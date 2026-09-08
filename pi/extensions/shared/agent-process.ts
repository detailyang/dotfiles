import { spawn, spawnSync } from "node:child_process";
import type { EventEmitter } from "node:events";
import { join } from "node:path";
import { StringDecoder } from "node:string_decoder";

export interface AgentProcessChild extends EventEmitter {
  pid?: number;
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin: EventEmitter & { write(value: string, encoding: BufferEncoding): unknown; end(): unknown };
  kill(signal?: NodeJS.Signals | number): boolean | void;
}

export type SpawnAgentProcess = (
  command: string, args: string[], options: { cwd?: string; detached: boolean },
) => AgentProcessChild;

export interface AgentProcessOptions {
  command: string;
  args: string[];
  cwd?: string;
  stdin?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  killGraceMs?: number;
}

export const MAX_JSON_LINE_CHARS = 8_000_000;
const MAX_STDERR_CHARS = 256_000;
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;

const spawnAgentProcess: SpawnAgentProcess = (command, args, options) => spawn(command, args, {
  ...options, shell: false, stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
});

function terminate(child: AgentProcessChild, signal: "SIGTERM" | "SIGKILL"): void {
  if (child.pid) {
    if (process.platform === "win32") {
      spawnSync(join(process.env.SystemRoot ?? "C:\\Windows", "System32", "taskkill.exe"),
        [...(signal === "SIGKILL" ? ["/F"] : []), "/T", "/PID", String(child.pid)],
        { stdio: "ignore", windowsHide: true, timeout: 5000 });
      return;
    }
    try {
      process.kill(-child.pid, signal);
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  }
  child.kill(signal);
}

function assistantText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content.filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text).join("");
}

/** Own the JSON-mode process until close, including cancellation and forced cleanup. */
export function runAgentProcess(
  options: AgentProcessOptions,
  onLine: (line: string) => void = () => {},
  spawnProcess: SpawnAgentProcess = spawnAgentProcess,
): Promise<{ finalText: string; stderr: string }> {
  if (options.signal?.aborted) return Promise.reject(new Error("Aborted"));
  return new Promise((resolve, reject) => {
    const child = spawnProcess(options.command, options.args, { cwd: options.cwd, detached: process.platform !== "win32" });
    const stdoutDecoder = new StringDecoder("utf8");
    const stderrDecoder = new StringDecoder("utf8");
    let stdout = "";
    let stderr = "";
    let failure: Error | undefined;
    let finalMessage: { stopReason?: string; errorMessage?: string; content?: unknown } | undefined;
    let protocolError: string | undefined;
    let killTimer: NodeJS.Timeout | undefined;
    let closed = false;

    const cancel = (error: Error) => {
      if (closed || failure) return;
      failure = error;
      // Install escalation before signalling: even a synchronous close must clear it.
      killTimer = setTimeout(() => {
        try { terminate(child, "SIGKILL"); } catch (killError) {
          failure = new Error(`${error.message}; failed to terminate process: ${String(killError)}`);
        }
      }, options.killGraceMs ?? 2000);
      try { terminate(child, "SIGTERM"); } catch { /* Escalation still owns cleanup. */ }
    };
    const onAbort = () => cancel(new Error("Aborted"));
    const timeout = setTimeout(() => cancel(new Error("Agent process timed out")), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    options.signal?.addEventListener("abort", onAbort, { once: true });

    const processLine = (line: string) => {
      if (failure || !line.trim()) return;
      if (line.length > MAX_JSON_LINE_CHARS) {
        cancel(new Error("Agent JSON line exceeded the output limit"));
        return;
      }
      let event;
      try { event = JSON.parse(line); } catch { /* Startup diagnostics can be non-JSON. */ }
      if (event?.type === "turn_start" || (event?.type === "message_start" && event.message?.role === "assistant")) {
        finalMessage = undefined;
      }
      if (event?.type === "message_end" && event.message?.role === "assistant") {
        finalMessage = event.message;
        protocolError = undefined;
      }
      if (event?.type === "error") {
        protocolError = typeof event.error === "string" ? event.error : "Agent reported an error";
      }
      try { onLine(line); } catch (error) {
        cancel(error instanceof Error ? error : new Error(String(error)));
      }
    };
    child.stdout.on("data", (chunk: Buffer) => {
      if (failure) return;
      stdout += stdoutDecoder.write(chunk);
      const lines = stdout.split("\n");
      stdout = lines.pop() ?? "";
      for (const line of lines) processLine(line);
      if (stdout.length > MAX_JSON_LINE_CHARS) cancel(new Error("Agent JSON line exceeded the output limit"));
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = (stderr + stderrDecoder.write(chunk)).slice(-MAX_STDERR_CHARS);
    });
    child.stdin.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code !== "EPIPE") cancel(error);
    });
    child.on("error", (error: Error) => cancel(error));
    child.on("close", (code: number | null, signal?: NodeJS.Signals) => {
      stdout += stdoutDecoder.end();
      stderr = (stderr + stderrDecoder.end()).slice(-MAX_STDERR_CHARS);
      processLine(stdout);
      closed = true;
      clearTimeout(timeout);
      clearTimeout(killTimer);
      options.signal?.removeEventListener("abort", onAbort);
      if (failure) {
        // A leader can exit before its children. Retire the owned group as well.
        try { terminate(child, "SIGKILL"); } catch { /* The group may already be gone. */ }
        reject(failure);
      } else if (code !== 0) {
        const reason = signal ? `signal ${signal}` : `code ${code}`;
        reject(new Error(`pi exited with ${reason}\n\nstderr:\n${stderr.trim().split("\n").slice(-30).join("\n") || "(no stderr)"}`));
      } else if (protocolError || finalMessage?.stopReason !== "stop") {
        reject(new Error(protocolError || finalMessage?.errorMessage || `Agent did not finish successfully (${finalMessage?.stopReason ?? "missing final response"})`));
      } else {
        const finalText = assistantText(finalMessage.content);
        if (!finalText.trim()) reject(new Error("Agent finished without a readable response"));
        else resolve({ finalText, stderr });
      }
    });
    // A cancellation can arrive between the initial check and listener registration.
    if (options.signal?.aborted) onAbort();
    if (!failure) {
      try {
        if (options.stdin !== undefined) child.stdin.write(options.stdin, "utf8");
        child.stdin.end();
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EPIPE") cancel(error instanceof Error ? error : new Error(String(error)));
      }
    }
  });
}

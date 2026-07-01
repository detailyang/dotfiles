import { spawn } from "node:child_process";
import type { EventEmitter } from "node:events";
import type { Writable } from "node:stream";

export type ReviewAgentEvent =
  | { type: "assistant"; text: string }
  | { type: "status"; text: string };

export interface ParallelReviewOptions {
  stdin?: string;
  cwd?: string;
  noTools?: boolean;
  noSkills?: boolean;
}

export interface ReviewAgentChild extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin: Pick<Writable, "write" | "end" | "on">;
  kill(signal?: NodeJS.Signals | number): boolean | void;
}

export type SpawnReviewAgent = (
  cmd: string,
  args: string[],
  options: { cwd?: string },
) => ReviewAgentChild;

const MAX_STDERR_CHARS = 256_000;
const TRUNCATED_MARKER = "\n\n[review output truncated by extension safety limit]";

function defaultSpawnReviewAgent(cmd: string, args: string[], options: { cwd?: string }): ReviewAgentChild {
  return spawn(cmd, args, {
    cwd: options.cwd,
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  }) as ReviewAgentChild;
}

function limitText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}${TRUNCATED_MARKER}`;
}

export function buildReviewAgentArgs(model: string, prompt: string, options: ParallelReviewOptions): string[] {
  const args = ["--mode", "json", "-p", "--no-session"];
  if (options.noTools) args.push("--no-tools");
  if (options.noSkills) args.push("--no-skills");
  args.push("--model", model, prompt);
  return args;
}

export function runReviewAgentProcess(
  model: string,
  prompt: string,
  options: ParallelReviewOptions,
  onEvent: (event: ReviewAgentEvent) => void,
  signal: AbortSignal,
  parseLine: (line: string) => ReviewAgentEvent | null,
  spawnReviewAgent: SpawnReviewAgent = defaultSpawnReviewAgent,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let stderr = "";
    let stdoutBuffer = "";
    let settled = false;
    const child = spawnReviewAgent("pi", buildReviewAgentArgs(model, prompt, options), {
      cwd: options.cwd,
    });

    const settleReject = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const settleResolve = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const onAbort = () => {
      child.kill("SIGTERM");
      settleReject(new Error("Aborted"));
    };
    signal.addEventListener("abort", onAbort);
    child.on("close", () => signal.removeEventListener("abort", onAbort));

    const processLine = (line: string) => {
      const event = parseLine(line);
      if (event) onEvent(event);
    };

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuffer += chunk.toString("utf8");
      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() ?? "";
      for (const line of lines) processLine(line);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = limitText(stderr + chunk.toString("utf8"), MAX_STDERR_CHARS);
    });

    child.stdin.on("error", (err: any) => {
      if (err?.code !== "EPIPE") {
        const error = err instanceof Error ? err : new Error(String(err));
        child.kill("SIGTERM");
        settleReject(error);
      }
    });

    child.on("error", (error) => settleReject(error instanceof Error ? error : new Error(String(error))));
    child.on("close", (code) => {
      if (stdoutBuffer.trim()) processLine(stdoutBuffer);
      if (code === 0 || code === null) {
        settleResolve();
        return;
      }

      const stderrText = stderr.trim() || "(no stderr)";
      const stderrTail = stderrText.split("\n").slice(-30).join("\n");
      settleReject(new Error(`pi exited with code ${code}\n\nstderr:\n${stderrTail}`));
    });

    try {
      if (options.stdin !== undefined) {
        child.stdin.write(options.stdin, "utf8");
      }
      child.stdin.end();
    } catch (err: any) {
      if (err?.code !== "EPIPE") {
        settleReject(err instanceof Error ? err : new Error(String(err)));
      }
    }
  });
}

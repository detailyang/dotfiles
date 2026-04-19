/**
 * Commit extension - creates git commits in an isolated sub-process.
 *
 * Spawns a separate `pi` process with --no-session so all git diff/log/status
 * context stays out of the main session context window.
 *
 * Usage:
 *   /commit                          - commit all current changes
 *   /commit fix the auth bug         - extra guidance for message
 *   /commit src/auth.ts              - commit only that file
 *   /commit src/auth.ts fix auth bug - file + guidance
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const SPINNER_FRAMES = ["|", "/", "-", "\\"];
const SPINNER_INTERVAL_MS = 100;

const COMMIT_SYSTEM_PROMPT = `Create a git commit for the current changes using a concise Conventional Commits-style subject.

Format: <type>(<scope>): <summary>
- type REQUIRED: feat | fix | docs | refactor | chore | test | perf
- scope OPTIONAL: short noun for affected area
- summary REQUIRED: imperative, <= 72 chars, no trailing period
- body OPTIONAL: blank line after subject, short paragraphs

Rules:
- No breaking-change markers, no footers, no sign-offs
- Only commit; do NOT push
- Treat caller-provided arguments as additional commit guidance:
  file paths/globs limit which files to stage; freeform text influences the message

Steps:
1. git status + git diff (limit to specified files if provided)
2. git log -n 50 --pretty=format:%s to see common scopes
3. Stage intended files
4. git commit -m "<subject>"`;

function truncate(text: string, max = 160): string {
  const value = text.replace(/\s+/g, " ").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  const parts: string[] = [];
  for (const part of content) {
    if (part && typeof part === "object" && "type" in part && "text" in part && (part as { type?: string }).type === "text") {
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") parts.push(text);
    }
  }
  return parts.join("");
}

function summarizeEvent(event: any): string | null {
  switch (event?.type) {
    case "error":
      return truncate(typeof event.error === "string" ? event.error : JSON.stringify(event.error), 200) || "subagent error";
    default:
      return null;
  }
}

function getPiInvocation(args: string[]): { command: string; args: string[] } {
  const script = process.argv[1];
  if (script && !script.startsWith("/$bunfs/root/") && fs.existsSync(script)) {
    return { command: process.execPath, args: [script, ...args] };
  }
  if (!/^(node|bun)(\.exe)?$/.test(path.basename(process.execPath).toLowerCase())) {
    return { command: process.execPath, args };
  }
  return { command: "pi", args };
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("commit", {
    description: "Create a git commit in an isolated context (no context pollution)",
    handler: async (args, ctx) => {
      let spinnerIndex = 0;
      let spinnerTimer: NodeJS.Timeout | undefined;
      let failureMessage = "";
      const renderProgress = () => {
        const frame = SPINNER_FRAMES[spinnerIndex % SPINNER_FRAMES.length];
        const text = `committing ${frame}`;
        if (ctx.hasUI) {
          ctx.ui.setStatus("commit", text);
          ctx.ui.setWidget("commit", [text]);
        }
      };
      const advanceProgress = () => {
        spinnerIndex += 1;
        renderProgress();
      };

      const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "pi-commit-"));
      const promptFile = path.join(tmpDir, "prompt.md");
      await fs.promises.writeFile(promptFile, COMMIT_SYSTEM_PROMPT, { encoding: "utf-8", mode: 0o600 });

      const task = args?.trim()
        ? `Create a git commit. Additional guidance: ${args}`
        : "Create a git commit for the current changes.";

      const piArgs = ["--mode", "json", "-p", "--no-session", "--append-system-prompt", promptFile, task];

      renderProgress();
      spinnerTimer = setInterval(advanceProgress, SPINNER_INTERVAL_MS);

      try {
        const invocation = getPiInvocation(piArgs);
        let finalText = "";
        let buffer = "";
        let stderrBuffer = "";

        const exitCode = await new Promise<number>((resolve) => {
          const proc = spawn(invocation.command, invocation.args, {
            cwd: ctx.cwd,
            shell: false,
            stdio: ["ignore", "pipe", "pipe"],
          });

          proc.stdout.on("data", (data: Buffer) => {
            buffer += data.toString();
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const event = JSON.parse(line);
                const summary = summarizeEvent(event);
                if (summary) failureMessage = summary;
                if (event.type === "message_end" && event.message?.role === "assistant") {
                  finalText = extractText(event.message.content);
                }
              } catch {}
            }
          });

          proc.stderr.on("data", (data: Buffer) => {
            stderrBuffer += data.toString();
            const lines = stderrBuffer.split("\n");
            stderrBuffer = lines.pop() ?? "";
            for (const line of lines) {
              const text = line.trim();
              if (!text) continue;
              failureMessage = `stderr: ${text}`;
            }
          });

          proc.on("close", (code: number | null) => {
            const trailingStdout = buffer.trim();
            if (trailingStdout) {
              try {
                const event = JSON.parse(trailingStdout);
                const summary = summarizeEvent(event);
                if (summary) failureMessage = summary;
                if (event.type === "message_end" && event.message?.role === "assistant") {
                  finalText = extractText(event.message.content);
                }
              } catch {}
            }

            const trailingStderr = stderrBuffer.trim();
            if (trailingStderr) failureMessage = `stderr: ${trailingStderr}`;

            resolve(code ?? 0);
          });
          proc.on("error", () => resolve(1));
        });

        if (exitCode !== 0) {
          ctx.ui.notify(failureMessage || "Commit failed", "error");
        } else {
          ctx.ui.notify(finalText.trim() || "Commit completed", "success");
        }
      } finally {
        if (spinnerTimer) clearInterval(spinnerTimer);
        ctx.ui.setStatus("commit", "");
        if (ctx.hasUI) ctx.ui.setWidget("commit", undefined);
        try { fs.unlinkSync(promptFile); } catch {}
        try { fs.rmdirSync(tmpDir); } catch {}
      }
    },
  });
}

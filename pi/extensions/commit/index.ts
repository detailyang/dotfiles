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
      const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "pi-commit-"));
      const promptFile = path.join(tmpDir, "prompt.md");
      await fs.promises.writeFile(promptFile, COMMIT_SYSTEM_PROMPT, { encoding: "utf-8", mode: 0o600 });

      const task = args?.trim()
        ? `Create a git commit. Additional guidance: ${args}`
        : "Create a git commit for the current changes.";

      const piArgs = ["--mode", "json", "-p", "--no-session", "--append-system-prompt", promptFile, task];

      ctx.ui.setStatus("commit", "committing...");

      try {
        const invocation = getPiInvocation(piArgs);
        let finalText = "";
        let buffer = "";

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
                if (event.type === "message_end" && event.message?.role === "assistant") {
                  for (const part of event.message.content ?? []) {
                    if (part.type === "text") finalText = part.text;
                  }
                }
              } catch {}
            }
          });

          proc.on("close", (code: number | null) => resolve(code ?? 0));
          proc.on("error", () => resolve(1));
        });

        if (exitCode !== 0) {
          ctx.ui.notify("Commit failed", "error");
        } else {
          ctx.ui.notify(finalText.trim() || "Commit completed", "success");
        }
      } finally {
        ctx.ui.setStatus("commit", "");
        try { fs.unlinkSync(promptFile); } catch {}
        try { fs.rmdirSync(tmpDir); } catch {}
      }
    },
  });
}

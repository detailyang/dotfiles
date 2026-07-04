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

import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { type Component, type TUI, visibleWidth } from "@earendil-works/pi-tui";

const SPINNER_FRAMES = ["|", "/", "-", "\\"];
const SPINNER_INTERVAL_MS = 100;

const COMMIT_SYSTEM_PROMPT = `Create a git commit for the current changes using Conventional Commits 1.0.0.

Required format:
<type>[optional scope][optional !]: <description>

[optional body]

[optional footer(s)]

Header rules:
- type REQUIRED: use a lowercase noun such as feat, fix, docs, style, refactor, perf, test, build, ci, chore, or revert
- scope OPTIONAL: short lowercase noun in parentheses, e.g. feat(auth): add login
- ! OPTIONAL: use immediately before the colon only for breaking changes
- description REQUIRED: imperative mood, concise, no trailing period

Body rules:
- OPTIONAL: add only when it clarifies why/what changed beyond the header
- Separate from the header with exactly one blank line

Footer rules:
- OPTIONAL: add only for issue references, metadata, or breaking changes
- Separate from the body, or from the header when no body exists, with exactly one blank line
- Use git trailer format: <token>: <value> or <token> #<value>
- For breaking changes, include a BREAKING CHANGE: <description> footer, or use ! in the header when the header is self-explanatory

Rules:
- Every commit message MUST match Conventional Commits 1.0.0
- Do not add sign-offs unless already required by repository history
- Only commit; do NOT push
- Treat caller-provided arguments as additional commit guidance:
  file paths/globs limit which files to stage; freeform text influences the message

Steps:
1. git status + git diff (limit to specified files if provided)
2. git log -n 50 --pretty=format:%s to see common scopes and type style
3. Stage intended files
4. Create one compliant commit; use multiple git commit -m arguments when body or footer is needed`;

interface CommitModelReference {
  provider?: unknown;
  id?: unknown;
}

interface CommitAgentArgsOptions {
  promptFile: string;
  task: string;
  model?: CommitModelReference;
  thinkingLevel?: string;
  approveProject?: boolean;
}

interface CommitOutcomeInput {
  exitCode: number;
  beforeHead: string | undefined;
  afterHead: string | undefined;
  finalText: string;
  failureMessage: string;
}

interface CommitOutcome {
  type: "info" | "error";
  message: string;
}

function truncate(text: string, max = 160): string {
  const value = text.replace(/\s+/g, " ").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

export function getModelArgument(model: CommitModelReference | undefined): string | undefined {
  if (!model || typeof model.provider !== "string" || typeof model.id !== "string") return undefined;
  if (!model.provider || !model.id) return undefined;
  return `${model.provider}/${model.id}`;
}

export function buildCommitAgentArgs(options: CommitAgentArgsOptions): string[] {
  const args = [
    "--mode",
    "json",
    "--no-session",
    options.approveProject ? "--approve" : "--no-approve",
    "--append-system-prompt",
    options.promptFile,
  ];

  const model = getModelArgument(options.model);
  if (model) args.push("--model", model);
  if (options.thinkingLevel) args.push("--thinking", options.thinkingLevel);

  args.push("-p", options.task);
  return args;
}

export function getCommitOutcome(input: CommitOutcomeInput): CommitOutcome {
  if (input.exitCode !== 0) {
    return { type: "error", message: input.failureMessage || "Commit failed" };
  }

  if (!input.afterHead || input.beforeHead === input.afterHead) {
    if (input.failureMessage) {
      return {
        type: "error",
        message: `Commit agent did not create a commit: ${input.failureMessage}`,
      };
    }

    return {
      type: "error",
      message: "Commit agent exited successfully, but no new git commit was created.",
    };
  }

  const message = input.finalText.trim() || `Commit completed (${input.afterHead.slice(0, 7)})`;
  return { type: "info", message };
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
    case "message_end":
      if (event.message?.role === "assistant" && event.message.stopReason === "error") {
        return `assistant error: ${truncate(event.message.errorMessage || "unknown error", 200)}`;
      }
      return null;
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

async function getGitHead(cwd: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    let stdout = "";
    const proc = spawn("git", ["rev-parse", "--verify", "HEAD"], {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "ignore"],
    });

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString("utf8");
    });
    proc.on("error", () => resolve(undefined));
    proc.on("close", (code: number | null) => {
      resolve(code === 0 ? stdout.trim() || undefined : undefined);
    });
  });
}

function reportCommitOutcome(
  ctx: { mode: string; ui: { notify(message: string, type?: "info" | "warning" | "error"): void } },
  outcome: CommitOutcome,
): void {
  if (ctx.mode === "tui" || ctx.mode === "rpc") {
    ctx.ui.notify(outcome.message, outcome.type);
    return;
  }

  if (outcome.type === "error") {
    console.error(outcome.message);
  } else if (ctx.mode === "print") {
    console.log(outcome.message);
  } else {
    console.error(outcome.message);
  }
}

class CommitProgressComponent implements Component {
  private frameIndex = 0;
  private timer: NodeJS.Timeout;
  private readonly tui: TUI;
  private readonly theme: Theme;

  constructor(tui: TUI, theme: Theme) {
    this.tui = tui;
    this.theme = theme;
    this.timer = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % SPINNER_FRAMES.length;
      this.tui.requestRender();
    }, SPINNER_INTERVAL_MS);
  }

  handleInput(_data: string): void {
    // Swallow input while the isolated commit agent is running.
  }

  invalidate(): void {
    // No cached state.
  }

  dispose(): void {
    clearInterval(this.timer);
  }

  render(width: number): string[] {
    const frame = SPINNER_FRAMES[this.frameIndex] ?? SPINNER_FRAMES[0];
    const text = this.theme.fg("accent", `thinking ${frame}`);
    const padding = Math.max(0, Math.floor((width - visibleWidth(text)) / 2));
    return ["", `${" ".repeat(padding)}${text}`, ""];
  }
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("commit", {
    description: "Create a git commit in an isolated context (no context pollution)",
    handler: async (args, ctx) => {
      let failureMessage = "";

      const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "pi-commit-"));
      const promptFile = path.join(tmpDir, "prompt.md");
      await fs.promises.writeFile(promptFile, COMMIT_SYSTEM_PROMPT, { encoding: "utf-8", mode: 0o600 });

      const task = args?.trim()
        ? `Create a git commit. Additional guidance: ${args}`
        : "Create a git commit for the current changes.";

      const beforeHead = await getGitHead(ctx.cwd);
      const piArgs = buildCommitAgentArgs({
        promptFile,
        task,
        model: ctx.model,
        thinkingLevel: pi.getThinkingLevel(),
        approveProject: ctx.isProjectTrusted(),
      });
      let closeProgress: (() => void) | undefined;
      const progressPromise = ctx.mode === "tui"
        ? ctx.ui.custom<void>((tui, theme, _keybindings, done) => {
            closeProgress = done;
            return new CommitProgressComponent(tui, theme);
          })
        : Promise.resolve();

      try {
        const invocation = getPiInvocation(piArgs);
        let finalText = "";
        let buffer = "";
        let stderrText = "";

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
            const text = data.toString();
            stderrText += text;
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

            const trailingStderr = stderrText.trim();
            if (trailingStderr) {
              const stderrTail = trailingStderr.split("\n").filter((line) => line.trim()).slice(-8).join("\n");
              failureMessage = `stderr: ${stderrTail}`;
            }

            resolve(code ?? 0);
          });
          proc.on("error", () => resolve(1));
        });

        const afterHead = exitCode === 0 ? await getGitHead(ctx.cwd) : beforeHead;
        const outcome = getCommitOutcome({ exitCode, beforeHead, afterHead, finalText, failureMessage });
        reportCommitOutcome(ctx, outcome);
      } finally {
        closeProgress?.();
        await progressPromise;
        try { fs.unlinkSync(promptFile); } catch {}
        try { fs.rmdirSync(tmpDir); } catch {}
      }
    },
  });
}

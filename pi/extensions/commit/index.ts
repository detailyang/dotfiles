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
import { type Component, type TUI, matchesKey, visibleWidth } from "@earendil-works/pi-tui";
import { runAgentProcess } from "../shared/agent-process.ts";

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
    const changed = input.afterHead && input.beforeHead !== input.afterHead
      ? ` HEAD changed to ${input.afterHead.slice(0, 12)}; inspect the commit and index before retrying.`
      : " Inspect the index before retrying; staging may already have changed.";
    return { type: "error", message: (input.failureMessage || "Commit failed") + changed };
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
      timeout: 10_000,
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

export class CommitProgressComponent implements Component {
  private frameIndex = 0;
  private timer: NodeJS.Timeout;
  private readonly tui: TUI;
  private readonly theme: Theme;

  private cancelled = false;
  private readonly cancel: () => void;

  constructor(tui: TUI, theme: Theme, cancel: () => void) {
    this.cancel = cancel;
    this.tui = tui;
    this.theme = theme;
    this.timer = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % SPINNER_FRAMES.length;
      this.tui.requestRender();
    }, SPINNER_INTERVAL_MS);
  }

  handleInput(data: string): void {
    if (!this.cancelled && (matchesKey(data, "escape") || matchesKey(data, "ctrl+c"))) {
      this.cancelled = true;
      this.cancel();
      this.tui.requestRender();
    }
  }

  invalidate(): void {
    // No cached state.
  }

  dispose(): void {
    clearInterval(this.timer);
  }

  render(width: number): string[] {
    const frame = SPINNER_FRAMES[this.frameIndex] ?? SPINNER_FRAMES[0];
    const text = this.theme.fg("accent", this.cancelled ? `Cancelling ${frame}` : `thinking ${frame}`);
    const padding = Math.max(0, Math.floor((width - visibleWidth(text)) / 2));
    return ["", `${" ".repeat(padding)}${text}`, ""];
  }
}

export function registerCommitExtension(
  pi: ExtensionAPI,
  dependencies = { runAgentProcess, getGitHead },
): void {
  let inFlight: Promise<void> | undefined;
  let controller: AbortController | undefined;
  let shuttingDown = false;
  pi.on("session_shutdown", async () => {
    shuttingDown = true;
    controller?.abort();
    await inFlight;
  });

  pi.registerCommand("commit", {
    description: "Create a git commit in an isolated context (no context pollution)",
    handler: async (args, ctx) => {
      if (inFlight || !ctx.isIdle()) {
        ctx.ui.notify("Wait for the current operation before starting a commit.", "warning");
        return;
      }
      if (shuttingDown) return;
      controller = new AbortController();
      const signal = ctx.signal ? AbortSignal.any([controller.signal, ctx.signal]) : controller.signal;
      const run = async () => {
        let tmpDir: string | undefined;
        let closeProgress: (() => void) | undefined;
        let progressFinished = false;
        let progressPromise = Promise.resolve();
        let beforeHead: string | undefined;
        let finalText = "";
        let failureMessage = "";
        try {
          tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "pi-commit-"));
          const promptFile = path.join(tmpDir, "prompt.md");
          await fs.promises.writeFile(promptFile, COMMIT_SYSTEM_PROMPT, { encoding: "utf-8", mode: 0o600 });
          beforeHead = await dependencies.getGitHead(ctx.cwd);
          const task = args?.trim()
            ? `Create a git commit. Additional guidance: ${args}`
            : "Create a git commit for the current changes.";
          const invocation = getPiInvocation(buildCommitAgentArgs({
            promptFile, task, model: ctx.model, thinkingLevel: pi.getThinkingLevel(),
            approveProject: ctx.isProjectTrusted(),
          }));
          if (signal.aborted) throw new Error("Aborted");
          if (ctx.mode === "tui") {
            progressPromise = ctx.ui.custom<void>((tui, theme, _keybindings, done) => {
              closeProgress = done;
              const component = new CommitProgressComponent(tui, theme, () => controller?.abort());
              if (progressFinished) done(undefined);
              return component;
            }).catch((error) => {
              failureMessage = String(error);
              controller?.abort();
            });
          }
          const result = await dependencies.runAgentProcess({
            ...invocation, cwd: ctx.cwd, signal,
          });
          finalText = result.finalText;
        } catch (error) {
          failureMessage ||= error instanceof Error ? error.message : String(error);
        } finally {
          progressFinished = true;
          closeProgress?.();
          await progressPromise;
          if (tmpDir) await fs.promises.rm(tmpDir, { recursive: true, force: true });
        }
        if (!shuttingDown) {
          const afterHead = await dependencies.getGitHead(ctx.cwd);
          if (shuttingDown) return;
          reportCommitOutcome(ctx, getCommitOutcome({
            exitCode: failureMessage ? 1 : 0, beforeHead, afterHead, finalText, failureMessage,
          }));
        }
      };
      inFlight = run();
      try {
        await inFlight;
      } finally {
        inFlight = undefined;
        controller = undefined;
      }
    },
  });
}

export default function commitExtension(pi: ExtensionAPI): void {
  registerCommitExtension(pi);
}

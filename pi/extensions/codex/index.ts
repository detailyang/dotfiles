/**
 * codex — resume Codex sessions inside pi
 *
 * Usage:
 *   /codex           Pick action → pick session → continue in pi
 *
 * Actions:
 *   resume   Filter sessions by current cwd (mirrors `codex resume`)
 *   browse   List all sessions across all directories
 *
 * After selecting a session, the full conversation context is injected
 * into a new pi session — no LLM summarization, no context loss.
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import { Container, type SelectItem, SelectList, Text } from "@earendil-works/pi-tui";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import { parseCodexJsonlMetadata, parseCodexJsonlTranscript, type ParsedCodexTranscript } from "../shared/transcript.js";

// ── Types ──────────────────────────────────────────────────────────────

interface SessionInfo {
  id: string;
  path: string;
  cwd?: string;
  /** First real user message (skipping environment_context, turn_aborted, etc.) */
  firstMessage: string;
  startedAt?: string;
  mtimeMs: number;
  /** Number of user messages in the session */
  turnCount: number;
}

// ── Codex Session Discovery ────────────────────────────────────────────

function listCodexSessions(cwd?: string): SessionInfo[] {
  const root = join(homedir(), ".codex", "sessions");
  if (!existsSync(root)) return [];

  const all: SessionInfo[] = [];
  function walk(dir: string) {
    let entries: string[];
    try { entries = readdirSync(dir); } catch (err: unknown) {
      if (!(err instanceof Error && (err as NodeJS.ErrnoException).code === "ENOENT")) {
        console.warn(`codex: failed to read directory ${dir}:`, err instanceof Error ? err.message : err);
      }
      return;
    }
    for (const name of entries) {
      const full = join(dir, name);
      let st: ReturnType<typeof statSync>;
      try { st = statSync(full); } catch (err: unknown) {
        if (!(err instanceof Error && (err as NodeJS.ErrnoException).code === "ENOENT")) {
          console.warn(`codex: failed to stat ${full}:`, err instanceof Error ? err.message : err);
        }
        continue;
      }
      if (st.isDirectory()) walk(full);
      else if (name.endsWith(".jsonl")) {
        const info = parseCodexMeta(full, st.mtimeMs);
        if (info) all.push(info);
      }
    }
  }
  walk(root);

  // Filter by cwd if provided
  const results = cwd
    ? all.filter((s) => s.cwd === cwd)
    : all;

  results.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return results;
}

function parseCodexMeta(filePath: string, mtimeMs: number): SessionInfo | null {
  const lines = readFileSync(filePath, "utf-8").split("\n");
  const meta = parseCodexJsonlMetadata(lines);

  if (!meta) return null;
  return {
    id: meta.id,
    path: filePath,
    cwd: meta.cwd,
    firstMessage: meta.firstMessage,
    startedAt: meta.startedAt,
    mtimeMs,
    turnCount: meta.turnCount,
  };
}

// ── Codex Session Parser ───────────────────────────────────────────────

function parseCodexSession(filePath: string): ParsedCodexTranscript {
  const lines = readFileSync(filePath, "utf-8").split("\n");
  return parseCodexJsonlTranscript(lines, basename(filePath), (message) => {
    console.warn(`codex: ${message} in ${filePath}`);
  });
}

// ── TUI: Action Selector ───────────────────────────────────────────────

async function selectAction(ctx: ExtensionCommandContext, cwd: string): Promise<string | null> {
  const shortCwd = cwd.replace(homedir(), "~");
  const items: SelectItem[] = [
    {
      value: "resume",
      label: "Resume",
      description: `Sessions in ${shortCwd}`,
    },
    {
      value: "browse",
      label: "Browse all",
      description: "Sessions across all directories",
    },
  ];

  return ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
    const container = new Container();
    container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
    container.addChild(new Text(theme.fg("accent", theme.bold("Codex")), 1, 0));

    const selectList = new SelectList(items, 5, {
      selectedPrefix: (t: string) => theme.fg("accent", t),
      selectedText: (t: string) => theme.fg("accent", t),
      description: (t: string) => theme.fg("muted", t),
      scrollInfo: (t: string) => theme.fg("dim", t),
      noMatch: (t: string) => theme.fg("warning", t),
    });
    selectList.onSelect = (item: SelectItem) => done(item.value as string);
    selectList.onCancel = () => done(null);
    container.addChild(selectList);

    container.addChild(new Text(theme.fg("dim", "↑↓ navigate · enter select · esc cancel"), 1, 0));
    container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

    return {
      render: (w: number) => container.render(w),
      invalidate: () => container.invalidate(),
      handleInput: (data: string) => { selectList.handleInput(data); tui.requestRender(); },
    };
  });
}

// ── TUI: Session Selector ──────────────────────────────────────────────

function relativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

async function selectSession(ctx: ExtensionCommandContext, sessions: SessionInfo[]): Promise<string | null> {
  const items: SelectItem[] = sessions.slice(0, 50).map((s) => {
    const created = s.startedAt
      ? relativeTime(new Date(s.startedAt))
      : relativeTime(new Date(s.mtimeMs));
    const updated = relativeTime(new Date(s.mtimeMs));
    return {
      value: s.path,
      label: s.firstMessage,
      description: `${created} · updated ${updated} · ${s.turnCount} turns`,
    };
  });

  return ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
    const container = new Container();
    container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
    container.addChild(new Text(theme.fg("accent", theme.bold("Select Codex Session")), 1, 0));
    container.addChild(new Text(theme.fg("dim", `${sessions.length} session(s)`), 1, 0));

    const selectList = new SelectList(items, Math.min(items.length, 15), {
      selectedPrefix: (t: string) => theme.fg("accent", t),
      selectedText: (t: string) => theme.fg("accent", t),
      description: (t: string) => theme.fg("muted", t),
      scrollInfo: (t: string) => theme.fg("dim", t),
      noMatch: (t: string) => theme.fg("warning", t),
    });
    selectList.onSelect = (item: SelectItem) => done(item.value as string);
    selectList.onCancel = () => done(null);
    container.addChild(selectList);

    container.addChild(new Text(theme.fg("dim", "↑↓ navigate · type to filter · enter select · esc cancel"), 1, 0));
    container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

    return {
      render: (w: number) => container.render(w),
      invalidate: () => container.invalidate(),
      handleInput: (data: string) => { selectList.handleInput(data); tui.requestRender(); },
    };
  });
}

// ── Extension ──────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  pi.registerCommand("codex", {
    description: "Resume a Codex session in pi",

    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("codex requires interactive TUI mode", "error");
        return;
      }

      // ── Step 1: Pick action ────────────────────────────────────────
      const action = await selectAction(ctx, ctx.cwd);
      if (!action) {
        ctx.ui.notify("Cancelled", "info");
        return;
      }

      // ── Step 2: Pick session ───────────────────────────────────────
      const filterCwd = action === "resume" ? ctx.cwd : undefined;
      const sessions = listCodexSessions(filterCwd);

      if (sessions.length === 0) {
        if (action === "resume") {
          const shortCwd = ctx.cwd.replace(homedir(), "~");
          ctx.ui.notify(`No Codex sessions found in ${shortCwd}`, "warning");
        } else {
          ctx.ui.notify("No Codex sessions found", "error");
        }
        return;
      }

      const sessionPath = await selectSession(ctx, sessions);
      if (!sessionPath) {
        ctx.ui.notify("Cancelled", "info");
        return;
      }

      // ── Step 3: Parse session ──────────────────────────────────────
      ctx.ui.notify("Parsing session...", "info");

      let parsed: ParsedCodexTranscript;
      try {
        parsed = parseCodexSession(sessionPath);
      } catch (err: unknown) {
        ctx.ui.notify(`Failed to parse session: ${err instanceof Error ? err.message : String(err)}`, "error");
        return;
      }

      if (!parsed.fullText.trim()) {
        ctx.ui.notify("Session contains no readable conversation", "error");
        return;
      }

      ctx.ui.notify(`Parsed ${parsed.entryCount} entries (${parsed.turns.length} turns)`, "info");

      // ── Step 4: Create new pi session with full context ────────────
      const currentSessionFile = ctx.sessionManager.getSessionFile();

      const newSessionResult = await ctx.newSession({
        parentSession: currentSessionFile,
        setup: async (sm) => {
          // Inject full conversation as a single user message
          // This preserves all context without lossy summarization
          const cwdInfo = parsed.cwd ? `\nWorking directory: ${parsed.cwd}` : "";
          sm.appendMessage({
            role: "user",
            content: [{
              type: "text",
              text: `I'm resuming a Codex session (id: ${parsed.sessionId}${cwdInfo}). Here is the full conversation context:\n\n${parsed.fullText}`,
            }],
            timestamp: Date.now(),
          });
        },
      });

      if (newSessionResult.cancelled) {
        ctx.ui.notify("New session cancelled", "info");
        return;
      }

      // ── Step 5: Set session name and continuation prompt ───────────
      pi.setSessionName(`Codex: ${parsed.sessionId.slice(0, 12)}...`);
      ctx.ui.setEditorText("Continue from where the previous Codex conversation left off.");
      ctx.ui.notify(
        `Resumed Codex session (${parsed.turns.length} turns). Submit to continue.`,
        "info",
      );
    },
  });
}

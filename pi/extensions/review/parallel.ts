import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { DynamicBorder, getAgentDir } from "@earendil-works/pi-coding-agent";
import { Container, type SelectItem, Text, Spacer } from "@earendil-works/pi-tui";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { matchesKey, Key, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReviewPane {
  model: string;
  lines: string[];
  finalText: string;
  status: string;
  done: boolean;
  error: boolean;
}

export interface ParallelReviewResult {
  model: string;
  text: string;
  error: boolean;
}

export interface ParallelReviewOptions {
  stdin?: string;
  cwd?: string;
  noTools?: boolean;
  noSkills?: boolean;
}

interface Prefs {
  lastSelected: string[];
}

type ReviewStreamEvent =
  | { type: "assistant"; text: string }
  | { type: "status"; text: string };

// ─── Preferences (persist last selection) ────────────────────────────────────

const PREFS_PATH = join(getAgentDir(), "extension-state", "review.json");

function loadPrefs(): Prefs {
  try {
    return JSON.parse(readFileSync(PREFS_PATH, "utf8")) as Prefs;
  } catch {
    return { lastSelected: [] };
  }
}

function savePrefs(prefs: Prefs): void {
  try {
    mkdirSync(dirname(PREFS_PATH), { recursive: true });
    writeFileSync(PREFS_PATH, JSON.stringify(prefs, null, 2), "utf8");
  } catch {
    // Non-fatal — best-effort persistence
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatParallelReviewResults(results: ParallelReviewResult[]): string {
  return results
    .map((result) => {
      const status = result.error ? "Error / aborted" : "Complete";
      const body = result.text || "(no output)";
      return `### ${result.model} - ${status}\n\n${body}`;
    })
    .join("\n\n---\n\n");
}

function buildReviewPayload(ctx: ExtensionCommandContext): { reviewPrompt: string; conversationContext: string } {
  const entries = ctx.sessionManager.getBranch();
  const msgLines: string[] = [];

  for (const entry of entries) {
    if (entry.type !== "message") continue;
    const msg = entry.message;
    if (msg.role === "user") {
      const text =
        typeof msg.content === "string"
          ? msg.content
          : msg.content
              .filter((c: any) => c.type === "text")
              .map((c: any) => c.text)
              .join("\n");
      msgLines.push(`USER:\n${text}\n`);
    } else if (msg.role === "assistant") {
      const text = (Array.isArray(msg.content) ? msg.content : [])
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("\n");
      if (text.trim()) msgLines.push(`ASSISTANT:\n${text}\n`);
    }
  }

  const conversationContext = [
    "--- CONVERSATION TO REVIEW ---",
    "",
    ...msgLines,
    "--- END OF CONVERSATION ---",
  ].join("\n");

  const reviewPrompt = [
    "You are a brutally critical senior engineer and domain expert doing an adversarial peer review.",
    "Your job is NOT to be helpful or encouraging. Your job is to find every flaw.",
    "",
    "The conversation above has been submitted for review. Tear it apart:",
    "",
    "1. FACTUAL ERRORS — List every incorrect claim, outdated assumption, or hallucination.",
    "   Be specific: quote the exact passage and explain why it is wrong.",
    "",
    "2. LOGICAL FLAWS — Identify circular reasoning, non-sequiturs, missing steps,",
    "   false dichotomies, or conclusions that don\'t follow from the evidence.",
    "",
    "3. OMISSIONS & BLIND SPOTS — What critical considerations, edge cases, failure modes,",
    "   security implications, or alternative approaches were completely ignored?",
    "",
    "4. QUALITY OF REASONING — Is the assistant\'s thinking shallow, overconfident, or sloppy?",
    "   Does it cargo-cult buzzwords without understanding? Does it give vague non-answers?",
    "",
    "5. CONCRETE VERDICT — End with a one-line verdict: PASS / NEEDS WORK / FAIL,",
    "   and the single most important thing that must be fixed.",
    "",
    "Do NOT soften your language. Do NOT praise anything unless it is genuinely exceptional.",
    "If the conversation is good, say so only after exhausting every possible criticism.",
    "Be specific, be ruthless, be correct.",
  ].join("\n");

  return { reviewPrompt, conversationContext };
}

function extractMessageText(message: any): string {
  const content = message?.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .filter((part: any) => part?.type === "text" && typeof part.text === "string")
    .map((part: any) => part.text)
    .join("\n")
    .trim();
}

function compactOneLine(text: string, maxWidth = 120): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxWidth) return oneLine;
  return `${oneLine.slice(0, maxWidth - 1)}…`;
}

function extractToolText(value: any): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return extractToolText(JSON.parse(trimmed));
      } catch {
        // Fall through to compact raw text.
      }
    }

    return compactOneLine(trimmed);
  }

  const content = value.content;
  if (typeof content === "string") return compactOneLine(content);
  if (Array.isArray(content)) {
    const text = content
      .filter((part: any) => part?.type === "text" && typeof part.text === "string")
      .map((part: any) => part.text)
      .join("\n")
      .trim();
    return compactOneLine(text);
  }

  if (typeof value.text === "string") return compactOneLine(value.text);
  if (typeof value.output === "string") return compactOneLine(value.output);
  if (typeof value.stdout === "string") return compactOneLine(value.stdout);
  if (typeof value.stderr === "string") return compactOneLine(value.stderr);

  return "";
}

function summarizeToolActivity(toolName: string, args: any): string {
  if (toolName === "bash") {
    const command = typeof args?.command === "string" ? args.command : "";
    return command ? `running: ${compactOneLine(command)}` : "running command";
  }

  if (toolName === "read") {
    const file =
      typeof args?.path === "string"
        ? args.path
        : typeof args?.filePath === "string"
        ? args.filePath
        : "";
    return file ? `reading ${compactOneLine(file)}` : "reading file";
  }

  if (toolName === "grep") {
    const pattern =
      typeof args?.pattern === "string"
        ? args.pattern
        : typeof args?.query === "string"
        ? args.query
        : "";
    return pattern ? `searching ${compactOneLine(pattern)}` : "searching";
  }

  if (toolName === "find" || toolName === "ls") {
    const path = typeof args?.path === "string" ? args.path : "";
    return path ? `${toolName} ${compactOneLine(path)}` : toolName;
  }

  return toolName;
}

function padVisible(line: string, width: number): string {
  const truncated = truncateToWidth(line, width, "");
  return truncated + " ".repeat(Math.max(0, width - visibleWidth(truncated)));
}

function wrapBodyLines(lines: string[], width: number): string[] {
  const contentWidth = Math.max(1, width - 1);
  const wrapped: string[] = [];

  for (const line of lines) {
    if (!line) {
      wrapped.push("");
      continue;
    }

    const parts = wrapTextWithAnsi(line.replace(/\t/g, "   "), contentWidth);
    if (parts.length === 0) {
      wrapped.push("");
      continue;
    }

    for (const part of parts) {
      wrapped.push(truncateToWidth(` ${part}`, width, ""));
    }
  }

  return wrapped.length > 0 ? wrapped : [""];
}

function runModelReview(
  model: string,
  prompt: string,
  options: ParallelReviewOptions,
  onEvent: (event: ReviewStreamEvent) => void,
  signal: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    let stderr = "";
    let stdoutBuffer = "";
    const args = ["--mode", "json", "-p", "--no-session"];
    if (options.noTools) args.push("--no-tools");
    if (options.noSkills) args.push("--no-skills");
    args.push("--model", model, prompt);

    const child = spawn("pi", args, {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    const onAbort = () => {
      child.kill("SIGTERM");
      reject(new Error("Aborted"));
    };
    signal.addEventListener("abort", onAbort);
    child.on("close", () => signal.removeEventListener("abort", onAbort));

    const processLine = (line: string) => {
      if (!line.trim()) return;

      let event: any;
      try {
        event = JSON.parse(line);
      } catch {
        onEvent({ type: "status", text: compactOneLine(line) });
        return;
      }

      if (
        (event.type === "message_update" || event.type === "message_end") &&
        event.message?.role === "assistant"
      ) {
        const text = extractMessageText(event.message);
        if (text) onEvent({ type: "assistant", text });
        return;
      }

      if (event.type === "tool_execution_start") {
        onEvent({ type: "status", text: summarizeToolActivity(event.toolName, event.args) });
        return;
      }

      if (event.type === "tool_execution_update") {
        const text = extractToolText(event.partialResult);
        if (event.isError && text) onEvent({ type: "status", text });
        return;
      }

      if (event.type === "tool_execution_end") {
        if (event.isError) onEvent({ type: "status", text: `${event.toolName ?? "tool"} failed` });
      }
    };

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuffer += chunk.toString("utf8");
      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() ?? "";
      for (const line of lines) processLine(line);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (stdoutBuffer.trim()) processLine(stdoutBuffer);
      if (code === 0 || code === null) resolve();
      else {
        const stderrText = stderr.trim() || "(no stderr)";
        const stderrTail = stderrText.split("\n").slice(-30).join("\n");
        reject(new Error(`pi exited with code ${code}\n\nstderr:\n${stderrTail}`));
      }
    });

    if (options.stdin !== undefined) {
      child.stdin.write(options.stdin, "utf8");
    }
    child.stdin.end();
  });
}

// ─── TUI: Multi-select list ───────────────────────────────────────────────────

class MultiSelectList {
  private items: SelectItem[];
  private selected: Set<number>;
  private cursor = 0;
  private visibleStart = 0;
  private readonly maxVisible: number;
  private cachedLines?: string[];
  private cachedWidth?: number;

  onConfirm?: (values: string[]) => void;
  onCancel?: () => void;

  constructor(items: SelectItem[], preSelected: Set<string>, maxVisible = 12) {
    this.items = items;
    this.maxVisible = maxVisible;
    this.selected = new Set(
      items.flatMap((item, i) => (preSelected.has(item.value) ? [i] : []))
    );
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.up)) {
      if (this.cursor > 0) {
        this.cursor--;
        if (this.cursor < this.visibleStart) this.visibleStart = this.cursor;
        this.invalidate();
      }
    } else if (matchesKey(data, Key.down)) {
      if (this.cursor < this.items.length - 1) {
        this.cursor++;
        if (this.cursor >= this.visibleStart + this.maxVisible)
          this.visibleStart = this.cursor - this.maxVisible + 1;
        this.invalidate();
      }
    } else if (matchesKey(data, Key.space)) {
      this.selected.has(this.cursor)
        ? this.selected.delete(this.cursor)
        : this.selected.add(this.cursor);
      this.invalidate();
    } else if (matchesKey(data, Key.enter)) {
      const values = [...this.selected]
        .sort((a, b) => a - b)
        .map((i) => this.items[i].value);
      this.onConfirm?.(values);
    } else if (matchesKey(data, Key.escape)) {
      this.onCancel?.();
    }
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const lines: string[] = [];
    const end = Math.min(this.visibleStart + this.maxVisible, this.items.length);

    for (let i = this.visibleStart; i < end; i++) {
      const item = this.items[i];
      const isCursor = i === this.cursor;
      const isSelected = this.selected.has(i);
      const check = isSelected ? "[✓]" : "[ ]";
      const arrow = isCursor ? "▶ " : "  ";
      const desc = item.description ? `  \x1b[2m${item.description}\x1b[0m` : "";
      const raw = `${arrow}${check} ${item.label}${desc}`;
      lines.push(
        isCursor
          ? `\x1b[7m${truncateToWidth(raw, width)}\x1b[0m`
          : truncateToWidth(raw, width)
      );
    }

    if (this.items.length > this.maxVisible) {
      const info = `  ${this.visibleStart + 1}–${end} of ${this.items.length}`;
      lines.push(truncateToWidth(`\x1b[2m${info}\x1b[0m`, width));
    }

    this.cachedLines = lines;
    this.cachedWidth = width;
    return lines;
  }

  invalidate() {
    this.cachedLines = undefined;
    this.cachedWidth = undefined;
  }
}

// ─── TUI: Review dashboard ────────────────────────────────────────────────────

class ReviewDashboard {
  private panes: ReviewPane[];
  private abortController = new AbortController();
  private scrollFromBottom = 0;
  private cachedLines?: string[];
  private cachedWidth?: number;
  private cachedHeight?: number;
  private cachedScroll?: number;
  private handle?: { requestRender(): void; close(): void };

  constructor(models: string[]) {
    this.panes = models.map((m) => ({
      model: m,
      lines: [],
      finalText: "",
      status: "",
      done: false,
      error: false,
    }));
  }

  setHandle(h: { requestRender(): void; close(): void }) {
    this.handle = h;
  }

  async run(prompt: string, options: ParallelReviewOptions = {}) {
    await Promise.allSettled(
      this.panes.map(async (pane) => {
        try {
          await runModelReview(
            pane.model,
            prompt,
            options,
            (event) => {
              if (event.type === "assistant") {
                pane.finalText = event.text;
                pane.lines = event.text.split("\n");
              } else {
                pane.status = event.text;
              }
              this.invalidate();
              this.handle?.requestRender();
            },
            this.abortController.signal
          );
          pane.done = true;
          pane.status = "";
        } catch (err: any) {
          pane.error = true;
          pane.status = "";
          pane.lines.push("");
          pane.lines.push(`\x1b[31m[Error]\x1b[0m`);
          pane.lines.push(...String(err.message ?? err).split("\n"));
        }
        this.invalidate();
        this.handle?.requestRender();
      })
    );
    this.handle?.close();
  }

  abort() {
    this.abortController.abort();
  }

  getResults(): ParallelReviewResult[] {
    // eslint-disable-next-line no-control-regex
    const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
    return this.panes.map((p) => ({
      model: p.model,
      text: stripAnsi(p.finalText || p.lines.join("\n")).trim(),
      error: p.error,
    }));
  }

  get allDone(): boolean {
    return this.panes.every((p) => p.done || p.error);
  }

  handleInput(data: string) {
    if (matchesKey(data, Key.escape) || matchesKey(data, "q")) {
      this.abort();
      this.handle?.close();
      return;
    }

    const page = Math.max(5, Math.floor((process.stdout.rows || 40) * 0.6));
    if (matchesKey(data, Key.up)) {
      this.scrollFromBottom += 1;
    } else if (matchesKey(data, Key.down)) {
      this.scrollFromBottom = Math.max(0, this.scrollFromBottom - 1);
    } else if (matchesKey(data, Key.pageUp)) {
      this.scrollFromBottom += page;
    } else if (matchesKey(data, Key.pageDown)) {
      this.scrollFromBottom = Math.max(0, this.scrollFromBottom - page);
    } else if (matchesKey(data, Key.home)) {
      this.scrollFromBottom = Number.MAX_SAFE_INTEGER;
    } else if (matchesKey(data, Key.end)) {
      this.scrollFromBottom = 0;
    } else {
      return;
    }

    this.invalidate();
  }

  render(width: number): string[] {
    const paneCount = this.panes.length;
    if (paneCount === 0) return [" No models selected."];
    const targetHeight = Math.max(12, process.stdout.rows || 40);
    if (
      this.cachedLines &&
      this.cachedWidth === width &&
      this.cachedHeight === targetHeight &&
      this.cachedScroll === this.scrollFromBottom
    ) {
      return this.cachedLines;
    }

    const allDone = this.panes.every((p) => p.done || p.error);
    const status = allDone
      ? "\x1b[32m✓ All reviews complete\x1b[0m"
      : "\x1b[33m⟳ Reviewing…\x1b[0m";

    const lines: string[] = [
      truncateToWidth(
        ` ${status}  (↑/↓ scroll, PgUp/PgDn page, End follow, q/Esc close)`,
        width
      ),
      "─".repeat(width),
    ];

    if (paneCount === 1 || width < 100) {
      const bodyLimit = this.bodyLimitForColumn(paneCount, targetHeight - lines.length);
      for (const pane of this.panes) {
        lines.push(...this.renderPane(pane, width, bodyLimit), "─".repeat(width));
      }
    } else {
      const colW = Math.floor((width - 1) / 2);
      const left = this.panes.slice(0, Math.ceil(paneCount / 2));
      const right = this.panes.slice(Math.ceil(paneCount / 2));
      const lLines = this.renderColumn(left, colW, targetHeight - lines.length);
      const rLines = this.renderColumn(right, colW, targetHeight - lines.length);
      const maxRows = Math.max(lLines.length, rLines.length);
      for (let r = 0; r < maxRows; r++) {
        const l = padVisible(lLines[r] ?? "", colW);
        const rr = padVisible(rLines[r] ?? "", colW);
        lines.push(truncateToWidth(`${l}│${rr}`, width));
      }
    }

    this.cachedLines = lines;
    this.cachedWidth = width;
    this.cachedHeight = targetHeight;
    this.cachedScroll = this.scrollFromBottom;
    return lines;
  }

  private renderColumn(panes: ReviewPane[], width: number, availableRows: number): string[] {
    const bodyLimit = this.bodyLimitForColumn(panes.length, availableRows);
    return panes.flatMap((p) => [...this.renderPane(p, width, bodyLimit), "─".repeat(width)]);
  }

  private bodyLimitForColumn(paneCount: number, availableRows: number): number {
    // Pane rows: title + status + divider + body + bottom divider.
    const rowsPerPane = Math.floor(Math.max(8, availableRows) / Math.max(1, paneCount));
    return Math.max(3, rowsPerPane - 4);
  }

  private renderPane(pane: ReviewPane, width: number, bodyLimit: number): string[] {
    const indicator = pane.done
      ? "\x1b[32m✓\x1b[0m"
      : pane.error
      ? "\x1b[31m✗\x1b[0m"
      : "\x1b[33m…\x1b[0m";
    const title = truncateToWidth(` ${indicator} \x1b[1m${pane.model}\x1b[0m`, width);
    const scrollText = this.scrollFromBottom > 0 ? "scrolling; End to follow" : "";
    const rawStatus = pane.status && !pane.done && !pane.error ? pane.status : "";
    const statusText = [rawStatus, scrollText].filter(Boolean).join("  |  ");
    const statusLine = truncateToWidth(` \x1b[2m${statusText}\x1b[0m`, width);
    const body = pane.lines.length > 0 ? pane.lines : ["(waiting for output...)"];
    const renderedBody = wrapBodyLines(body, width);
    const maxScroll = Math.max(0, renderedBody.length - bodyLimit);
    const scroll = Math.min(this.scrollFromBottom, maxScroll);
    const end = Math.max(0, renderedBody.length - scroll);
    const start = Math.max(0, end - bodyLimit);
    const bodyLines = renderedBody.slice(start, end).map((l) => padVisible(l, width));
    while (bodyLines.length < bodyLimit) bodyLines.push("");
    return [title, statusLine, "╌".repeat(width), ...bodyLines];
  }

  invalidate() {
    this.cachedLines = undefined;
    this.cachedWidth = undefined;
    this.cachedHeight = undefined;
    this.cachedScroll = undefined;
  }
}

// ─── Extension entry point ────────────────────────────────────────────────────

export async function selectReviewerModels(
  ctx: ExtensionCommandContext,
  title = "Review — Select reviewer models",
  statusKey = "review"
): Promise<string[] | null> {
  ctx.ui.setStatus(statusKey, "Loading available models...");
  let modelItems: SelectItem[];

  try {
    const available = await ctx.modelRegistry.getAvailable();

    if (available.length === 0) {
      ctx.ui.notify("No models available - configure API keys with /login", "error");
      ctx.ui.setStatus(statusKey, "");
      return null;
    }

    modelItems = available.map((m: any) => ({
      value: `${m.provider}/${m.id}`,
      label: m.name ?? m.id,
      description: m.provider,
    }));
  } catch (err: any) {
    ctx.ui.notify(`Failed to load models: ${err.message}`, "error");
    ctx.ui.setStatus(statusKey, "");
    return null;
  }

  ctx.ui.setStatus(statusKey, "");

  const prefs = loadPrefs();
  const preSelected = new Set(prefs.lastSelected);

  const chosenModels = await ctx.ui.custom<string[] | null>(
    (tui, theme, _kb, done) => {
      const container = new Container();
      container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
      container.addChild(new Text(theme.fg("accent", theme.bold(` ${title}`)), 1, 0));
      container.addChild(new Spacer(1));

      const list = new MultiSelectList(modelItems, preSelected);
      list.onConfirm = (vals) => done(vals.length > 0 ? vals : null);
      list.onCancel = () => done(null);
      container.addChild(list);

      container.addChild(new Spacer(1));
      container.addChild(
        new Text(
          theme.fg("dim", " Up/down navigate  •  Space toggle  •  Enter confirm  •  Esc cancel"),
          1,
          0
        )
      );
      container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

      return {
        render: (w: number) => container.render(w),
        invalidate: () => container.invalidate(),
        handleInput: (data: string) => {
          list.handleInput(data);
          tui.requestRender();
        },
      };
    },
    { overlay: true }
  );

  if (chosenModels?.length) {
    savePrefs({ lastSelected: chosenModels });
  }

  return chosenModels;
}

export async function runParallelReviewDashboard(
  ctx: ExtensionCommandContext,
  models: string[],
  prompt: string,
  options: ParallelReviewOptions = {}
): Promise<ParallelReviewResult[]> {
  const dashboard = new ReviewDashboard(models);

  await ctx.ui.custom<void>(
    (tui, _theme, _kb, done) => {
      dashboard.setHandle({
        requestRender: () => tui.requestRender(),
        close: () => done(undefined),
      });
      dashboard.run(prompt, options).catch((err) => {
        console.error("Parallel review dashboard error:", err);
        done(undefined);
      });

      return {
        render: (w: number) => dashboard.render(w),
        invalidate: () => dashboard.invalidate(),
        handleInput: (data: string) => {
          dashboard.handleInput(data);
          tui.requestRender();
        },
      };
    },
    {
      overlay: true,
      overlayOptions: {
        width: "100%",
        maxHeight: "100%",
        anchor: "top-left",
        margin: 0,
      },
    }
  );

  return dashboard.getResults();
}

export async function runPlanReview(pi: ExtensionAPI, ctx: ExtensionCommandContext): Promise<boolean> {
      if (!ctx.hasUI) {
        ctx.ui.notify("Plan review requires an interactive terminal", "error");
        return false;
      }

      const chosenModels = await selectReviewerModels(ctx, "Plan Review — Select reviewer models", "plan-review");

      if (!chosenModels || chosenModels.length === 0) {
        ctx.ui.notify("Plan review cancelled", "info");
        return false;
      }

      let reviewPrompt: string;
      let conversationContext: string;
      try {
        ({ reviewPrompt, conversationContext } = buildReviewPayload(ctx));
      } catch (err: any) {
        ctx.ui.notify(`Failed to build transcript: ${err.message}`, "error");
        return false;
      }

      if (conversationContext.split("\n").length < 6) {
        ctx.ui.notify("Not enough conversation history to review yet.", "warning");
        return false;
      }

      const results = await runParallelReviewDashboard(ctx, chosenModels, reviewPrompt, {
        stdin: conversationContext,
        noTools: true,
        noSkills: true,
      });

      // ── Step 5: Inject results and immediately trigger a reflection turn ───
      //
      // deliverAs: "steer"  — injects the peer review as a steering message
      //                        that enters the current context window.
      // triggerTurn: true   — immediately fires a new LLM call so the main
      //                        model reflects on the criticism and produces a
      //                        revised answer without waiting for user input.

      const aborted = results.every((r) => r.text === "" && r.error);

      if (!aborted) {
        const sections = formatParallelReviewResults(results);

        const messageContent = [
          "## Peer Review Results",
          "",
          "The following adversarial plan reviews were produced by parallel model calls via `/review plan`.",
          "Carefully read every criticism below, then immediately:",
          "1. Acknowledge any valid flaws in your previous response.",
          "2. Provide a revised, improved answer that addresses them.",
          "3. If a criticism is wrong or inapplicable, briefly explain why.",
          "",
          sections,
        ].join("\n");

        await pi.sendMessage(
          {
            customType: "plan-review",
            content: messageContent,
            display: true,
          },
          {
            // steer + triggerTurn: the model sees the peer review results and
            // immediately produces a revised response — no user prompt needed.
            deliverAs: "steer",
            triggerTurn: true,
          }
        );

        ctx.ui.notify(
          `Plan review complete — triggering reflection (${results.length} model${results.length === 1 ? "" : "s"})`,
          "success"
        );
        return true;
      } else {
        ctx.ui.notify("Plan review cancelled — no results to inject", "info");
        return false;
      }
}

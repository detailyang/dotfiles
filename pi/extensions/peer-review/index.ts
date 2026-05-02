/**
 * /peer-review — Pi extension
 *
 * Flow:
 *   1. 从 ctx.modelRegistry.getAvailable() 获取当前可用模型（无硬编码）
 *   2. 弹出多选 TUI，默认勾选上一次的选择（持久化到 prefs.json）
 *   3. 并行 spawn `pi -p --no-session --no-tools --model <provider/id> "<prompt>"`
 *      - prompt 是 positional arg，对话历史 pipe 进 stdin 作为上下文
 *   4. 实时 dashboard 展示各模型的流式输出
 *   5. 评审完成后立即以 steer + triggerTurn 触发主模型反思并给出改进方案
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { DynamicBorder } from "@mariozechner/pi-coding-agent";
import { Container, type SelectItem, Text, Spacer } from "@mariozechner/pi-tui";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { matchesKey, Key, truncateToWidth } from "@mariozechner/pi-tui";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReviewPane {
  model: string;
  lines: string[];
  done: boolean;
  error: boolean;
}

interface Prefs {
  lastSelected: string[];
}

// ─── Preferences (persist last selection) ────────────────────────────────────

const PREFS_PATH = join(dirname(fileURLToPath(import.meta.url)), "prefs.json");

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

function buildReviewPayload(ctx: any): { reviewPrompt: string; conversationContext: string } {
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

function runPeerReview(
  model: string,
  reviewPrompt: string,
  conversationContext: string,
  onChunk: (text: string) => void,
  signal: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "pi",
      ["-p", "--no-session", "--no-tools", "--no-skills", "--model", model, reviewPrompt],
      { stdio: ["pipe", "pipe", "pipe"], env: process.env }
    );

    signal.addEventListener("abort", () => {
      child.kill("SIGTERM");
      reject(new Error("Aborted"));
    });

    child.stdout.on("data", (chunk: Buffer) => onChunk(chunk.toString("utf8")));
    child.stderr.on("data", () => {});

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0 || code === null) resolve();
      else reject(new Error(`pi exited with code ${code}`));
    });

    child.stdin.write(conversationContext, "utf8");
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
  private cachedLines?: string[];
  private cachedWidth?: number;
  private handle?: { requestRender(): void; close(): void };

  constructor(models: string[]) {
    this.panes = models.map((m) => ({ model: m, lines: [], done: false, error: false }));
  }

  setHandle(h: { requestRender(): void; close(): void }) {
    this.handle = h;
  }

  async run(reviewPrompt: string, conversationContext: string) {
    await Promise.allSettled(
      this.panes.map(async (pane) => {
        try {
          await runPeerReview(
            pane.model,
            reviewPrompt,
            conversationContext,
            (chunk) => {
              const buf = pane.lines.join("\n") + chunk;
              pane.lines = buf.split("\n");
              this.invalidate();
              this.handle?.requestRender();
            },
            this.abortController.signal
          );
          pane.done = true;
        } catch (err: any) {
          pane.error = true;
          pane.lines.push(`\x1b[31m[Error: ${err.message}]\x1b[0m`);
        }
        this.invalidate();
        this.handle?.requestRender();
      })
    );
  }

  abort() {
    this.abortController.abort();
  }

  getResults(): Array<{ model: string; text: string; error: boolean }> {
    // eslint-disable-next-line no-control-regex
    const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
    return this.panes.map((p) => ({
      model: p.model,
      text: stripAnsi(p.lines.join("\n")).trim(),
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
    }
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const paneCount = this.panes.length;
    if (paneCount === 0) return [" No models selected."];

    const allDone = this.panes.every((p) => p.done || p.error);
    const status = allDone
      ? "\x1b[32m✓ All reviews complete\x1b[0m"
      : "\x1b[33m⟳ Reviewing…\x1b[0m";

    const lines: string[] = [
      truncateToWidth(` ${status}  (q / Esc to close)`, width),
      "─".repeat(width),
    ];

    if (paneCount === 1 || width < 100) {
      for (const pane of this.panes) {
        lines.push(...this.renderPane(pane, width), "─".repeat(width));
      }
    } else {
      const colW = Math.floor((width - 1) / 2);
      const left = this.panes.slice(0, Math.ceil(paneCount / 2));
      const right = this.panes.slice(Math.ceil(paneCount / 2));
      const lLines = left.flatMap((p) => [...this.renderPane(p, colW), "─".repeat(colW)]);
      const rLines = right.flatMap((p) => [...this.renderPane(p, colW), "─".repeat(colW)]);
      const maxRows = Math.max(lLines.length, rLines.length);
      for (let r = 0; r < maxRows; r++) {
        const l = lLines[r] ?? " ".repeat(colW);
        const rr = rLines[r] ?? " ".repeat(colW);
        lines.push(truncateToWidth(`${l.padEnd(colW)} │${rr}`, width));
      }
    }

    this.cachedLines = lines;
    this.cachedWidth = width;
    return lines;
  }

  private renderPane(pane: ReviewPane, width: number): string[] {
    const indicator = pane.done
      ? "\x1b[32m✓\x1b[0m"
      : pane.error
      ? "\x1b[31m✗\x1b[0m"
      : "\x1b[33m…\x1b[0m";
    const title = truncateToWidth(` ${indicator} \x1b[1m${pane.model}\x1b[0m`, width);
    const bodyLines = pane.lines.slice(-20).map((l) => truncateToWidth(" " + l, width));
    return [title, "╌".repeat(width), ...bodyLines];
  }

  invalidate() {
    this.cachedLines = undefined;
    this.cachedWidth = undefined;
  }
}

// ─── Extension entry point ────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  pi.registerCommand("peer-review", {
    description: "Send the current conversation to multiple models for parallel peer review, then immediately trigger a reflection turn",

    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("peer-review requires an interactive terminal", "error");
        return;
      }

      // ── Step 1: Load available models ──────────────────────────────────────

      ctx.ui.setStatus("peer-review", "Loading available models…");
      let modelItems: SelectItem[];

      try {
        const available = await ctx.modelRegistry.getAvailable();

        if (available.length === 0) {
          ctx.ui.notify(
            "No models available — configure API keys with /login",
            "error"
          );
          ctx.ui.setStatus("peer-review", "");
          return;
        }

        modelItems = available.map((m: any) => ({
          value: `${m.provider}/${m.id}`,
          label: m.name ?? m.id,
          description: m.provider,
        }));
      } catch (err: any) {
        ctx.ui.notify(`Failed to load models: ${err.message}`, "error");
        ctx.ui.setStatus("peer-review", "");
        return;
      }

      ctx.ui.setStatus("peer-review", "");

      // ── Step 2: Multi-select picker ────────────────────────────────────────

      const prefs = loadPrefs();
      const preSelected = new Set(prefs.lastSelected);

      const chosenModels = await ctx.ui.custom<string[] | null>(
        (tui, theme, _kb, done) => {
          const container = new Container();
          container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
          container.addChild(
            new Text(
              theme.fg("accent", theme.bold(" 🔍 Peer Review — Select reviewer models")),
              1,
              0
            )
          );
          container.addChild(new Spacer(1));

          const list = new MultiSelectList(modelItems, preSelected);
          list.onConfirm = (vals) => done(vals.length > 0 ? vals : null);
          list.onCancel = () => done(null);
          container.addChild(list);

          container.addChild(new Spacer(1));
          container.addChild(
            new Text(
              theme.fg("dim", " ↑↓ navigate  •  Space toggle  •  Enter confirm  •  Esc cancel"),
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

      if (!chosenModels || chosenModels.length === 0) {
        ctx.ui.notify("Peer review cancelled", "info");
        return;
      }

      savePrefs({ lastSelected: chosenModels });

      // ── Step 3: Build review payload ───────────────────────────────────────

      let reviewPrompt: string;
      let conversationContext: string;
      try {
        ({ reviewPrompt, conversationContext } = buildReviewPayload(ctx));
      } catch (err: any) {
        ctx.ui.notify(`Failed to build transcript: ${err.message}`, "error");
        return;
      }

      if (conversationContext.split("\n").length < 6) {
        ctx.ui.notify("Not enough conversation history to review yet.", "warning");
        return;
      }

      // ── Step 4: Live dashboard ─────────────────────────────────────────────

      const dashboard = new ReviewDashboard(chosenModels);

      await ctx.ui.custom<void>((tui, _theme, _kb, done) => {
        dashboard.setHandle({
          requestRender: () => tui.requestRender(),
          close: () => done(undefined),
        });
        dashboard.run(reviewPrompt, conversationContext).catch(() => {});

        return {
          render: (w: number) => dashboard.render(w),
          invalidate: () => dashboard.invalidate(),
          handleInput: (data: string) => {
            dashboard.handleInput(data);
            tui.requestRender();
          },
        };
      });

      // ── Step 5: Inject results and immediately trigger a reflection turn ───
      //
      // deliverAs: "steer"  — injects the peer review as a steering message
      //                        that enters the current context window.
      // triggerTurn: true   — immediately fires a new LLM call so the main
      //                        model reflects on the criticism and produces a
      //                        revised answer without waiting for user input.

      const results = dashboard.getResults();
      const aborted = results.every((r) => r.text === "" && r.error);

      if (!aborted) {
        const sections = results
          .map((r) => {
            const status = r.error ? "⚠ Error / aborted" : "✓ Complete";
            const body = r.text || "(no output)";
            return `### ${r.model} — ${status}\n\n${body}`;
          })
          .join("\n\n---\n\n");

        const messageContent = [
          "## Peer Review Results",
          "",
          "The following adversarial reviews were produced by parallel model calls via `/peer-review`.",
          "Carefully read every criticism below, then immediately:",
          "1. Acknowledge any valid flaws in your previous response.",
          "2. Provide a revised, improved answer that addresses them.",
          "3. If a criticism is wrong or inapplicable, briefly explain why.",
          "",
          sections,
        ].join("\n");

        await pi.sendMessage(
          {
            customType: "peer-review",
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
          `Peer review complete — triggering reflection (${results.length} model${results.length === 1 ? "" : "s"})`,
          "success"
        );
      } else {
        ctx.ui.notify("Peer review cancelled — no results to inject", "info");
      }
    },
  });
}

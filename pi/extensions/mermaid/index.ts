import { createHash } from "node:crypto";
import {
  getMarkdownTheme,
  keyHint,
  type ExtensionAPI,
  type ExtensionContext,
  type MessageRenderer,
  type SessionEntry,
} from "@earendil-works/pi-coding-agent";
import { Box, Spacer, Text, type Component, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { renderMermaidAscii } from "beautiful-mermaid";
import type { JSDOM } from "jsdom";

const MESSAGE_TYPE = "mermaid";
const MERMAID_BLOCK_RE = /```mermaid\s*([\s\S]*?)```/gi;
const ISSUE_LINE_RE = /^\[mermaid:(warning|error)\](?:\[hash:[^\]]+\])?\s*(.*)$/;
const COLLAPSED_LINES = 10;
const MAX_BLOCKS = 5;
const MAX_SOURCE_LINES = 400;
const MAX_SOURCE_CHARS = 20_000;
const MAX_CACHE_ENTRIES = 200;
const ASCII_PRESETS = [
  { key: "default", paddingX: 5, boxBorderPadding: 1 },
  { key: "compact", paddingX: 3, boxBorderPadding: 1 },
  { key: "tight", paddingX: 2, boxBorderPadding: 1 },
  { key: "squeezed", paddingX: 1, boxBorderPadding: 0 },
] as const;
const SUPPORTED_TYPES = new Set([
  "graph",
  "flowchart",
  "sequenceDiagram",
  "classDiagram",
  "erDiagram",
  "stateDiagram",
  "stateDiagram-v2",
]);
const SUPPORTED_TYPE_LABEL = "graph/flowchart, sequenceDiagram, classDiagram, erDiagram, stateDiagram(-v2)";

type MermaidIssue = { severity: "warning" | "error"; message: string };
type MermaidNotification = MermaidIssue;
type AsciiVariant = {
  presetKey: string;
  ascii: string;
  lineCount: number;
  maxLineWidth: number;
};
type MermaidDetails = {
  source: string;
  index: number;
  ascii: string;
  lineCount: number;
  variants?: AsciiVariant[];
  issues?: MermaidIssue[];
};

type MermaidParser = (source: string) => Promise<void>;
let parser: MermaidParser | null = null;
let parserError: string | null = null;
let parserWarningShown = false;
let parserDom: JSDOM | null = null;
const issueCache = new Map<string, true>();
const asciiCache = new Map<string, AsciiVariant>();
const lineCache = new Map<string, { lines: string[]; previewLines: string[] }>();

function refreshCacheEntry<T>(cache: Map<string, T>, key: string, value: T): void {
  cache.delete(key);
  cache.set(key, value);
  if (cache.size <= MAX_CACHE_ENTRIES) return;
  const oldest = cache.keys().next().value;
  if (oldest !== undefined) cache.delete(oldest);
}

async function getParser(): Promise<MermaidParser | null> {
  if (parser || parserError) return parser;
  try {
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    if (typeof globalThis.window === "undefined") {
      const { JSDOM } = await import("jsdom");
      parserDom = new JSDOM("");
      Object.defineProperty(globalThis, "window", { configurable: true, value: parserDom.window });
    }

    let module: typeof import("mermaid");
    try {
      module = await import("mermaid");
    } finally {
      if (parserDom) {
        if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
        else delete (globalThis as { window?: unknown }).window;
      }
    }

    const api = (module as any).default ?? (module as any).mermaidAPI ?? module;
    if (typeof api?.parse !== "function") throw new Error("Mermaid parse API not available");
    api.initialize?.({ startOnLoad: false });
    parser = async (source) => {
      await api.parse(source);
    };
  } catch (error) {
    parserError = error instanceof Error ? error.message : String(error);
  }
  return parser;
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part: any) => (part?.type === "text" && typeof part.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n");
}

function extractMermaidBlocks(text: string, limit = Number.POSITIVE_INFINITY): string[] {
  const blocks: string[] = [];
  MERMAID_BLOCK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MERMAID_BLOCK_RE.exec(text)) !== null) {
    const source = match[1]?.trim();
    if (source) blocks.push(source);
    if (blocks.length >= limit) break;
  }
  return blocks;
}

function mermaidType(source: string): string | null {
  for (const line of source.split(/\r?\n/)) {
    const value = line.trim();
    if (value && !value.startsWith("%%")) return value.split(/\s+/)[0] ?? null;
  }
  return null;
}

function diagramHash(source: string): string {
  return createHash("sha256").update(source).digest("hex").slice(0, 8);
}

function lineCount(value: string): number {
  return value ? value.split(/\r?\n/).length : 0;
}

function maxLineWidth(value: string): number {
  return value ? Math.max(...value.split(/\r?\n/).map((line) => visibleWidth(line))) : 0;
}

function cachedLines(ascii: string): { lines: string[]; previewLines: string[] } {
  const cached = lineCache.get(ascii);
  if (cached) {
    refreshCacheEntry(lineCache, ascii, cached);
    return cached;
  }
  const lines = ascii ? ascii.split(/\r?\n/) : [];
  const value = { lines, previewLines: lines.slice(0, COLLAPSED_LINES) };
  refreshCacheEntry(lineCache, ascii, value);
  return value;
}

function renderVariant(source: string, hash: string, preset: (typeof ASCII_PRESETS)[number]): AsciiVariant {
  const key = `${hash}:${preset.key}`;
  const cached = asciiCache.get(key);
  if (cached) {
    refreshCacheEntry(asciiCache, key, cached);
    return cached;
  }
  const ascii = renderMermaidAscii(source, {
    paddingX: preset.paddingX,
    boxBorderPadding: preset.boxBorderPadding,
    colorMode: "none",
  }).trimEnd();
  const variant = {
    presetKey: preset.key,
    ascii,
    lineCount: lineCount(ascii),
    maxLineWidth: maxLineWidth(ascii),
  };
  refreshCacheEntry(asciiCache, key, variant);
  return variant;
}

function selectVariant(width: number, details: MermaidDetails): AsciiVariant & { clipped: boolean } {
  const variants = details.variants ?? [{
    presetKey: "fallback",
    ascii: details.ascii,
    lineCount: details.lineCount,
    maxLineWidth: maxLineWidth(details.ascii),
  }];
  const selected = variants.find((variant) => variant.maxLineWidth <= width) ?? variants.at(-1)!;
  return { ...selected, clipped: selected.maxLineWidth > width };
}

function splitIssues(text: string): { ascii: string; issues: MermaidIssue[] } {
  const lines = text.split(/\r?\n/);
  const issues: MermaidIssue[] = [];
  let index = 0;
  while (index < lines.length) {
    const match = lines[index]?.match(ISSUE_LINE_RE);
    if (!match) break;
    issues.push({ severity: match[1] as MermaidIssue["severity"], message: match[2] ?? "" });
    index += 1;
  }
  while (lines[index]?.trim() === "") index += 1;
  return { ascii: lines.slice(index).join("\n"), issues };
}

function contextContent(source: string, hash: string, issues: MermaidIssue[], includeSource: boolean): string {
  const issueText = issues
    .map((issue) => `[mermaid:${issue.severity}][hash:${hash}] ${issue.message}`)
    .join("\n");
  if (!includeSource) return issueText;
  const sourceText = `\`\`\`mermaid\n%% mermaid-hash: ${hash}\n${source.replace(/\s+$/g, "")}\n\`\`\``;
  return issueText ? `${issueText}\n\n${sourceText}` : sourceText;
}

function rememberIssue(hash: string, issue: MermaidIssue): boolean {
  const key = `${hash}:${issue.severity}:${issue.message}`;
  if (issueCache.has(key)) return false;
  refreshCacheEntry(issueCache, key, true);
  return true;
}

async function processBlock(
  source: string,
  index: number,
  label: string,
  validate: MermaidParser | null,
  warnParserUnavailable: (reason?: string) => void,
): Promise<{ details: MermaidDetails; hash: string; issues: MermaidIssue[]; notifications: MermaidNotification[] }> {
  const hash = diagramHash(source);
  const issues: MermaidIssue[] = [];
  const notifications: MermaidNotification[] = [];
  let parseFailed = false;

  if (validate) {
    try {
      await validate(source);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("DOMPurify")) {
        warnParserUnavailable(message);
      } else {
        parseFailed = true;
        const issue = { severity: "error", message: `Mermaid parse error${label}: ${message}` } as const;
        notifications.push(issue);
        if (rememberIssue(hash, issue)) issues.push(issue);
      }
    }
  }

  let variants: AsciiVariant[] | undefined;
  let ascii = "[parse failed]";
  if (!parseFailed) {
    variants = [];
    for (const preset of ASCII_PRESETS) {
      try {
        variants.push(renderVariant(source, hash, preset));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        notifications.push({ severity: "warning", message: `Mermaid render failed${label} (${preset.key}): ${message}` });
      }
    }
    if (variants.length > 0) {
      ascii = variants[0]!.ascii;
    } else {
      const issue = { severity: "error", message: `Mermaid render failed${label}: no ASCII variant rendered` } as const;
      notifications.push(issue);
      if (rememberIssue(hash, issue)) issues.push(issue);
      variants = undefined;
      ascii = "[render failed]";
    }
  }

  return {
    hash,
    issues,
    notifications,
    details: {
      source,
      index,
      ascii,
      lineCount: lineCount(ascii),
      variants,
      issues: issues.length ? issues : undefined,
    },
  };
}

function lastAssistantText(entries: SessionEntry[]): string | null {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry?.type !== "message" || entry.message.role !== "assistant") continue;
    const text = extractText(entry.message.content);
    if (text.trim()) return text;
  }
  return null;
}

function createRenderer(): MessageRenderer<MermaidDetails> {
  return (message, { expanded }, theme) => {
    const fallback = splitIssues(extractText(message.content));
    const details = message.details as MermaidDetails | undefined ?? {
      source: "",
      index: 1,
      ascii: fallback.ascii,
      lineCount: lineCount(fallback.ascii),
      issues: fallback.issues,
    };
    const component: Component = {
      render(width) {
        const contentWidth = Math.max(1, width);
        const selected = selectVariant(contentWidth, details);
        const asciiLines = cachedLines(selected.ascii);
        const overflow = selected.lineCount > COLLAPSED_LINES;
        const shown = expanded || !overflow ? asciiLines.lines : asciiLines.previewLines;
        const lines = [truncateToWidth(theme.fg("customMessageLabel", theme.bold("Mermaid (ASCII)")), contentWidth)];
        lines.push(...shown.map((line) => truncateToWidth(line, contentWidth, "")));
        if (overflow && !expanded) {
          lines.push(truncateToWidth(theme.fg("muted", `... (${selected.lineCount - COLLAPSED_LINES} more lines, ${keyHint("app.tools.expand", "to expand")})`), contentWidth));
        }
        if (selected.clipped) {
          lines.push(truncateToWidth(theme.fg("muted", "... (clipped to fit width; widen terminal to view full diagram)"), contentWidth));
        }
        return lines;
      },
      invalidate() {},
    };

    const box = new Box(1, 1, (text) => theme.bg("customMessageBg", text));
    box.addChild(component);
    if (expanded && details.source) {
      const markdownTheme = getMarkdownTheme();
      const source = details.source.replace(/\s+$/g, "");
      const highlighted = markdownTheme.highlightCode?.(source, "mermaid");
      const codeLines = highlighted ?? source.split("\n").map((line) => markdownTheme.codeBlock(line));
      const indent = markdownTheme.codeBlockIndent ?? "  ";
      box.addChild(new Spacer(1));
      box.addChild(new Text([
        markdownTheme.codeBlockBorder("```mermaid"),
        ...codeLines.map((line) => `${indent}${line}`),
        markdownTheme.codeBlockBorder("```"),
      ].join("\n"), 0, 0));
    }
    return box;
  };
}

export default function mermaidExtension(pi: ExtensionAPI): void {
  pi.registerMessageRenderer(MESSAGE_TYPE, createRenderer());

  async function renderBlocks(
    blocks: string[],
    ctx: ExtensionContext,
    options: { includeSourceInContext?: boolean } = {},
  ): Promise<void> {
    const notify = (message: string, severity: "info" | "warning" | "error") => {
      if (ctx.hasUI) ctx.ui.notify(message, severity);
    };
    const warnParserUnavailable = (reason?: string) => {
      if (parserWarningShown) return;
      parserWarningShown = true;
      notify(`Mermaid parser validation is unavailable${reason ? ` (${reason})` : ""}; rendering anyway.`, "warning");
    };
    const validate = await getParser();
    if (!validate) warnParserUnavailable(parserError ?? undefined);
    if (blocks.length > MAX_BLOCKS) notify(`Found ${blocks.length} mermaid blocks, rendering first ${MAX_BLOCKS}.`, "warning");

    for (const [offset, source] of blocks.slice(0, MAX_BLOCKS).entries()) {
      const index = offset + 1;
      const label = blocks.length > 1 ? ` (block ${index})` : "";
      const lines = source.split(/\r?\n/).length;
      if (lines > MAX_SOURCE_LINES || source.length > MAX_SOURCE_CHARS) {
        notify(`Mermaid block ${index} too large (${lines} lines, ${source.length} chars).`, "warning");
        continue;
      }
      const type = mermaidType(source);
      if (!type || !SUPPORTED_TYPES.has(type)) {
        notify(`Mermaid renderer can't render type "${type ?? "unknown"}"${label}. Supported: ${SUPPORTED_TYPE_LABEL}.`, "info");
        continue;
      }
      const result = await processBlock(source, index, label, validate, warnParserUnavailable);
      pi.sendMessage({
        customType: MESSAGE_TYPE,
        content: contextContent(source, result.hash, result.issues, options.includeSourceInContext ?? true),
        display: true,
        details: result.details,
      });
      for (const notification of result.notifications) {
        notify(notification.message, notification.severity);
      }
    }
  }

  pi.on("input", async (event, ctx) => {
    if (event.source === "extension") return { action: "continue" };
    const blocks = extractMermaidBlocks(typeof event.text === "string" ? event.text : "", MAX_BLOCKS + 1);
    if (blocks.length) await renderBlocks(blocks, ctx, { includeSourceInContext: blocks.length > 1 });
    return { action: "continue" };
  });

  pi.on("agent_end", async (event, ctx) => {
    for (let index = event.messages.length - 1; index >= 0; index -= 1) {
      const message = event.messages[index];
      if (message.role !== "assistant") continue;
      const blocks = extractMermaidBlocks(extractText(message.content), MAX_BLOCKS + 1);
      if (blocks.length) await renderBlocks(blocks, ctx, { includeSourceInContext: blocks.length > 1 });
      return;
    }
  });

  pi.registerCommand("pi-mermaid", {
    description: "Render mermaid in last assistant message as ASCII",
    handler: async (_args, ctx) => {
      const text = lastAssistantText(ctx.sessionManager.getBranch());
      if (!text) {
        if (ctx.hasUI) ctx.ui.notify("No assistant message found", "warning");
        return;
      }
      const blocks = extractMermaidBlocks(text, MAX_BLOCKS + 1);
      if (!blocks.length) {
        if (ctx.hasUI) ctx.ui.notify("No mermaid blocks found", "warning");
        return;
      }
      await renderBlocks(blocks, ctx, { includeSourceInContext: true });
    },
  });
}

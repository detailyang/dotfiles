import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CompactThinkingConfig } from "../feature/compact-thinking.ts";

export type CompactStyleMode = "on" | "compact" | "off";
export type DiffViewMode = "auto" | "split" | "unified";
export type DiffIndicatorMode = "bars" | "classic" | "none";

export interface ToolDisplayConfig {
  diffViewMode: DiffViewMode;
  diffIndicatorMode: DiffIndicatorMode;
  diffSplitMinWidth: number;
  editDiffCollapsedLines: number;
  writeDiffCollapsedLines: number;
  diffWordWrap: boolean;
  expandedPreviewMaxLines: number;
}

export const DEFAULT_TOOL_DISPLAY_CONFIG: ToolDisplayConfig = {
  diffViewMode: "auto",
  diffIndicatorMode: "bars",
  diffSplitMinWidth: 120,
  editDiffCollapsedLines: 24,
  writeDiffCollapsedLines: 0,
  diffWordWrap: true,
  expandedPreviewMaxLines: 40,
};

export type Config = {
  mode: CompactStyleMode;
  excludeRenderers: string[];
  diffViewMode: DiffViewMode;
  diffIndicatorMode: DiffIndicatorMode;
  diffSplitMinWidth: number;
  editDiffCollapsedLines: number;
  writeDiffCollapsedLines: number;
  diffWordWrap: boolean;
  expandedPreviewMaxLines: number;
  expandedInputMaxLines: number;
  expandedOutputMaxLines: number;
  inputClip: number;
  useSummaryTitlesAsThinkingTitle: boolean;
  previewLines: number;
  animationIntervalMs: number;
  dimThinkingText: boolean;
  enableMarkdownEnhance: boolean;
  enableAgentSummary: boolean;
  enableWorkingMessage: boolean;
};

const AGENT_DIR = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
const CONFIG_PATH = join(AGENT_DIR, "better-style.json");

export const DIFF_VIEW_MODES: DiffViewMode[] = ["auto", "split", "unified"];
export const DIFF_INDICATOR_MODES: DiffIndicatorMode[] = ["bars", "classic", "none"];
export const DIFF_SPLIT_MIN_WIDTH_VALUES = ["80", "100", "120", "140", "160", "180"];
export const DIFF_COLLAPSED_LINES_VALUES = ["12", "24", "36", "48", "80", "120"];
export const WRITE_DIFF_COLLAPSED_LINES_VALUES = ["0", "4", "8", "12", "24", "36"];
export const EXPANDED_PREVIEW_MAX_LINES_VALUES = ["40", "60", "80", "120", "200", "500", "2000"];
export const EXPANDED_INPUT_MAX_LINES_VALUES = ["5", "10", "20", "40", "80"];
export const EXPANDED_OUTPUT_MAX_LINES_VALUES = ["10", "20", "40", "80", "120"];
export const INPUT_CLIP_VALUES = ["40", "60", "80", "100", "120", "160"];
export const THINKING_PREVIEW_LINES_VALUES = ["0", "1", "3", "5", "10"];
export const THINKING_ANIMATION_INTERVAL_VALUES = ["40", "60", "90", "120", "180"];
export const EXCLUDE_RENDERER_CANDIDATES = [
  "bash",
  "read",
  "edit",
  "write",
  "grep",
  "find",
  "ls",
  "webfetch",
  "wait",
];

export const DEFAULT_CONFIG: Config = {
  mode: "on",
  excludeRenderers: [],
  diffViewMode: DEFAULT_TOOL_DISPLAY_CONFIG.diffViewMode,
  diffIndicatorMode: DEFAULT_TOOL_DISPLAY_CONFIG.diffIndicatorMode,
  diffSplitMinWidth: DEFAULT_TOOL_DISPLAY_CONFIG.diffSplitMinWidth,
  editDiffCollapsedLines: DEFAULT_TOOL_DISPLAY_CONFIG.editDiffCollapsedLines,
  writeDiffCollapsedLines: DEFAULT_TOOL_DISPLAY_CONFIG.writeDiffCollapsedLines,
  diffWordWrap: DEFAULT_TOOL_DISPLAY_CONFIG.diffWordWrap,
  expandedPreviewMaxLines: DEFAULT_TOOL_DISPLAY_CONFIG.expandedPreviewMaxLines,
  expandedInputMaxLines: 5,
  expandedOutputMaxLines: 10,
  inputClip: 100,
  useSummaryTitlesAsThinkingTitle: true,
  previewLines: 3,
  animationIntervalMs: 90,
  dimThinkingText: false,
  enableMarkdownEnhance: true,
  enableAgentSummary: true,
  enableWorkingMessage: true,
};

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function pickPositiveInt(value: unknown, fallback: number, min = 1, max = 100_000): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export function pickPositiveNumber(value: unknown, fallback: number, min = 1): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? Math.max(min, parsed) : fallback;
}

export function normalizeConfig(input: unknown): Config {
  const source = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const excludeRenderers = Array.isArray(source.excludeRenderers)
    ? [...new Set(source.excludeRenderers.filter((name): name is string => typeof name === "string" && name.length > 0))]
    : [];
  return {
    mode: pickEnum(source.mode, ["on", "compact", "off"], DEFAULT_CONFIG.mode),
    excludeRenderers,
    diffViewMode: pickEnum(source.diffViewMode, DIFF_VIEW_MODES, DEFAULT_CONFIG.diffViewMode),
    diffIndicatorMode: pickEnum(source.diffIndicatorMode, DIFF_INDICATOR_MODES, DEFAULT_CONFIG.diffIndicatorMode),
    diffSplitMinWidth: pickPositiveInt(source.diffSplitMinWidth, DEFAULT_CONFIG.diffSplitMinWidth, 40, 300),
    editDiffCollapsedLines: pickPositiveInt(source.editDiffCollapsedLines, DEFAULT_CONFIG.editDiffCollapsedLines, 1, 500),
    writeDiffCollapsedLines: pickPositiveInt(source.writeDiffCollapsedLines, DEFAULT_CONFIG.writeDiffCollapsedLines, 0, 500),
    diffWordWrap: source.diffWordWrap !== false,
    expandedPreviewMaxLines: pickPositiveInt(source.expandedPreviewMaxLines, DEFAULT_CONFIG.expandedPreviewMaxLines, 10, 50_000),
    expandedInputMaxLines: pickPositiveInt(source.expandedInputMaxLines, DEFAULT_CONFIG.expandedInputMaxLines, 1, 5_000),
    expandedOutputMaxLines: pickPositiveInt(source.expandedOutputMaxLines, DEFAULT_CONFIG.expandedOutputMaxLines, 1, 5_000),
    inputClip: pickPositiveInt(source.inputClip, DEFAULT_CONFIG.inputClip, 8, 500),
    useSummaryTitlesAsThinkingTitle: source.useSummaryTitlesAsThinkingTitle !== false,
    previewLines: pickPositiveInt(source.previewLines, DEFAULT_CONFIG.previewLines, 0, Number.MAX_SAFE_INTEGER),
    animationIntervalMs: pickPositiveNumber(source.animationIntervalMs, DEFAULT_CONFIG.animationIntervalMs),
    dimThinkingText: source.dimThinkingText === true,
    enableMarkdownEnhance: source.enableMarkdownEnhance !== false,
    enableAgentSummary: source.enableAgentSummary !== false,
    enableWorkingMessage: source.enableWorkingMessage !== false,
  };
}

export function getCompactThinkingConfig(source: Config = config): CompactThinkingConfig {
  return {
    useSummaryTitlesAsThinkingTitle: source.useSummaryTitlesAsThinkingTitle,
    previewLines: source.previewLines,
    animationIntervalMs: source.animationIntervalMs,
  };
}

export function getToolDisplayConfig(source: Config = config): ToolDisplayConfig {
  return {
    diffViewMode: source.diffViewMode,
    diffIndicatorMode: source.diffIndicatorMode,
    diffSplitMinWidth: source.diffSplitMinWidth,
    editDiffCollapsedLines: source.editDiffCollapsedLines,
    writeDiffCollapsedLines: source.writeDiffCollapsedLines,
    diffWordWrap: source.diffWordWrap,
    expandedPreviewMaxLines: source.expandedPreviewMaxLines,
  };
}

export function formatExcludeRenderers(names: readonly string[]): string {
  return names.length === 0 ? "none" : names.join(", ");
}

export function formatConfigStatus(source: Config = config): string {
  return [
    `mode=${source.mode}`,
    `exclude=[${source.excludeRenderers.join(", ") || "none"}]`,
    `diffView=${source.diffViewMode}`,
    `diffIndicator=${source.diffIndicatorMode}`,
    `diffSplitMin=${source.diffSplitMinWidth}`,
    `editCollapsed=${source.editDiffCollapsedLines}`,
    `writeCollapsed=${source.writeDiffCollapsedLines}`,
    `diffWordWrap=${source.diffWordWrap ? "on" : "off"}`,
    `expandedMax=${source.expandedPreviewMaxLines}`,
    `expandedInput=${source.expandedInputMaxLines}`,
    `expandedOutput=${source.expandedOutputMaxLines}`,
    `inputClip=${source.inputClip}`,
    `thinkingTitle=${source.useSummaryTitlesAsThinkingTitle ? "summary" : "default"}`,
    `thinkingPreview=${source.previewLines}`,
    `thinkingAnimation=${source.animationIntervalMs}ms`,
    `thinkingDim=${source.dimThinkingText ? "on" : "off"}`,
    `markdown=${source.enableMarkdownEnhance ? "on" : "off"}`,
    `agentSummary=${source.enableAgentSummary ? "on" : "off"}`,
    `workingMsg=${source.enableWorkingMessage ? "on" : "off"}`,
  ].join(" · ");
}

function loadConfig(): Config {
  try {
    const source = existsSync(CONFIG_PATH)
      ? (JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Record<string, unknown>)
      : {};
    return normalizeConfig(source);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export const config: Config = loadConfig();

export function saveConfig(): void {
  mkdirSync(AGENT_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function updateConfig(partial: Partial<Config>): void {
  Object.assign(config, normalizeConfig({ ...config, ...partial }));
  saveConfig();
}

export function setConfig(next: Config): void {
  Object.assign(config, next);
}

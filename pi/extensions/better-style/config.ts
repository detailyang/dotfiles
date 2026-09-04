import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import {
	config as upstreamConfig,
	DEFAULT_CONFIG as UPSTREAM_DEFAULT_CONFIG,
	normalizeConfig as normalizeUpstreamConfig,
	type Config as UpstreamConfig,
	type DiffIndicatorMode,
	type DiffViewMode,
} from "pi-cc-extensions/extensions/config/config.ts";

export type BetterStyleMode = "on" | "compact" | "off";
export type Config = UpstreamConfig;
export type { DiffIndicatorMode, DiffViewMode };

const AGENT_DIR = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
export const CONFIG_PATH = join(AGENT_DIR, "better-style.json");

export const DIFF_VIEW_MODES: DiffViewMode[] = ["auto", "split", "unified"];
export const DIFF_INDICATOR_MODES: DiffIndicatorMode[] = ["bars", "classic", "none"];
export const DIFF_SPLIT_MIN_WIDTH_VALUES = ["80", "100", "120", "140", "160", "180"];
export const DIFF_COLLAPSED_LINES_VALUES = ["12", "24", "36", "48", "80", "120"];
export const WRITE_DIFF_COLLAPSED_LINES_VALUES = ["0", "4", "8", "12", "24", "36"];
export const EXPANDED_PREVIEW_MAX_LINES_VALUES = ["40", "60", "80", "120", "200", "500"];
export const EXPANDED_INPUT_MAX_LINES_VALUES = ["3", "5", "8", "12", "24"];
export const EXPANDED_OUTPUT_MAX_LINES_VALUES = ["5", "10", "20", "40", "80"];
export const INPUT_CLIP_VALUES = ["40", "60", "80", "100", "120", "160"];
export const THINKING_PREVIEW_LINES_VALUES = ["0", "1", "3", "5", "10"];
export const THINKING_ANIMATION_INTERVAL_VALUES = ["40", "60", "90", "120", "180"];

/**
 * better-style owns only presentation behavior. These upstream capabilities stay
 * disabled even when stale values exist in the JSON file.
 */
export const DEFAULT_CONFIG: Config = normalizeConfig({
	...UPSTREAM_DEFAULT_CONFIG,
	mode: "on",
	showStartupHeader: false,
	enableSessionReference: false,
	enableSubagentAutocomplete: false,
	enableContextCommand: false,
	enableAliases: false,
	enableAgentSummary: true,
	enableWorkingMessage: true,
});

function sourceObject(input: unknown): Record<string, unknown> {
	return input && typeof input === "object" ? (input as Record<string, unknown>) : {};
}

export function normalizeConfig(input: unknown): Config {
	const source = sourceObject(input);
	const normalized = normalizeUpstreamConfig({ ...UPSTREAM_DEFAULT_CONFIG, ...source });
	return {
		...normalized,
		showStartupHeader: false,
		enableSessionReference: false,
		enableSubagentAutocomplete: false,
		enableContextCommand: false,
		enableAliases: false,
	};
}

function loadConfig(): Config {
	try {
		if (!existsSync(CONFIG_PATH)) return normalizeConfig(DEFAULT_CONFIG);
		return normalizeConfig(JSON.parse(readFileSync(CONFIG_PATH, "utf8")));
	} catch {
		return normalizeConfig(DEFAULT_CONFIG);
	}
}

/**
 * Upstream rendering modules all retain a reference to this same mutable object.
 * Reusing it avoids forking the renderer while keeping persistence under
 * better-style.json instead of claude-code-style.json.
 */
export const config = upstreamConfig as Config;
Object.assign(config, loadConfig());

export function saveConfig(): void {
	mkdirSync(dirname(CONFIG_PATH), { recursive: true });
	writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
}

export function updateConfig(partial: Partial<Config>): void {
	Object.assign(config, normalizeConfig({ ...config, ...partial }));
	saveConfig();
}

/** Runtime-only exclusions preserve renderers owned by other extensions. */
export function addRuntimeRendererExclusions(names: readonly string[]): void {
	config.excludeRenderers = [...new Set([...config.excludeRenderers, ...names])].sort((a, b) =>
		a.localeCompare(b),
	);
}

export function getCompactThinkingConfig(source: Config = config) {
	return {
		useSummaryTitlesAsThinkingTitle: source.useSummaryTitlesAsThinkingTitle,
		previewLines: source.previewLines,
		animationIntervalMs: source.animationIntervalMs,
	};
}

export function formatConfigStatus(source: Config = config): string {
	return [
		`mode=${source.mode}`,
		`diff=${source.diffViewMode}/${source.diffIndicatorMode}`,
		`splitMin=${source.diffSplitMinWidth}`,
		`editCollapsed=${source.editDiffCollapsedLines}`,
		`writeCollapsed=${source.writeDiffCollapsedLines}`,
		`wrap=${source.diffWordWrap ? "on" : "off"}`,
		`expanded=${source.expandedInputMaxLines}/${source.expandedOutputMaxLines}/${source.expandedPreviewMaxLines}`,
		`inputClip=${source.inputClip}`,
		`thinking=${source.previewLines} lines/${source.animationIntervalMs}ms`,
		`thinkingDim=${source.dimThinkingText ? "on" : "off"}`,
		`summary=${source.enableAgentSummary ? "on" : "off"}`,
		`working=${source.enableWorkingMessage ? "on" : "off"}`,
	].join(" · ");
}

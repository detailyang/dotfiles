import { getSettingsListTheme } from "@earendil-works/pi-coding-agent";
import { SettingsList } from "@earendil-works/pi-tui";
import type { CompactThinkingController } from "pi-cc-extensions/extensions/feature/compact-thinking.ts";
import {
	config,
	DEFAULT_CONFIG,
	DIFF_COLLAPSED_LINES_VALUES,
	DIFF_INDICATOR_MODES,
	DIFF_SPLIT_MIN_WIDTH_VALUES,
	DIFF_VIEW_MODES,
	EXPANDED_INPUT_MAX_LINES_VALUES,
	EXPANDED_OUTPUT_MAX_LINES_VALUES,
	EXPANDED_PREVIEW_MAX_LINES_VALUES,
	getCompactThinkingConfig,
	INPUT_CLIP_VALUES,
	THINKING_ANIMATION_INTERVAL_VALUES,
	THINKING_PREVIEW_LINES_VALUES,
	updateConfig,
	WRITE_DIFF_COLLAPSED_LINES_VALUES,
	type BetterStyleMode,
	type Config,
	type DiffIndicatorMode,
	type DiffViewMode,
} from "./config.ts";

export type BetterStylePanelHooks = {
	applyStyleMode(mode: BetterStyleMode, ctx: any): void;
	refreshCurrentTranscript(ctx: any): void;
};

function boolValue(value: boolean): "on" | "off" {
	return value ? "on" : "off";
}

function integer(value: string, fallback: number, min: number, max: number): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export async function showBetterStylePanel(
	ctx: any,
	hooks: BetterStylePanelHooks,
	compactThinking?: CompactThinkingController,
): Promise<void> {
	if (ctx?.mode !== "tui" || !ctx?.hasUI || typeof ctx.ui?.custom !== "function") {
		ctx.ui?.notify?.("/better-style requires TUI mode", "warning");
		return;
	}

	await ctx.ui.custom<void>(
		(_tui: unknown, _theme: unknown, _keybindings: unknown, done: () => void) => {
			const items = [
				{
					id: "mode",
					label: "Style · Mode",
					description: "on: styled tools · compact: one assistant summary · off: Pi native",
					currentValue: config.mode,
					values: ["on", "compact", "off"],
				},
				{
					id: "diffViewMode",
					label: "Diff · Layout",
					description: "Auto, side-by-side, or unified edit/write diff",
					currentValue: config.diffViewMode,
					values: [...DIFF_VIEW_MODES],
				},
				{
					id: "diffIndicatorMode",
					label: "Diff · Indicator",
					description: "Changed-line marker style",
					currentValue: config.diffIndicatorMode,
					values: [...DIFF_INDICATOR_MODES],
				},
				{
					id: "diffSplitMinWidth",
					label: "Diff · Split min width",
					description: "Terminal width required for side-by-side layout",
					currentValue: String(config.diffSplitMinWidth),
					values: [...DIFF_SPLIT_MIN_WIDTH_VALUES],
				},
				{
					id: "editDiffCollapsedLines",
					label: "Diff · Edit preview lines",
					description: "Collapsed edit diff body limit",
					currentValue: String(config.editDiffCollapsedLines),
					values: [...DIFF_COLLAPSED_LINES_VALUES],
				},
				{
					id: "writeDiffCollapsedLines",
					label: "Diff · Write preview lines",
					description: "0 keeps only creation/overwrite statistics",
					currentValue: String(config.writeDiffCollapsedLines),
					values: [...WRITE_DIFF_COLLAPSED_LINES_VALUES],
				},
				{
					id: "diffWordWrap",
					label: "Diff · Word wrap",
					description: "Wrap long diff lines instead of truncating",
					currentValue: boolValue(config.diffWordWrap),
					values: ["on", "off"],
				},
				{
					id: "expandedInputMaxLines",
					label: "Tool · Expanded input",
					description: "Maximum input lines in an expanded tool card",
					currentValue: String(config.expandedInputMaxLines),
					values: [...EXPANDED_INPUT_MAX_LINES_VALUES],
				},
				{
					id: "expandedOutputMaxLines",
					label: "Tool · Expanded output",
					description: "Maximum output lines in an expanded tool card",
					currentValue: String(config.expandedOutputMaxLines),
					values: [...EXPANDED_OUTPUT_MAX_LINES_VALUES],
				},
				{
					id: "expandedPreviewMaxLines",
					label: "Tool · Expanded diff",
					description: "Maximum rich-diff or task-list lines when expanded",
					currentValue: String(config.expandedPreviewMaxLines),
					values: [...EXPANDED_PREVIEW_MAX_LINES_VALUES],
				},
				{
					id: "inputClip",
					label: "Tool · Summary clip",
					description: "Maximum path/command characters in tool summaries",
					currentValue: String(config.inputClip),
					values: [...INPUT_CLIP_VALUES],
				},
				{
					id: "previewLines",
					label: "Thinking · Preview lines",
					description: "0 hides the thinking preview body",
					currentValue: String(config.previewLines),
					values: [...THINKING_PREVIEW_LINES_VALUES],
				},
				{
					id: "useSummaryTitlesAsThinkingTitle",
					label: "Thinking · Summary title",
					description: "Use the latest provider summary as the active title",
					currentValue: boolValue(config.useSummaryTitlesAsThinkingTitle),
					values: ["on", "off"],
				},
				{
					id: "animationIntervalMs",
					label: "Thinking · Animation ms",
					description: "Animation interval for active thinking titles",
					currentValue: String(config.animationIntervalMs),
					values: [...THINKING_ANIMATION_INTERVAL_VALUES],
				},
				{
					id: "dimThinkingText",
					label: "Thinking · Dim body",
					description: "Render thinking body with the theme dim color",
					currentValue: boolValue(config.dimThinkingText),
					values: ["on", "off"],
				},
				{
					id: "enableWorkingMessage",
					label: "Status · Token/time",
					description: "Show elapsed time and exact/estimated output tokens",
					currentValue: boolValue(config.enableWorkingMessage),
					values: ["on", "off"],
				},
				{
					id: "enableAgentSummary",
					label: "Status · Agent summary",
					description: "Append per-round tool counts, failures, and duration",
					currentValue: boolValue(config.enableAgentSummary),
					values: ["on", "off"],
				},
			];

			const list = new SettingsList(
				items,
				Math.min(18, items.length),
				getSettingsListTheme(),
				(id: string, value: string) => {
					if (id === "mode") {
						hooks.applyStyleMode(value as BetterStyleMode, ctx);
						return;
					}
					const partial: Partial<Config> = {};
					switch (id) {
						case "diffViewMode":
							partial.diffViewMode = value as DiffViewMode;
							break;
						case "diffIndicatorMode":
							partial.diffIndicatorMode = value as DiffIndicatorMode;
							break;
						case "diffSplitMinWidth":
							partial.diffSplitMinWidth = integer(value, DEFAULT_CONFIG.diffSplitMinWidth, 40, 300);
							break;
						case "editDiffCollapsedLines":
							partial.editDiffCollapsedLines = integer(value, DEFAULT_CONFIG.editDiffCollapsedLines, 1, 500);
							break;
						case "writeDiffCollapsedLines":
							partial.writeDiffCollapsedLines = integer(value, DEFAULT_CONFIG.writeDiffCollapsedLines, 0, 500);
							break;
						case "diffWordWrap":
							partial.diffWordWrap = value === "on";
							break;
						case "expandedInputMaxLines":
							partial.expandedInputMaxLines = integer(value, DEFAULT_CONFIG.expandedInputMaxLines, 1, 5_000);
							break;
						case "expandedOutputMaxLines":
							partial.expandedOutputMaxLines = integer(value, DEFAULT_CONFIG.expandedOutputMaxLines, 1, 5_000);
							break;
						case "expandedPreviewMaxLines":
							partial.expandedPreviewMaxLines = integer(value, DEFAULT_CONFIG.expandedPreviewMaxLines, 10, 50_000);
							break;
						case "inputClip":
							partial.inputClip = integer(value, DEFAULT_CONFIG.inputClip, 8, 500);
							break;
						case "previewLines":
							partial.previewLines = integer(value, DEFAULT_CONFIG.previewLines, 0, 100);
							break;
						case "useSummaryTitlesAsThinkingTitle":
							partial.useSummaryTitlesAsThinkingTitle = value === "on";
							break;
						case "animationIntervalMs":
							partial.animationIntervalMs = integer(value, DEFAULT_CONFIG.animationIntervalMs, 20, 2_000);
							break;
						case "dimThinkingText":
							partial.dimThinkingText = value === "on";
							break;
						case "enableWorkingMessage":
							partial.enableWorkingMessage = value === "on";
							break;
						case "enableAgentSummary":
							partial.enableAgentSummary = value === "on";
							break;
						default:
							return;
					}
					updateConfig(partial);
					compactThinking?.updateConfig(getCompactThinkingConfig());
					hooks.refreshCurrentTranscript(ctx);
					ctx.ui.requestRender?.(true);
				},
				() => done(),
				{ enableSearch: true },
			);
			return list;
		},
		{
			overlay: true,
			overlayOptions: { anchor: "center", width: "90%", maxHeight: "90%", margin: 1 },
		},
	);
}

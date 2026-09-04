import type { CompactThinkingController } from "../feature/compact-thinking.ts";
import type { CompactStyleMode } from "./config.ts";
import {
  config,
  DIFF_COLLAPSED_LINES_VALUES,
  DIFF_INDICATOR_MODES,
  DIFF_SPLIT_MIN_WIDTH_VALUES,
  DIFF_VIEW_MODES,
  EXCLUDE_RENDERER_CANDIDATES,
  EXPANDED_INPUT_MAX_LINES_VALUES,
  EXPANDED_OUTPUT_MAX_LINES_VALUES,
  EXPANDED_PREVIEW_MAX_LINES_VALUES,
  getCompactThinkingConfig,
  INPUT_CLIP_VALUES,
  THINKING_PREVIEW_LINES_VALUES,
  updateConfig,
  WRITE_DIFF_COLLAPSED_LINES_VALUES,
} from "./config.ts";

export type BetterStylePanelHooks = {
  applyStyleMode(mode: CompactStyleMode, ctx: any, toolGrouping?: any): void;
  refreshCurrentTranscript(ctx?: any, toolGrouping?: any): void;
};

async function selectValue<T extends string>(ctx: any, title: string, values: readonly T[]): Promise<T | undefined> {
  const selected = await ctx.ui.select(title, [...values]);
  return values.includes(selected as T) ? (selected as T) : undefined;
}

export async function showBetterStylePanel(
  ctx: any,
  hooks: BetterStylePanelHooks,
  toolGrouping?: any,
  compactThinking?: CompactThinkingController,
): Promise<void> {
  const refresh = (partial: Parameters<typeof updateConfig>[0]) => {
    updateConfig(partial);
    compactThinking?.updateConfig(getCompactThinkingConfig(config));
    hooks.refreshCurrentTranscript(ctx, toolGrouping);
  };

  for (;;) {
    const action = await ctx.ui.select("Better style", [
      `Mode: ${config.mode}`,
      `Diff layout: ${config.diffViewMode}`,
      `Diff indicator: ${config.diffIndicatorMode}`,
      `Diff split min width: ${config.diffSplitMinWidth}`,
      `Edit collapsed lines: ${config.editDiffCollapsedLines}`,
      `Write collapsed lines: ${config.writeDiffCollapsedLines}`,
      `Diff word wrap: ${config.diffWordWrap ? "on" : "off"}`,
      `Expanded body lines: ${config.expandedPreviewMaxLines}`,
      `Expanded input lines: ${config.expandedInputMaxLines}`,
      `Expanded output lines: ${config.expandedOutputMaxLines}`,
      `Tool input clip: ${config.inputClip}`,
      `Thinking title: ${config.useSummaryTitlesAsThinkingTitle ? "summary" : "default"}`,
      `Thinking preview lines: ${config.previewLines}`,
      `Thinking dim text: ${config.dimThinkingText ? "on" : "off"}`,
      `Markdown enhancement: ${config.enableMarkdownEnhance ? "on" : "off"}`,
      `Agent summary: ${config.enableAgentSummary ? "on" : "off"}`,
      `Native renderers: ${config.excludeRenderers.join(", ") || "none"}`,
      "Done",
    ]);
    if (!action || action === "Done") return;

    if (action.startsWith("Mode:")) {
      const mode = await selectValue(ctx, "Style mode", ["on", "compact", "off"] as const);
      if (mode) hooks.applyStyleMode(mode, ctx, toolGrouping);
    } else if (action.startsWith("Diff layout:")) {
      const value = await selectValue(ctx, "Diff layout", DIFF_VIEW_MODES);
      if (value) refresh({ diffViewMode: value });
    } else if (action.startsWith("Diff indicator:")) {
      const value = await selectValue(ctx, "Diff indicator", DIFF_INDICATOR_MODES);
      if (value) refresh({ diffIndicatorMode: value });
    } else if (action.startsWith("Diff split min width:")) {
      const value = await selectValue(ctx, "Split layout minimum width", DIFF_SPLIT_MIN_WIDTH_VALUES);
      if (value) refresh({ diffSplitMinWidth: Number(value) });
    } else if (action.startsWith("Edit collapsed lines:")) {
      const value = await selectValue(ctx, "Edit collapsed lines", DIFF_COLLAPSED_LINES_VALUES);
      if (value) refresh({ editDiffCollapsedLines: Number(value) });
    } else if (action.startsWith("Write collapsed lines:")) {
      const value = await selectValue(ctx, "Write collapsed lines", WRITE_DIFF_COLLAPSED_LINES_VALUES);
      if (value) refresh({ writeDiffCollapsedLines: Number(value) });
    } else if (action.startsWith("Diff word wrap:")) {
      refresh({ diffWordWrap: !config.diffWordWrap });
    } else if (action.startsWith("Expanded body lines:")) {
      const value = await selectValue(ctx, "Expanded body lines", EXPANDED_PREVIEW_MAX_LINES_VALUES);
      if (value) refresh({ expandedPreviewMaxLines: Number(value) });
    } else if (action.startsWith("Expanded input lines:")) {
      const value = await selectValue(ctx, "Expanded input lines", EXPANDED_INPUT_MAX_LINES_VALUES);
      if (value) refresh({ expandedInputMaxLines: Number(value) });
    } else if (action.startsWith("Expanded output lines:")) {
      const value = await selectValue(ctx, "Expanded output lines", EXPANDED_OUTPUT_MAX_LINES_VALUES);
      if (value) refresh({ expandedOutputMaxLines: Number(value) });
    } else if (action.startsWith("Tool input clip:")) {
      const value = await selectValue(ctx, "Tool input clip", INPUT_CLIP_VALUES);
      if (value) refresh({ inputClip: Number(value) });
    } else if (action.startsWith("Thinking title:")) {
      refresh({ useSummaryTitlesAsThinkingTitle: !config.useSummaryTitlesAsThinkingTitle });
    } else if (action.startsWith("Thinking preview lines:")) {
      const value = await selectValue(ctx, "Thinking preview lines", THINKING_PREVIEW_LINES_VALUES);
      if (value) refresh({ previewLines: Number(value) });
    } else if (action.startsWith("Thinking dim text:")) {
      refresh({ dimThinkingText: !config.dimThinkingText });
    } else if (action.startsWith("Markdown enhancement:")) {
      refresh({ enableMarkdownEnhance: !config.enableMarkdownEnhance });
    } else if (action.startsWith("Agent summary:")) {
      refresh({ enableAgentSummary: !config.enableAgentSummary });
    } else if (action.startsWith("Native renderers:")) {
      const labels = EXCLUDE_RENDERER_CANDIDATES.map((name) => `${name} — ${config.excludeRenderers.includes(name) ? "native" : "styled"}`);
      const selected = await ctx.ui.select("Toggle native renderer", labels);
      if (selected) {
        const name = selected.split(" — ")[0]!;
        const next = config.excludeRenderers.includes(name)
          ? config.excludeRenderers.filter((item) => item !== name)
          : [...config.excludeRenderers, name];
        refresh({ excludeRenderers: next });
      }
    }
  }
}

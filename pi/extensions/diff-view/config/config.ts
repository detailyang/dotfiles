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

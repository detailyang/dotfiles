export type DiffViewMode = "auto" | "split" | "unified";
export type DiffIndicatorMode = "bars" | "classic" | "none";

export interface ToolDisplayConfig {
  showEditCall: boolean;
  diffViewMode: DiffViewMode;
  diffIndicatorMode: DiffIndicatorMode;
  diffSplitMinWidth: number;
  editDiffCollapsedLines: number;
  writeDiffCollapsedLines: number;
  diffWordWrap: boolean;
  expandedPreviewMaxLines: number;
}

export const DEFAULT_TOOL_DISPLAY_CONFIG: ToolDisplayConfig = {
  showEditCall: false,
  diffViewMode: "auto",
  diffIndicatorMode: "classic",
  diffSplitMinWidth: 120,
  editDiffCollapsedLines: 24,
  writeDiffCollapsedLines: 0,
  diffWordWrap: true,
  expandedPreviewMaxLines: 40,
};

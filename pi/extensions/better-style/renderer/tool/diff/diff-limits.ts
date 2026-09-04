import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { DEFAULT_TOOL_DISPLAY_CONFIG, type ToolDisplayConfig } from "../../../config/config.ts";
import { showMoreHintText } from "../show-more-hint.ts";
import {
	buildCollapsedDiffHintText,
	clampRenderedLineToWidth,
	clampRenderedLinesToWidth,
} from "./line-width-safety.ts";
import { stabilizeBackgroundResets, type DiffTheme } from "./diff-palette.ts";
import { countDiffLineEntries, type ParsedDiffEntry } from "./diff-parse.ts";
import type { SplitDiffRow } from "./diff-inline.ts";
import type { RenderedRow } from "./diff-layout.ts";

const DIFF_WIDTH_OPS = {
	measure: visibleWidth,
	truncate: (text: string, maxWidth: number): string => truncateToWidth(text, maxWidth, ""),
};

export function clampDiffLineToWidth(text: string, width: number): string {
	return stabilizeBackgroundResets(clampRenderedLineToWidth(text, width, DIFF_WIDTH_OPS));
}

export function clampDiffLinesToWidth(lines: string[], width: number): string[] {
	return clampRenderedLinesToWidth(lines, width, DIFF_WIDTH_OPS).map((line) =>
		stabilizeBackgroundResets(line),
	);
}

function renderDiffSpacerLine(width: number): string {
	const safeWidth = Math.max(0, width);
	return safeWidth > 0 ? " ".repeat(safeWidth) : "";
}

export function resolveDiffDisplayLimit(
	expanded: boolean,
	maxCollapsedLines: number,
	maxExpandedLines: number,
): number {
	const expandedLimit = Number.isFinite(maxExpandedLines)
		? maxExpandedLines
		: DEFAULT_TOOL_DISPLAY_CONFIG.expandedPreviewMaxLines;
	const collapsedLimit = Number.isFinite(maxCollapsedLines)
		? maxCollapsedLines
		: DEFAULT_TOOL_DISPLAY_CONFIG.editDiffCollapsedLines;
	return expanded ? Math.max(0, expandedLimit) : Math.max(1, collapsedLimit);
}

export function resolveWriteCollapsedLimit(
	config: Pick<ToolDisplayConfig, "writeDiffCollapsedLines">,
): number {
	return Math.max(0, config.writeDiffCollapsedLines);
}

/**
 * How many source rows/entries to fully highlight+render before applyLineLimit.
 * Extra headroom covers word-wrap expansion so the display limit can still fill.
 */
export function resolveDiffProcessBudget(displayLimit: number, wordWrap: boolean): number {
	if (!Number.isFinite(displayLimit) || displayLimit <= 0) {
		return Number.POSITIVE_INFINITY;
	}
	return wordWrap ? displayLimit * 2 + 8 : displayLimit + 4;
}

export function takeEntriesForLineBudget(
	entries: ParsedDiffEntry[],
	maxLineEntries: number,
): { entries: ParsedDiffEntry[]; totalLineEntries: number; processedLineEntries: number } {
	const totalLineEntries = countDiffLineEntries(entries);
	if (!Number.isFinite(maxLineEntries) || maxLineEntries >= totalLineEntries) {
		return { entries, totalLineEntries, processedLineEntries: totalLineEntries };
	}
	const limited: ParsedDiffEntry[] = [];
	let processedLineEntries = 0;
	for (const entry of entries) {
		if (entry.kind === "line") {
			if (processedLineEntries >= maxLineEntries) break;
			processedLineEntries++;
		}
		limited.push(entry);
	}
	return { entries: limited, totalLineEntries, processedLineEntries };
}

export function takeSplitRowsForBudget(
	rows: SplitDiffRow[],
	maxRows: number,
): { rows: SplitDiffRow[]; totalRows: number; processedRows: number } {
	const totalRows = rows.length;
	if (!Number.isFinite(maxRows) || maxRows >= totalRows) {
		return { rows, totalRows, processedRows: totalRows };
	}
	const limited = rows.slice(0, maxRows);
	return { rows: limited, totalRows, processedRows: limited.length };
}

export function applyLineLimit(
	rows: RenderedRow[],
	width: number,
	expanded: boolean,
	maxCollapsedLines: number,
	maxExpandedLines: number,
	totalHunks: number,
	theme: DiffTheme,
	/**
	 * When the caller only rendered a prefix of the full diff, pass the unprocessed
	 * remainder so the collapse hint still reflects total hidden content.
	 */
	unprocessedLogicalRows = 0,
	hovered = false,
): string[] {
	const limit = resolveDiffDisplayLimit(expanded, maxCollapsedLines, maxExpandedLines);
	const safeUnprocessed = Math.max(0, unprocessedLogicalRows);
	if (limit === 0 || (rows.length <= limit && safeUnprocessed === 0)) {
		return rows.map((row) => clampDiffLineToWidth(row.text, width));
	}

	const shown = rows.length <= limit ? rows : rows.slice(0, limit);
	const remaining = Math.max(0, rows.length - shown.length) + safeUnprocessed;
	if (remaining === 0) {
		return shown.map((row) => clampDiffLineToWidth(row.text, width));
	}
	const visibleHunks = new Set(
		shown
			.map((row) => row.hunkIndex)
			.filter((hunkIndex): hunkIndex is number => typeof hunkIndex === "number" && hunkIndex > 0),
	);
	const hiddenHunks = Math.max(0, totalHunks - visibleHunks.size);
	const hintText = buildCollapsedDiffHintText(
		{
			remainingLines: remaining,
			hiddenHunks,
		},
		width,
		DIFF_WIDTH_OPS,
	);

	const clickLabel = showMoreHintText();
	const clickIndex = hintText.lastIndexOf(clickLabel);
	const styledHint =
		hovered && !expanded && clickIndex >= 0
			? theme.fg("muted", hintText.slice(0, clickIndex)) +
				theme.fg("text", clickLabel) +
				theme.fg("muted", hintText.slice(clickIndex + clickLabel.length))
			: theme.fg(expanded ? "warning" : "muted", hintText);
	return [
		...shown.map((row) => clampDiffLineToWidth(row.text, width)),
		renderDiffSpacerLine(width),
		clampDiffLineToWidth(styledHint, width),
	];
}

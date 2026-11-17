import { getLanguageFromPath, highlightCode } from "@earendil-works/pi-coding-agent";
import { sanitizeAnsiForThemedOutput } from "./ansi-utils.ts";
import { sanitizeToolResultText } from "../../../utils/tool-result-sanitize.ts";
import { MAX_HL_CHARS, shikiHighlightCache } from "./shiki-highlight.ts";
import { normalizeCodeWhitespace } from "./diff-text.ts";
import {
	applyInlineSpanHighlight,
	getLineBackground,
	resolveShikiTheme,
	type DiffPalette,
	type DiffTheme,
} from "./diff-palette.ts";
import type { DiffLineEntry, ParsedDiffEntry } from "./diff-parse.ts";
import type { DiffSpan } from "./diff-inline.ts";

export type CodeLineHighlighter = (line: string, entry: DiffLineEntry) => string;

function cleanCodeLine(line: string): string {
	return sanitizeToolResultText(line).replace(/\n/g, "");
}

export function shouldHighlightCodeBlock(code: string): boolean {
	return code.length <= MAX_HL_CHARS;
}

export function resolveLanguageFromPath(rawPath: string | undefined): string | undefined {
	if (!rawPath || !rawPath.trim()) {
		return undefined;
	}
	const normalizedPath = rawPath.replace(/^@/, "").trim();
	if (!normalizedPath) {
		return undefined;
	}
	try {
		return getLanguageFromPath(normalizedPath);
	} catch {
		return undefined;
	}
}

function withLinePrefix(line: string, cleanEntryLine: string, highlighted: string): string {
	const cleanLine = cleanCodeLine(line);
	if (cleanLine === cleanEntryLine) {
		return highlighted;
	}
	if (cleanLine.endsWith(cleanEntryLine)) {
		const prefix = sanitizeAnsiForThemedOutput(
			cleanLine.slice(0, cleanLine.length - cleanEntryLine.length),
		);
		return `${prefix}${highlighted}`;
	}
	return sanitizeAnsiForThemedOutput(cleanLine);
}

export function createCodeLineHighlighter(
	language: string | undefined,
	theme: DiffTheme,
	entries: readonly ParsedDiffEntry[],
	invalidate?: () => void,
): CodeLineHighlighter {
	const codeEntries = entries.filter((entry): entry is DiffLineEntry => entry.kind === "line");
	const cleanLines = codeEntries.map((entry) =>
		cleanCodeLine(normalizeCodeWhitespace(entry.content)),
	);
	const cleanByEntry = new WeakMap(
		codeEntries.map((entry, index) => [entry, cleanLines[index] ?? ""]),
	);
	const code = cleanLines.join("\n");
	const shouldHighlight = !!language && shouldHighlightCodeBlock(code);
	const fallbackLines = shouldHighlight
		? (() => {
				try {
					return highlightCode(code, language).map(sanitizeAnsiForThemedOutput);
				} catch {
					return cleanLines.map(sanitizeAnsiForThemedOutput);
				}
			})()
		: cleanLines.map(sanitizeAnsiForThemedOutput);
	const fallbackByEntry = new WeakMap(
		codeEntries.map((entry, index) => [entry, fallbackLines[index] ?? cleanLines[index] ?? ""]),
	);
	if (!shouldHighlight) {
		return (line, entry) =>
			withLinePrefix(line, cleanByEntry.get(entry) ?? "", fallbackByEntry.get(entry) ?? "");
	}

	const shikiTheme = resolveShikiTheme(theme);
	let highlightedByEntry: WeakMap<DiffLineEntry, string> | undefined;
	const resolveHighlighted = () => {
		if (highlightedByEntry) return;
		const highlighted = shikiHighlightCache.get(
			code,
			language,
			shikiTheme,
			fallbackLines,
			invalidate,
		);
		if (highlighted) {
			highlightedByEntry = new WeakMap(
				codeEntries.map((entry, index) => [
					entry,
					sanitizeAnsiForThemedOutput(highlighted[index] ?? fallbackByEntry.get(entry) ?? ""),
				]),
			);
		}
	};
	resolveHighlighted();
	return (line, entry) => {
		resolveHighlighted();
		const base = highlightedByEntry?.get(entry) ?? fallbackByEntry.get(entry) ?? "";
		return withLinePrefix(line, cleanByEntry.get(entry) ?? "", base);
	};
}

export function highlightDiffLine(
	codeText: string,
	entry: DiffLineEntry,
	inlineHighlights: WeakMap<DiffLineEntry, DiffSpan[]>,
	palette: DiffPalette,
	highlightLine: CodeLineHighlighter,
	containerBgAnsi: string | undefined,
): { highlighted: string; rowBg: string | undefined } {
	const syntaxHighlighted = highlightLine(codeText, entry);
	const rowBg = getLineBackground(entry.lineKind, palette, false);
	const emphasisBg = getLineBackground(entry.lineKind, palette, true);
	const inlineSpans = inlineHighlights.get(entry) ?? [];
	const highlighted = applyInlineSpanHighlight(
		codeText,
		syntaxHighlighted,
		inlineSpans,
		emphasisBg,
		rowBg,
		containerBgAnsi,
	);
	return { highlighted, rowBg };
}

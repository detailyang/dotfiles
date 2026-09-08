import assert from "node:assert/strict";
import test from "node:test";
import { visibleWidth } from "@earendil-works/pi-tui";
import { DEFAULT_TOOL_DISPLAY_CONFIG } from "../extensions/diff-view/config/config.ts";
import {
	renderCompact, renderSplit, renderUnified, type DiffRenderContext,
} from "../extensions/diff-view/renderer/tool/diff/diff-layout.ts";
import type { DiffLineEntry, DiffLineKind } from "../extensions/diff-view/renderer/tool/diff/diff-parse.ts";

type Layout = "unified" | "split" | "compact";
const plain = (text: string) => text.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");

function entry(lineKind: DiffLineKind, content: string, hashline = false): DiffLineEntry {
	return {
		kind: "line", lineKind, content, hunkIndex: 1,
		oldLineNumber: lineKind === "add" ? null : 42,
		newLineNumber: lineKind === "remove" ? null : 42,
		fallbackLineNumber: "42",
		hashlineAnchorContent: hashline ? `42#AB:${content}` : undefined,
		raw: `${lineKind === "add" ? "+" : lineKind === "remove" ? "-" : " "}42|${content}`,
	};
}

function context(overrides: Partial<DiffRenderContext> = {}): DiffRenderContext {
	return {
		width: 65,
		theme: { fg: (_color, text) => text },
		inlineHighlights: new WeakMap(),
		// Identical backgrounds: only signs carry change semantics.
		palette: {
			addRowBgAnsi: "\x1b[48;5;235m", removeRowBgAnsi: "\x1b[48;5;235m",
			addEmphasisBgAnsi: "", removeEmphasisBgAnsi: "",
		},
		highlightLine: (line) => line,
		containerBgAnsi: undefined,
		wordWrap: true,
		indicatorMode: "classic",
		showHashlineAnchors: false,
		...overrides,
	};
}

function render(layout: Layout, entries: DiffLineEntry[], ctx: DiffRenderContext): string[] {
	const numberWidth = ctx.showHashlineAnchors ? 7 : 3;
	const rows = layout === "compact" ? renderCompact(entries, ctx)
		: layout === "unified" ? renderUnified(entries, ctx, numberWidth)
			: renderSplit(entries.map((line) => ({
				hunkIndex: line.hunkIndex,
				left: line.lineKind === "add" ? undefined : line,
				right: line.lineKind === "remove" ? undefined : line,
			})), ctx, numberWidth);
	assert.ok(rows.every(({ text }) => visibleWidth(text) <= ctx.width), "viewport width");
	return rows.map(({ text }) => plain(text));
}

function hasMarker(layout: Layout, text: string, sign: "+" | "-"): boolean {
	return layout === "compact" ? text.startsWith(`${sign} `) : text.includes(`│${sign} `);
}

test("classic is the default; explicit bars and none still work", () => {
	assert.equal(DEFAULT_TOOL_DISPLAY_CONFIG.diffIndicatorMode, "classic");
	for (const indicatorMode of ["bars", "none"] as const) {
		const lines = render("unified", [entry("add", "added")], context({ indicatorMode }));
		assert.equal(lines.some((line) => line.includes("▌")), indicatorMode === "bars");
		assert.ok(lines.every((line) => !hasMarker("unified", line, "+")));
	}
});

for (const layout of ["unified", "split", "compact"] as const) {
	for (const hashline of [false, true]) {
		test(`${layout}: grayscale signs and anchors, hashline=${hashline}`, () => {
			const lines = render(layout, [entry("context", "same", hashline),
				entry("remove", "old", hashline), entry("add", "new", hashline)],
			context({ showHashlineAnchors: hashline }));
			assert.ok(lines.some((line) => line.includes("old") && hasMarker(layout, line, "-")));
			assert.ok(lines.some((line) => line.includes("new") && hasMarker(layout, line, "+")));
			const unchanged = lines.filter((line) => line.includes("same"));
			assert.ok(unchanged.length > 0);
			assert.ok(unchanged.every((line) => !hasMarker(layout, line, "+") && !hasMarker(layout, line, "-")));
			if (hashline) assert.ok(lines.some((line) => line.includes("42#AB")));
		});

		test(`${layout}: continuation and empty-line signs, hashline=${hashline}`, () => {
			for (const [kind, sign] of [["add", "+"], ["remove", "-"]] as const) {
				const ctx = context({ width: layout === "split" ? 65 : 24, showHashlineAnchors: hashline });
				const codeRows = render(layout, [entry(kind, "x".repeat(180), hashline)], ctx)
					.filter((line) => line.includes("x"));
				assert.ok(codeRows.length > 1, "must exercise continuation rows");
				assert.ok(codeRows.every((line) => hasMarker(layout, line, sign)), codeRows.join("\n"));
				assert.ok(codeRows.slice(1).every((line) => !line.includes("42")), "do not repeat line numbers");
				const empty = render(layout, [entry(kind, "", hashline)], ctx);
				assert.equal(empty.filter((line) => hasMarker(layout, line, sign)).length, 1);
			}
		});
	}

	test(`${layout}: normal foreground; marker never enters syntax highlighting`, () => {
		const signs: Array<[string, string]> = [];
		const highlighted: string[] = [];
		const lines = render(layout, [entry("remove", "--count;"), entry("add", "++count;")], context({
			theme: { fg(color, text) {
				if (text === "+" || text === "-") signs.push([color, text]);
				return `\x1b[${color === "text" ? 37 : 90}m${text}\x1b[39m`;
			} },
			highlightLine(code) { highlighted.push(code); return code; },
		}));
		assert.deepEqual(highlighted, ["--count;", "++count;"]);
		assert.deepEqual(signs, [["text", "-"], ["text", "+"]]);
		assert.ok(lines.some((line) => line.includes("- --count;")));
		assert.ok(lines.some((line) => line.includes("+ ++count;")));
	});

	test(`${layout}: wide characters fit with wrapping on and off`, () => {
		for (const wordWrap of [false, true]) {
			const lines = render(layout, [entry("add", "中文🙂内容".repeat(30), true)],
				context({ wordWrap, showHashlineAnchors: true }));
			assert.ok(lines.some((line) => hasMarker(layout, line, "+")));
		}
	});
}

for (const showHashlineAnchors of [false, true]) {
	test(`split: unmarked padding and aligned columns, hashline=${showHashlineAnchors}`, () => {
		const ctx = context({ showHashlineAnchors });
		const leftWidth = Math.floor((ctx.width - 3) / 2);
		const rows = renderSplit([{
			left: entry("remove", "", showHashlineAnchors),
			right: entry("add", "x".repeat(160), showHashlineAnchors), hunkIndex: 1,
		}], ctx, showHashlineAnchors ? 7 : 3).map(({ text }) => plain(text));
		assert.ok(rows.every((line) => visibleWidth(line) === ctx.width), "headers and cells fill columns");
		const body = rows.slice(2);
		assert.ok(body.length > 1);
		assert.ok(body[0].slice(0, leftWidth).includes("│- "), "real empty deletion is marked");
		for (const line of body.slice(1)) {
			assert.equal(line.slice(0, leftWidth).trim(), "│", "opposite-column padding is not a deletion");
		}
		for (const line of body) {
			assert.equal(line.slice(leftWidth, leftWidth + 3), " │ ");
			assert.ok(line.slice(leftWidth + 3).includes("│+ "));
		}
	});
}

test("split fallback to a narrow unified viewport retains hashline signs", () => {
	const lines = render("split", [entry("remove", "old", true), entry("add", "new", true)],
		context({ width: 24, showHashlineAnchors: true }));
	assert.ok(lines.some((line) => line.includes("│- old")));
	assert.ok(lines.some((line) => line.includes("│+ new")));
});

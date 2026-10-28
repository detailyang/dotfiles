import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Image, Markdown, setCapabilities } from "@earendil-works/pi-tui";
import { transformMermaid } from "../extensions/pele/markdown.ts";
import { imageMarkdown } from "../extensions/pele/preview.ts";
import { PeleRenderer, resolveVariables } from "../extensions/pele/renderer.ts";

const isImageLine = (line: string) => line.includes("\x1b_G") || line.includes("\x1b]1337;File=");
const source = "flowchart LR\n  A[Input] --> B[Pele]";
const fenced = `Before\n\n\`\`\`mermaid\n${source}\n\`\`\`\n\nAfter\n`;

test("complete Mermaid fences are replaced without changing surrounding text", () => {
	assert.equal(transformMermaid(fenced, () => "IMAGE"), "Before\n\nIMAGE\n\nAfter\n");
	assert.match(transformMermaid("~~~mermaid\n" + source + "\n~~~", () => "IMAGE"), /IMAGE/);
});

test("incomplete, unrelated and nested example fences stay untouched", () => {
	for (const value of [
		"```mermaid\n" + source,
		"```js\nconst x = 1;\n```",
		"````markdown\n" + fenced + "\n````",
	]) assert.equal(transformMermaid(value, () => "WRONG"), value);
});

test("unmodified Markdown preserves CRLF and reference definitions", () => {
	const markdown = "A Mermaid example\r\n\r\n[link][id]\r\n\r\n[id]: https://example.com\r\n";
	assert.equal(transformMermaid(markdown, () => "WRONG"), markdown);
});

test("render failures preserve source", () => {
	assert.equal(transformMermaid(fenced, () => { throw new Error("invalid"); }), fenced);
});

test("Pele renders SVG and bounded PNG artifacts, caches and rejects invalid input", () => {
	const directory = mkdtempSync(join(tmpdir(), "pele-test-"));
	try {
		const renderer = new PeleRenderer(directory);
		const result = renderer.render(source);
		assert.match(result.svg, /pele-flowchart/);
		assert.ok(!/="var\(/.test(result.svg));
		assert.deepEqual(result.png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
		assert.ok(result.width <= 2048 && result.height <= 2048);
		assert.equal(readFileSync(result.svgPath, "utf8"), result.svg);
		assert.equal(renderer.render(source), result);
		assert.match(renderer.render(source, 720, "dark").svg, /#cecdc3/);
		assert.match(result.svg, /rx="6" ry="6"/);
		assert.match(result.svg, /font-size:16px/);
		assert.throws(() => renderer.render("not a diagram"));
		assert.throws(() => renderer.render("a".repeat(50_001)));
		assert.throws(() => renderer.render(""));
		for (const other of [
			"sequenceDiagram\nAlice->>Bob: Hello",
			"classDiagram\nAnimal <|-- Duck",
			'pie\n"One" : 10\n"Two" : 20',
			"stateDiagram-v2\n[*] --> Ready",
		]) assert.ok(renderer.render(other).png.length > 100);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("CSS alias resolution leaves label text unchanged and normalizes SVG 1.1 attributes", () => {
	const svg = '<svg style="--_fg:var(--custom-fg,#123);--_r:6px;font:16px sans-serif" fill="var(--_fg)"><rect style="rx:var(--_r)"/><text>var(--_fg)</text></svg>';
	assert.equal(resolveVariables(svg, "light"),
		'<svg style="--_fg:#123;--_r:6px;font-size:16px;font-family:sans-serif" fill="#123"><rect rx="6" ry="6"/><text>var(--_fg)</text></svg>');
});

test("Pi Markdown preserves terminal image payload and reserved rows", () => {
	const directory = mkdtempSync(join(tmpdir(), "pele-tui-"));
	const identity = (text: string) => text;
	const theme = {
		heading: identity, link: identity, linkUrl: identity, code: identity,
		codeBlock: identity, codeBlockBorder: identity, quote: identity,
		quoteBorder: identity, hr: identity, listBullet: identity, bold: identity,
		italic: identity, strikethrough: identity, underline: identity,
	};
	try {
		const result = new PeleRenderer(directory).render(source);
		for (const protocol of ["kitty", "iterm2"] as const) {
			setCapabilities({ images: protocol, trueColor: true, hyperlinks: false });
			const preview = new Image(result.png.toString("base64"), "image/png",
				{ fallbackColor: identity }, { maxWidthCells: 60 });
			const imageLines = preview.render(60);
			const markdown = transformMermaid(fenced, () => imageMarkdown(imageLines));
			const lines = new Markdown(markdown, 0, 0, theme).render(60);
			assert.equal(lines.filter(isImageLine).length, 1);
			assert.ok(!lines.find(isImageLine)!.includes("\n"));
			assert.ok(lines.length >= imageLines.length + 2);
			assert.ok(lines.some((line) => line.includes(imageLines.find(isImageLine)!)));
		}
	} finally {
		setCapabilities({ images: null, trueColor: true, hyperlinks: false });
		rmSync(directory, { recursive: true, force: true });
	}
});

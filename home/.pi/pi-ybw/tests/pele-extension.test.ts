import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { SettingsManager, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Image, Markdown, getCellDimensions, setCapabilities, setCellDimensions } from "@earendil-works/pi-tui";
import peleExtension from "../extensions/pele/index.ts";
import { transformMermaid } from "../extensions/pele/markdown.ts";

test("nested diagrams render below containers without changing their source", () => {
	for (const markdown of [
		"> ```mermaid\n> graph TD\n> A-->B\n> ```",
		"- Example\n\n  ```mermaid\n  graph TD\n  A-->B\n  ```",
	]) {
		let count = 0;
		const result = transformMermaid(markdown, () => {
			count++;
			return "PREVIEW";
		});
		assert.equal(count, 1);
		assert.ok(result.startsWith(markdown));
		assert.match(result, /PREVIEW/);
	}
});

test("extension lifecycle, prompt guidance, tool and automatic rendering", async () => {
	const cwd = mkdtempSync(join(tmpdir(), "pele-extension-"));
	const handlers = new Map<string, (...args: any[]) => any>();
	let tool: any;
	let transformer: any;
	const pi = {
		on: (name: string, handler: any) => handlers.set(name, handler),
		registerTool: (value: any) => {
			tool = value;
		},
		registerMarkdownTransformer: (value: any) => {
			transformer = value;
		},
	} as unknown as ExtensionAPI;
	const ctx = { cwd, ui: { theme: { appearance: "dark" } } };
	try {
		peleExtension(pi);
		assert.equal(existsSync(join(cwd, ".pi")), false);
		handlers.get("session_start")!({}, ctx);
		assert.equal(SettingsManager.inMemory().getMermaidRenderingMode(), "off");
		const event = { systemPromptOptions: { sections: {} as Record<string, string> } };
		handlers.get("before_agent_start")!(event);
		assert.match(event.systemPromptOptions.sections.pele, /render_mermaid/);
		const legacyEvent = { systemPromptOptions: { appendSystemPrompt: "" } };
		handlers.get("before_agent_start")!(legacyEvent);
		assert.match(legacyEvent.systemPromptOptions.appendSystemPrompt, /render_mermaid/);
		const result = await tool.execute("id", { source: "graph TD\nA-->B" }, undefined, undefined, ctx);
		assert.equal(result.content[1].mimeType, "image/png");
		assert.ok(existsSync(result.details.svgPath));
		const abort = new AbortController();
		abort.abort();
		await assert.rejects(tool.execute("id", { source: "graph TD\nA-->B" }, abort.signal, undefined, ctx));
		await assert.rejects(tool.execute("id", { source: "invalid" }, undefined, undefined, ctx));
		setCapabilities({ images: null, trueColor: true, hyperlinks: false });
		const markdown = "```mermaid\ngraph TD\nA-->B\n```";
		const context = { messageType: "assistant" as const, availableWidth: 60, isStreaming: false };
		const fallback = transformer(markdown, context);
		assert.ok(fallback.includes(markdown));
		assert.match(fallback, /Pele SVG/);
		assert.equal(transformer(markdown, { ...context, messageType: "assistant-thinking" }), markdown);
		assert.equal(transformer("```mermaid\ngraph TD\nA", { ...context, isStreaming: true }),
			"```mermaid\ngraph TD\nA");
		setCapabilities({ images: "kitty", trueColor: true, hyperlinks: false });
		const preview = transformer(markdown, context);
		assert.ok(preview.includes("\x1b_G"));
		assert.equal(transformer(markdown, context), preview);
		const previousCells = getCellDimensions();
		try {
			setCellDimensions({ widthPx: 9, heightPx: 18 });
			handlers.get("session_start")!({}, ctx);
			transformer(markdown, { ...context, availableWidth: 1 });
			const resized = transformer(markdown, { ...context, availableWidth: 8 });
			handlers.get("session_start")!({}, ctx);
			const fresh = transformer(markdown, { ...context, availableWidth: 8 });
			const size = (text: string) => text.match(/c=\d+,r=\d+/)?.[0];
			assert.ok(size(fresh), "Expected Kitty placement dimensions");
			assert.equal(size(resized), size(fresh), "Resizing must match a fresh preview");
			const wide = transformer(markdown, { ...context, availableWidth: 120 });
			const wideCols = Number(wide.match(/c=(\d+)/)?.[1] ?? 0);
			assert.ok(wideCols > 0 && wideCols < 40, "Small diagrams must not upscale across the full terminal width");
			const identity = (text: string) => text;
			const mdLines = new Markdown(wide, 1, 0, {
				heading: identity, link: identity, linkUrl: identity, code: identity,
				codeBlock: identity, codeBlockBorder: identity, quote: identity,
				quoteBorder: identity, hr: identity, listBullet: identity, bold: identity,
				italic: identity, strikethrough: identity, underline: identity,
			}).render(120);
			const anchor = mdLines.findIndex((line) => line.includes("\x1b_G"));
			assert.ok(anchor >= 0);
			assert.equal(mdLines[anchor + 1], "", "Reserved Kitty rows in Markdown must be empty strings for fullscreen cropping");
			const toolImage = new Image(result.content[1].data, "image/png", { fallbackColor: identity }, { maxWidthCells: 80 });
			const toolCols = Number(toolImage.render(120)[0]?.match(/c=(\d+)/)?.[1] ?? 0);
			assert.equal(toolCols, wideCols, "Tool result image width must match natural diagram cell width");
		} finally {
			setCellDimensions(previousCells);
		}
		handlers.get("session_shutdown")!();
		assert.equal(SettingsManager.inMemory().getMermaidRenderingMode(), "streaming");
		assert.equal(transformer(markdown, context), markdown);
	} finally {
		setCapabilities({ images: null, trueColor: true, hyperlinks: false });
		rmSync(cwd, { recursive: true, force: true });
	}
});

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
	SettingsManager,
	getAgentDir,
	type ExtensionAPI,
	type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Image, Markdown, getCapabilities, getCellDimensions } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { transformMermaid } from "./markdown.ts";
import { imageMarkdown, normalizeKittyImageRows } from "./preview.ts";
import { PeleRenderer, type Appearance, type Diagram } from "./renderer.ts";

const MAX_PREVIEW_ROWS = 32;

interface PatchTarget {
	settingsProto?: { getMermaidRenderingMode?: () => string };
	originalGetMermaidRenderingMode?: () => string;
	markdownProto: { render: (width: number) => string[] };
	originalMarkdownRender: (width: number) => string[];
	imageProto: { render: (width: number) => string[] };
	originalImageRender: (width: number) => string[];
}

const targets = new Map<object, PatchTarget>();
const naturalImageSizes = new Map<string, { svgWidth: number; svgHeight: number }>();
let activeSessions = 0;

function registerTarget(
	settingsClass: { prototype?: { getMermaidRenderingMode?: () => string } } | undefined,
	markdownClass: { prototype?: { render?: (width: number) => string[] } } | undefined,
	imageClass: { prototype?: { render?: (width: number) => string[] } } | undefined,
): void {
	const markdownProto = markdownClass?.prototype;
	const imageProto = imageClass?.prototype;
	if (!markdownProto?.render || !imageProto?.render || targets.has(markdownProto)) return;
	const settingsProto = settingsClass?.prototype;
	targets.set(markdownProto, {
		settingsProto,
		originalGetMermaidRenderingMode: settingsProto?.getMermaidRenderingMode,
		markdownProto: markdownProto as { render: (width: number) => string[] },
		originalMarkdownRender: markdownProto.render,
		imageProto: imageProto as { render: (width: number) => string[] },
		originalImageRender: imageProto.render,
	});
}

function discoverTargets(): void {
	registerTarget(SettingsManager, Markdown, Image);
	const moduleBuiltin = process.getBuiltinModule?.("node:module") as
		| { createRequire?: (id: string) => NodeRequire }
		| undefined;
	const createReq = moduleBuiltin?.createRequire;
	if (!createReq) return;
	const packageRoot = fileURLToPath(new URL("../..", import.meta.url));
	const nodeModulesRoots = new Set<string>([
		join(packageRoot, "node_modules"),
		join(process.cwd(), "node_modules"),
	]);
	try {
		const agentDir = getAgentDir();
		const version = readFileSync(join(agentDir, "install", "current-version"), "utf8").trim();
		nodeModulesRoots.add(join(agentDir, "install", "releases", version, "node_modules"));
	} catch {
		// Ignore when managed install metadata is unavailable.
	}
	const req = createReq(import.meta.url);
	for (const root of nodeModulesRoots) {
		const tuiIndex = join(root, "@earendil-works", "pi-tui", "dist", "index.js");
		if (!existsSync(tuiIndex)) continue;
		try {
			const tuiMod = req(tuiIndex) as { Markdown?: typeof Markdown; Image?: typeof Image };
			registerTarget(undefined, tuiMod?.Markdown, tuiMod?.Image);
			const agentIndex = join(root, "@earendil-works", "pi-coding-agent", "dist", "index.js");
			if (existsSync(agentIndex)) {
				void import(pathToFileURL(agentIndex).href)
					.then((agentMod) => {
						if (agentMod?.SettingsManager?.prototype && activeSessions > 0) {
							registerTarget(agentMod.SettingsManager, tuiMod?.Markdown, tuiMod?.Image);
							agentMod.SettingsManager.prototype.getMermaidRenderingMode = () => "off";
						}
					})
					.catch(() => {});
			}
		} catch {
			// Ignore when native ESM require is unavailable for this root.
		}
	}
}

function rememberNaturalSize(base64: string, diagram: Diagram): void {
	naturalImageSizes.delete(base64);
	naturalImageSizes.set(base64, { svgWidth: diagram.svgWidth, svgHeight: diagram.svgHeight });
	while (naturalImageSizes.size > 64) {
		const oldest = naturalImageSizes.keys().next().value;
		if (oldest === undefined) break;
		naturalImageSizes.delete(oldest);
	}
}

function naturalCellBounds(svgWidth: number, svgHeight: number): { maxWidthCells: number; maxHeightCells: number } {
	const cells = getCellDimensions();
	const widthPx = Math.max(1, cells.widthPx);
	const heightPx = Math.max(1, cells.heightPx);
	return {
		maxWidthCells: Math.max(1, Math.ceil(svgWidth / widthPx)),
		maxHeightCells: Math.min(MAX_PREVIEW_ROWS, Math.max(1, Math.ceil(svgHeight / heightPx))),
	};
}

function installRuntimeHooks(): void {
	discoverTargets();
	for (const target of targets.values()) {
		if (target.settingsProto && typeof target.originalGetMermaidRenderingMode === "function") {
			target.settingsProto.getMermaidRenderingMode = () => "off";
		}
		const { originalMarkdownRender, originalImageRender } = target;
		target.markdownProto.render = function (width: number): string[] {
			return normalizeKittyImageRows(originalMarkdownRender.call(this, width));
		};
		target.imageProto.render = function (width: number): string[] {
			const self = this as unknown as {
				base64Data?: string;
				options?: { maxWidthCells?: number; maxHeightCells?: number };
			};
			const natural = self.base64Data ? naturalImageSizes.get(self.base64Data) : undefined;
			if (natural && self.options) {
				const bounds = naturalCellBounds(natural.svgWidth, natural.svgHeight);
				self.options.maxWidthCells = bounds.maxWidthCells;
				self.options.maxHeightCells = bounds.maxHeightCells;
			}
			return originalImageRender.call(this, width);
		};
	}
}

function restoreRuntimeHooks(): void {
	for (const target of targets.values()) {
		if (target.settingsProto && typeof target.originalGetMermaidRenderingMode === "function") {
			target.settingsProto.getMermaidRenderingMode = target.originalGetMermaidRenderingMode;
		}
		target.markdownProto.render = target.originalMarkdownRender;
		target.imageProto.render = target.originalImageRender;
	}
}

function appearanceFromContext(ctx: ExtensionContext): Appearance {
	const theme = ctx.ui.theme as { appearance?: Appearance; name?: string };
	if (theme.appearance === "light" || theme.appearance === "dark") return theme.appearance;
	return /(?:^|[-_ ])dark(?:$|[-_ ])/i.test(theme.name ?? "") ? "dark" : "light";
}

export default function peleExtension(pi: ExtensionAPI): void {
	if (typeof pi.registerMarkdownTransformer !== "function") {
		throw new Error("Pele rendering requires Pi with registerMarkdownTransformer support.");
	}
	installRuntimeHooks();

	let renderer: PeleRenderer | undefined;
	let sessionActive = false;
	const previews = new WeakMap<Diagram, { image: Image; base64: string }>();
	let appearance: () => Appearance = () => "light";
	const getRenderer = (cwd: string) => {
		renderer ??= new PeleRenderer(join(cwd, ".pi", "pele"));
		return renderer;
	};

	pi.on("session_start", (_event, ctx) => {
		if (!sessionActive) {
			sessionActive = true;
			activeSessions++;
		}
		installRuntimeHooks();
		renderer = new PeleRenderer(join(ctx.cwd, ".pi", "pele"));
		appearance = () => appearanceFromContext(ctx);
	});

	pi.on("session_shutdown", () => {
		renderer?.clear();
		renderer = undefined;
		if (sessionActive) {
			sessionActive = false;
			activeSessions = Math.max(0, activeSessions - 1);
		}
		if (activeSessions === 0) {
			naturalImageSizes.clear();
			restoreRuntimeHooks();
		}
	});

	pi.on("before_agent_start", (event) => {
		const guidance =
			"Render all Mermaid diagrams with Pele. Use render_mermaid for diagram files and previews. " +
			"For diagrams in replies, use complete top-level fenced mermaid blocks; Pi renders them automatically with Pele. " +
			"Do not use Mermaid CLI, mermaid.js, pretty-mermaid, or external rendering services.";
		const options = event.systemPromptOptions as {
			sections?: Record<string, string>;
			appendSystemPrompt?: string;
		};
		if (options.sections) {
			options.sections.pele = guidance;
		} else if (!options.appendSystemPrompt?.includes(guidance)) {
			options.appendSystemPrompt = [options.appendSystemPrompt, guidance].filter(Boolean).join("\n\n");
		}
	});

	pi.registerTool({
		name: "render_mermaid",
		label: "Render Mermaid (Pele)",
		description: "Render Mermaid source locally with Pele. Returns SVG and PNG file paths and a PNG preview. No browser or external rendering service.",
		parameters: Type.Object({
			source: Type.String({ description: "Complete Mermaid source", maxLength: 50_000 }),
			width: Type.Optional(Type.Integer({ minimum: 80, maximum: 1600, description: "Layout width in pixels (default 720)" })),
			appearance: Type.Optional(Type.Union([Type.Literal("light"), Type.Literal("dark")])),
		}),
		async execute(_id, params, signal, _onUpdate, ctx) {
			signal?.throwIfAborted();
			const diagram = getRenderer(ctx.cwd).render(params.source, params.width, params.appearance ?? appearance());
			signal?.throwIfAborted();
			const base64 = diagram.png.toString("base64");
			rememberNaturalSize(base64, diagram);
			return {
				content: [
					{ type: "text", text: `Rendered with Pele.\nSVG: ${diagram.svgPath}\nPNG: ${diagram.pngPath}` },
					{ type: "image", data: base64, mimeType: "image/png" },
				],
				details: { svgPath: diagram.svgPath, pngPath: diagram.pngPath },
			};
		},
	});

	pi.registerMarkdownTransformer((markdown, context) => {
		if (!renderer || context.messageType === "assistant-thinking") return markdown;
		return transformMermaid(markdown, (source, original) => {
			const diagram = renderer!.render(source,
				context.availableWidth * getCellDimensions().widthPx, appearance());
			const link = `[Pele SVG](${pathToFileURL(diagram.svgPath).href})`;
			if (!getCapabilities().images) return `${original}\n\n${link}`;
			let cached = previews.get(diagram);
			if (!cached) {
				const base64 = diagram.png.toString("base64");
				rememberNaturalSize(base64, diagram);
				const bounds = naturalCellBounds(diagram.svgWidth, diagram.svgHeight);
				const image = new Image(
					base64,
					"image/png",
					{ fallbackColor: (text) => text },
					bounds,
					{ widthPx: diagram.width, heightPx: diagram.height },
				);
				cached = { image, base64 };
				previews.set(diagram, cached);
			} else {
				rememberNaturalSize(cached.base64, diagram);
			}
			return `${imageMarkdown(cached.image.render(context.availableWidth))}\n\n${link}`;
		});
	});
}

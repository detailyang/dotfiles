import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { render } from "pele";

export type Appearance = "light" | "dark";

export interface Diagram {
	svg: string;
	png: Buffer;
	width: number;
	height: number;
	svgWidth: number;
	svgHeight: number;
	svgPath: string;
	pngPath: string;
}

const fontFiles = [
	process.env.PI_PELE_FONT,
	"/System/Library/Fonts/Supplemental/Arial.ttf",
	"/System/Library/Fonts/PingFang.ttc",
	"/System/Library/Fonts/Hiragino Sans GB.ttc",
	"/System/Library/Fonts/STHeiti Medium.ttc",
	"/System/Library/Fonts/Supplemental/Songti.ttc",
	"/Library/Fonts/Arial Unicode.ttf",
	"/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
	"/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
	"/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
	"/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
	process.env.WINDIR ? join(process.env.WINDIR, "Fonts", "arial.ttf") : undefined,
].filter((path): path is string => Boolean(path && existsSync(path)));

const light: Record<string, string> = {
	"--pele-bg": "#fffcf0",
	"--pele-fg": "#100f0f",
	"--pele-muted": "#6f6e69",
	"--pele-line": "#403e3c",
	"--pele-surface": "#f2f0e5",
	"--pele-surface-alt": "#e6e4d9",
	"--pele-border": "#b7b5ac",
	"--pele-accent": "#205ea6",
	"--pele-critical": "#af3029",
	"--pele-radius": "6px",
};

const dark: Record<string, string> = {
	"--pele-bg": "#100f0f",
	"--pele-fg": "#cecdc3",
	"--pele-muted": "#878580",
	"--pele-line": "#a8a69f",
	"--pele-surface": "#1c1b1a",
	"--pele-surface-alt": "#282726",
	"--pele-border": "#575653",
	"--pele-accent": "#4385be",
	"--pele-critical": "#d14d41",
	"--pele-radius": "6px",
};

// Resolve Pele's generated CSS variables and SVG 2 style shorthands for resvg (SVG 1.1).
export function resolveVariables(svg: string, appearance: Appearance): string {
	const palette = appearance === "dark" ? dark : light;
	const variables: Record<string, string> = { ...palette };
	const rootStyle = /<svg\b[^>]*\bstyle="([^"]*)"/.exec(svg)?.[1] ?? "";
	for (const declaration of rootStyle.split(";")) {
		const match = /^(--[\w-]+):(.+)$/.exec(declaration);
		if (match) variables[match[1]] = match[2];
	}
	function resolve(value: string): string {
		for (let i = 0; i < 20 && value.includes("var("); i++) {
			const next = value.replace(/var\((--[\w-]+)(?:,([^()]*))?\)/g,
				(_all, name: string, fallback: string | undefined) => variables[name] ?? fallback ?? "");
			if (next === value) break;
			value = next;
		}
		return value;
	}
	// Never rewrite text labels that happen to contain CSS-like expressions.
	return svg
		.replace(/\b(style|fill|stroke|color|font-family|font-weight)="([^"]*)"/g,
			(_all, name: string, value: string) => {
				const resolved = resolve(value).replace(
					/\bfont:(\d+(?:\.\d+)?)px\s+([^;"]+)/g,
					"font-size:$1px;font-family:$2",
				);
				return `${name}="${resolved}"`;
			})
		.replace(/\bstyle="rx:(\d+(?:\.\d+)?)(?:px)?;?([^"]*)"/g,
			(_all, radius: string, rest: string) =>
				rest ? `rx="${radius}" ry="${radius}" style="${rest}"` : `rx="${radius}" ry="${radius}"`);
}

export class PeleRenderer {
	private cache = new Map<string, Diagram>();
	private bytes = 0;
	private directory: string;

	constructor(directory: string) {
		this.directory = directory;
	}

	clear(): void {
		this.cache.clear();
		this.bytes = 0;
	}

	render(source: string, width = 720, appearance: Appearance = "light"): Diagram {
		if (!source.trim()) throw new Error("Mermaid source is empty.");
		if (source.length > 50_000) throw new Error("Mermaid source exceeds 50,000 characters.");
		width = Math.max(80, Math.min(1600, Math.round(width)));
		const key = createHash("sha256").update(JSON.stringify([source, width, appearance])).digest("hex");
		const cached = this.cache.get(key);
		if (cached) {
			this.cache.delete(key);
			this.cache.set(key, cached);
			return cached;
		}
		const baseOptions = {
			maxWidth: width,
			padding: 16,
			responsive: false,
			images: false,
			links: false,
			limit: 50_000,
			outputLimit: 4_000_000,
			maxEdges: 1000,
			idPrefix: `pele-${key.slice(0, 16)}`,
		};
		let result = render(source, { ...baseOptions, autoDirection: false });
		if (result.width > width) {
			const maxPreviewHeightPx = 32 * 18;
			const horizontalScale = Math.min(1, width / result.width, maxPreviewHeightPx / result.height);
			const vertical = render(source, {
				...baseOptions,
				autoDirection: true,
				directionBreakpoint: width + 1,
			});
			const verticalScale = Math.min(1, width / vertical.width, maxPreviewHeightPx / vertical.height);
			if (verticalScale > horizontalScale) {
				result = vertical;
			}
		}
		if (!(result.width > 0 && result.height > 0) ||
			!Number.isFinite(result.width + result.height)) {
			throw new Error("Pele returned invalid diagram dimensions.");
		}
		const svg = resolveVariables(result.svg, appearance);
		const scale = Math.min(2, 2048 / result.width, 2048 / result.height);
		const raster = new Resvg(svg, {
			fitTo: { mode: "zoom", value: scale },
			font: { loadSystemFonts: fontFiles.length === 0, defaultFontSize: 16, fontFiles },
			background: appearance === "dark" ? dark["--pele-bg"] : light["--pele-bg"],
		}).render();
		const png = raster.asPng();
		mkdirSync(this.directory, { recursive: true, mode: 0o700 });
		const svgPath = join(this.directory, `${key}.svg`);
		const pngPath = join(this.directory, `${key}.png`);
		writeFileSync(svgPath, svg, { mode: 0o600 });
		writeFileSync(pngPath, png, { mode: 0o600 });
		const diagram: Diagram = {
			svg,
			png,
			width: raster.width,
			height: raster.height,
			svgWidth: result.width,
			svgHeight: result.height,
			svgPath,
			pngPath,
		};
		const size = Buffer.byteLength(svg) + png.length;
		while (this.cache.size && (this.bytes + size > 24 * 1024 * 1024 || this.cache.size >= 32)) {
			const oldest = this.cache.keys().next().value!;
			const value = this.cache.get(oldest)!;
			this.bytes -= Buffer.byteLength(value.svg) + value.png.length;
			this.cache.delete(oldest);
		}
		this.cache.set(key, diagram);
		this.bytes += size;
		return diagram;
	}
}

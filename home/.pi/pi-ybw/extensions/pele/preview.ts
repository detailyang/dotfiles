import { visibleWidth } from "@earendil-works/pi-tui";

// An image must occupy its own Markdown paragraph: Pi skips line wrapping
// for image paragraphs, including any embedded newline characters.
export function imageMarkdown(lines: string[]): string {
	return lines.map((line) => line ? `\n\n${line}\n\n` : "\x1b[0m").join("\n").trim();
}

// Pi's fullscreen ScrollView crops partially scrolled Kitty images only when
// the reserved rows following the anchor line are empty strings.
export function normalizeKittyImageRows(lines: string[]): string[] {
	for (let i = 0; i < lines.length; i++) {
		const match = /\x1b_G[^;]*\br=(\d+)/.exec(lines[i] ?? "");
		if (!match) continue;
		const rows = Number.parseInt(match[1], 10);
		for (let r = 1; r < rows && i + r < lines.length; r++) {
			if (visibleWidth((lines[i + r] ?? "").trim()) === 0) {
				lines[i + r] = "";
			}
		}
		i += Math.max(0, rows - 1);
	}
	return lines;
}

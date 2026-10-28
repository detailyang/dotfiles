import { Lexer, walkTokens, type Token } from "marked";

function mermaidSource(token: Token): string | undefined {
	if (token.type !== "code" || token.lang?.trim().toLowerCase() !== "mermaid") return;
	const opening = /^ {0,3}(`{3,}|~{3,})[^\n]*\n/.exec(token.raw);
	if (!opening) return;
	const fence = opening[1];
	const closing = new RegExp(`\\n {0,3}${fence[0]}{${fence.length},}[ \\t]*(?:\\n)?$`);
	if (closing.test(token.raw)) return token.text;
}

// Parse the outer Markdown first so Mermaid examples inside longer fences stay intact.
export function transformMermaid(
	markdown: string,
	replace: (source: string, original: string) => string,
): string {
	if (!/mermaid/i.test(markdown)) return markdown;
	const tokens = Lexer.lex(markdown);
	let changed = false;
	function render(token: Token): string | undefined {
		const source = mermaidSource(token);
		if (source === undefined) return;
		try {
			const result = replace(source, token.raw);
			changed = true;
			return result;
		} catch {
			return;
		}
	}
	const output = tokens.map((token, index) => {
		const rendered = render(token);
		const suffix = tokens[index + 1]?.type === "space" ? "" : "\n\n";
		if (rendered !== undefined) return rendered + suffix;
		if (token.type === "list" || token.type === "blockquote") {
			const previews: string[] = [];
			walkTokens([token], (child) => {
				const preview = render(child);
				if (preview !== undefined) previews.push(preview);
			});
			// Image protocols must not be wrapped in list or quote decoration.
			// Keep the container intact and display its diagrams immediately below it.
			if (previews.length) return `${token.raw}\n\n${previews.join("\n\n")}${suffix}`;
		}
		return token.raw;
	}).join("");
	return changed ? output : markdown;
}

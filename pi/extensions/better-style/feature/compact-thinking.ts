// compact-thinking 本地内联实现。fork 自 pi-compact-thinking（MIT，
// https://github.com/tifandotme/pi-extensions/tree/master/packages/pi-compact-thinking）。
// 差异：
// 1. 不再依赖上游包 —— 配置解耦，由 claude-code-style 经 installCompactThinking
//    /updateConfig 管控（模块级 config 对象，不再读写 compact-thinking.json）。
// 2. 合并了上游 fork patch：subagent 工具（Agent/Agents）执行期间保持思考状态，
//    直到 tool_execution_end 或下一个 text/thinking 边界才收尾。
import type { AssistantMessage } from "@earendil-works/pi-ai";
import {
	AssistantMessageComponent,
	type ExtensionAPI,
	type Theme,
} from "@earendil-works/pi-coding-agent";
import {
	truncateToWidth,
	visibleWidth,
	wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import { Box, Markdown, Spacer, Text, type Component } from "@earendil-works/pi-tui";
import { showMoreHintText } from "../renderer/tool/show-more-hint.ts";
import { styleCompactThinkingText } from "../renderer/compact-mode.ts";
import { refreshMountedTranscript } from "../renderer/transcript-refresh.ts";
import {
	COMPACT_THINKING_OWNER,
	COMPACT_THINKING_PATCH_KEY,
	patchRegistry,
	PROTOTYPE_ORIGINAL_KEY,
} from "../utils/patch-keys.ts";
// pi-tui 类型声明中 TUI 的 re-export 解析失败，本地用最小结构化类型（只用到 requestRender）。
type RenderTui = { requestRender(force?: boolean): void };

// pi-coding-agent 的类型声明中 AssistantMessageComponent 仅能以 value 形式使用。
type AssistantMessageComponentLike = InstanceType<typeof AssistantMessageComponent>;

export type CompactThinkingConfig = {
	useSummaryTitlesAsThinkingTitle: boolean;
	previewLines: number;
};

export type CompactThinkingController = {
	updateConfig(next: CompactThinkingConfig): void;
};

type SummaryPart = {
	title: string;
	body: string;
};

type ActiveThinking = {
	messageTimestamp: number;
	contentIndex: number;
};

// pi-coding-agent 类型声明中 MarkdownTransformer 的 re-export 解析失败，本地用最小结构化类型。
type MarkdownTransformer = (
	markdown: string,
	context: {
		messageType: "user" | "assistant" | "assistant-thinking";
		isStreaming: boolean;
		availableWidth: number;
	},
) => string;

type AssistantInternals = {
	contentContainer: {
		clear(): void;
		addChild(component: Component): void;
	};
	hideThinkingBlock: boolean;
	markdownTheme: ConstructorParameters<typeof Markdown>[3];
	hiddenThinkingLabel: string;
	outputPad: number;
	isStreaming: boolean;
	markdownTransformers: readonly MarkdownTransformer[];
	lastMessage?: AssistantMessage;
	hasToolCalls: boolean;
	updateContent(message: AssistantMessage): void;
};

type PatchedPrototype = typeof AssistantMessageComponent.prototype & {
	updateContent: (message: AssistantMessage, isStreaming?: boolean) => void;
};

// 配置由 claude-code-style 管控（installCompactThinking 注入初始值，
// updateConfig 运行时更新），上游的配置文件读写已移除。
const config: CompactThinkingConfig = {
	useSummaryTitlesAsThinkingTitle: true,
	previewLines: 3,
};

function thinkingExpandAction(): string {
	return showMoreHintText();
}

// 只 wrap 尾部窗口；缓存未着色折行，着色放到取出时做，避免主题切换命中旧 ANSI。
type PreviewCacheEntry = { lines: string[]; hiddenBefore: number };
const previewCache = new Map<string, PreviewCacheEntry>();
export const THINKING_PREVIEW_CACHE_MAX = 2_048;
const PREVIEW_BUDGET_MIN_CHARS = 2_000;
const PREVIEW_BUDGET_SLACK_LINES = 2;

function getCachedPreview(key: string): PreviewCacheEntry | undefined {
	const entry = previewCache.get(key);
	if (!entry) return undefined;
	previewCache.delete(key);
	previewCache.set(key, entry);
	return entry;
}

function cachePreview(key: string, entry: PreviewCacheEntry): void {
	previewCache.delete(key);
	while (previewCache.size >= THINKING_PREVIEW_CACHE_MAX) {
		const oldest = previewCache.keys().next().value;
		if (oldest === undefined) break;
		previewCache.delete(oldest);
	}
	previewCache.set(key, entry);
}

export function clearThinkingPreviewCache(): void {
	previewCache.clear();
	expandedWrapCache.clear();
}

type ExpandedWrapEntry = { text: string; lines: string[] };
const expandedWrapCache = new Map<string, ExpandedWrapEntry>();
export const THINKING_EXPANDED_WRAP_CACHE_MAX = 64;

function expandedWrapKey(messageTimestamp: number, runStartIndex: number, width: number): string {
	return `${messageTimestamp}:${runStartIndex}:${width}`;
}

function wrapExpandedThinking(
	messageTimestamp: number,
	runStartIndex: number,
	text: string,
	width: number,
): string[] {
	const key = expandedWrapKey(messageTimestamp, runStartIndex, width);
	const hit = expandedWrapCache.get(key);
	if (hit && hit.text === text) {
		expandedWrapCache.delete(key);
		expandedWrapCache.set(key, hit);
		return hit.lines;
	}
	const lines = wrapTextWithAnsi(text.replace(/\t/g, "   "), Math.max(1, width));
	expandedWrapCache.delete(key);
	while (expandedWrapCache.size >= THINKING_EXPANDED_WRAP_CACHE_MAX) {
		const oldest = expandedWrapCache.keys().next().value;
		if (oldest === undefined) break;
		expandedWrapCache.delete(oldest);
	}
	expandedWrapCache.set(key, { text, lines });
	return lines;
}

function evictExpandedWraps(messageTimestamp: number, runStartIndex: number): void {
	for (const key of expandedWrapCache.keys()) {
		const [ts, run] = key.split(":");
		if (Number(ts) === messageTimestamp && Number(run) === runStartIndex) {
			expandedWrapCache.delete(key);
		}
	}
}

export function thinkingPreviewCacheSize(): number {
	return previewCache.size;
}

export function thinkingExpandedWrapCacheSize(): number {
	return expandedWrapCache.size;
}

/** 按可见宽度估算折行数，不走 Text 全量 wrap。无换行长段也能计到隐藏行。 */
function countWrappedLines(text: string, contentWidth: number): number {
	if (!text) return 0;
	const width = Math.max(1, contentWidth);
	let lines = 0;
	for (const raw of text.replace(/\t/g, "   ").split(/\r\n|\r|\n/)) {
		const w = visibleWidth(raw);
		lines += w === 0 ? 1 : Math.ceil(w / width);
	}
	return lines;
}

function padPreviewLine(line: string, width: number, padding: number): string {
	const left = padding > 0 ? " ".repeat(padding) : "";
	const right = padding > 0 ? " ".repeat(padding) : "";
	const withMargins = left + line + right;
	return withMargins + " ".repeat(Math.max(0, width - visibleWidth(withMargins)));
}

function layoutThinkingPreview(
	text: string,
	width: number,
	padding: number,
): { visible: string[]; hiddenLines: number } {
	if (!text || config.previewLines <= 0) return { visible: [], hiddenLines: 0 };
	const contentWidth = Math.max(1, width - padding * 2);
	const budget = Math.max(
		width * (config.previewLines + PREVIEW_BUDGET_SLACK_LINES),
		PREVIEW_BUDGET_MIN_CHARS,
	);
	let source = text;
	let cut = 0;
	if (source.length > budget) {
		const start = source.length - budget;
		const newline = source.indexOf("\n", start);
		cut = newline === -1 ? start : newline + 1;
		if (cut < source.length) source = source.slice(cut);
		else cut = 0;
	}
	const cacheKey = `${width}:${padding}:${cut}:${source}`;
	let entry = getCachedPreview(cacheKey);
	if (!entry) {
		entry = {
			lines: wrapTextWithAnsi(source.replace(/\t/g, "   "), contentWidth),
			hiddenBefore: cut > 0 ? countWrappedLines(text.slice(0, cut), contentWidth) : 0,
		};
		cachePreview(cacheKey, entry);
	}
	const hiddenLines = entry.hiddenBefore + Math.max(0, entry.lines.length - config.previewLines);
	const visible = hiddenLines > 0 ? entry.lines.slice(-config.previewLines) : entry.lines;
	return { visible, hiddenLines };
}

function hiddenPreviewHint(
	hiddenLines: number,
	forceExpandHint = false,
): { prefix: string; action: string; suffix: string } | undefined {
	const action = thinkingExpandAction() ?? "";
	if (hiddenLines > 0) {
		const noun = hiddenLines === 1 ? "line" : "lines";
		return {
			prefix: ` • (${hiddenLines} more ${noun}${action ? ", " : ""}`,
			action,
			suffix: ")",
		};
	}
	if (forceExpandHint) {
		return { prefix: " • ", action, suffix: "" };
	}
	return undefined;
}

const expandedThinking = new Set<number>();

/** 折叠预览 + 展开全文。fullscreen 点击 hint 展开、双击整块收起，对齐工具卡。 */
export class ThinkingPreviewBlock implements Component {
	private heading: string;
	private text: string;
	private padding: number;
	readonly messageTimestamp: number;
	readonly runStartIndex: number;
	private style: (text: string) => string;
	private theme: Theme | undefined;
	private _expanded: boolean;
	private hintHovered = false;
	private collapsedMemo:
		| {
				width: number;
				previewLines: number;
				hintHovered: boolean;
				expandAction: string | undefined;
				lines: string[];
		  }
		| undefined;

	constructor(
		heading: string,
		text: string,
		padding: number,
		messageTimestamp: number,
		style: (text: string) => string,
		theme?: Theme,
		runStartIndex = 0,
	) {
		this.heading = heading;
		this.text = text;
		this.padding = padding;
		this.messageTimestamp = messageTimestamp;
		this.runStartIndex = runStartIndex;
		this.style = style;
		this.theme = theme;
		this._expanded = expandedThinking.has(messageTimestamp);
	}

	private paint(color: string, text: string): string {
		return this.theme && typeof this.theme.fg === "function"
			? this.theme.fg(color as never, text)
			: text;
	}

	get expanded(): boolean {
		return this._expanded;
	}

	setExpanded(expanded: boolean): void {
		if (this._expanded !== expanded) this.collapsedMemo = undefined;
		this._expanded = expanded;
		if (expanded) expandedThinking.add(this.messageTimestamp);
		else {
			expandedThinking.delete(this.messageTimestamp);
			evictExpandedWraps(this.messageTimestamp, this.runStartIndex);
		}
	}

	setHintHovered(hovered: boolean): void {
		if (this.hintHovered !== hovered) this.collapsedMemo = undefined;
		this.hintHovered = hovered;
	}

	private headingLines(width: number, hiddenLines: number, padding: number): string[] {
		const hint = this._expanded
			? undefined
			: hiddenPreviewHint(hiddenLines, Boolean(this.text) && config.previewLines <= 0);
		if (!hint) return new Text(this.heading, padding, 0).render(width);
		const rawHint = hint.prefix + hint.action + hint.suffix;
		const contentWidth = Math.max(1, width - padding * 2);
		const headingBudget = Math.max(0, contentWidth - visibleWidth(rawHint));
		const clipped =
			visibleWidth(this.heading) > headingBudget
				? truncateToWidth(this.heading, headingBudget, "")
				: this.heading;
		const action = this.paint(this.hintHovered ? "text" : "dim", hint.action);
		return new Text(
			clipped + this.paint("dim", hint.prefix) + action + this.paint("dim", hint.suffix),
			padding,
			0,
		).render(width);
	}

	private bodyLines(width: number, padding: number): { lines: string[]; hiddenLines: number } {
		if (!this.text || (config.previewLines <= 0 && !this._expanded)) {
			return { lines: [], hiddenLines: 0 };
		}
		if (this._expanded) {
			return {
				lines: wrapExpandedThinking(this.messageTimestamp, this.runStartIndex, this.text, width),
				hiddenLines: 0,
			};
		}
		const preview = layoutThinkingPreview(this.text, width, padding);
		return { lines: preview.visible, hiddenLines: preview.hiddenLines };
	}

	render(width: number) {
		if (this._expanded) {
			const innerWidth = Math.max(1, width - 2);
			const body = this.bodyLines(innerWidth, 0);
			const heading = this.headingLines(innerWidth, 0, 0);
			const inner = body.lines.length
				? [...heading, ...body.lines.map((line) => this.style(line))]
				: heading;
			const bgFn =
				this.theme && typeof this.theme.bg === "function"
					? (text: string) => this.theme!.bg("userMessageBg" as never, text)
					: undefined;
			const box = new Box(1, 1, bgFn);
			box.addChild({
				render: () => inner,
				invalidate() {},
			});
			return box.render(width);
		}

		const expandAction = thinkingExpandAction();
		if (
			this.collapsedMemo?.width === width &&
			this.collapsedMemo.previewLines === config.previewLines &&
			this.collapsedMemo.hintHovered === this.hintHovered &&
			this.collapsedMemo.expandAction === expandAction
		) {
			return this.collapsedMemo.lines;
		}

		const body = this.bodyLines(width, this.padding);
		const heading = this.headingLines(width, body.hiddenLines, this.padding);
		const lines = body.lines.length
			? [
					...heading,
					...body.lines.map((line) => padPreviewLine(this.style(line), width, this.padding)),
				]
			: heading;
		this.collapsedMemo = {
			width,
			previewLines: config.previewLines,
			hintHovered: this.hintHovered,
			expandAction,
			lines,
		};
		return lines;
	}

	invalidate() {
		this.collapsedMemo = undefined;
	}
}

function parseSummaryPart(text: string): SummaryPart | undefined {
	const match = /^\s*\*\*([^\n]+?)\*\*[ \t]*(?:\r?\n(?:\r?\n)?([\s\S]*))?\s*$/.exec(text);
	if (!match) return undefined;
	return { title: match[1].trim(), body: (match[2] ?? "").trim() };
}

function parseLatestStreamingSummary(text: string): SummaryPart | undefined {
	// Providers do not consistently insert a blank line between streamed
	// summary parts, so accept a bold title at the start of any source line.
	const titlePattern = /(?:^|\r?\n)\s*\*\*([^\n*]+?)\*\*[ \t]*(?:\r?\n)?/g;
	let latest: RegExpExecArray | undefined;
	let match: RegExpExecArray | null;
	while ((match = titlePattern.exec(text))) latest = match;
	if (!latest) return parseSummaryPart(text);

	return {
		title: latest[1].trim(),
		body: text.slice(latest.index + latest[0].length).trim(),
	};
}

function isOpenAiResponsesMessage(message: AssistantMessage) {
	return (
		message.api === "openai-responses" ||
		message.api === "openai-codex-responses" ||
		message.api === "azure-openai-responses"
	);
}

function getLatestOpenAiSummary(thinkingSignature: string | undefined): SummaryPart | undefined {
	if (!thinkingSignature) return undefined;

	try {
		const item = JSON.parse(thinkingSignature) as {
			type?: unknown;
			summary?: Array<{ type?: unknown; text?: unknown }>;
		};
		if (item.type !== "reasoning" || !Array.isArray(item.summary)) {
			return undefined;
		}

		for (let i = item.summary.length - 1; i >= 0; i--) {
			const part = item.summary[i];
			if (part.type !== "summary_text" || typeof part.text !== "string") {
				continue;
			}
			const parsed = parseSummaryPart(part.text);
			if (parsed) return parsed;
		}
	} catch {
		// Invalid or provider-specific signatures use the generic fallback.
	}
	return undefined;
}

const WIDGET_ID = "compact-thinking-render-loop";

// 上游 index.ts 内联（含 subagent fork patch）。
function createTransform(
	messageType: "assistant" | "assistant-thinking",
	self: AssistantInternals,
) {
	// 与 pi 内置 applyMarkdownTransformers 相同的链式语义：
	// 异常保留当前 markdown，继续下一个 transformer。
	return (markdown: string, availableWidth: number): string => {
		let out = markdown;
		for (const transformer of self.markdownTransformers ?? []) {
			try {
				const result = transformer(out, {
					messageType,
					isStreaming: self.isStreaming,
					availableWidth,
				});
				if (typeof result === "string") out = result;
			} catch {
				// 保持当前 markdown 继续
			}
		}
		return out;
	};
}

function compactThinking(pi: ExtensionAPI) {
	const prototype = AssistantMessageComponent.prototype as PatchedPrototype;
	const originalUpdateContent = prototype.updateContent;

	const streamingComponents = new Set<AssistantMessageComponentLike>();
	let activeThinking: ActiveThinking | undefined;
	let activeTheme: Theme | undefined;
	let activeTui: RenderTui | undefined;
	let latestComponent: AssistantMessageComponentLike | undefined;
	let latestComponentTimestamp: number | undefined;
	let patchInstalled = true;

	function thinkingStyle(text: string) {
		return styleCompactThinkingText(text, activeTheme);
	}

	function summaryTitleStyle(text: string) {
		return styleCompactThinkingText(text, activeTheme, true);
	}

	function isActiveRun(message: AssistantMessage, startIndex: number, endIndex: number) {
		return (
			activeThinking?.messageTimestamp === message.timestamp &&
			activeThinking.contentIndex >= startIndex &&
			activeThinking.contentIndex <= endIndex
		);
	}

	prototype.updateContent = function patchedUpdateContent(
		message: AssistantMessage,
		isStreaming?: boolean,
	) {
		const component = this as AssistantMessageComponentLike;
		const self = this as unknown as AssistantInternals;
		// isStreaming 丢失 → mermaid 流式误渲染来回闪。
		self.isStreaming = isStreaming ?? self.isStreaming;
		self.lastMessage = message;
		latestComponent = component;
		latestComponentTimestamp = message.timestamp;

		// Visible mode is intentionally untouched: Shift+Tab restores Pi's exact
		// built-in Thinking Markdown renderer, including every OpenAI summary stage.
		if (!self.hideThinkingBlock) {
			originalUpdateContent.call(this, message, self.isStreaming);
			return;
		}

		if (activeThinking?.messageTimestamp === message.timestamp) {
			streamingComponents.add(component);
		}

		self.contentContainer.clear();
		const hasActiveThinking =
			activeThinking?.messageTimestamp === message.timestamp &&
			message.content.some((content) => content.type === "thinking");
		const hasVisibleContent =
			hasActiveThinking ||
			message.content.some(
				(content) =>
					(content.type === "text" && content.text.trim()) ||
					(content.type === "thinking" && content.thinking.trim()),
			);
		// Reserve Pi's normal leading spacer even before the first thinking token.
		// This prevents the placeholder heading from jumping down one row when
		// summary/body content begins streaming.
		if (hasVisibleContent) self.contentContainer.addChild(new Spacer(1));

		for (let i = 0; i < message.content.length; i++) {
			const content = message.content[i];

			if (content.type === "text" && content.text.trim()) {
				self.contentContainer.addChild(
					new Markdown(content.text.trim(), self.outputPad, 0, self.markdownTheme, undefined, {
						transform: createTransform("assistant", self),
					}),
				);
				continue;
			}

			if (content.type !== "thinking") continue;

			const runStartIndex = i;
			const hasVisibleContentBefore = message.content
				.slice(0, runStartIndex)
				.some(
					(previous) =>
						(previous.type === "text" && previous.text.trim()) ||
						(previous.type === "thinking" && previous.thinking.trim()),
				);
			const thinkingBlocks: string[] = [];
			let latestSummary: SummaryPart | undefined;
			for (; i < message.content.length; i++) {
				const thinkingContent = message.content[i];
				if (thinkingContent.type !== "thinking") break;
				const thinking = thinkingContent.thinking.trim();
				if (!thinking) continue;
				thinkingBlocks.push(thinking);

				if (config.useSummaryTitlesAsThinkingTitle && isOpenAiResponsesMessage(message)) {
					const contentIsActive =
						activeThinking?.messageTimestamp === message.timestamp &&
						activeThinking.contentIndex === i;
					// During streaming, thinkingSignature may contain only the previously
					// completed summary parts. Prefer the live text so a newly arriving
					// title immediately replaces the old one instead of appearing in its
					// preview body. Once complete, the structured signature is canonical.
					latestSummary = contentIsActive
						? (parseLatestStreamingSummary(thinking) ??
							getLatestOpenAiSummary(thinkingContent.thinkingSignature) ??
							latestSummary)
						: (getLatestOpenAiSummary(thinkingContent.thinkingSignature) ??
							parseLatestStreamingSummary(thinking) ??
							latestSummary);
				}
			}
			const runEndIndex = i - 1;
			i--;
			const active = isActiveRun(message, runStartIndex, runEndIndex);
			// OpenAI can spend several seconds reasoning before it emits the first
			// summary token. Keep an empty active block visible as animated
			// "Thinking..." during that otherwise silent interval.
			if (thinkingBlocks.length === 0 && !active) continue;
			if (hasVisibleContentBefore) {
				self.contentContainer.addChild(new Spacer(1));
			}

			let heading: string;
			if (active && latestSummary) {
				heading = summaryTitleStyle(latestSummary.title);
			} else if (active) {
				heading = thinkingStyle(self.hiddenThinkingLabel || "Thinking...");
			} else {
				heading = thinkingStyle(latestSummary?.title ?? "Thought");
			}
			const previewSource = (latestSummary?.body ?? thinkingBlocks.join("\n\n")).trim();
			self.contentContainer.addChild(
				new ThinkingPreviewBlock(
					heading,
					previewSource,
					self.outputPad,
					message.timestamp,
					thinkingStyle,
					activeTheme,
					runStartIndex,
				),
			);

			const hasVisibleContentAfter = message.content
				.slice(i + 1)
				.some(
					(next) =>
						(next.type === "text" && next.text.trim()) ||
						(next.type === "thinking" && next.thinking.trim()),
				);
			if (hasVisibleContentAfter) self.contentContainer.addChild(new Spacer(1));
		}

		const hasToolCalls = message.content.some((content) => content.type === "toolCall");
		self.hasToolCalls = hasToolCalls;

		if (message.stopReason === "length") {
			self.contentContainer.addChild(new Spacer(1));
			self.contentContainer.addChild(
				new Text(
					activeTheme
						? activeTheme.fg(
								"error",
								"Error: Model stopped because it reached the maximum output token limit. The response may be incomplete.",
							)
						: "Error: Model stopped because it reached the maximum output token limit. The response may be incomplete.",
					self.outputPad,
					0,
				),
			);
		} else if (!hasToolCalls) {
			if (message.stopReason === "aborted") {
				const abortMessage =
					message.errorMessage && message.errorMessage !== "Request was aborted"
						? message.errorMessage
						: "Operation aborted";
				self.contentContainer.addChild(new Spacer(1));
				self.contentContainer.addChild(
					new Text(
						activeTheme ? activeTheme.fg("error", abortMessage) : abortMessage,
						self.outputPad,
						0,
					),
				);
			} else if (message.stopReason === "error") {
				const errorMessage = message.errorMessage || "Unknown error";
				self.contentContainer.addChild(new Spacer(1));
				self.contentContainer.addChild(
					new Text(
						activeTheme
							? activeTheme.fg("error", `Error: ${errorMessage}`)
							: `Error: ${errorMessage}`,
						self.outputPad,
						0,
					),
				);
			}
		}
	};
	const installedUpdateContent = prototype.updateContent;
	(installedUpdateContent as any)[COMPACT_THINKING_PATCH_KEY] = true;

	function startThinking(message: AssistantMessage, contentIndex: number) {
		activeThinking = {
			messageTimestamp: message.timestamp,
			contentIndex,
		};
		streamingComponents.clear();
		if (latestComponent && latestComponentTimestamp === message.timestamp) {
			streamingComponents.add(latestComponent);
			const self = latestComponent as unknown as AssistantInternals;
			self.updateContent(message);
			activeTui?.requestRender();
		}
	}

	function finishThinking() {
		if (!activeThinking) return;
		activeThinking = undefined;
		const components = [...streamingComponents];
		streamingComponents.clear();
		for (const component of components) {
			const self = component as unknown as AssistantInternals;
			if (self.lastMessage) self.updateContent(self.lastMessage);
		}
		activeTui?.requestRender();
	}

	// ---- fork patch：subagent 工具执行期间保持思考状态 ----

	// Subagent tools can run for minutes: keep the thinking loading animation
	// alive for the whole execution and only finalize once the tool ends or the
	// model emits the next text/thinking boundary.
	function resumeAgentThinking(message: AssistantMessage | undefined) {
		if (activeThinking) return;
		const content = message?.content;
		if (!Array.isArray(content)) return;
		const index = content.findIndex((item) => item?.type === "thinking");
		if (index < 0) return;
		startThinking(message as AssistantMessage, index);
	}

	function messageHasAgentTool(message: AssistantMessage | undefined) {
		return (
			Array.isArray(message?.content) &&
			message.content.some(
				(content) =>
					content?.type === "toolCall" &&
					(content.name === "Agent" ||
						content.name === "Agents" ||
						content.arguments?.subagent_type != null),
			)
		);
	}

	pi.on("message_update", (event) => {
		if (event.message.role !== "assistant") return;
		const update = event.assistantMessageEvent;

		if (update.type === "thinking_start") {
			if (activeThinking?.messageTimestamp === event.message.timestamp) {
				// Some Responses-compatible providers emit a fresh thinking_start for
				// each summary/reasoning item even though no text or tool boundary has
				// ended the visible Thinking run. Follow the new content block without
				// resetting the run's original start time.
				activeThinking.contentIndex = update.contentIndex;
			} else {
				if (activeThinking) finishThinking();
				startThinking(event.message, update.contentIndex);
			}
		} else if (update.type === "thinking_delta") {
			if (!activeThinking) {
				startThinking(event.message, update.contentIndex);
			} else if (activeThinking.messageTimestamp === event.message.timestamp) {
				activeThinking.contentIndex = update.contentIndex;
			}
		} else if (update.type === "text_start") {
			finishThinking();
		} else if (update.type === "toolcall_start" || update.type === "toolcall_delta") {
			if (messageHasAgentTool(event.message)) {
				resumeAgentThinking(event.message);
			} else {
				finishThinking();
			}
		}
		// Do not finalize on thinking_end alone. OpenAI Responses providers can
		// close one reasoning item and immediately open another for the next
		// summary while Pi still renders both as one contiguous Thinking run.
		// A text/tool transition or message_end is the actual visible boundary.
	});

	// OpenAI-compatible providers may not close reasoning until the response ends.
	pi.on("tool_execution_start", (event: any) => {
		if (event.toolName === "Agent" || event.toolName === "Agents") {
			const lastMessage = (latestComponent as unknown as { lastMessage?: AssistantMessage })
				?.lastMessage;
			resumeAgentThinking(lastMessage);
		} else {
			finishThinking();
		}
	});
	pi.on("tool_execution_end", (event: any) => {
		if (event.toolName === "Agent" || event.toolName === "Agents") finishThinking();
	});
	pi.on("message_end", (event) => {
		if (event.message.role !== "assistant") return;
		// Agent tool runs after message_end; keep the ticker until tool_execution_end
		// or the next text/thinking boundary.
		if (messageHasAgentTool(event.message)) return;
		finishThinking();
	});

	pi.on("session_start", (_event, ctx) => {
		activeTheme = ctx.ui.theme;
		if (ctx.mode !== "tui") return;

		// An empty widget exposes mounted roots for transcript refresh without
		// enabling terminal mouse reporting or intercepting native scrollback input.
		// setWidget 的 factory 同步执行，此刻补丁已安装。
		ctx.ui.setWidget(WIDGET_ID, (tui) => {
			activeTui = tui;
			return { render: () => [], invalidate() {} };
		});

		// pi 在 reload/resume 时先于 session_start 用原始原型重建聊天组件
		// （rebuildChatFromMessages / renderCurrentSessionState）。由共享的
		// refreshMountedTranscript 扫描挂载树重绘这些组件，恢复 compact 渲染、
		// 工具调用显示。
		refreshMountedTranscript(activeTui);
		activeTui?.requestRender(true);
	});

	pi.on("session_tree", (_event, _ctx) => {
		refreshMountedTranscript(activeTui);
		activeTui?.requestRender(true);
	});

	pi.on("session_shutdown", (_event, ctx) => {
		finishThinking();
		activeTui = undefined;
		activeTheme = undefined;
		latestComponent = undefined;
		latestComponentTimestamp = undefined;
		streamingComponents.clear();
		expandedThinking.clear();
		clearThinkingPreviewCache();
		if (ctx.mode === "tui") ctx.ui.setWidget(WIDGET_ID, undefined);

		if (patchInstalled) {
			if (prototype.updateContent === installedUpdateContent) {
				const wrappedOriginal = (originalUpdateContent as any)[PROTOTYPE_ORIGINAL_KEY];
				prototype.updateContent =
					typeof wrappedOriginal === "function" ? wrappedOriginal : originalUpdateContent;
			}
			patchInstalled = false;
		}
	});
}

type CompactThinkingOwner = {
	owner: object;
	stop(event?: any, ctx?: any): void;
};

type UpstreamHandler = (event: any, ctx: any) => void;

export function installCompactThinking(
	pi: ExtensionAPI,
	initialConfig: CompactThinkingConfig,
): CompactThinkingController {
	const owner = {};
	let session: { event: any; ctx: any } | undefined;
	let active = false;
	// Stable pi.on wrappers delegate here so activate/reload never double-binds.
	const delegates = new Map<string, UpstreamHandler>();
	const boundEvents = new Set<string>();

	const bind = (eventName: string) => {
		if (boundEvents.has(eventName)) return;
		boundEvents.add(eventName);
		pi.on(eventName as any, (e: any, ctx: any) => {
			if (!active) return;
			const handler = delegates.get(eventName);
			if (!handler) return;
			handler(e, ctx);
		});
	};

	const stop = (event?: any, ctx?: any) => {
		if (!active) return;
		active = false;
		const shutdown = delegates.get("session_shutdown");
		delegates.clear();
		shutdown?.(event ?? session?.event ?? {}, ctx ?? session?.ctx ?? { mode: "rpc", ui: {} });
		if (patchRegistry.get<CompactThinkingOwner>(COMPACT_THINKING_OWNER)?.owner === owner)
			patchRegistry.delete(COMPACT_THINKING_OWNER);
	};

	const activate = (event: any, ctx: any) => {
		// Headless subagent runtimes share this process. Never steal the parent
		// TUI prototype patch.
		if (ctx?.mode !== "tui") return;

		patchRegistry.get<CompactThinkingOwner>(COMPACT_THINKING_OWNER)?.stop(event, ctx);
		session = { event, ctx };

		// 配置统一由 claude-code-style 管控，加载时覆盖库默认值。
		Object.assign(config, initialConfig);
		delegates.clear();

		compactThinking({
			on(eventName: string, handler: UpstreamHandler) {
				if (eventName === "session_start") {
					// Already inside session_start — run immediately.
					handler(event, ctx);
					return;
				}
				if (eventName === "session_shutdown") {
					delegates.set(eventName, handler);
					return;
				}
				delegates.set(eventName, handler);
				bind(eventName);
			},
		} as unknown as ExtensionAPI);

		active = true;
		patchRegistry.install(COMPACT_THINKING_OWNER, { owner, stop });
	};

	pi.on("session_start", (event, ctx) => {
		session = { event, ctx };
		activate(event, ctx);
	});
	pi.on("session_shutdown", (event, ctx) => {
		if (patchRegistry.get<CompactThinkingOwner>(COMPACT_THINKING_OWNER)?.owner === owner)
			stop(event, ctx);
		session = undefined;
	});

	return {
		updateConfig(next) {
			Object.assign(initialConfig, next);
			Object.assign(config, next);
		},
	};
}

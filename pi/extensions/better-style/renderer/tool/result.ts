import { getKeybindings, Text, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { Component } from "@earendil-works/pi-tui";
import { config } from "../../config/config.ts";
import { RICH_DIFF_COMPONENT } from "../../utils/patch-keys.ts";
import { TOOL_LOADING_INTERVAL_MS, toolLoadingIcon } from "../../utils/tool-loading-icon.ts";
import { sanitizeToolResultText } from "../../utils/tool-result-sanitize.ts";
import { showMoreHintText } from "./show-more-hint.ts";

export const SHOW_MORE_LABEL = "click to show more";
export const INPUT_LABEL = "Input";
export const OUTPUT_LABEL = "Output";
const TOOL_IO_MARKER_PREFIX = "\x1b]1337;pi-tool-io=";
const TOOL_IO_MARKER_SUFFIX = "\x07";
const EXPANDED_TOOL_IO_VIEW_GENERATION = Symbol.for("pi.better-style.expanded-tool-io-view-generation");
const CURRENT_EXPANDED_TOOL_IO_VIEW_GENERATION = 2;

export type ToolIoSection = "input" | "output";
export type IoViewFrameState = { nextId: number; views: Map<number, ExpandedToolIoView> };

let activeIoViewFrame: IoViewFrameState | null = null;
const ioViewInvalidators = new WeakMap<ExpandedToolIoView, () => void>();

function toolViewMarker(id: number, section: ToolIoSection, edge: "start" | "end"): string {
	return `${TOOL_IO_MARKER_PREFIX}${id}:${section}:${edge}${TOOL_IO_MARKER_SUFFIX}`;
}

function withIoViewMarkers(
	lines: string[],
	view: ExpandedToolIoView,
	section: ToolIoSection,
): string[] {
	const frame = activeIoViewFrame;
	if (!frame || lines.length === 0) return lines;
	const id = frame.nextId++;
	frame.views.set(id, view);
	const marked = [...lines];
	marked[0] = toolViewMarker(id, section, "start") + marked[0];
	marked[marked.length - 1] += toolViewMarker(id, section, "end");
	return marked;
}

/** 注册 ExpandedToolIoView 的局部重绘回调；renderer 容器内使用。 */
export function bindIoViewInvalidator(view: ExpandedToolIoView, invalidate: () => void): void {
	ioViewInvalidators.set(view, invalidate);
}

/** 触发某个 IoView 所在工具卡重绘。 */
export function invalidateIoView(view: ExpandedToolIoView): void {
	ioViewInvalidators.get(view)?.();
}

/** 工具标题行和结果行共享的外部缩进。 */
export function insetComponent(component: Component, prefix = "   "): Component {
	return {
		render(width: number): string[] {
			const inner = Math.max(1, width - visibleWidth(prefix));
			return component.render(inner).map((line) => prefix + line);
		},
		invalidate() {
			component.invalidate();
		},
	};
}

function contentText(content: any): string {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content
			.map((block) => {
				if (typeof block === "string") return block;
				if (block?.type === "text" && typeof block.text === "string") return block.text;
				if (block?.type === "image") {
					const media = block.media_type || block.source?.media_type || "image";
					return `[${media}]`;
				}
				try {
					return JSON.stringify(block);
				} catch {
					return String(block);
				}
			})
			.join("\n");
	}
	if (content === undefined || content === null) return "";
	try {
		return JSON.stringify(content);
	} catch {
		return String(content);
	}
}

/** 从 ToolResult 中提取可读文本。 */
export function textFromResult(result: any, full = false): string {
	const raw = result?.content ?? result;
	let text = contentText(raw);
	if (!full && result?.details !== undefined) {
		const details = contentText(result.details);
		if (details && details !== text) text += `${text ? "\n" : ""}${details}`;
	}
	return sanitizeToolResultText(text);
}

/** 结果文本的逻辑行数。 */
export function countLines(text: string): number {
	const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
	if (!normalized) return 0;
	return normalized.endsWith("\n")
		? normalized.slice(0, -1).split("\n").length
		: normalized.split("\n").length;
}

function resultLabel(toolName: string, text: string, isError: boolean): string {
	const lines = countLines(text);
	const trimmed = text.trim();
	if (isError) return trimmed ? trimmed.split("\n", 1)[0]!.trim() : "failed";
	if (!trimmed) return "Done";
	if (toolName === "read") return `${lines} line${lines === 1 ? "" : "s"} read`;
	if (toolName === "grep" || toolName === "find")
		return `${lines} line${lines === 1 ? "" : "s"} returned`;
	if (toolName === "bash" || toolName === "powershell") {
		return `${lines} line${lines === 1 ? "" : "s"} returned`;
	}
	if (trimmed.includes("\n")) return `${lines} lines returned`;
	return trimmed;
}

export function outputLineCount(result: any): number {
	return countLines(textFromResult(result));
}

function previewLines(text: string, limit: number): { lines: string[]; hidden: number } {
	const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
	const visible = lines.slice(0, Math.max(0, limit));
	return { lines: visible, hidden: Math.max(0, lines.length - visible.length) };
}

function clampLine(line: string, width: number): string {
	return truncateToWidth(line.replace(/\t/g, "    "), Math.max(0, width), "…");
}

/** 从头截断：保留末尾（路径 basename、长命令后缀），前缀显示省略号。 */
export function headTruncateToWidth(text: string, width: number): string {
	if (width <= 0) return "";
	if (visibleWidth(text) <= width) return text;
	const ellipsis = "…";
	const target = Math.max(0, width - visibleWidth(ellipsis));
	if (target <= 0) return truncateToWidth(ellipsis, width, "");
	// 从右向左累加，保留可见宽度 target 的后缀；字符遍历防 surrogate pair 断裂。
	const chars = Array.from(text);
	let suffix = "";
	for (let i = chars.length - 1; i >= 0; i--) {
		const candidate = chars[i] + suffix;
		if (visibleWidth(candidate) > target) break;
		suffix = candidate;
	}
	return ellipsis + suffix;
}

export type ToolVisualState = "pending" | "success" | "error";

export function resolveToolVisualState(context: any): ToolVisualState | undefined {
	if (context?.visualState === "pending" || context?.visualState === "success" || context?.visualState === "error") {
		return context.visualState;
	}
	if (context?.isError) return "error";
	if (context?.isPartial || context?.executionStarted) return "pending";
	return undefined;
}

export function setToolVisualState(context: any, state: ToolVisualState): void {
	if (context && typeof context === "object") context.visualState = state;
}

export function pendingIcon(_toolName: string): string {
	return toolLoadingIcon();
}

export function settledIcon(_toolName: string, state?: ToolVisualState): string {
	if (state === "error") return "✗";
	if (state === "success") return "✓";
	return "●";
}

export function toolIconColor(context: any): string {
	const state = resolveToolVisualState(context);
	if (state === "error") return "error";
	if (state === "success") return "success";
	return "accent";
}

/**
 * 等宽渲染宽度：防止自渲染器拿到无限宽导致长行越界。
 */
export function toolViewportWidth(width: number): number {
	return Math.max(1, Math.floor(Number.isFinite(width) ? width : 1));
}

const animationContexts = new Set<any>();
let animationTimer: ReturnType<typeof setTimeout> | null = null;

function runAnimationTick(): void {
	animationTimer = null;
	for (const context of [...animationContexts]) {
		try {
			context?.invalidate?.();
		} catch {
			animationContexts.delete(context);
		}
	}
	animationContexts.clear();
}

export function scheduleAnimation(context: any): void {
	if (!context || typeof context !== "object") return;
	if (context.betterStyleAnimationScheduled) return;
	context.betterStyleAnimationScheduled = true;
	animationContexts.add(context);
	if (animationTimer) return;
	animationTimer = setTimeout(() => {
		for (const item of animationContexts) {
			if (item && typeof item === "object") item.betterStyleAnimationScheduled = false;
		}
		runAnimationTick();
	}, TOOL_LOADING_INTERVAL_MS);
	animationTimer.unref?.();
}

export function clearAllAnimations(): void {
	if (animationTimer) clearTimeout(animationTimer);
	animationTimer = null;
	for (const context of animationContexts) {
		if (context && typeof context === "object") context.betterStyleAnimationScheduled = false;
	}
	animationContexts.clear();
}

/** 折叠工具结果摘要。 */
export function renderCollapsedToolResultToWidth(
	toolName: string,
	result: any,
	width: number,
	theme: any,
	isError: boolean,
): Component {
	const text = textFromResult(result);
	const label = resultLabel(toolName, text, isError);
	const color = isError ? "error" : "muted";
	return new Text(theme.fg(color, `↳ ${clampLine(label, Math.max(1, width - 2))}`), 0, 0);
}

/** 结果是否值得展开。 */
export function hasExpandableDetail(text: string): boolean {
	return countLines(text) > 1 || text.length > 160;
}

function keyHint(): string {
	const keys = getKeybindings().getKeys("app.tools.expand");
	return keys.length ? keys.join("/") : "Ctrl+O";
}

/** 展开工具结果（非 rich diff）。 */
export function renderExpandedToolResult(
	text: string,
	width: number,
	theme: any,
	maxLines = config.expandedPreviewMaxLines,
): Component {
	const safeWidth = Math.max(1, width);
	const limited = previewLines(text, maxLines);
	const output = limited.lines.map((line) => clampLine(line, safeWidth));
	if (limited.hidden > 0) {
		output.push(theme.fg("dim", `… ${limited.hidden} more lines · ${keyHint()} to expand`));
	}
	return new Text(output.join("\n") || theme.fg("muted", "Done"), 0, 0);
}

export function isToolExpanded(options: any, context: any): boolean {
	return Boolean(options?.expanded ?? context?.expanded);
}

function valueText(value: unknown): string {
	if (typeof value === "string") return value;
	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return String(value);
	}
}

export function formatToolInputArgs(args: unknown): string {
	if (!args || typeof args !== "object") return valueText(args ?? "");
	const entries = Object.entries(args as Record<string, unknown>);
	if (!entries.length) return "";
	return entries.map(([key, value]) => `${key}: ${valueText(value)}`).join("\n");
}

function sectionLines(
	label: string,
	body: string,
	width: number,
	maxLines: number,
	theme: any,
	section: ToolIoSection,
	view: ExpandedToolIoView,
): string[] {
	const contentWidth = Math.max(1, width - 2);
	const limited = previewLines(body, maxLines);
	const lines = [theme.fg("accent", label)];
	for (const line of limited.lines) lines.push(`│ ${clampLine(line, contentWidth)}`);
	if (limited.hidden > 0) {
		const hovered = view.isHeaderHovered(section);
		const hintColor = hovered ? "text" : "dim";
		lines.push(`│ ${theme.fg(hintColor, `… ${limited.hidden} more lines · ${showMoreHintText()}`)}`);
	}
	if (!body.trim()) lines.push(theme.fg("muted", "│ (empty)"));
	return withIoViewMarkers(lines, view, section);
}

/**
 * Expanded ordinary tool I/O card. This remains a Component so the enclosing
 * ToolExecutionComponent can own expansion and re-rendering.
 */
export class ExpandedToolIoView implements Component {
	readonly [EXPANDED_TOOL_IO_VIEW_GENERATION] = CURRENT_EXPANDED_TOOL_IO_VIEW_GENERATION;
	private inputBody = "";
	private outputBody = "";
	private theme: any;
	private hoveredSection: ToolIoSection | null = null;

	constructor(inputBody: string, outputBody: string, theme: any) {
		this.setContent(inputBody, outputBody, theme);
	}

	setContent(inputBody: string, outputBody: string, theme: any): void {
		this.inputBody = inputBody;
		this.outputBody = outputBody;
		this.theme = theme;
	}

	getInputBody(): string {
		return this.inputBody;
	}

	getOutputBody(): string {
		return this.outputBody.trim() ? this.outputBody : "Done";
	}

	setHoveredSection(section: ToolIoSection | null): void {
		if (this.hoveredSection === section) return;
		this.hoveredSection = section;
		this.invalidate();
	}

	isHeaderHovered(section: ToolIoSection): boolean {
		return this.hoveredSection === section;
	}

	matchShowMoreLine(line: string): ToolIoSection | undefined {
		if (!line.includes("more lines")) return undefined;
		if (line.includes(INPUT_LABEL)) return "input";
		if (line.includes(OUTPUT_LABEL)) return "output";
		return undefined;
	}

	render(width: number): string[] {
		const safeWidth = Math.max(1, width);
		const input = sectionLines(
			INPUT_LABEL,
			this.inputBody,
			safeWidth,
			config.expandedInputMaxLines,
			this.theme,
			"input",
			this,
		);
		const output = sectionLines(
			OUTPUT_LABEL,
			this.outputBody,
			safeWidth,
			config.expandedOutputMaxLines,
			this.theme,
			"output",
			this,
		);
		return [...input, "", ...output];
	}

	invalidate(): void {
		invalidateIoView(this);
	}
}

/** Structural guard that also rejects stale generations after /reload. */
export function isExpandedToolIoView(value: unknown): value is ExpandedToolIoView {
	return Boolean(
		value &&
			typeof value === "object" &&
			(value as any)[EXPANDED_TOOL_IO_VIEW_GENERATION] ===
				CURRENT_EXPANDED_TOOL_IO_VIEW_GENERATION &&
			typeof (value as any).setContent === "function" &&
			typeof (value as any).render === "function",
	);
}

export function getActiveIoViewFrame(): IoViewFrameState | null {
	return activeIoViewFrame;
}

export function setActiveIoViewFrame(frame: IoViewFrameState | null): void {
	activeIoViewFrame = frame;
}

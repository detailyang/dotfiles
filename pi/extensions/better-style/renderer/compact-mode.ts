/**
 * Compact mode：每条含 toolCall 的 assistant message 折叠为一条逐步累加的摘要行
 * （`Running..., bash×2, read×2`），edit/write 独立标题行（`✓ write <path> (+25 -0)`），
 * 普通工具折叠时不显示独立行；展开（Ctrl+O / fullscreen 点击）在单个工具卡中恢复
 * compact-thinking/Pi 原生或专用 renderer。edit/write 复用 mode=on 的 rich diff
 * 与 `editDiffCollapsedLines` / `writeDiffCollapsedLines` / `expandedPreviewMaxLines`。
 * Agent/Task 族：调用只进摘要计数，tool 卡始终折叠（避免 pending→完成高度闪动）。
 * 底部 Agents/Tasks 面板由 pi-subagents/pi-tasks 独立 widget 负责，不经 tool 卡外置。
 *
 * 工具计数：read 按非空路径去重、其余按调用计数（首次出现顺序）；edit/write 不进摘要。
 * 进行中显示静态 Running...，结束后仅保留工具计数。
 * abort/error/length 状态行挂在摘要外层，避免被折叠吞掉。
 * 最终 agent 回合摘要由 feature/agent-summary 独占（bash/read/edit/write/other）。
 *
 * 补丁生命周期遵循仓库既有模式：Symbol 所有权、dispose 仅恢复仍由本安装持有的
 * 方法、重入守卫防止 /reload 后残留闭包递归。
 */
import {
	AssistantMessageComponent,
	ToolExecutionComponent,
	type Theme,
} from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth, Box, Spacer } from "@earendil-works/pi-tui";
import { config, getToolDisplayConfig } from "../config/config.ts";
import { toolLoadingIcon } from "../utils/tool-loading-icon.ts";
import { sanitizeToolResultText } from "../utils/tool-result-sanitize.ts";
import { refreshTranscriptComponent } from "./transcript-refresh.ts";
import { getMessageDisplayTheme } from "./tool/message-display.ts";
import { showMoreHintText } from "./tool/show-more-hint.ts";
import {
	countEditDiffStats,
	countWriteDiffStats,
	isRichDiffComponent,
} from "./tool/diff/diff-renderer.ts";
import { renderRichToolResult } from "./tool/diff/index.ts";
import type { WriteExecutionMetadataStore } from "./tool/diff/write-execution.ts";
import { insetComponent, renderExpandedToolResult } from "./tool/result.ts";
import { oneLine } from "../utils/format.ts";
import {
	paddedBackgroundRow,
	toolBackgroundSlot,
	toolStatus,
	type ToolStatus,
} from "./tool/grouping.ts";
import { hasVisibleText, stripBackgroundAnsi } from "../utils/ansi-text.ts";
import { walkComponentTree } from "../utils/component-tree.ts";
import {
	ASSISTANT_REENTRY_KEY,
	ASSISTANT_SET_EXPANDED_KEY,
	ASSISTANT_TOGGLE_ROUND_KEY,
	COMPACT_MODE_PATCH_KEY,
	COMPACT_THINKING_PATCH_KEY,
	patchRegistry,
	PROTOTYPE_ORIGINAL_KEY,
} from "../utils/patch-keys.ts";

const EDIT_WRITE_TOOLS = new Set(["edit", "write"]);

type CompactThinkingTheme = Pick<Theme, "fg" | "italic" | "bold">;

/** 与 compact-thinking 主渲染器共用的静态文字样式。 */
export function styleCompactThinkingText(
	text: string,
	theme: CompactThinkingTheme | undefined,
	bold = false,
): string {
	if (!theme) return text;
	const color = config.dimThinkingText ? "dim" : "thinkingText";
	const colored = typeof theme.fg === "function" ? theme.fg(color, text) : text;
	const weighted = bold && typeof theme.bold === "function" ? theme.bold(colored) : colored;
	return typeof theme.italic === "function" ? theme.italic(weighted) : weighted;
}

/** assistant stopReason → 外层状态文案（与 Pi 原生口径对齐）。 */
export function messageStopStatus(message: any): string | undefined {
	const reason = message?.stopReason;
	if (reason === "aborted") {
		return message.errorMessage && message.errorMessage !== "Request was aborted"
			? String(message.errorMessage)
			: "Operation aborted";
	}
	if (reason === "error") {
		return `Error: ${message.errorMessage || "Unknown error"}`;
	}
	if (reason === "length") {
		return "Response was truncated before completion.";
	}
	return undefined;
}

function roundStopStatus(messages: Iterable<any>): string | undefined {
	for (const message of messages) {
		const status = messageStopStatus(message);
		if (status) return status;
	}
	return undefined;
}

/** Build a compact summary without elapsed-time tracking. */
function buildMessagesSummary(messages: Iterable<any>, runningActive = false): string {
	const parts: string[] = [];
	const counts = new Map<string, number>();
	const readPaths = new Set<string>();
	for (const message of messages) {
		const content = Array.isArray(message?.content) ? message.content : [];
		for (const item of content) {
			if (item?.type !== "toolCall") continue;
			const rawName = typeof item.name === "string" ? item.name : "tool";
			if (EDIT_WRITE_TOOLS.has(rawName)) continue;
			const name = sanitizeToolResultText(rawName);
			if (rawName.split(".").pop() === "read") {
				const args = item.arguments ?? item.args ?? {};
				const path = args.path ?? args.file_path ?? args.file;
				if (typeof path === "string" && path.length > 0) {
					if (readPaths.has(path)) continue;
					readPaths.add(path);
				}
			}
			counts.set(name, (counts.get(name) ?? 0) + 1);
		}
	}
	if (runningActive) parts.push("Running...");
	for (const [name, count] of counts) parts.push(`${name}×${count}`);
	return parts.join(", ");
}

export function buildMessageSummary(message: any): string {
	return buildMessagesSummary([message]);
}

function fallbackTheme(): any {
	return {
		fg: (_color: string, text: string) => text,
		italic: (text: string) => text,
		bold: (text: string) => text,
	};
}

function themeOf(): any {
	return getMessageDisplayTheme() ?? fallbackTheme();
}

/** edit/write expanded cards use their current tool status background. */
function editWriteExpandedCard(theme: any, status: ToolStatus): any {
	const slot = toolBackgroundSlot(status);
	return new Box(
		1,
		1,
		typeof theme?.bg === "function" ? (text: string) => theme.bg(slot, text) : undefined,
	);
}

function nestedToolCardRow(line: string, width: number): string {
	const leftInset = 2;
	const rightInset = 3;
	const contentWidth = Math.max(0, width - leftInset - rightInset);
	const text = stripBackgroundAnsi(line).replace(/^ +/, "");
	const innerPad = 2;
	const clipped = truncateToWidth(text, Math.max(0, contentWidth - innerPad), "");
	const pad = Math.max(0, contentWidth - innerPad - visibleWidth(clipped));
	return `${" ".repeat(leftInset)} ${clipped}${" ".repeat(pad)} ${" ".repeat(rightInset)}`;
}

function layoutExpandedToolCard(
	theme: any,
	children: any[],
	width: number,
	backgroundSlot: "toolPendingBg" | "toolSuccessBg" | "toolErrorBg",
): { lines: string[]; hits: Array<{ child: any; start: number; end: number }> } {
	const innerWidth = Math.max(0, width - 2);
	const lines: string[] = [];
	const hits: Array<{ child: any; start: number; end: number }> = [];
	const isThinkingPreview = (child: any) => typeof child?.setHintHovered === "function";
	lines.push(paddedBackgroundRow(theme, backgroundSlot, "", width));
	let skipLeadingBlank = true;
	for (const child of children) {
		const childLines = child.render(innerWidth);
		const nest = child.__ccToolCard || (isThinkingPreview(child) && child.expanded === true);
		if (!nest) {
			let start = 0;
			if (skipLeadingBlank) {
				while (start < childLines.length && !hasVisibleText(childLines[start])) start++;
				skipLeadingBlank = false;
			}
			const rangeStart = lines.length;
			for (let i = start; i < childLines.length; i++) {
				lines.push(paddedBackgroundRow(theme, backgroundSlot, childLines[i], width));
			}
			if (lines.length > rangeStart) hits.push({ child, start: rangeStart, end: lines.length });
			continue;
		}
		skipLeadingBlank = false;
		let first = -1;
		let last = -1;
		for (let i = 0; i < childLines.length; i++) {
			if (hasVisibleText(childLines[i])) {
				if (first < 0) first = i;
				last = i;
			}
		}
		if (first < 0) {
			for (const line of childLines) {
				lines.push(paddedBackgroundRow(theme, backgroundSlot, line, width));
			}
			continue;
		}
		lines.push(paddedBackgroundRow(theme, backgroundSlot, "", width));
		const rangeStart = lines.length;
		lines.push(paddedBackgroundRow(theme, backgroundSlot, nestedToolCardRow("", width), width));
		for (let i = first; i <= last; i++) {
			lines.push(
				paddedBackgroundRow(theme, backgroundSlot, nestedToolCardRow(childLines[i], width), width),
			);
		}
		lines.push(paddedBackgroundRow(theme, backgroundSlot, nestedToolCardRow("", width), width));
		if (isThinkingPreview(child)) hits.push({ child, start: rangeStart, end: lines.length });
	}
	lines.push(paddedBackgroundRow(theme, backgroundSlot, "", width));
	return { lines, hits };
}

function compactRoundCard(
	cardItems: Array<{ child?: any; tool?: any }>,
	toolRender: (tool: any, width: number) => string[],
	isRoundActive: () => boolean,
): any {
	const children: any[] = [];
	for (const item of cardItems) {
		if (item.child) children.push(item.child);
		else if (item.tool) {
			const tool = item.tool;
			children.push({
				__ccToolCard: true,
				render: (innerWidth: number) => toolRender(tool, innerWidth),
				invalidate: () => tool.invalidate?.(),
			});
		}
	}
	const backgroundSlot = () => {
		const statuses = cardItems
			.filter((item) => item.tool)
			.map((item) => toolStatus(item.tool));
		const status: ToolStatus = statuses.includes("error")
			? "error"
			: isRoundActive() || statuses.includes("pending")
				? "pending"
				: "success";
		return toolBackgroundSlot(status);
	};
	return {
		children,
		render(width: number): string[] {
			return [
				"",
				...layoutExpandedToolCard(themeOf(), children, width, backgroundSlot()).lines,
			];
		},
		childAtRow(localRow: number, width: number) {
			if (localRow < 1) return null;
			const row = localRow - 1;
			const { hits } = layoutExpandedToolCard(
				themeOf(),
				children,
				width,
				backgroundSlot(),
			);
			for (const hit of hits) {
				if (row >= hit.start && row < hit.end) return hit.child;
			}
			return null;
		},
		invalidate() {
			for (const child of children) child.invalidate?.();
		},
	};
}

function isAssistantComponent(value: any): boolean {
	return value instanceof AssistantMessageComponent;
}

function isToolComponent(value: any): boolean {
	return value instanceof ToolExecutionComponent;
}

function detachAssistantExpansion(component: any): void {
	if (
		typeof component?.[ASSISTANT_SET_EXPANDED_KEY] !== "function" ||
		component.setExpanded !== component[ASSISTANT_SET_EXPANDED_KEY]
	) {
		return;
	}
	delete component.setExpanded;
	delete component[ASSISTANT_SET_EXPANDED_KEY];
	delete component[ASSISTANT_TOGGLE_ROUND_KEY];
	delete component[ASSISTANT_REENTRY_KEY];
}

/** 供 mouse-interaction 识别可点击的 compact assistant 行（仅 compact 模式下生效）。 */
export function isCompactAssistantComponent(value: unknown): boolean {
	if (config.mode !== "compact" || !value || typeof value !== "object") return false;
	const component = value as any;
	return (
		typeof component[ASSISTANT_SET_EXPANDED_KEY] === "function" &&
		component.setExpanded === component[ASSISTANT_SET_EXPANDED_KEY]
	);
}

export type CompactModeHooks = {
	/** 会话事件后同步：所有权、全局展开状态、已挂载组件。 */
	sync(ctx: any): void;
	/** 重绘所有被跟踪的 assistant/tool 组件（模式切换用）。 */
	refresh(): void;
	/** compact 模式下重新认领 assistant patch（位于 compact-thinking 之上）。 */
	assertOwnership(): void;
	/** 重新渲染包含指定 toolCallId 的 assistant 消息（思考收尾时刷新）。 */
	refreshToolCallMessage(toolCallId: string | undefined): void;
	shutdown(): void;
};

type CompactModeInstallDeps = {
	writeMetadata: WriteExecutionMetadataStore;
};

type CompactModePatch = {
	active: boolean;
	prototype: any;
	assistantInstalled: (...args: any[]) => any;
	assistantOriginal: (...args: any[]) => any;
	assistantNative: (...args: any[]) => any;
	toolInstalledRender: (width: number) => string[];
	toolInstalledUpdateDisplay: () => void;
	toolOriginalRender: (width: number) => string[];
	toolOriginalUpdateDisplay: () => void;
	assertAssistantOwnership: () => void;
	dispose: () => void;
};

const trackedAssistantComponents = new Set<any>();
const trackedToolComponents = new Set<any>();
let hoveredAssistantComponent: any;

export function setHoveredCompactAssistant(component: any): boolean {
	if (hoveredAssistantComponent === component) return false;
	hoveredAssistantComponent = component;
	return true;
}

function compactEditWriteLine(
	component: any,
	width: number,
	writeMetadata?: WriteExecutionMetadataStore,
	options: { hint?: boolean; flushLeft?: boolean } = {},
): string[] {
	const theme = themeOf();
	const name = String(component.toolName ?? "tool");
	const args = component.args ?? {};
	const path = sanitizeToolResultText(
		typeof args.path === "string" && args.path
			? args.path
			: typeof args.file_path === "string" && args.file_path
				? args.file_path
				: "",
	);
	const isError = component.result?.isError === true;
	const isPending = !component.result || component.isPartial === true;
	const icon = isError ? "✗" : isPending ? toolLoadingIcon() : "✓";
	const iconColor = isError ? "error" : isPending ? "accent" : "success";
	let statsText = "";
	let statsStyled = "";
	if (!isError && !isPending) {
		const stats =
			name === "edit"
				? countEditDiffStats(component.result?.details)
				: name === "write"
					? countWriteDiffStats(
							typeof args.content === "string" ? args.content : undefined,
							writeMetadata?.get(component.toolCallId)?.previousContent,
							writeMetadata?.get(component.toolCallId)?.fileExistedBeforeWrite,
						)
					: undefined;
		if (stats) {
			statsText = ` (+${stats.added} -${stats.removed})`;
			statsStyled = ` ${theme.fg("dim", "(")}${theme.fg("success", `+${stats.added}`)} ${theme.fg("error", `-${stats.removed}`)}${theme.fg("dim", ")")}`;
		}
	}
	// 展开卡 Box(1,1) 已 pad；折叠行自己留 1 格前导空格
	const iconPart = `${options.flushLeft ? "" : " "}${theme.fg(iconColor, icon)} `;
	const namePart = theme.fg("toolTitle", name);
	const hintText =
		options.hint !== false && component.expanded !== true ? ` • ${showMoreHintText()}` : "";
	const fixedWidth =
		visibleWidth(iconPart) +
		visibleWidth(namePart) +
		visibleWidth(statsText) +
		visibleWidth(hintText);
	const pathWidth = Math.max(0, width - fixedWidth - (path ? 1 : 0));
	const pathPart = pathWidth > 0 && path ? ` ${oneLine(path, pathWidth)}` : "";
	const line = `${iconPart}${namePart}${theme.fg("toolTitle", pathPart)}${statsStyled}${hintText ? theme.fg("dim", hintText) : ""}`;
	return ["", truncateToWidth(line, width, "")];
}

/** expanded 写进 rich diff 闭包，折叠/展开分槽缓存，避免每帧 parseDiff。 */
const compactRichDiffCache = new WeakMap<
	object,
	{ result: unknown; collapsed?: unknown; expanded?: unknown }
>();

/**
 * compact edit/write：标题行 + mode=on 同一套 rich diff。
 * 折叠/展开都走 `renderRichToolResult`，limits 不另开一套。
 */
function compactEditWriteLines(
	component: any,
	width: number,
	writeMetadata?: WriteExecutionMetadataStore,
): string[] {
	const theme = themeOf();
	const result = component.result;
	const expanded = component.expanded === true;
	const isError = result?.isError === true;
	const isPending = !result || component.isPartial === true;
	let candidate: unknown;
	if (!isPending && writeMetadata) {
		let entry = compactRichDiffCache.get(component);
		if (!entry || entry.result !== result) {
			entry = { result };
			compactRichDiffCache.set(component, entry);
		}
		const slot = expanded ? "expanded" : "collapsed";
		candidate = entry[slot];
		if (!isRichDiffComponent(candidate)) {
			candidate = renderRichToolResult(
				String(component.toolName ?? ""),
				result,
				{
					expanded,
					isPartial: component.isPartial === true,
					isError,
					isHovered: () => false,
				},
				theme,
				component,
				writeMetadata,
				getToolDisplayConfig,
			);
			if (isRichDiffComponent(candidate)) entry[slot] = candidate;
		}
	}
	const hasRich = isRichDiffComponent(candidate);
	if (hasRich) {
		component.resultRendererComponent = candidate;
	}

	const title = compactEditWriteLine(component, width, writeMetadata, { hint: !hasRich });
	if (!hasRich && !expanded) {
		return title;
	}

	let detail: any;
	if (hasRich) {
		detail = expanded ? candidate : insetComponent(candidate as any);
	} else {
		const outputText = sanitizeToolResultText(
			Array.isArray(result?.content)
				? result.content
						.filter((item: any) => item?.type === "text")
						.map((item: any) => String(item.text ?? ""))
						.join("\n")
				: "",
		);
		const state = (component.state ??= {});
		detail = renderExpandedToolResult(
			outputText,
			theme,
			isError,
			state.ccstyleIoView,
			component.args,
			component,
			true, // 外层 Box(1,1) 已 pad
		);
		component.resultRendererComponent = detail;
	}

	if (!expanded) {
		return [...title, ...detail.render(width)];
	}

	const box = editWriteExpandedCard(theme, toolStatus(component));
	box.addChild({
		render(innerWidth: number): string[] {
			return compactEditWriteLine(component, innerWidth, writeMetadata, {
				hint: false,
				flushLeft: true,
			}).slice(1);
		},
		invalidate() {},
	});
	box.addChild(detail);
	// 与原生 ToolExecutionComponent 一样：Spacer(1) + Box，否则贴上一条 tool 少 1 行间距
	return ["", ...box.render(width)];
}

function compactAssistantLineComponent(
	component: any,
	summary: string | (() => string),
	options: { hint?: boolean; leadingBlank?: boolean; pad?: number } = {},
): any {
	const self = component as any;
	return {
		render(width: number): string[] {
			const theme = themeOf();
			const pad = Math.max(0, options.pad ?? (Number(self.outputPad) || 0));
			const available = Math.max(0, width - pad);
			const hintText = options.hint === false ? "" : ` • ${showMoreHintText()}`;
			const summaryWidth = Math.max(0, available - visibleWidth(hintText));
			const resolved = typeof summary === "function" ? summary() : summary;
			const plainText = truncateToWidth(resolved, summaryWidth, "…");
			let text = theme.fg("muted", plainText);
			if (plainText.startsWith("Running...")) {
				const separator = plainText.indexOf(", ");
				const heading = separator < 0 ? plainText : plainText.slice(0, separator);
				const tools = separator < 0 ? "" : plainText.slice(separator);
				text = `${styleCompactThinkingText(heading, theme)}${theme.fg("muted", tools)}`;
			}
			const hintColor = hoveredAssistantComponent === component ? "text" : "dim";
			const line = `${text}${hintText ? theme.fg(hintColor, hintText) : ""}`;
			const rendered = `${" ".repeat(pad)}${truncateToWidth(line, available, "")}`;
			return options.leadingBlank === false ? [rendered] : ["", rendered];
		},
		invalidate() {},
	};
}

function compactStopStatusLine(status: string, pad = 0): any {
	return {
		render(width: number): string[] {
			const theme = themeOf();
			const prefix = " ".repeat(Math.max(0, pad));
			const line = `${prefix}${theme.fg("error", status)}`;
			return ["", truncateToWidth(line, width, "")];
		},
		invalidate() {},
	};
}

function compactAssistantLine(component: any, summary: string | (() => string)): void {
	if (typeof summary === "string" && !summary) return;
	component.contentContainer.addChild(compactAssistantLineComponent(component, summary));
}

function appendStopStatus(component: any, status: string | undefined): void {
	if (!status || !component?.contentContainer?.addChild) return;
	component.contentContainer.addChild(
		compactStopStatusLine(status, Number(component.outputPad) || 0),
	);
}

function ensureAssistantSetExpanded(component: any): void {
	if (
		typeof component[ASSISTANT_SET_EXPANDED_KEY] === "function" &&
		component.setExpanded === component[ASSISTANT_SET_EXPANDED_KEY]
	) {
		return;
	}
	if (typeof component.setExpanded === "function") {
		detachAssistantExpansion(component);
		if (typeof component.setExpanded === "function") return;
	}
	const installed = function (this: any, expanded: boolean) {
		if (config.mode !== "compact") {
			detachAssistantExpansion(this);
			return;
		}
		const toggleRound = this[ASSISTANT_TOGGLE_ROUND_KEY];
		if (typeof toggleRound === "function") {
			toggleRound(expanded);
			return;
		}
		this.expanded = expanded;
		if (typeof this.updateContent === "function" && this.lastMessage) {
			this.updateContent(this.lastMessage);
		}
	};
	component[ASSISTANT_SET_EXPANDED_KEY] = installed;
	component.setExpanded = installed;
}

function collectMountedComponents(root: any): void {
	if (!root || typeof root !== "object") return;
	const assistants = new Set<any>();
	const tools = new Set<any>();
	walkComponentTree(root, (value: any) => {
		if (isAssistantComponent(value)) {
			assistants.add(value);
			// 仅在 compact 模式给实例装 setExpanded，避免 on/off 下 Ctrl+O/mouse 回归。
			if (config.mode === "compact") ensureAssistantSetExpanded(value);
		} else if (isToolComponent(value)) {
			tools.add(value);
		}
	});
	// 扫到组件才替换跟踪表。面板/custom UI 打开时 root 往往扫不到 transcript，
	// 若此时清空会丢掉 live updateContent/updateDisplay 已登记的实例，
	// /better-style 切换就只能靠 /reload 重建。
	if (assistants.size > 0 || tools.size > 0) {
		trackedAssistantComponents.clear();
		trackedToolComponents.clear();
		for (const component of assistants) trackedAssistantComponents.add(component);
		for (const component of tools) trackedToolComponents.add(component);
	} else if (config.mode === "compact") {
		for (const component of trackedAssistantComponents) ensureAssistantSetExpanded(component);
	}
}

export function installCompactMode(deps: CompactModeInstallDeps): CompactModeHooks {
	const previous = patchRegistry.get<CompactModePatch>(COMPACT_MODE_PATCH_KEY);
	if (previous) previous.dispose();

	const assistantPrototype = AssistantMessageComponent.prototype as any;
	const toolPrototype = ToolExecutionComponent.prototype as any;
	const patch: CompactModePatch = {
		active: true,
		prototype: assistantPrototype,
		assistantInstalled: undefined as any,
		assistantOriginal: assistantPrototype.updateContent,
		assistantNative: assistantPrototype.updateContent,
		toolInstalledRender: undefined as any,
		toolInstalledUpdateDisplay: undefined as any,
		toolOriginalRender: toolPrototype.render,
		toolOriginalUpdateDisplay: toolPrototype.updateDisplay,
		assertAssistantOwnership: () => {},
		dispose: () => {},
	};

	const passThroughAssistant = (component: any, message: any, isStreaming?: boolean): any => {
		const self = component as any;
		if (self[ASSISTANT_REENTRY_KEY] === patch)
			return patch.assistantNative.call(component, message, isStreaming);
		self[ASSISTANT_REENTRY_KEY] = patch;
		try {
			return patch.assistantOriginal.call(component, message, isStreaming);
		} finally {
			delete self[ASSISTANT_REENTRY_KEY];
		}
	};

	type CompactRound = {
		anchor: any;
		messages: Map<any, any>;
		detachedMessages: any[];
		active: boolean;
		suppressedToolIds: Set<string>;
	};
	let activeRound: CompactRound | undefined;
	let roundByComponent = new WeakMap<object, CompactRound>();
	const expandedRoundToolIds = new Set<string>();

	const summarize = (messages: Iterable<any>, runningActive = false) =>
		buildMessagesSummary(messages, runningActive);

	/** End the active round; event-driven renders update the static summary. */
	const endRound = (round: CompactRound, render = false): void => {
		round.active = false;
		if (activeRound === round) activeRound = undefined;
		if (render) renderRound(round);
	};

	const renderAssistantWithoutThinking = (
		component: any,
		message: any,
		isStreaming?: boolean,
	): any => {
		const content = Array.isArray(message?.content) ? message.content : [];
		const result = passThroughAssistant(
			component,
			{
				...message,
				content: content.filter((item: any) => item?.type !== "thinking"),
			},
			isStreaming,
		);
		component.lastMessage = message;
		return result;
	};

	const roundMessages = (round: CompactRound): any[] => [
		...round.messages.values(),
		...round.detachedMessages,
	];

	const roundToolCallIds = (round: CompactRound): Set<string> => {
		const ids = new Set<string>();
		for (const message of roundMessages(round)) {
			for (const item of Array.isArray(message?.content) ? message.content : []) {
				if (item?.type === "toolCall" && typeof item.id === "string") ids.add(item.id);
			}
		}
		return ids;
	};

	const renderRound = (round: CompactRound): void => {
		const messages = roundMessages(round);
		const stopStatus = roundStopStatus(messages);
		if (stopStatus) endRound(round);
		const getSummary = () => summarize(roundMessages(round), round.active);
		const summary = getSummary();
		for (const id of round.suppressedToolIds) expandedRoundToolIds.delete(id);
		round.suppressedToolIds.clear();

		for (const [component, message] of round.messages) {
			component.lastMessage = message;
			ensureAssistantSetExpanded(component);
			component[ASSISTANT_TOGGLE_ROUND_KEY] = (expanded: boolean) => {
				for (const member of round.messages.keys()) member.expanded = expanded;
				if (!expanded) {
					for (const id of round.suppressedToolIds) expandedRoundToolIds.delete(id);
					round.suppressedToolIds.clear();
				}
				renderRound(round);
			};
		}

		if (round.anchor.expanded === true) {
			const toolsById = new Map<string, any>();
			for (const tool of trackedToolComponents) {
				if (typeof tool?.toolCallId === "string") toolsById.set(tool.toolCallId, tool);
			}
			const cardItems: Array<{ child?: any; tool?: any }> = [];
			const placedToolIds = new Set<string>();
			const takeAssistantRun = (kids: any[], cursor: { i: number }) => {
				while (cursor.i < kids.length && kids[cursor.i] instanceof Spacer) {
					cardItems.push({ child: kids[cursor.i++] });
				}
				if (cursor.i < kids.length) cardItems.push({ child: kids[cursor.i++] });
			};
			const placeTool = (id: string, fallbackName?: string) => {
				const tool = toolsById.get(id);
				if (!tool || EDIT_WRITE_TOOLS.has(String(tool.toolName ?? fallbackName ?? ""))) return;
				if (placedToolIds.has(id)) return;
				placedToolIds.add(id);
				cardItems.push({ tool });
			};
			for (const [component, message] of round.messages) {
				passThroughAssistant(component, message);
				const kids = Array.isArray(component.contentContainer?.children)
					? [...component.contentContainer.children]
					: [];
				component.contentContainer?.clear?.();
				const cursor = { i: 0 };
				let inThinkingRun = false;
				for (const item of Array.isArray(message?.content) ? message.content : []) {
					if (item?.type === "thinking") {
						if (!String(item.thinking ?? "").trim()) continue;
						if (!inThinkingRun) {
							takeAssistantRun(kids, cursor);
							inThinkingRun = true;
						}
						continue;
					}
					inThinkingRun = false;
					if (item?.type === "text" && String(item.text ?? "").trim()) {
						takeAssistantRun(kids, cursor);
						continue;
					}
					if (item?.type === "toolCall" && typeof item.id === "string") {
						placeTool(item.id, item.name);
					}
				}
				while (cursor.i < kids.length) cardItems.push({ child: kids[cursor.i++] });
			}
			for (const message of round.detachedMessages) {
				for (const item of Array.isArray(message?.content) ? message.content : []) {
					if (item?.type === "toolCall" && typeof item.id === "string") {
						placeTool(item.id, item.name);
					}
				}
			}
			const ids = roundToolCallIds(round);
			for (const id of ids) {
				round.suppressedToolIds.add(id);
				expandedRoundToolIds.add(id);
				if (!placedToolIds.has(id)) placeTool(id);
			}
			// Round 展开只打开外层卡片。普通工具保持折叠，避免长输出递归撑满屏幕。
			for (const tool of trackedToolComponents) {
				if (
					!ids.has(tool.toolCallId) ||
					EDIT_WRITE_TOOLS.has(String(tool.toolName ?? "")) ||
					tool.expanded !== true
				) {
					continue;
				}
				if (typeof tool.setExpanded === "function") tool.setExpanded(false);
				else {
					tool.expanded = false;
					tool.updateDisplay?.();
				}
			}
			round.anchor.contentContainer.addChild(
				compactRoundCard(
					cardItems,
					(tool, innerWidth) => patch.toolOriginalRender.call(tool, innerWidth),
					() => round.active,
				),
			);
			// 展开卡内工具会显示 error，外层仍挂 abort/length，避免只藏在折叠工具里。
			appendStopStatus(round.anchor, stopStatus);
			return;
		}

		for (const [component, message] of round.messages) {
			if (component === round.anchor) {
				renderAssistantWithoutThinking(component, message);
				// 空摘要不挂行（getter 在 Running 启动瞬间也可能短暂为空）
				if (summary || round.active) compactAssistantLine(component, getSummary);
				// 折叠时工具行被隐藏：abort/error/length 必须挂在摘要外层。
				appendStopStatus(component, stopStatus);
			} else {
				component.contentContainer?.clear?.();
			}
		}
	};

	const activateRound = (round: CompactRound): void => {
		round.active = true;
		activeRound = round;
	};

	const finishRound = (round: CompactRound): void => endRound(round, true);

	const resetRounds = (): void => {
		activeRound = undefined;
		roundByComponent = new WeakMap();
		expandedRoundToolIds.clear();
	};

	patch.assistantInstalled = function (this: any, message: any, isStreaming?: boolean) {
		const self = this as any;
		// 同 compact-thinking：isStreaming 丢失 → mermaid 流式误渲染来回闪。
		if (isStreaming !== undefined) self.isStreaming = isStreaming;
		if (self[ASSISTANT_REENTRY_KEY] === patch) {
			return patch.assistantNative.call(this, message, isStreaming);
		}
		self.lastMessage = message;
		trackedAssistantComponents.add(this);
		if (!patch.active || config.mode !== "compact") {
			return passThroughAssistant(this, message, isStreaming);
		}
		if (!self.contentContainer || typeof self.contentContainer.clear !== "function") {
			return passThroughAssistant(this, message, isStreaming);
		}

		const content = Array.isArray(message?.content) ? message.content : [];
		const hasToolCalls = content.some((item: any) => item?.type === "toolCall");
		const hasText = content.some(
			(item: any) => item?.type === "text" && typeof item.text === "string" && item.text.trim(),
		);
		self.hasToolCalls = hasToolCalls;

		if (hasToolCalls) {
			let round = roundByComponent.get(this);
			if (hasText && (!round || round.anchor !== this)) {
				if (round) round.messages.delete(this);
				if (activeRound) finishRound(activeRound);
				round = {
					anchor: this,
					messages: new Map(),
					detachedMessages: [],
					active: true,
					suppressedToolIds: new Set(),
				};
				roundByComponent.set(this, round);
				activateRound(round);
			} else if (!round) {
				round = activeRound ?? {
					anchor: this,
					messages: new Map(),
					detachedMessages: [],
					active: true,
					suppressedToolIds: new Set(),
				};
				roundByComponent.set(this, round);
				if (!activeRound) activateRound(round);
			}
			round.messages.set(this, message);
			renderRound(round);
			return undefined;
		}

		if (hasText) {
			const round = roundByComponent.get(this);
			const previousMessage = round?.messages.get(this);
			if (round && previousMessage && (round.anchor !== this || round.messages.size > 1)) {
				// 最终回答开始后，当前组件恢复原生文本；它已完成的 thinking
				// 留在上一轮摘要中，避免再次生成独立 Thought 行。
				round.messages.delete(this);
				round.detachedMessages.push(previousMessage);
				roundByComponent.delete(this);
				finishRound(round);
				return renderAssistantWithoutThinking(this, message);
			}
			if (round) {
				endRound(round);
				roundByComponent.delete(this);
				return passThroughAssistant(this, message);
			}
			if (activeRound) finishRound(activeRound);
			return renderAssistantWithoutThinking(this, message);
		}

		const hasThinking = content.some((item: any) => item?.type === "thinking");
		if (hasThinking) {
			let round = roundByComponent.get(this);
			if (!round) {
				round = activeRound ?? {
					anchor: this,
					messages: new Map(),
					detachedMessages: [],
					active: true,
					suppressedToolIds: new Set(),
				};
				roundByComponent.set(this, round);
				if (!activeRound) activateRound(round);
			}
			round.messages.set(this, message);
			renderRound(round);
			return undefined;
		}

		// 无可见内容的 abort/error/length：直接外层状态行，并结束进行中的回合。
		const loneStatus = messageStopStatus(message);
		if (loneStatus) {
			if (activeRound) finishRound(activeRound);
			self.contentContainer.clear();
			appendStopStatus(this, loneStatus);
			return undefined;
		}

		self.contentContainer.clear();
		return undefined;
	};

	patch.toolInstalledRender = function (this: any, width: number) {
		if (!patch.active || config.mode !== "compact") {
			return patch.toolOriginalRender.call(this, width);
		}
		const name = String(this.toolName ?? "");
		if (EDIT_WRITE_TOOLS.has(name)) {
			return compactEditWriteLines(this, width, deps.writeMetadata);
		}
		// Agent/Task 等同普通工具：折叠不外置（live 面板走独立 widget）。
		if (expandedRoundToolIds.has(String(this.toolCallId ?? ""))) return [];
		// 普通工具折叠时不显示独立行（摘要行已统计），独立展开走原 renderer。
		if (this.expanded === true) {
			return patch.toolOriginalRender.call(this, width);
		}
		return [];
	};

	patch.toolInstalledUpdateDisplay = function (this: any) {
		if (
			patch.active &&
			config.mode === "compact" &&
			expandedRoundToolIds.has(String(this.toolCallId ?? ""))
		) {
			this.expanded = false;
		}
		const result = patch.toolOriginalUpdateDisplay.call(this);
		if (!patch.active) return result;
		trackedToolComponents.add(this);
		return result;
	};

	patch.assertAssistantOwnership = () => {
		// compact 必须在外层：从 compact-thinking 包装器认领，或收回 mode=on/off
		// 时主动释放给 original/native 的所有权。未知外部包装器不抢，避免递归。
		if (!patch.active || assistantPrototype.updateContent === patch.assistantInstalled) return;
		const current = assistantPrototype.updateContent;
		if ((current as any)[COMPACT_THINKING_PATCH_KEY] === true) {
			patch.assistantOriginal = current;
			assistantPrototype.updateContent = patch.assistantInstalled;
			return;
		}
		if (current === patch.assistantOriginal || current === patch.assistantNative) {
			assistantPrototype.updateContent = patch.assistantInstalled;
		}
	};

	(patch.assistantInstalled as any)[PROTOTYPE_ORIGINAL_KEY] = patch.assistantNative;

	patch.dispose = () => {
		if (!patch.active) return;
		patch.active = false;
		if (assistantPrototype.updateContent === patch.assistantInstalled) {
			assistantPrototype.updateContent = patch.assistantOriginal;
		}
		if (toolPrototype.render === patch.toolInstalledRender) {
			toolPrototype.render = patch.toolOriginalRender;
		}
		if (toolPrototype.updateDisplay === patch.toolInstalledUpdateDisplay) {
			toolPrototype.updateDisplay = patch.toolOriginalUpdateDisplay;
		}
		patchRegistry.dispose(COMPACT_MODE_PATCH_KEY, patch);
		for (const component of trackedAssistantComponents) detachAssistantExpansion(component);
		trackedAssistantComponents.clear();
		trackedToolComponents.clear();
		hoveredAssistantComponent = undefined;
		resetRounds();
	};

	assistantPrototype.updateContent = patch.assistantInstalled;
	toolPrototype.render = patch.toolInstalledRender;
	toolPrototype.updateDisplay = patch.toolInstalledUpdateDisplay;
	patchRegistry.install(COMPACT_MODE_PATCH_KEY, patch);

	const syncGlobalExpanded = (ctx: any): void => {
		let globalExpanded = false;
		try {
			globalExpanded = ctx?.ui?.getToolsExpanded?.() === true;
		} catch {
			// 测试或无 UI 上下文时保持折叠。
		}
		for (const component of trackedAssistantComponents) component.expanded = globalExpanded;
		for (const component of trackedToolComponents) component.expanded = globalExpanded;
	};

	return {
		sync(ctx: any) {
			if (!patch.active) return;
			resetRounds();
			// 始终保持补丁在链上：mode=on/off 走 passThrough，仍写入 lastMessage
			// 与 tracked 集合，这样 /better-style 切回 compact 时不必 /reload。
			patch.assertAssistantOwnership();
			if (config.mode === "compact") syncGlobalExpanded(ctx);
			else hoveredAssistantComponent = undefined;
			refreshTrackedComponents();
		},
		refresh() {
			if (!patch.active) return;
			resetRounds();
			patch.assertAssistantOwnership();
			if (config.mode !== "compact") hoveredAssistantComponent = undefined;
			refreshTrackedComponents();
		},
		assertOwnership() {
			if (!patch.active) return;
			patch.assertAssistantOwnership();
		},
		refreshToolCallMessage(toolCallId: string | undefined) {
			if (!patch.active || typeof toolCallId !== "string" || !toolCallId) return;
			for (const component of [...trackedAssistantComponents]) {
				const message = component.lastMessage;
				const contains =
					Array.isArray(message?.content) &&
					message.content.some((item: any) => item?.type === "toolCall" && item.id === toolCallId);
				if (!contains) continue;
				try {
					component.updateContent?.(message);
				} catch {
					trackedAssistantComponents.delete(component);
				}
			}
		},
		shutdown() {
			patch.dispose();
		},
	};
}

function refreshTrackedComponents(): void {
	for (const component of [...trackedAssistantComponents]) {
		try {
			if (config.mode !== "compact") detachAssistantExpansion(component);
			refreshTranscriptComponent(component);
		} catch {
			trackedAssistantComponents.delete(component);
		}
	}
	for (const component of [...trackedToolComponents]) {
		try {
			// 共享实现负责 updateDisplay；invalidate 属于 compact-mode 的跟踪语义。
			refreshTranscriptComponent(component);
			component.invalidate?.();
		} catch {
			trackedToolComponents.delete(component);
		}
	}
}

/** 供 renderer/index.ts 在 session 事件后收集 /reload 重建的组件。 */
export function refreshCompactModeComponents(root: any): void {
	collectMountedComponents(root);
}

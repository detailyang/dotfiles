import {
	BranchSummaryMessageComponent,
	CompactionSummaryMessageComponent,
	SkillInvocationMessageComponent,
} from "@earendil-works/pi-coding-agent";
import { Markdown, Spacer, Text } from "@earendil-works/pi-tui";
import { MESSAGE_DISPLAY_PATCH, patchRegistry } from "../../utils/patch-keys.ts";
import { config } from "../../config/config.ts";
import { showMoreHintText } from "./show-more-hint.ts";
import { walkComponentTree } from "../../utils/component-tree.ts";

/**
 * 接管三个消息组件（`<skill>` 块、压缩摘要、分支摘要），better-style on 时渲染为
 * 与工具调用一致的单行风格（● Title · hint），off 时回退原生。
 *
 * 三者结构同构：Box + markdownTheme + updateDisplay，构造/setExpanded/invalidate
 * 三条路径都经过 updateDisplay，patch 一处即可全覆盖。它们不走
 * ToolExecutionComponent，无法复用其原型 patch，这里单独统一管理。
 */

const BRIGHT_GREEN = "\x1b[38;2;80;220;100m";
const ANSI_FG_RESET = "\x1b[39m";

/** 事件上下文中同步的最新主题（与 toolGrouping.setTheme 同一来源）。 */
let displayTheme: any;

export function setMessageDisplayTheme(theme: any): void {
	displayTheme = theme;
}

/** 供工具展开面板背景等共享同一主题来源（ctx.ui.theme）。 */
export function getMessageDisplayTheme(): any {
	return displayTheme;
}

type DisplayKind = {
	title(component: any): string;
	body(component: any): string;
};

const SKILL_KIND: DisplayKind = {
	title: (component) => `Skill ${String(component.skillBlock?.name ?? "skill")}`,
	body: (component) => String(component.skillBlock?.content ?? ""),
};

const COMPACTION_KIND: DisplayKind = {
	title: (component) =>
		`Compacted from ${Number(component.message?.tokensBefore ?? 0).toLocaleString()} tokens`,
	body: (component) => String(component.message?.summary ?? ""),
};

const BRANCH_KIND: DisplayKind = {
	title: () => "Branch summary",
	body: (component) => String(component.message?.summary ?? ""),
};

function renderBetterStyle(component: any, kind: DisplayKind): void {
	const theme = displayTheme;
	if (!theme) return;
	if (component.bgFn) component.setBgFn?.(undefined);
	if (component.paddingY !== 0) {
		component._betterStyleOriginalPaddingY = component.paddingY;
		component.paddingY = 0;
	}
	component.clear();
	const icon = `${BRIGHT_GREEN}✓${ANSI_FG_RESET}`;
	const title = theme.fg("toolTitle", kind.title(component));
	if (!component.expanded) {
		const hint = `${theme.fg("dim", " • ")}${theme.fg("dim", showMoreHintText())}`;
		component.addChild(new Text(`${icon} ${title}${hint}`, 0, 0));
		return;
	}
	component.paddingX = 1;
	component.paddingY = 1;
	if (typeof theme.bg === "function" && typeof component.setBgFn === "function") {
		component.setBgFn((text: string) => theme.bg("userMessageBg", text));
	}
	component.addChild(new Text(`${icon} ${title}`, 0, 0));
	component.addChild(new Spacer(1));
	component.addChild(
		new Markdown(kind.body(component), 0, 0, component.markdownTheme, {
			color: (text: string) => theme.fg("customMessageText", text),
		}),
	);
}

type PatchEntry = {
	prototype: any;
	installed: (...args: any[]) => void;
	original: (...args: any[]) => void;
};

/** patch 三个消息组件的 updateDisplay，返回统一 dispose（/reload 链安全）。 */
export function installMessageDisplayRendering(): () => void {
	const previous = patchRegistry.get<{ dispose: () => void }>(MESSAGE_DISPLAY_PATCH);
	if (previous) previous.dispose();
	const patch: { active: boolean; entries: PatchEntry[]; dispose: () => void } = {
		active: true,
		entries: [],
		dispose: () => {},
	};
	const installOne = (ComponentClass: any, kind: DisplayKind): void => {
		const prototype = ComponentClass.prototype;
		const original = prototype.updateDisplay;
		const installed = function (this: any) {
			if (patch.active && config.mode !== "off") {
				try {
					renderBetterStyle(this, kind);
					return;
				} catch {
					// 渲染失败回退原生。
				}
			}
			if (this._betterStyleOriginalPaddingY !== undefined) {
				this.paddingY = this._betterStyleOriginalPaddingY;
				delete this._betterStyleOriginalPaddingY;
			}
			original.call(this);
		};
		prototype.updateDisplay = installed;
		patch.entries.push({ prototype, installed, original });
	};
	installOne(SkillInvocationMessageComponent, SKILL_KIND);
	installOne(CompactionSummaryMessageComponent, COMPACTION_KIND);
	installOne(BranchSummaryMessageComponent, BRANCH_KIND);
	patch.dispose = () => {
		patch.active = false;
		for (const entry of patch.entries) {
			if (entry.prototype.updateDisplay === entry.installed) {
				entry.prototype.updateDisplay = entry.original;
			}
		}
		patchRegistry.dispose(MESSAGE_DISPLAY_PATCH, patch);
	};
	patchRegistry.install(MESSAGE_DISPLAY_PATCH, patch);
	return patch.dispose;
}

/** 三个消息组件共享的结构特征；CustomMessageComponent 用 rebuild 无 updateDisplay，不命中。 */
export function isMessageDisplayComponent(value: any): boolean {
	return Boolean(
		value &&
			typeof value === "object" &&
			typeof value.markdownTheme === "object" &&
			typeof value.setExpanded === "function" &&
			typeof value.updateDisplay === "function" &&
			typeof value.clear === "function",
	);
}

/** 遍历当前 transcript，让已挂载的消息组件按当前 mode 重渲染。 */
export function refreshMessageDisplays(root: any): void {
	walkComponentTree(root, (value: any) => {
		if (isMessageDisplayComponent(value)) {
			value.invalidate?.();
			return false;
		}
	});
}

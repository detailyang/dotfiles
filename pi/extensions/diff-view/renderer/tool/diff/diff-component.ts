import {
	DEFAULT_TOOL_DISPLAY_CONFIG,
	type DiffIndicatorMode,
	type ToolDisplayConfig,
} from "../../../config/config.ts";
import type { DiffPresentationMode } from "./diff-presentation.ts";
import { RICH_DIFF_COMPONENT } from "../../../utils/patch-keys.ts";
export { RICH_DIFF_COMPONENT };

/** Snapshot or live getter — panel changes must apply on the next paint. */
export type DisplayConfigInput = ToolDisplayConfig | (() => ToolDisplayConfig);

export interface DiffRenderOptions {
	expanded: boolean;
	filePath?: string;
	previousContent?: string;
	fileExistedBeforeWrite?: boolean;
	headerLabel?: string;
	/** Live hover state for the collapsed hint row (muted → text on hover). */
	isHovered?: () => boolean;
	invalidate?: () => void;
}

export function isRichDiffComponent(value: unknown): boolean {
	return Boolean(
		value &&
			typeof value === "object" &&
			(value as Record<symbol, unknown>)[RICH_DIFF_COMPONENT] === true,
	);
}

export function resolveLiveDisplayConfig(input: DisplayConfigInput): ToolDisplayConfig {
	return typeof input === "function" ? input() : input;
}

/** Cache key fragment so indicator/wrap/limits invalidate without host recreate. */
export function displayConfigCacheKey(config: ToolDisplayConfig): string {
	return [
		config.diffViewMode,
		config.diffIndicatorMode,
		String(config.diffSplitMinWidth),
		String(config.editDiffCollapsedLines),
		String(config.writeDiffCollapsedLines),
		config.diffWordWrap ? "1" : "0",
		String(config.expandedPreviewMaxLines),
	].join(":");
}

export function resolveDiffIndicatorMode(
	config: Partial<Pick<ToolDisplayConfig, "diffIndicatorMode">>,
): DiffIndicatorMode {
	return config.diffIndicatorMode ?? DEFAULT_TOOL_DISPLAY_CONFIG.diffIndicatorMode;
}

export function createDiffRenderCache() {
	let cachedWidth: number | undefined;
	let cachedExpanded: boolean | undefined;
	let cachedMode: DiffPresentationMode | undefined;
	let cachedConfigKey: string | undefined;
	let cachedHovered: boolean | undefined;
	let cachedLines: string[] | undefined;

	return {
		get(
			width: number,
			expanded: boolean,
			mode: DiffPresentationMode,
			configKey: string,
			hovered: boolean,
		): string[] | undefined {
			if (
				cachedLines &&
				cachedWidth === width &&
				cachedExpanded === expanded &&
				cachedMode === mode &&
				cachedConfigKey === configKey &&
				cachedHovered === hovered
			) {
				return cachedLines;
			}
			return undefined;
		},
		set(
			width: number,
			expanded: boolean,
			mode: DiffPresentationMode,
			configKey: string,
			hovered: boolean,
			lines: string[],
		): string[] {
			cachedWidth = width;
			cachedExpanded = expanded;
			cachedMode = mode;
			cachedConfigKey = configKey;
			cachedHovered = hovered;
			cachedLines = lines;
			return lines;
		},
		invalidate(): void {
			cachedWidth = undefined;
			cachedExpanded = undefined;
			cachedMode = undefined;
			cachedConfigKey = undefined;
			cachedHovered = undefined;
			cachedLines = undefined;
		},
	};
}

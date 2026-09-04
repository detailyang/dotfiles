import { createWriteToolDefinition, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import {
	renderEditDiffResult,
	renderWriteDiffResult,
	type DisplayConfigInput,
} from "./diff-renderer.ts";
import { DEFAULT_TOOL_DISPLAY_CONFIG } from "../../../config/config.ts";
import { executeWriteWithMetadata, WriteExecutionMetadataStore } from "./write-execution.ts";

function resultText(result: any): string {
	const blocks = Array.isArray(result?.content) ? result.content : [];
	return blocks
		.filter((block: any) => block?.type === "text" && typeof block.text === "string")
		.map((block: any) => block.text)
		.join("\n");
}

function unavailableComponent(reason: string, theme: any) {
	return {
		render(width: number): string[] {
			return [
				truncateToWidth(
					theme.fg("warning", `↳ diff unavailable: ${reason}`),
					Math.max(0, width),
					"",
				),
			];
		},
		invalidate() {},
	};
}

export function renderRichToolResult(
	toolName: string,
	result: any,
	options: any,
	theme: any,
	context: any,
	writeMetadata: WriteExecutionMetadataStore,
	/** Plain snapshot or live getter — getter lets /better-style panel changes repaint existing diffs. */
	displayConfig: DisplayConfigInput = DEFAULT_TOOL_DISPLAY_CONFIG,
): any | undefined {
	if (options?.isPartial || options?.isError || context?.isError) return undefined;
	const expanded = options?.expanded === true || context?.expanded === true;
	const filePath = context?.args?.file_path ?? context?.args?.path;
	if (toolName === "edit") {
		return renderEditDiffResult(
			result?.details,
			{
				expanded,
				filePath,
				isHovered: options?.isHovered,
				invalidate: () => context?.invalidate?.(),
			},
			displayConfig,
			theme,
			resultText(result),
		);
	}
	if (toolName !== "write") return undefined;

	const metadata = writeMetadata.get(context?.toolCallId);
	if (!metadata) {
		return unavailableComponent("execution metadata is unavailable", theme);
	}
	if (metadata.diffUnavailableReason) {
		return unavailableComponent(metadata.diffUnavailableReason, theme);
	}
	return renderWriteDiffResult(
		typeof context?.args?.content === "string" ? context.args.content : undefined,
		{
			expanded,
			filePath,
			previousContent: metadata.previousContent,
			fileExistedBeforeWrite: metadata.fileExistedBeforeWrite,
			isHovered: options?.isHovered,
			invalidate: () => context?.invalidate?.(),
		},
		displayConfig,
		theme,
		resultText(result),
	);
}

function hasExternalWriteOwner(pi: ExtensionAPI): boolean {
	try {
		const tools = pi.getAllTools();
		const write = tools.find((tool: any) => tool?.name === "write") as any;
		const source = write?.sourceInfo?.source;
		return Boolean(write && typeof source === "string" && source !== "builtin");
	} catch {
		// getAllTools is unavailable before the extension runtime is bound.
		return false;
	}
}

export function installWriteOverride(
	pi: ExtensionAPI,
	store = new WriteExecutionMetadataStore(),
): WriteExecutionMetadataStore {
	if (typeof (pi as any).registerTool !== "function" || hasExternalWriteOwner(pi)) return store;
	const nativeWrite = createWriteToolDefinition(process.cwd()) as any;
	pi.registerTool({
		...nativeWrite,
		async execute(
			toolCallId: string,
			params: { path: string; content: string },
			signal: AbortSignal | undefined,
			_onUpdate: unknown,
			ctx: { cwd: string },
		) {
			return executeWriteWithMetadata(store, toolCallId, params, signal, ctx.cwd);
		},
	});
	return store;
}

export {
	DEFAULT_TOOL_DISPLAY_CONFIG,
	type ToolDisplayConfig,
	type DiffViewMode,
	type DiffIndicatorMode,
} from "../../../config/config.ts";
export type { DisplayConfigInput } from "./diff-renderer.ts";
export { WriteExecutionMetadataStore } from "./write-execution.ts";

import {
  createEditToolDefinition,
  createWriteToolDefinition,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { DEFAULT_TOOL_DISPLAY_CONFIG } from "../../../config/config.ts";
import {
  renderEditDiffResult,
  renderWriteDiffResult,
  type DisplayConfigInput,
} from "./diff-renderer.ts";
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
        invalidate: () => context?.invalidate?.(),
      },
      displayConfig,
      theme,
      resultText(result),
    );
  }
  if (toolName !== "write") return undefined;

  const metadata = writeMetadata.get(context?.toolCallId);
  if (!metadata) return unavailableComponent("execution metadata is unavailable", theme);
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
      invalidate: () => context?.invalidate?.(),
    },
    displayConfig,
    theme,
    resultText(result),
  );
}

function hasExternalOwner(pi: ExtensionAPI, toolName: string): boolean {
  try {
    const tool = pi.getAllTools().find((candidate: any) => candidate?.name === toolName) as any;
    const source = tool?.sourceInfo?.source;
    return Boolean(tool && typeof source === "string" && source !== "builtin");
  } catch {
    return false;
  }
}

function withDiffRenderer(
  nativeTool: any,
  toolName: "edit" | "write",
  store: WriteExecutionMetadataStore,
): any {
  return {
    ...nativeTool,
    renderResult(result: any, options: any, theme: any, context: any) {
      return (
        renderRichToolResult(toolName, result, options, theme, context, store) ??
        nativeTool.renderResult?.call(nativeTool, result, options, theme, context)
      );
    },
  };
}

export function installDiffViewTools(
  pi: ExtensionAPI,
  store = new WriteExecutionMetadataStore(),
  cwd = process.cwd(),
): WriteExecutionMetadataStore {
  if (typeof (pi as any).registerTool !== "function") return store;

  if (!hasExternalOwner(pi, "edit")) {
    const nativeEdit = createEditToolDefinition(cwd) as any;
    pi.registerTool(withDiffRenderer(nativeEdit, "edit", store));
  }

  if (!hasExternalOwner(pi, "write")) {
    const nativeWrite = createWriteToolDefinition(cwd) as any;
    pi.registerTool(
      withDiffRenderer(
        {
          ...nativeWrite,
          async execute(
            toolCallId: string,
            params: { path: string; content: string },
            signal: AbortSignal | undefined,
            _onUpdate: unknown,
            ctx: { cwd?: string } | undefined,
          ) {
            return executeWriteWithMetadata(store, toolCallId, params, signal, ctx?.cwd ?? cwd);
          },
        },
        "write",
        store,
      ),
    );
  }

  return store;
}

export {
  DEFAULT_TOOL_DISPLAY_CONFIG,
  type DiffIndicatorMode,
  type DiffViewMode,
  type ToolDisplayConfig,
} from "../../../config/config.ts";
export type { DisplayConfigInput } from "./diff-renderer.ts";
export { WriteExecutionMetadataStore } from "./write-execution.ts";

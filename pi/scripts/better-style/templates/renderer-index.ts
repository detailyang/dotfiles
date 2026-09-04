import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { CompactThinkingController } from "../feature/compact-thinking.ts";
import { showBetterStylePanel } from "../config/panel.ts";
import {
  config,
  formatConfigStatus,
  getCompactThinkingConfig,
  normalizeConfig,
  setConfig,
  updateConfig,
  type CompactStyleMode,
  type Config,
} from "../config/config.ts";
import { installCompactMode, refreshCompactModeComponents, type CompactModeHooks } from "./compact-mode.ts";
import { installDefaultMode, installToolExpandedBackground, type DefaultModeHooks } from "./default-mode.ts";
import { installToolGrouping, type ToolGroupingHooks } from "./tool/grouping.ts";
import { installWriteOverride, WriteExecutionMetadataStore } from "./tool/diff/index.ts";
import { installMessageDisplayRendering, refreshMessageDisplays, setMessageDisplayTheme } from "./tool/message-display.ts";
import { getBetterStyleTui, installTuiAnchor, scheduleSessionRender, teardownTuiAnchor } from "./tui-anchor.ts";

let compactModeHooks: CompactModeHooks | undefined;

function refreshCurrentTranscript(ctx?: any, toolGrouping?: ToolGroupingHooks): void {
  const tui = getBetterStyleTui();
  toolGrouping?.refresh(tui);
  refreshMessageDisplays(tui);
  refreshCompactModeComponents(tui);
  compactModeHooks?.refresh();
  tui?.requestRender?.(true);
  ctx?.ui?.requestRender?.(true);
}

function syncCompactMode(ctx: any): void {
  refreshCompactModeComponents(getBetterStyleTui());
  compactModeHooks?.sync(ctx);
}

function applyStyleMode(mode: CompactStyleMode, ctx: any, toolGrouping?: ToolGroupingHooks): void {
  updateConfig({ mode });
  if (mode === "compact") syncCompactMode(ctx);
  refreshCurrentTranscript(ctx, toolGrouping);
  scheduleSessionRender(() => {
    if (mode === "compact") syncCompactMode(ctx);
    refreshCurrentTranscript(ctx, toolGrouping);
  });
  ctx.ui.notify(`Better style: ${mode}`, "info");
}

export default function (
  pi: ExtensionAPI,
  configOverride?: Partial<Config>,
  compactThinking?: CompactThinkingController,
): void {
  if (configOverride) setConfig(normalizeConfig({ ...config, ...configOverride }));
  const writeExecutionMetadata = new WriteExecutionMetadataStore();
  let installation:
    | {
        defaultMode: DefaultModeHooks;
        toolGrouping: ToolGroupingHooks;
        compactMode: CompactModeHooks;
        disposeMessageDisplay: () => void;
        disposeToolExpandedBackground: () => void;
      }
    | undefined;

  const ensureTuiInstallation = (ctx: any) => {
    if (ctx?.mode !== "tui" || !ctx?.hasUI) return undefined;
    if (installation) return installation;
    const defaultMode = installDefaultMode(writeExecutionMetadata);
    const toolGrouping = installToolGrouping(() => config.mode === "on");
    const compactMode = installCompactMode({
      writeMetadata: writeExecutionMetadata,
    });
    compactModeHooks = compactMode;
    const disposeMessageDisplay = installMessageDisplayRendering();
    const disposeToolExpandedBackground = installToolExpandedBackground();
    installation = {
      defaultMode,
      toolGrouping,
      compactMode,
      disposeMessageDisplay,
      disposeToolExpandedBackground,
    };
    return installation;
  };

  pi.registerCommand("better-style", {
    description: "Configure keyboard-first compact rendering and rich diff options",
    getArgumentCompletions: (prefix) => [
      { value: "on", label: "on", description: "Enable better-style rendering" },
      { value: "compact", label: "compact", description: "One summary line per assistant message" },
      { value: "off", label: "off", description: "Use Pi's native renderer" },
      { value: "status", label: "status", description: "Show full configuration" },
      { value: "panel", label: "panel", description: "Open interactive settings" },
    ].filter((item) => item.value.startsWith(prefix)),
    handler: async (args, ctx) => {
      const arg = args.trim().toLowerCase();
      if (!arg || arg === "panel" || arg === "on" || arg === "compact" || arg === "off") {
        if (ctx?.mode !== "tui" || !ctx?.hasUI) {
          ctx.ui?.notify?.("/better-style requires TUI mode", "warning");
          return;
        }
        const hooks = ensureTuiInstallation(ctx);
        if (!hooks) return;
        if (!arg || arg === "panel") {
          await showBetterStylePanel(
            ctx,
            { applyStyleMode, refreshCurrentTranscript },
            hooks.toolGrouping,
            compactThinking,
          );
        } else {
          applyStyleMode(arg as CompactStyleMode, ctx, hooks.toolGrouping);
        }
        return;
      }
      if (arg === "status") {
        ctx.ui.notify(`Better style: ${formatConfigStatus(config)}`, "info");
        return;
      }
      ctx.ui.notify("Usage: /better-style [on|compact|off|status|panel]", "warning");
    },
  });

  pi.on("message_update", async (event) => {
    if (config.mode === "compact" && event.message?.role === "assistant") {
      compactModeHooks?.assertOwnership();
    }
  });

  pi.on("tool_execution_end", async (event) => {
    if (config.mode !== "compact") return;
    const toolCallId: string | undefined = event?.toolCallId;
    setTimeout(() => compactModeHooks?.refreshToolCallMessage(toolCallId), 0);
  });

  pi.on("session_start", async (_event, ctx) => {
    installWriteOverride(pi, writeExecutionMetadata);
    installTuiAnchor(ctx);
    const hooks = ensureTuiInstallation(ctx);
    if (!hooks) return;
    hooks.toolGrouping.setTheme(ctx.ui.theme);
    setMessageDisplayTheme(ctx.ui.theme);
    ctx.ui.setStatus("better-style", undefined);
    compactThinking?.updateConfig(getCompactThinkingConfig(config));
    syncCompactMode(ctx);
    setTimeout(() => syncCompactMode(ctx), 0);
    scheduleSessionRender(() => hooks.toolGrouping.refresh(getBetterStyleTui()));
  });

  pi.on("session_compact", async (_event, ctx) => {
    installTuiAnchor(ctx);
    const hooks = ensureTuiInstallation(ctx);
    if (!hooks) return;
    hooks.toolGrouping.setTheme(ctx.ui.theme);
    setMessageDisplayTheme(ctx.ui.theme);
    syncCompactMode(ctx);
    scheduleSessionRender(() => {
      syncCompactMode(ctx);
      hooks.toolGrouping.refresh(getBetterStyleTui());
    });
  });

  pi.on("session_tree", async (_event, ctx) => {
    if (ctx?.mode !== "tui" || !ctx?.hasUI) return;
    syncCompactMode(ctx);
    scheduleSessionRender(() => syncCompactMode(ctx));
  });

  pi.on("tool_execution_start", async (_event, ctx) => {
    installation?.toolGrouping.setTheme(ctx.ui.theme);
  });

  pi.on("session_shutdown", async () => {
    writeExecutionMetadata.clear();
    teardownTuiAnchor();
    const current = installation;
    if (!current || !current.defaultMode.isOwner()) return;
    current.defaultMode.shutdown();
    current.toolGrouping.shutdown();
    current.disposeToolExpandedBackground();
    current.compactMode.shutdown();
    compactModeHooks = undefined;
    current.disposeMessageDisplay();
    installation = undefined;
  });
}

export { getCompactThinkingConfig } from "../config/config.ts";
export { humanizeMcpToolName, isMcpToolDefinition, preservesOriginalRenderer, shouldRenderRichDiff } from "./default-mode.ts";
export { ExpandedToolIoView, ExpandedToolResultText, formatToolInputArgs, SHOW_MORE_LABEL } from "./tool/result.ts";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { CompactThinkingController } from "pi-cc-extensions/extensions/feature/compact-thinking.ts";
import {
	installCompactMode,
	refreshCompactModeComponents,
	type CompactModeHooks,
	type CompactThinkingQuery,
} from "pi-cc-extensions/extensions/renderer/compact-mode.ts";
import {
	installDefaultMode,
	installToolExpandedBackground,
	type DefaultModeHooks,
} from "pi-cc-extensions/extensions/renderer/default-mode.ts";
import { refreshMountedTranscript } from "pi-cc-extensions/extensions/renderer/transcript-refresh.ts";
import {
	installToolGrouping,
	type ToolGroupingHooks,
} from "pi-cc-extensions/extensions/renderer/tool/grouping.ts";
import {
	installMessageDisplayRendering,
	refreshMessageDisplays,
	setMessageDisplayTheme,
} from "pi-cc-extensions/extensions/renderer/tool/message-display.ts";
import {
	installWriteOverride,
	WriteExecutionMetadataStore,
} from "pi-cc-extensions/extensions/renderer/tool/diff/index.ts";
import { clearAllAnimations } from "pi-cc-extensions/extensions/renderer/tool/result.ts";
import {
	addRuntimeRendererExclusions,
	config,
	formatConfigStatus,
	updateConfig,
	type BetterStyleMode,
} from "./config.ts";
import { showBetterStylePanel } from "./panel.ts";

const STYLE_BUILTINS = new Set([
	"bash",
	"powershell",
	"read",
	"edit",
	"write",
	"grep",
	"find",
	"ls",
	"webfetch",
	"wait",
]);

let compactModeHooks: CompactModeHooks | undefined;

function hasDedicatedRenderer(tool: any): boolean {
	return Boolean(
		tool &&
			(tool.renderShell === "self" ||
				typeof tool.renderCall === "function" ||
				typeof tool.renderResult === "function"),
	);
}

/** Preserve renderer ownership for tools registered by other extensions. */
function preserveExternalRenderers(pi: ExtensionAPI): void {
	let tools: any[] = [];
	try {
		tools = pi.getAllTools?.() ?? [];
	} catch {
		return;
	}
	const names = tools
		.filter((tool) => {
			const name = String(tool?.name ?? "");
			return name && !STYLE_BUILTINS.has(name.toLowerCase()) && hasDedicatedRenderer(tool);
		})
		.map((tool) => String(tool.name));
	addRuntimeRendererExclusions(names);
}

function uiRoot(ctx: any): any {
	const ui = ctx?.ui;
	return ui?.tui ?? ui?._tui ?? ui?.root ?? ui;
}

function scheduleRender(callback: () => void): void {
	const timer = setTimeout(callback, 0);
	timer.unref?.();
}

function refreshCurrentTranscript(ctx?: any, toolGrouping?: ToolGroupingHooks): void {
	const root = uiRoot(ctx);
	toolGrouping?.refresh(root);
	refreshMessageDisplays(root);
	refreshCompactModeComponents(root);
	compactModeHooks?.refresh();
	refreshMountedTranscript(root);
	ctx?.ui?.requestRender?.(true);
}

function syncCompactMode(ctx: any): void {
	refreshCompactModeComponents(uiRoot(ctx));
	compactModeHooks?.sync(ctx);
}

function applyStyleMode(mode: BetterStyleMode, ctx: any, toolGrouping?: ToolGroupingHooks): void {
	updateConfig({ mode });
	if (mode === "compact") syncCompactMode(ctx);
	refreshCurrentTranscript(ctx, toolGrouping);
	scheduleRender(() => {
		if (mode === "compact") syncCompactMode(ctx);
		refreshCurrentTranscript(ctx, toolGrouping);
	});
	ctx.ui.notify(`Better style: ${mode}`, "info");
}

export default function installBetterStyleRenderer(
	pi: ExtensionAPI,
	compactThinking?: CompactThinkingController,
): void {
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
			query: compactThinking as CompactThinkingQuery | undefined,
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
		description: "Configure keyboard-first tool, diff, thinking, and status rendering",
		getArgumentCompletions: (prefix) => {
			const options = [
				{ value: "on", label: "on", description: "Enable styled tool rendering" },
				{ value: "compact", label: "compact", description: "Collapse each assistant round" },
				{ value: "off", label: "off", description: "Use Pi native rendering" },
				{ value: "status", label: "status", description: "Show current configuration" },
				{ value: "panel", label: "panel", description: "Open the settings panel" },
			];
			return options.filter((item) => item.value.startsWith(prefix.toLowerCase()));
		},
		handler: async (args, ctx) => {
			const arg = args.trim().toLowerCase();
			if (arg === "status") {
				ctx.ui.notify(`Better style: ${formatConfigStatus(config)}`, "info");
				return;
			}
			if (arg === "on" || arg === "compact" || arg === "off") {
				const hooks = ensureTuiInstallation(ctx);
				if (!hooks) {
					ctx.ui.notify("/better-style requires TUI mode", "warning");
					return;
				}
				applyStyleMode(arg, ctx, hooks.toolGrouping);
				return;
			}
			if (!arg || arg === "panel") {
				const hooks = ensureTuiInstallation(ctx);
				if (!hooks) {
					ctx.ui.notify("/better-style requires TUI mode", "warning");
					return;
				}
				await showBetterStylePanel(
					ctx,
					{
						applyStyleMode: (mode, panelCtx) =>
							applyStyleMode(mode, panelCtx, hooks.toolGrouping),
						refreshCurrentTranscript: (panelCtx) =>
							refreshCurrentTranscript(panelCtx, hooks.toolGrouping),
					},
					compactThinking,
				);
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
		scheduleRender(() => compactModeHooks?.refreshToolCallMessage(toolCallId));
	});

	pi.on("session_start", async (_event, ctx) => {
		preserveExternalRenderers(pi);
		installWriteOverride(pi, writeExecutionMetadata);
		const hooks = ensureTuiInstallation(ctx);
		if (!hooks) return;
		hooks.toolGrouping.setTheme(ctx.ui.theme);
		setMessageDisplayTheme(ctx.ui.theme);
		ctx.ui.setStatus("better-style", undefined);
		syncCompactMode(ctx);
		scheduleRender(() => {
			syncCompactMode(ctx);
			refreshCurrentTranscript(ctx, hooks.toolGrouping);
		});
	});

	pi.on("session_compact", async (_event, ctx) => {
		const hooks = ensureTuiInstallation(ctx);
		if (!hooks) return;
		hooks.toolGrouping.setTheme(ctx.ui.theme);
		setMessageDisplayTheme(ctx.ui.theme);
		syncCompactMode(ctx);
		scheduleRender(() => {
			syncCompactMode(ctx);
			refreshCurrentTranscript(ctx, hooks.toolGrouping);
		});
	});

	pi.on("session_tree", async (_event, ctx) => {
		if (ctx?.mode !== "tui" || !ctx?.hasUI) return;
		syncCompactMode(ctx);
		scheduleRender(() => {
			syncCompactMode(ctx);
			refreshCurrentTranscript(ctx, installation?.toolGrouping);
		});
	});

	pi.on("tool_execution_start", async (_event, ctx) => {
		installation?.toolGrouping.setTheme(ctx.ui.theme);
	});

	pi.on("session_shutdown", async () => {
		writeExecutionMetadata.clear();
		const current = installation;
		if (!current || !current.defaultMode.isOwner()) return;
		current.defaultMode.shutdown();
		current.toolGrouping.shutdown();
		current.disposeToolExpandedBackground();
		current.compactMode.shutdown();
		compactModeHooks = undefined;
		current.disposeMessageDisplay();
		clearAllAnimations();
		installation = undefined;
	});
}

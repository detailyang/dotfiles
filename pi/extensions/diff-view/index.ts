import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";
import { DEFAULT_TOOL_DISPLAY_CONFIG } from "./config/config.ts";
import { loadDiffViewConfig, openDiffViewSettings, saveDiffViewConfig } from "./config/settings.ts";
import { installDiffViewTools } from "./renderer/tool/diff/index.ts";

export default function diffView(pi: ExtensionAPI): void {
  const settingsPath = join(getAgentDir(), "diff-view.json");
  let config = { ...DEFAULT_TOOL_DISPLAY_CONFIG };
  const store = installDiffViewTools(pi, undefined, undefined, () => config);

  pi.on("session_start", async (_event, ctx) => {
    try {
      config = loadDiffViewConfig(settingsPath);
    } catch (error) {
      config = { ...DEFAULT_TOOL_DISPLAY_CONFIG };
      ctx.ui.notify(`Could not load ${settingsPath}; using defaults: ${error instanceof Error ? error.message : String(error)}`, "warning");
    }
  });
  pi.registerCommand("diff-view", {
    description: "Configure edit/write diff display (auto-save)",
    handler: async (_args, ctx) => {
      await openDiffViewSettings(ctx, () => config, (next) => {
        saveDiffViewConfig(settingsPath, next);
        config = next;
      });
    },
  });
  pi.on("session_shutdown", async () => store.clear());
}

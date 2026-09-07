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
      ctx.ui.notify(`无法读取 ${settingsPath}，使用默认设置：${error instanceof Error ? error.message : String(error)}`, "warning");
    }
  });
  pi.registerCommand("diff-view", {
    description: "配置 edit/write diff 展示（自动保存）",
    handler: async (_args, ctx) => {
      await openDiffViewSettings(ctx, () => config, (next) => {
        saveDiffViewConfig(settingsPath, next);
        config = next;
      });
    },
  });
  pi.on("session_shutdown", async () => store.clear());
}

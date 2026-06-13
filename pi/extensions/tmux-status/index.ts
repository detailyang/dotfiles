import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFileSync } from "node:child_process";
import { basename } from "node:path";

const runTmux = (args: string[]): string => {
  try { return execFileSync("tmux", args, { encoding: "utf8" }).trim(); } catch { return ""; }
};

const dir = () => basename(process.cwd());

export default function (pi: ExtensionAPI) {
  let windowId: string | null = null;

  const rename = (name: string) => {
    if (windowId) {
      runTmux(["rename-window", "-t", windowId, name]);
    }
  };

  pi.on("session_start", async () => {
    // 启动时立刻捕获当前窗口 ID
    windowId = runTmux(["display-message", "-p", "#{window_id}"]) || null;
    rename(`○(${dir()})`);
  });

  pi.on("agent_start", async () => {
    rename(`●(${dir()})`);
  });

  pi.on("agent_end", async () => {
    rename(`○(${dir()})`);
  });

  pi.on("session_shutdown", async () => {
    rename(`${dir()}`);
    if (windowId) {
      runTmux(["set-option", "-w", "-t", windowId, "-q", "automatic-rename", "on"]);
    }
    windowId = null;
  });
}

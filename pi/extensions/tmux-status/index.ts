import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFileSync } from "node:child_process";
import { basename } from "node:path";

const runTmux = (args: string[]): string => {
  try { return execFileSync("tmux", args, { encoding: "utf8" }).trim(); } catch { return ""; }
};

const dir = () => basename(process.cwd());
const FRAMES = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];

const getCurrentWindowId = () => {
  const paneId = process.env.TMUX_PANE;
  const args = paneId
    ? ["display-message", "-p", "-t", paneId, "#{window_id}"]
    : ["display-message", "-p", "#{window_id}"];

  return runTmux(args) || null;
};

export default function (pi: ExtensionAPI) {
  // Skip if not running inside tmux
  if (!process.env.TMUX) return;

  let windowId: string | null = null;
  let spinner: NodeJS.Timeout | null = null;
  let frameIdx = 0;

  const rename = (name: string) => {
    if (windowId) runTmux(["rename-window", "-t", windowId, name]);
  };

  const startSpinner = () => {
    frameIdx = 0;
    spinner = setInterval(() => {
      rename(`${FRAMES[frameIdx++ % FRAMES.length]}${dir()}`);
    }, 100);
  };

  const stopSpinner = () => {
    if (spinner) { clearInterval(spinner); spinner = null; }
  };

  pi.on("session_start", async () => {
    windowId = getCurrentWindowId();
    rename(`${dir()}`);
  });

  pi.on("agent_start", async () => {
    startSpinner();
  });

  pi.on("agent_end", async () => {
    stopSpinner();
    rename(`${dir()}`);
  });

  pi.on("session_shutdown", async () => {
    stopSpinner();
    rename(`${dir()}`);
    if (windowId) {
      runTmux(["set-option", "-w", "-t", windowId, "-q", "automatic-rename", "on"]);
    }
    windowId = null;
  });
}

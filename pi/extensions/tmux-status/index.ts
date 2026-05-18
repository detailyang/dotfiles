import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execSync } from "node:child_process";
import { basename } from "node:path";

const run = (cmd: string) => {
  try { execSync(cmd); } catch {}
};

const dir = () => basename(process.cwd());

export default function (pi: ExtensionAPI) {
  let windowId: string | null = null;

  const rename = (name: string) => {
    if (windowId) {
      run(`tmux rename-window -t ${windowId} "${name}"`);
    }
  };

  pi.on("session_start", async () => {
    // 启动时立刻捕获当前窗口 ID
    try {
      windowId = execSync("tmux display-message -p '#{window_id}'")
        .toString()
        .trim();
    } catch {}
    rename(`○ π(${dir()})`);
  });

  pi.on("agent_start", async () => {
    rename(`● π(${dir()})`);
  });

  pi.on("agent_end", async () => {
    rename(`○ π(${dir()})`);
  });

  pi.on("session_shutdown", async () => {
    rename(`${dir()}`);
    if (windowId) {
      run(`tmux set-option -w -t ${windowId} -q automatic-rename on`);
    }
    windowId = null;
  });
}

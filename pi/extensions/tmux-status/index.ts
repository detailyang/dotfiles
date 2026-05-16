import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execSync } from "node:child_process";
import { basename } from "node:path";


const run = (cmd: string) => {
  try { execSync(cmd); } catch {}
};

const dir = () => basename(process.cwd());

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async () => {
    run(`tmux rename-window "○ π(${dir()})"`);
  });

  pi.on("agent_start", async () => {
    run(`tmux rename-window "● π(${dir()})"`);
  });

  pi.on("agent_end", async () => {
    run(`tmux rename-window "○ π(${dir()})"`);
  });

  pi.on("session_shutdown", async () => {
    run(`tmux rename-window "${dir()}"`);
    run(`tmux set-option -w -q automatic-rename on`);
  });
}

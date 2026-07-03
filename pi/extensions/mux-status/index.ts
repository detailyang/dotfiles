import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFileSync } from "node:child_process";
import { basename } from "node:path";

const run = (command: string, args: string[]): string => {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
};

const runTmux = (args: string[]): string => run("tmux", args);
const runHerdr = (args: string[]): string => run(process.env.HERDR_BIN_PATH || "herdr", args);

const dir = () => basename(process.cwd());
const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

type MuxTarget = {
  rename: (name: string) => void;
  restore: () => void;
};

const herdrTabSerial = (tabId: string): string | null => {
  const match = /(?:^|:)t(\d+)$/.exec(tabId);
  return match?.[1] || null;
};

const withSerial = (serial: string | null, name: string) => {
  if (!serial) return name;

  const frame = FRAMES.find((candidate) => name.startsWith(candidate));
  if (!frame) return `${serial}(${name})`;

  return `${frame}${serial}(${name.slice(frame.length)})`;
};

const getCurrentTmuxWindowId = () => {
  const paneId = process.env.TMUX_PANE;
  const args = paneId
    ? ["display-message", "-p", "-t", paneId, "#{window_id}"]
    : ["display-message", "-p", "#{window_id}"];

  return runTmux(args) || null;
};

const tmuxTarget = (): MuxTarget | null => {
  if (!process.env.TMUX) return null;

  const windowId = getCurrentTmuxWindowId();
  if (!windowId) return null;

  return {
    rename: (name) => {
      runTmux(["rename-window", "-t", windowId, name]);
    },
    restore: () => {
      runTmux(["rename-window", "-t", windowId, dir()]);
      runTmux(["set-option", "-w", "-t", windowId, "-q", "automatic-rename", "on"]);
    },
  };
};

const herdrTarget = (): MuxTarget | null => {
  const tabId = process.env.HERDR_TAB_ID;
  if (!tabId) return null;

  const serial = herdrTabSerial(tabId);

  return {
    rename: (name) => {
      runHerdr(["tab", "rename", tabId, withSerial(serial, name)]);
    },
    restore: () => {
      runHerdr(["tab", "rename", tabId, withSerial(serial, dir())]);
    },
  };
};

const muxTargets = (): MuxTarget[] => [tmuxTarget(), herdrTarget()].filter(
  (target): target is MuxTarget => target !== null,
);

export default function (pi: ExtensionAPI) {
  let targets: MuxTarget[] = [];
  let spinner: NodeJS.Timeout | null = null;
  let frameIdx = 0;

  const rename = (name: string) => {
    for (const target of targets) target.rename(name);
  };

  const startSpinner = () => {
    stopSpinner();

    if (targets.length === 0) return;

    frameIdx = 0;
    spinner = setInterval(() => {
      rename(`${FRAMES[frameIdx++ % FRAMES.length]}${dir()}`);
    }, 100);
  };

  const stopSpinner = () => {
    if (spinner) {
      clearInterval(spinner);
      spinner = null;
    }
  };

  pi.on("session_start", async () => {
    targets = muxTargets();
    rename(dir());
  });

  pi.on("agent_start", async () => {
    startSpinner();
  });

  pi.on("agent_end", async () => {
    stopSpinner();
    rename(dir());
  });

  pi.on("session_shutdown", async () => {
    stopSpinner();

    for (const target of targets) target.restore();
    targets = [];
  });
}

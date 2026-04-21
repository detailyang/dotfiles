import { spawnSync } from "node:child_process";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

function signalExitCode(signal: NodeJS.Signals): number {
  switch (signal) {
    case "SIGHUP":
      return 129;
    case "SIGINT":
      return 130;
    case "SIGQUIT":
      return 131;
    case "SIGKILL":
      return 137;
    case "SIGTERM":
      return 143;
    default:
      return 128;
  }
}

function runLazyGit(cwd: string): { exitCode: number; signal?: NodeJS.Signals } {
  const result = spawnSync("lazygit", [], {
    cwd,
    env: process.env,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === "ENOENT") {
      return { exitCode: 127 };
    }
    return { exitCode: 1 };
  }

  if (result.status !== null) {
    return { exitCode: result.status };
  }

  if (result.signal) {
    return { exitCode: signalExitCode(result.signal), signal: result.signal };
  }

  return { exitCode: 1 };
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("lazygit", {
    description: "Open lazygit in the current directory",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("lazygit needs an interactive terminal", "error");
        return;
      }

      const result = await ctx.ui.custom<{ exitCode: number; signal?: NodeJS.Signals }>((tui, _theme, _kb, done) => {
        tui.stop();
        process.stdout.write("\x1b[2J\x1b[H");

        const code = runLazyGit(ctx.cwd);

        tui.start();
        tui.requestRender(true);
        done(code);

        return {
          render: () => [],
          invalidate: () => {},
          handleInput: () => {},
        };
      });

      if (result.exitCode === 127) {
        ctx.ui.notify("lazygit is not installed or not on PATH", "error");
        return;
      }

      if (result.exitCode !== 0) {
        const reason = result.signal ? ` (terminated by ${result.signal})` : "";
        ctx.ui.notify(`lazygit exited with code ${result.exitCode}${reason}`, "error");
      }
    },
  });
}

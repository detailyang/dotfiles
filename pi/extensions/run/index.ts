import { spawnSync } from "node:child_process";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

function signalExitCode(signal: NodeJS.Signals): number {
  const codes: Record<string, number> = {
    SIGHUP: 129, SIGINT: 130, SIGQUIT: 131, SIGKILL: 137, SIGTERM: 143
  };
  return codes[signal] || 128;
}

function runCommand(cmd: string, args: string[], cwd: string): { exitCode: number; signal?: NodeJS.Signals } {
  const result = spawnSync(cmd, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
    shell: false,

  });

  if (result.error) {
    return { exitCode: (result.error as NodeJS.ErrnoException).code === "ENOENT" ? 127 : 1 };
  }

  if (result.status !== null) return { exitCode: result.status };
  if (result.signal) return { exitCode: signalExitCode(result.signal), signal: result.signal };
  return { exitCode: 1 };
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("t", {
    description: "Run a TUI program (e.g., /t lazygit, /t vim file.ts, /t htop)",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("This command needs an interactive terminal", "error");
        return;
      }

      const parts = args?.trim().split(/\s+/) || [];
      if (parts.length === 0) {
        ctx.ui.notify("Usage: /t <command> [args...]", "error");
        return;
      }

      const [cmd, ...cmdArgs] = parts;

      const result = await ctx.ui.custom<{ exitCode: number; signal?: NodeJS.Signals }>((tui, _theme, _kb, done) => {
        tui.stop();
        process.stdout.write("\x1b[2J\x1b[H");

        const originalHandlers = process.listeners('SIGINT');
        process.removeAllListeners('SIGINT');
        process.on('SIGINT', () => {});

        let code: { exitCode: number; signal?: NodeJS.Signals };
        try {
          code = runCommand(cmd, cmdArgs, ctx.cwd);
        } finally {
          process.removeAllListeners('SIGINT');
          originalHandlers.forEach(h => process.on('SIGINT', h as NodeJS.SignalsListener));
        }

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
        ctx.ui.notify(`${cmd} is not installed or not on PATH`, "error");
        return;
      }

      if (result.exitCode !== 0) {
        const reason = result.signal ? ` (${result.signal})` : "";
        ctx.ui.notify(`${cmd} exited with code ${result.exitCode}${reason}`, "error");
      }
    },
  });
}

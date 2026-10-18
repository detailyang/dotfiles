import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const STATUS_KEY = "continue";
const USAGE = "Usage: /continue [<hours> | <number>h | <number>m | status | cancel]. Delay must be at least 1 ms and at most 596 hours.";

function parseDelay(args: string): number | undefined {
  const match = /^(\d+(?:\.\d+)?|\.\d+)(h|m)?$/i.exec(args);
  if (!match) return undefined;
  const delay = Number(match[1]) * (match[2]?.toLowerCase() === "m" ? 60_000 : 3_600_000);
  if (!Number.isFinite(delay) || delay < 1 || delay > 596 * 3_600_000) return undefined;
  return Math.ceil(delay);
}

export default function continueExtension(pi: ExtensionAPI): void {
  let scheduled: { deadline: number; sessionId: string; leafId: string | null } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function clear(ctx: ExtensionContext): void {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    scheduled = undefined;
    if (ctx.hasUI) ctx.ui.setStatus(STATUS_KEY, undefined);
  }

  function cancel(ctx: ExtensionContext): void {
    if (!scheduled) return;
    clear(ctx);
    ctx.ui.notify("Scheduled continuation cancelled: session activity changed.", "info");
  }

  function send(ctx: ExtensionContext): void {
    try {
      pi.sendUserMessage("continue");
    } catch (error) {
      ctx.ui.notify(`Could not continue: ${error instanceof Error ? error.message : String(error)}`, "error");
    }
  }

  function describe(deadline: number): string {
    return `Continue at ${new Date(deadline).toLocaleString()}`;
  }

  pi.registerCommand("continue", {
    description: "Send continue now or after a delay: /continue [2 | 1.5h | 90m | status | cancel]",
    handler: async (args, ctx) => {
      const input = args.trim();
      if (input === "status") {
        ctx.ui.notify(scheduled ? describe(scheduled.deadline) : "No scheduled continuation.", "info");
        return;
      }
      if (input === "cancel") {
        const wasScheduled = scheduled !== undefined;
        clear(ctx);
        ctx.ui.notify(wasScheduled ? "Scheduled continuation cancelled." : "No scheduled continuation.", "info");
        return;
      }
      const delay = input ? parseDelay(input) : 0;
      if (delay === undefined) {
        ctx.ui.notify(USAGE, "warning");
        return;
      }
      if (!ctx.isIdle() || ctx.hasPendingMessages()) {
        ctx.ui.notify("/continue requires an idle session with no queued messages. Stop or finish the current run first.", "warning");
        return;
      }

      clear(ctx);
      if (delay === 0) {
        send(ctx);
        return;
      }

      const next = {
        deadline: Date.now() + delay,
        sessionId: ctx.sessionManager.getSessionId(),
        leafId: ctx.sessionManager.getLeafId(),
      };
      scheduled = next;
      timer = setTimeout(() => {
        if (scheduled !== next) return;
        const unchanged = ctx.sessionManager.getSessionId() === next.sessionId
          && ctx.sessionManager.getLeafId() === next.leafId;
        clear(ctx);
        if (!unchanged || !ctx.isIdle() || ctx.hasPendingMessages()) {
          ctx.ui.notify("Scheduled continuation cancelled: session activity changed.", "warning");
          return;
        }
        send(ctx);
      }, delay);
      timer.unref();
      const status = describe(next.deadline);
      if (ctx.hasUI) ctx.ui.setStatus(STATUS_KEY, status);
      ctx.ui.notify(`${status}. Keep Pi running; /continue cancel cancels the timer.`, "info");
    },
  });

  pi.on("agent_start", (_event, ctx) => cancel(ctx));
  pi.on("session_before_switch", (_event, ctx) => cancel(ctx));
  pi.on("session_before_fork", (_event, ctx) => cancel(ctx));
  pi.on("session_before_tree", (_event, ctx) => cancel(ctx));
  pi.on("session_before_compact", (_event, ctx) => cancel(ctx));
  pi.on("session_start", (_event, ctx) => clear(ctx));
  pi.on("session_shutdown", (_event, ctx) => clear(ctx));
}

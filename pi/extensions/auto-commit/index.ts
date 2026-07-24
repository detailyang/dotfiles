/**
 * Yo Snapshot lifecycle adapter.
 *
 * When a compatible `yo` executable is on PATH, this records the workspace at
 * Pi's before-agent and agent-settled lifecycle boundaries. Without Yo it is inert.
 */

import { randomUUID } from "node:crypto";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  createYoSnapshot,
  detectYoSnapshot,
  type YoSnapshotOutput,
  type YoSnapshotReason,
} from "./yo.ts";

const STATUS_KEY = "yo-snapshot";

function setStatus(ctx: ExtensionContext, text: string | undefined): void {
  if (ctx.hasUI) ctx.ui.setStatus(STATUS_KEY, text);
}

function report(ctx: ExtensionContext, message: string, type: "info" | "warning" | "error"): void {
  if (ctx.hasUI) {
    ctx.ui.notify(message, type);
    return;
  }
  console.error(`[yo-snapshot] ${message}`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createdMessage(output: YoSnapshotOutput): string {
  return `Yo Snapshot ${output.snapshot_id} recorded at S${output.sequence}: ${output.files_changed} files (+${output.insertions} -${output.deletions}).`;
}

export default function (pi: ExtensionAPI) {
  let yoAvailable: boolean | undefined;

  async function ensureYo(ctx: ExtensionContext): Promise<boolean> {
    if (yoAvailable !== undefined) return yoAvailable;
    yoAvailable = await detectYoSnapshot(pi, ctx.cwd);
    setStatus(ctx, yoAvailable ? "snapshot: ready" : undefined);
    return yoAvailable;
  }

  async function recordSnapshot(
    ctx: ExtensionContext,
    reason: YoSnapshotReason,
    notify: boolean,
  ): Promise<void> {
    setStatus(ctx, "snapshot: capturing");
    try {
      const output = await createYoSnapshot(
        pi,
        `pi-${ctx.sessionManager.getSessionId()}`,
        randomUUID(),
        reason,
        ctx.cwd,
      );
      if (notify) report(ctx, createdMessage(output), "info");
      setStatus(ctx, "snapshot: ready");
    } catch (error) {
      report(ctx, `Yo Snapshot ${reason} failed: ${errorMessage(error)}`, "error");
      setStatus(ctx, "snapshot: error");
    }
  }

  pi.on("session_start", async (_event, ctx) => {
    yoAvailable = undefined;
    await ensureYo(ctx);
  });

  pi.on("before_agent_start", async (_event, ctx) => {
    if (!ctx.isProjectTrusted()) {
      setStatus(ctx, undefined);
      return;
    }
    if (!(await ensureYo(ctx))) return;
    await recordSnapshot(ctx, "before-agent", false);
  });

  pi.on("agent_settled", async (_event, ctx) => {
    if (!ctx.isProjectTrusted()) {
      setStatus(ctx, undefined);
      return;
    }
    if (!(await ensureYo(ctx))) return;
    await recordSnapshot(ctx, "agent-settled", true);
  });

  pi.on("session_shutdown", (_event, ctx) => {
    setStatus(ctx, undefined);
  });
}

import type {
  ExecResult,
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";

import {
  buildPiArgs,
  CREATE_TIMEOUT_MS,
  errorMessage,
  report,
  type BtwLocation,
  type RexHost,
  type RexLocation,
} from "./shared.ts";

type RexPaneCreated = {
  kind: "pane";
  blockId: string;
};

type RexTabCreated = {
  kind: "tab";
  windowId: string;
  blockId: string;
};

type RexFloatCreated = {
  kind: "float";
  layerId: string;
  blockId: string;
};

type RexTarget = RexPaneCreated | RexTabCreated;

// Center the BTW window at 80% of the current Rex window.
const FLOAT_BOUNDS = [0.1, 0.1, 0.8, 0.8];

function commandFailure(result: ExecResult): string {
  return result.stderr.trim() || result.stdout.trim() || `exit code ${result.code}`;
}

function parseRexResponse(stdout: string): Record<string, unknown> {
  let response: unknown;
  try {
    response = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`invalid JSON response: ${errorMessage(error)}`);
  }

  if (!response || typeof response !== "object") {
    throw new Error("response is not an object");
  }

  return response as Record<string, unknown>;
}

function parseBlockId(record: Record<string, unknown>): string {
  const blockIds = record.block_ids;
  if (!Array.isArray(blockIds)) {
    throw new Error("response is missing block_ids");
  }

  const blockId = blockIds[0];
  if (typeof blockId !== "string" || !blockId) {
    throw new Error("response is missing block_ids[0]");
  }

  return blockId;
}

function parseRexTarget(stdout: string, location: BtwLocation): RexTarget {
  const record = parseRexResponse(stdout);
  const blockId = parseBlockId(record);

  if (location === "pane") {
    return { kind: "pane", blockId };
  }

  const windowId = record.window_id;
  if (typeof windowId !== "string" || !windowId) {
    throw new Error("response is missing window_id");
  }

  return { kind: "tab", windowId, blockId };
}

function parseRexFloat(stdout: string): RexFloatCreated {
  const record = parseRexResponse(stdout);
  const blockId = parseBlockId(record);
  const layerId = record.layer_id;
  if (typeof layerId !== "string" || !layerId) {
    throw new Error("response is missing layer_id");
  }

  return { kind: "float", layerId, blockId };
}

async function resolveRexWindow(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  host: RexHost,
): Promise<string> {
  const result = await pi.exec("rex", [
    "api",
    "call",
    "-s",
    host.sessionId,
    "target.resolve",
    JSON.stringify({ kinds: ["block"], queries: [host.blockId] }),
  ], { cwd: ctx.cwd, timeout: CREATE_TIMEOUT_MS });

  if (result.code !== 0) {
    throw new Error(commandFailure(result));
  }

  const record = parseRexResponse(result.stdout);
  const results = record.results;
  if (!Array.isArray(results)) {
    throw new Error("response is missing results");
  }

  const resolved = results[0];
  if (!resolved || typeof resolved !== "object") {
    throw new Error("response is missing results[0]");
  }

  const entry = resolved as Record<string, unknown>;
  if (entry.status !== "resolved") {
    const reason = typeof entry.reason === "string" ? entry.reason.trim() : "";
    throw new Error(reason || `block ${host.blockId} was not found`);
  }

  const target = entry.target;
  if (!target || typeof target !== "object") {
    throw new Error("resolved block is missing target");
  }

  const windowId = (target as Record<string, unknown>).window_id;
  if (typeof windowId !== "string" || !windowId) {
    throw new Error(`block ${host.blockId} is not placed in a window`);
  }

  return windowId;
}

async function openRexFloat(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  host: RexHost,
  piArgs: string[],
): Promise<void> {
  let windowId: string;
  try {
    windowId = await resolveRexWindow(pi, ctx, host);
  } catch (error) {
    report(ctx, `Cannot open Rex BTW floating window: ${errorMessage(error)}`, "error");
    return;
  }

  const request = {
    session_id: host.sessionId,
    window_id: windowId,
    bounds: FLOAT_BOUNDS,
    focus: true,
    layout: {
      block: {
        flavor: "com.superlogical.terminal.shell",
        label: "btw",
        options: {
          command: ["pi", ...piArgs],
          cwd: ctx.cwd,
        },
      },
    },
  };

  let result: ExecResult;
  try {
    result = await pi.exec("rex", [
      "api",
      "call",
      "-s",
      host.sessionId,
      "session.new_layer",
      JSON.stringify(request),
    ], { cwd: ctx.cwd, timeout: CREATE_TIMEOUT_MS });
  } catch (error) {
    report(ctx, `Cannot create Rex BTW floating window: ${errorMessage(error)}`, "error");
    return;
  }

  if (result.code !== 0) {
    report(ctx, `Cannot create Rex BTW floating window: ${commandFailure(result)}`, "error");
    return;
  }

  let created: RexFloatCreated;
  try {
    created = parseRexFloat(result.stdout);
  } catch (error) {
    report(ctx, `Cannot read the Rex BTW floating window response: ${errorMessage(error)}`, "error");
    return;
  }

  report(ctx, `Opened Rex BTW floating window ${created.layerId}.`, "info");
}

export async function openRexBtw(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  host: RexHost,
  location: RexLocation,
  parentSessionFile: string,
  question: string,
): Promise<void> {
  const piArgs = buildPiArgs(pi, ctx, parentSessionFile);
  if (question) {
    piArgs.push("--", question);
  }

  if (location === "float") {
    await openRexFloat(pi, ctx, host, piArgs);
    return;
  }

  const args = location === "pane"
    ? [
        "split",
        "-s",
        host.sessionId,
        "-b",
        host.blockId,
        "--split=right",
        "-c",
        ctx.cwd,
        "--focus",
        "--json",
        "--",
        "pi",
        ...piArgs,
      ]
    : [
        "window",
        "new",
        "-s",
        host.sessionId,
        "btw",
        "-c",
        ctx.cwd,
        "--focus",
        "--json",
        "--",
        "pi",
        ...piArgs,
      ];

  let result: ExecResult;
  try {
    result = await pi.exec("rex", args, {
      cwd: ctx.cwd,
      timeout: CREATE_TIMEOUT_MS,
    });
  } catch (error) {
    report(ctx, `Cannot create Rex BTW ${location}: ${errorMessage(error)}`, "error");
    return;
  }

  if (result.code !== 0) {
    report(ctx, `Cannot create Rex BTW ${location}: ${commandFailure(result)}`, "error");
    return;
  }

  let created: RexTarget;
  try {
    created = parseRexTarget(result.stdout, location);
  } catch (error) {
    report(ctx, `Cannot read the Rex BTW ${location} response: ${errorMessage(error)}`, "error");
    return;
  }

  const targetId = created.kind === "pane" ? created.blockId : created.windowId;
  report(ctx, `Opened Rex BTW ${created.kind} ${targetId}.`, "info");
}

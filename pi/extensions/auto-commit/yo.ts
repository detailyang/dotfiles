const YO_DETECT_TIMEOUT_MS = 5_000;
const YO_CAPTURE_TIMEOUT_MS = 120_000;

export type YoSnapshotReason = "before-agent" | "agent-settled" | "manual";
type SerializedSnapshotReason = "before_agent" | "agent_settled" | "manual";

export interface YoExecOptions {
  cwd?: string;
  timeout?: number;
}

export interface YoExecResult {
  stdout: string;
  stderr: string;
  code: number;
  killed?: boolean;
}

export interface YoExecHost {
  exec(command: string, args: string[], options?: YoExecOptions): Promise<YoExecResult>;
}

export interface YoSnapshotOutput {
  status: "created";
  snapshot_id: string;
  parent_snapshot_id: string | null;
  run_id: string;
  sequence: number;
  source_event_id: string;
  reason: SerializedSnapshotReason;
  files_changed: number;
  insertions: number;
  deletions: number;
  created_at: string;
  replayed: boolean;
}

function concise(value: string, fallback: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  return normalized.length <= 300 ? normalized : `${normalized.slice(0, 297)}...`;
}

function commandFailure(result: YoExecResult, fallback: string): Error {
  const timeout = result.killed ? "yo command timed out" : fallback;
  return new Error(concise(result.stderr || result.stdout, timeout));
}

function parseJsonObject(stdout: string, command: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(stdout);
  } catch {
    throw new Error(`${command} returned invalid JSON`);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${command} returned an invalid JSON object`);
  }
  return value as Record<string, unknown>;
}

function requireString(output: Record<string, unknown>, field: string): string {
  const value = output[field];
  if (typeof value !== "string" || !value) {
    throw new Error(`yo snapshot create returned an invalid ${field}`);
  }
  return value;
}

function requireInteger(output: Record<string, unknown>, field: string, minimum: number): number {
  const value = output[field];
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum) {
    throw new Error(`yo snapshot create returned an invalid ${field}`);
  }
  return value;
}

function serializedReason(reason: YoSnapshotReason): SerializedSnapshotReason {
  return reason.replaceAll("-", "_") as SerializedSnapshotReason;
}

export async function detectYoSnapshot(host: YoExecHost, cwd: string): Promise<boolean> {
  try {
    const result = await host.exec("yo", ["snapshot", "create", "--help"], {
      cwd,
      timeout: YO_DETECT_TIMEOUT_MS,
    });
    return result.code === 0;
  } catch {
    return false;
  }
}

export async function createYoSnapshot(
  host: YoExecHost,
  runId: string,
  sourceEventId: string,
  reason: YoSnapshotReason,
  workspace: string,
): Promise<YoSnapshotOutput> {
  const result = await host.exec(
    "yo",
    [
      "snapshot",
      "create",
      "--run",
      runId,
      "--event",
      sourceEventId,
      "--reason",
      reason,
      "--workspace",
      workspace,
      "--json",
    ],
    { cwd: workspace, timeout: YO_CAPTURE_TIMEOUT_MS },
  );
  if (result.code !== 0) {
    throw commandFailure(result, "yo snapshot create failed");
  }

  const output = parseJsonObject(result.stdout, "yo snapshot create");
  if (output.status !== "created") {
    throw new Error("yo snapshot create returned an unknown status");
  }

  const snapshotId = requireString(output, "snapshot_id");
  const outputRunId = requireString(output, "run_id");
  const outputEventId = requireString(output, "source_event_id");
  const outputReason = requireString(output, "reason");
  const createdAt = requireString(output, "created_at");
  const parentId = output.parent_snapshot_id;
  if (parentId !== null && (typeof parentId !== "string" || !parentId)) {
    throw new Error("yo snapshot create returned an invalid parent_snapshot_id");
  }
  if (outputRunId !== runId) {
    throw new Error("yo snapshot create returned a mismatched run_id");
  }
  if (outputEventId !== sourceEventId) {
    throw new Error("yo snapshot create returned a mismatched source_event_id");
  }
  if (outputReason !== serializedReason(reason)) {
    throw new Error("yo snapshot create returned a mismatched reason");
  }
  if (!Number.isFinite(Date.parse(createdAt))) {
    throw new Error("yo snapshot create returned an invalid created_at");
  }
  if (typeof output.replayed !== "boolean") {
    throw new Error("yo snapshot create returned an invalid replayed flag");
  }

  return {
    status: "created",
    snapshot_id: snapshotId,
    parent_snapshot_id: parentId,
    run_id: outputRunId,
    sequence: requireInteger(output, "sequence", 1),
    source_event_id: outputEventId,
    reason: outputReason as SerializedSnapshotReason,
    files_changed: requireInteger(output, "files_changed", 0),
    insertions: requireInteger(output, "insertions", 0),
    deletions: requireInteger(output, "deletions", 0),
    created_at: createdAt,
    replayed: output.replayed,
  };
}

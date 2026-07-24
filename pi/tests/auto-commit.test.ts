import test from "node:test";
import assert from "node:assert/strict";

import autoCommitExtension from "../extensions/auto-commit/index.ts";

interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
  killed?: boolean;
}

interface ExecCall {
  command: string;
  args: string[];
  options?: { cwd?: string; timeout?: number };
}

interface HarnessOptions {
  trusted?: boolean;
  exec(call: ExecCall): ExecResult | Promise<ExecResult>;
}

function ok(stdout = ""): ExecResult {
  return { stdout, stderr: "", code: 0, killed: false };
}

function argument(args: string[], name: string): string {
  const index = args.indexOf(name);
  assert.notEqual(index, -1, `missing ${name}`);
  return args[index + 1] ?? "";
}

function snapshotOutput(
  args: string[],
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const reason = argument(args, "--reason");
  const settled = reason === "agent-settled";
  return {
    status: "created",
    snapshot_id: (settled ? "b" : "a").repeat(40),
    parent_snapshot_id: settled ? "a".repeat(40) : null,
    run_id: argument(args, "--run"),
    sequence: settled ? 2 : 1,
    source_event_id: argument(args, "--event"),
    reason: reason.replaceAll("-", "_"),
    files_changed: settled ? 2 : 0,
    insertions: settled ? 3 : 0,
    deletions: settled ? 1 : 0,
    created_at: "2026-07-22T12:00:00Z",
    replayed: false,
    ...overrides,
  };
}

function createHarness(options: HarnessOptions) {
  const handlers = new Map<string, (event: unknown, ctx: any) => unknown>();
  const calls: ExecCall[] = [];
  const notifications: Array<{ message: string; type: string }> = [];
  const statuses: Array<string | undefined> = [];
  const commands: string[] = [];
  const pi = {
    async exec(command: string, args: string[], execOptions?: ExecCall["options"]) {
      const call = { command, args, options: execOptions };
      calls.push(call);
      return options.exec(call);
    },
    registerCommand(name: string) {
      commands.push(name);
    },
    on(event: string, handler: (event: unknown, ctx: any) => unknown) {
      handlers.set(event, handler);
    },
  };
  const ctx = {
    cwd: "/workspace/project",
    hasUI: true,
    isProjectTrusted: () => options.trusted ?? true,
    sessionManager: {
      getSessionId: () => "session-123",
    },
    ui: {
      notify(message: string, type: string) {
        notifications.push({ message, type });
      },
      setStatus(_key: string, text: string | undefined) {
        statuses.push(text);
      },
    },
  };

  autoCommitExtension(pi as never);

  return {
    calls,
    commands,
    notifications,
    statuses,
    async emit(event: string) {
      await handlers.get(event)?.({}, ctx);
    },
    hasHandler(event: string) {
      return handlers.has(event);
    },
  };
}

test("silently does nothing when yo snapshot is unavailable", async () => {
  const harness = createHarness({
    exec: () => ({ stdout: "", stderr: "command not found: yo", code: 127 }),
  });

  await harness.emit("session_start");
  await harness.emit("before_agent_start");
  await harness.emit("agent_settled");

  assert.deepEqual(harness.calls.map(({ command, args }) => [command, ...args]), [
    ["yo", "snapshot", "create", "--help"],
  ]);
  assert.deepEqual(harness.notifications, []);
  assert.equal(harness.statuses.filter(Boolean).length, 0);
  assert.deepEqual(harness.commands, []);
});

test("records before-agent and agent-settled snapshots for one Pi turn", async () => {
  const harness = createHarness({
    exec: ({ args }) => {
      if (args.at(-1) === "--help") return ok();
      return ok(JSON.stringify(snapshotOutput(args)));
    },
  });

  await harness.emit("session_start");
  await harness.emit("before_agent_start");
  await harness.emit("agent_settled");

  assert.equal(harness.hasHandler("agent_end"), false);
  assert.equal(harness.calls.length, 3);
  assert.deepEqual(harness.calls[0], {
    command: "yo",
    args: ["snapshot", "create", "--help"],
    options: { cwd: "/workspace/project", timeout: 5_000 },
  });

  const before = harness.calls[1];
  const settled = harness.calls[2];
  for (const call of [before, settled]) {
    assert.equal(call.command, "yo");
    assert.deepEqual(call.args.slice(0, 5), [
      "snapshot",
      "create",
      "--run",
      "pi-session-123",
      "--event",
    ]);
    assert.match(call.args[5] ?? "", /^[0-9a-f]{8}-[0-9a-f-]{27}$/);
    assert.deepEqual(call.args.slice(8), [
      "--workspace",
      "/workspace/project",
      "--json",
    ]);
  }
  assert.deepEqual(before.args.slice(6, 8), ["--reason", "before-agent"]);
  assert.deepEqual(settled.args.slice(6, 8), ["--reason", "agent-settled"]);
  assert.notEqual(before.args[5], settled.args[5]);
  assert.equal(harness.calls.some(({ command }) => command === "git"), false);
  assert.deepEqual(harness.notifications, [
    {
      message: `Yo Snapshot ${"b".repeat(40)} recorded at S2: 2 files (+3 -1).`,
      type: "info",
    },
  ]);
  assert.equal(harness.statuses.at(-1), "snapshot: ready");
});

test("does not create snapshots for an untrusted project", async () => {
  const harness = createHarness({
    trusted: false,
    exec: () => ok(),
  });

  await harness.emit("session_start");
  await harness.emit("before_agent_start");
  await harness.emit("agent_settled");

  assert.equal(harness.calls.length, 1);
  assert.deepEqual(harness.notifications, []);
  assert.equal(harness.statuses.at(-1), undefined);
});

test("records an unchanged settled observation instead of dropping it", async () => {
  const harness = createHarness({
    exec: ({ args }) => {
      if (args.at(-1) === "--help") return ok();
      return ok(JSON.stringify(snapshotOutput(args, {
        snapshot_id: "a".repeat(40),
        files_changed: 0,
        insertions: 0,
        deletions: 0,
      })));
    },
  });

  await harness.emit("session_start");
  await harness.emit("before_agent_start");
  await harness.emit("agent_settled");

  assert.equal(harness.calls.length, 3);
  assert.deepEqual(harness.notifications, [
    {
      message: `Yo Snapshot ${"a".repeat(40)} recorded at S2: 0 files (+0 -0).`,
      type: "info",
    },
  ]);
});

test("reports a before snapshot failure but still observes agent-settled", async () => {
  const harness = createHarness({
    exec: ({ args }) => {
      if (args.at(-1) === "--help") return ok();
      if (argument(args, "--reason") === "before-agent") {
        return { stdout: "", stderr: "workspace is not a Git repository", code: 1 };
      }
      return ok(JSON.stringify(snapshotOutput(args, {
        parent_snapshot_id: null,
        sequence: 1,
      })));
    },
  });

  await harness.emit("session_start");
  await harness.emit("before_agent_start");
  await harness.emit("agent_settled");

  assert.equal(harness.calls.length, 3);
  assert.deepEqual(harness.notifications, [
    {
      message: "Yo Snapshot before-agent failed: workspace is not a Git repository",
      type: "error",
    },
    {
      message: `Yo Snapshot ${"b".repeat(40)} recorded at S1: 2 files (+3 -1).`,
      type: "info",
    },
  ]);
  assert.equal(harness.statuses.at(-1), "snapshot: ready");
});

test("rejects a malformed response instead of inventing snapshot statistics", async () => {
  const harness = createHarness({
    exec: ({ args }) => {
      if (args.at(-1) === "--help") return ok();
      return ok(JSON.stringify(snapshotOutput(args, { files_changed: undefined })));
    },
  });

  await harness.emit("session_start");
  await harness.emit("before_agent_start");

  assert.match(harness.notifications.at(-1)?.message ?? "", /invalid files_changed/);
  assert.equal(harness.notifications.at(-1)?.type, "error");
  assert.equal(harness.statuses.at(-1), "snapshot: error");
});

test("reports each create failure and allows the next lifecycle event to retry independently", async () => {
  let createAttempts = 0;
  const harness = createHarness({
    exec: ({ args }) => {
      if (args.at(-1) === "--help") return ok();
      createAttempts += 1;
      if (createAttempts === 1) {
        return { stdout: "", stderr: "snapshot ref is locked", code: 1 };
      }
      return ok(JSON.stringify(snapshotOutput(args, {
        parent_snapshot_id: null,
        sequence: 1,
      })));
    },
  });

  await harness.emit("session_start");
  await harness.emit("before_agent_start");
  await harness.emit("agent_settled");

  assert.equal(createAttempts, 2);
  assert.match(harness.notifications[0]?.message ?? "", /snapshot ref is locked/);
  assert.equal(harness.notifications[0]?.type, "error");
  assert.equal(harness.notifications[1]?.type, "info");
});

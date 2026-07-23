import test from "node:test";
import assert from "node:assert/strict";

import { registerHerdrBtwExtension } from "../extensions/herdr-btw/index.ts";

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
  env?: NodeJS.ProcessEnv;
  sessionFile?: string | null;
  exec(call: ExecCall): ExecResult | Promise<ExecResult>;
}

function ok(stdout = ""): ExecResult {
  return { stdout, stderr: "", code: 0, killed: false };
}

function tabCreatedOutput(): string {
  return JSON.stringify({
    id: "cli:tab:create",
    result: {
      type: "tab_created",
      tab: {
        tab_id: "wH:tZ",
        workspace_id: "wH",
      },
      root_pane: {
        pane_id: "wH:pZ",
        tab_id: "wH:tZ",
        workspace_id: "wH",
      },
    },
  });
}

function createHarness(options: HarnessOptions) {
  const calls: ExecCall[] = [];
  const notifications: Array<{ message: string; type: string }> = [];
  let command: { handler(args: string, ctx: any): Promise<void> } | undefined;
  const pi = {
    async exec(executable: string, args: string[], execOptions?: ExecCall["options"]) {
      const call = { command: executable, args, options: execOptions };
      calls.push(call);
      return options.exec(call);
    },
    getThinkingLevel: () => "high",
    registerCommand(name: string, registered: typeof command) {
      assert.equal(name, "herdr-btw");
      command = registered;
    },
  };
  const ctx = {
    cwd: "/workspace/project",
    isProjectTrusted: () => true,
    model: { provider: "openai", id: "gpt-5.2-codex" },
    sessionManager: {
      getSessionFile: () => options.sessionFile === null
        ? undefined
        : options.sessionFile ?? "/sessions/parent.jsonl",
    },
    ui: {
      notify(message: string, type: string) {
        notifications.push({ message, type });
      },
    },
  };

  registerHerdrBtwExtension(pi as never, options.env ?? {});
  assert.ok(command);

  return {
    calls,
    notifications,
    run: (args: string) => command.handler(args, ctx),
  };
}

test("creates a focused tab in the current Herdr workspace and starts a BTW Pi session", async () => {
  const harness = createHarness({
    env: {
      HERDR_WORKSPACE_ID: "wH",
      HERDR_BIN_PATH: "/opt/herdr/bin/herdr",
    },
    exec: ({ args }) => args[1] === "create" ? ok(tabCreatedOutput()) : ok(),
  });

  await harness.run("  Explain the failing test  ");

  assert.deepEqual(harness.calls, [
    {
      command: "/opt/herdr/bin/herdr",
      args: [
        "tab",
        "create",
        "--workspace",
        "wH",
        "--cwd",
        "/workspace/project",
        "--label",
        "btw",
        "--focus",
      ],
      options: { cwd: "/workspace/project", timeout: 10_000 },
    },
    {
      command: "/opt/herdr/bin/herdr",
      args: [
        "agent",
        "start",
        "btw-wh-pz",
        "--kind",
        "pi",
        "--pane",
        "wH:pZ",
        "--timeout",
        "30000",
        "--",
        "--fork",
        "/sessions/parent.jsonl",
        "--model",
        "openai/gpt-5.2-codex",
        "--thinking",
        "high",
        "--approve",
      ],
      options: { cwd: "/workspace/project", timeout: 35_000 },
    },
    {
      command: "/opt/herdr/bin/herdr",
      args: ["agent", "prompt", "wH:pZ", "Explain the failing test"],
      options: { cwd: "/workspace/project", timeout: 10_000 },
    },
  ]);
  assert.deepEqual(harness.notifications, [
    { message: "Opened Herdr BTW tab wH:tZ.", type: "info" },
  ]);
});

test("opens an idle Pi session when no question is supplied", async () => {
  const harness = createHarness({
    env: { HERDR_WORKSPACE_ID: "wH" },
    exec: ({ args }) => args[1] === "create" ? ok(tabCreatedOutput()) : ok(),
  });

  await harness.run("   ");

  assert.equal(harness.calls.length, 2);
  assert.equal(harness.calls[0]?.command, "herdr");
  assert.deepEqual(harness.notifications, [
    { message: "Opened Herdr BTW tab wH:tZ.", type: "info" },
  ]);
});

test("does not create a tab when the current Pi session is not persisted", async () => {
  const harness = createHarness({
    env: { HERDR_WORKSPACE_ID: "wH" },
    sessionFile: null,
    exec: () => ok(),
  });

  await harness.run("question");

  assert.deepEqual(harness.calls, []);
  assert.deepEqual(harness.notifications, [
    {
      message: "Cannot fork Herdr BTW tab: the current Pi session is not persisted.",
      type: "error",
    },
  ]);
});

test("does not create a tab outside Herdr", async () => {
  const harness = createHarness({
    exec: () => ok(),
  });

  await harness.run("question");

  assert.deepEqual(harness.calls, []);
  assert.deepEqual(harness.notifications, [
    {
      message: "Cannot open a Herdr BTW tab: HERDR_WORKSPACE_ID is unavailable.",
      type: "error",
    },
  ]);
});

test("reports tab creation failures without attempting to start Pi", async () => {
  const harness = createHarness({
    env: { HERDR_WORKSPACE_ID: "wH" },
    exec: () => ({ stdout: "", stderr: "Herdr server is unavailable", code: 1 }),
  });

  await harness.run("question");

  assert.equal(harness.calls.length, 1);
  assert.deepEqual(harness.notifications, [
    {
      message: "Cannot create Herdr BTW tab: Herdr server is unavailable",
      type: "error",
    },
  ]);
});

test("retries agent startup while the new pane shell is still starting", async () => {
  let startAttempts = 0;
  const harness = createHarness({
    env: { HERDR_WORKSPACE_ID: "wH" },
    exec: ({ args }) => {
      if (args[1] === "create") return ok(tabCreatedOutput());
      if (args[1] === "start") {
        startAttempts += 1;
        if (startAttempts === 1) {
          return {
            stdout: "",
            stderr: JSON.stringify({
              error: {
                code: "agent_pane_busy",
                message: "agent target pane is not an available shell",
              },
            }),
            code: 1,
          };
        }
      }
      return ok();
    },
  });

  await harness.run("");

  assert.equal(startAttempts, 2);
  assert.equal(harness.calls.some(({ args }) => args[1] === "close"), false);
  assert.deepEqual(harness.notifications, [
    { message: "Opened Herdr BTW tab wH:tZ.", type: "info" },
  ]);
});

test("closes the new tab when Pi fails to start", async () => {
  const harness = createHarness({
    env: { HERDR_WORKSPACE_ID: "wH" },
    exec: ({ args }) => {
      if (args[1] === "create") return ok(tabCreatedOutput());
      if (args[1] === "start") {
        return { stdout: "", stderr: "agent did not become ready", code: 1 };
      }
      return ok();
    },
  });

  await harness.run("question");

  assert.deepEqual(harness.calls.map(({ args }) => args.slice(0, 2)), [
    ["tab", "create"],
    ["agent", "start"],
    ["tab", "close"],
  ]);
  assert.deepEqual(harness.notifications, [
    {
      message: "Cannot start Pi in Herdr BTW tab: agent did not become ready",
      type: "error",
    },
  ]);
});

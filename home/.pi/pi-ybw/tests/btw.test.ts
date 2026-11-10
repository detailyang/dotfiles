import test from "node:test";
import assert from "node:assert/strict";

import { registerBtwExtension } from "../extensions/btw/index.ts";

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
  hasUI?: boolean;
  sessionFile?: string | null;
  selection?: string | null;
  choices?: string[];
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

function paneSplitOutput(): string {
  return JSON.stringify({
    id: "cli:pane:split",
    result: {
      type: "pane_info",
      pane: {
        pane_id: "wH:pN",
        tab_id: "wH:tCurrent",
        workspace_id: "wH",
      },
    },
  });
}

function rexPaneOutput(): string {
  return JSON.stringify({
    anchor_id: "block:B",
    block_ids: ["block:N"],
    split_ids: ["split:X"],
    revision: 1,
  });
}

function rexTabOutput(): string {
  return JSON.stringify({
    window_id: "window:W",
    block_ids: ["block:N"],
    revision: 1,
  });
}

function rexResolveOutput(windowId = "window:W"): string {
  return JSON.stringify({
    results: [{
      query: "block:B",
      status: "resolved",
      target: {
        kind: "block",
        session_id: "session:S",
        window_id: windowId,
        block_id: "block:B",
        label: "shell",
        where: "window 1",
      },
    }],
  });
}

function rexFloatOutput(): string {
  return JSON.stringify({
    layer_id: "layer:L",
    block_ids: ["block:N"],
    revision: 1,
  });
}

function rexFloatRequest(command: string[]): string {
  return JSON.stringify({
    session_id: "session:S",
    window_id: "window:W",
    bounds: [0.1, 0.1, 0.8, 0.8],
    focus: true,
    layout: {
      block: {
        flavor: "com.superlogical.terminal.shell",
        label: "btw",
        options: {
          command,
          cwd: "/workspace/project",
        },
      },
    },
  });
}

function createHarness(options: HarnessOptions) {
  const calls: ExecCall[] = [];
  const notifications: Array<{ message: string; type: string }> = [];
  const commands = new Map<string, { handler(args: string, ctx: any): Promise<void> }>();
  const pi = {
    async exec(executable: string, args: string[], execOptions?: ExecCall["options"]) {
      const call = { command: executable, args, options: execOptions };
      calls.push(call);
      return options.exec(call);
    },
    getThinkingLevel: () => "high",
    registerCommand(name: string, registered: { handler(args: string, ctx: any): Promise<void> }) {
      commands.set(name, registered);
    },
  };
  const ctx = {
    cwd: "/workspace/project",
    hasUI: options.hasUI ?? true,
    isProjectTrusted: () => true,
    model: { provider: "openai", id: "gpt-5.2-codex" },
    sessionManager: {
      getSessionFile: () => options.sessionFile === null
        ? undefined
        : options.sessionFile ?? "/sessions/parent.jsonl",
    },
    ui: {
      async select(title: string, choices: string[]) {
        assert.equal(title, "Open BTW in:");
        assert.deepEqual(choices, options.choices ?? ["New pane in current tab", "New tab"]);
        return options.selection === null
          ? undefined
          : options.selection ?? "New tab";
      },
      notify(message: string, type: string) {
        notifications.push({ message, type });
      },
    },
  };

  registerBtwExtension(pi as never, options.env ?? {});
  assert.deepEqual([...commands.keys()], ["btw"]);

  return {
    calls,
    notifications,
    run: (args: string) => commands.get("btw")!.handler(args, ctx),
  };
}

function rexEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    TERM_PROGRAM: "rex",
    REX_SESSION: "session:S",
    REX_BLOCK: "block:B",
    ...extra,
  };
}

const REX_LOCATION_CHOICES = ["Floating window", "New pane in current tab", "New tab"];

function createRexHarness(options: HarnessOptions) {
  return createHarness({
    choices: REX_LOCATION_CHOICES,
    ...options,
    env: options.env ?? rexEnv(),
  });
}

test("does nothing when Pi has no dialog-capable UI", async () => {
  const harness = createHarness({
    env: { HERDR_WORKSPACE_ID: "wH" },
    hasUI: false,
    exec: () => ok(),
  });

  await harness.run("question");

  assert.deepEqual(harness.calls, []);
  assert.deepEqual(harness.notifications, []);
});

test("creates a focused pane in the current tab when selected", async () => {
  const harness = createHarness({
    env: {
      HERDR_WORKSPACE_ID: "wH",
      HERDR_BIN_PATH: "/opt/herdr/bin/herdr",
    },
    selection: "New pane in current tab",
    exec: ({ args }) => args[1] === "split" ? ok(paneSplitOutput()) : ok(),
  });

  await harness.run("Compare these approaches");

  assert.deepEqual(harness.calls, [
    {
      command: "/opt/herdr/bin/herdr",
      args: [
        "pane",
        "split",
        "--current",
        "--direction",
        "right",
        "--cwd",
        "/workspace/project",
        "--focus",
      ],
      options: { cwd: "/workspace/project", timeout: 10_000 },
    },
    {
      command: "/opt/herdr/bin/herdr",
      args: [
        "agent",
        "start",
        "btw-wh-pn",
        "--kind",
        "pi",
        "--pane",
        "wH:pN",
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
      args: ["agent", "prompt", "wH:pN", "Compare these approaches"],
      options: { cwd: "/workspace/project", timeout: 10_000 },
    },
  ]);
  assert.deepEqual(harness.notifications, [
    { message: "Opened Herdr BTW pane wH:pN.", type: "info" },
  ]);
});

test("does nothing when the location selector is cancelled", async () => {
  const harness = createHarness({
    env: { HERDR_WORKSPACE_ID: "wH" },
    selection: null,
    exec: () => ok(),
  });

  await harness.run("question");

  assert.deepEqual(harness.calls, []);
  assert.deepEqual(harness.notifications, [
    { message: "BTW cancelled.", type: "info" },
  ]);
});

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

test("does not create a target when the current Pi session is not persisted", async () => {
  const harness = createHarness({
    env: { HERDR_WORKSPACE_ID: "wH" },
    sessionFile: null,
    exec: () => ok(),
  });

  await harness.run("question");

  assert.deepEqual(harness.calls, []);
  assert.deepEqual(harness.notifications, [
    {
      message: "Cannot fork BTW: the current Pi session is not persisted.",
      type: "error",
    },
  ]);
});

test("does not create a target outside Herdr or Rex", async () => {
  const harness = createHarness({
    exec: () => ok(),
  });

  await harness.run("question");

  assert.deepEqual(harness.calls, []);
  assert.deepEqual(harness.notifications, [
    {
      message: "Cannot open BTW: this terminal is not inside Herdr or Rex.",
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

test("closes only the new pane when Pi fails to start", async () => {
  const harness = createHarness({
    env: { HERDR_WORKSPACE_ID: "wH" },
    selection: "New pane in current tab",
    exec: ({ args }) => {
      if (args[1] === "split") return ok(paneSplitOutput());
      if (args[1] === "start") {
        return { stdout: "", stderr: "agent did not become ready", code: 1 };
      }
      return ok();
    },
  });

  await harness.run("question");

  assert.deepEqual(harness.calls.map(({ args }) => args.slice(0, 3)), [
    ["pane", "split", "--current"],
    ["agent", "start", "btw-wh-pn"],
    ["pane", "close", "wH:pN"],
  ]);
  assert.deepEqual(harness.notifications, [
    {
      message: "Cannot start Pi in Herdr BTW pane: agent did not become ready",
      type: "error",
    },
  ]);
});

test("creates a focused Rex pane and starts Pi with the question", async () => {
  const harness = createRexHarness({
    selection: "New pane in current tab",
    exec: () => ok(rexPaneOutput()),
  });

  await harness.run("  Compare these approaches  ");

  assert.deepEqual(harness.calls, [
    {
      command: "rex",
      args: [
        "split",
        "-s",
        "session:S",
        "-b",
        "block:B",
        "--split=right",
        "-c",
        "/workspace/project",
        "--focus",
        "--json",
        "--",
        "pi",
        "--fork",
        "/sessions/parent.jsonl",
        "--model",
        "openai/gpt-5.2-codex",
        "--thinking",
        "high",
        "--approve",
        "--",
        "Compare these approaches",
      ],
      options: { cwd: "/workspace/project", timeout: 10_000 },
    },
  ]);
  assert.deepEqual(harness.notifications, [
    { message: "Opened Rex BTW pane block:N.", type: "info" },
  ]);
});

test("creates a focused Rex tab and starts Pi with the question", async () => {
  const harness = createRexHarness({
    exec: () => ok(rexTabOutput()),
  });

  await harness.run("Explain the failing test");

  assert.deepEqual(harness.calls, [
    {
      command: "rex",
      args: [
        "window",
        "new",
        "-s",
        "session:S",
        "btw",
        "-c",
        "/workspace/project",
        "--focus",
        "--json",
        "--",
        "pi",
        "--fork",
        "/sessions/parent.jsonl",
        "--model",
        "openai/gpt-5.2-codex",
        "--thinking",
        "high",
        "--approve",
        "--",
        "Explain the failing test",
      ],
      options: { cwd: "/workspace/project", timeout: 10_000 },
    },
  ]);
  assert.deepEqual(harness.notifications, [
    { message: "Opened Rex BTW tab window:W.", type: "info" },
  ]);
});

test("creates a Rex floating window and starts Pi with the question", async () => {
  const harness = createRexHarness({
    selection: "Floating window",
    exec: ({ args }) => args[4] === "target.resolve"
      ? ok(rexResolveOutput())
      : ok(rexFloatOutput()),
  });

  await harness.run("  Compare these approaches  ");

  assert.deepEqual(harness.calls, [
    {
      command: "rex",
      args: [
        "api",
        "call",
        "-s",
        "session:S",
        "target.resolve",
        JSON.stringify({ kinds: ["block"], queries: ["block:B"] }),
      ],
      options: { cwd: "/workspace/project", timeout: 10_000 },
    },
    {
      command: "rex",
      args: [
        "api",
        "call",
        "-s",
        "session:S",
        "session.new_layer",
        rexFloatRequest([
          "pi",
          "--fork",
          "/sessions/parent.jsonl",
          "--model",
          "openai/gpt-5.2-codex",
          "--thinking",
          "high",
          "--approve",
          "--",
          "Compare these approaches",
        ]),
      ],
      options: { cwd: "/workspace/project", timeout: 10_000 },
    },
  ]);
  assert.deepEqual(harness.notifications, [
    { message: "Opened Rex BTW floating window layer:L.", type: "info" },
  ]);
});

test("reports when the Rex block is not placed in a window", async () => {
  const harness = createRexHarness({
    selection: "Floating window",
    exec: () => ok(JSON.stringify({
      results: [{ query: "block:B", status: "not_found", reason: "block is detached" }],
    })),
  });

  await harness.run("question");

  assert.equal(harness.calls.length, 1);
  assert.deepEqual(harness.notifications, [
    { message: "Cannot open Rex BTW floating window: block is detached", type: "error" },
  ]);
});

test("reports when the resolved Rex block has no window", async () => {
  const harness = createRexHarness({
    selection: "Floating window",
    exec: () => ok(JSON.stringify({
      results: [{
        query: "block:B",
        status: "resolved",
        target: {
          kind: "block",
          session_id: "session:S",
          block_id: "block:B",
          label: "shell",
        },
      }],
    })),
  });

  await harness.run("question");

  assert.equal(harness.calls.length, 1);
  assert.deepEqual(harness.notifications, [
    {
      message: "Cannot open Rex BTW floating window: block block:B is not placed in a window",
      type: "error",
    },
  ]);
});

test("reports Rex floating window creation failures", async () => {
  const harness = createRexHarness({
    selection: "Floating window",
    exec: ({ args }) => args[4] === "target.resolve"
      ? ok(rexResolveOutput())
      : { stdout: "", stderr: "layer limit reached", code: 1 },
  });

  await harness.run("question");

  assert.deepEqual(harness.notifications, [
    { message: "Cannot create Rex BTW floating window: layer limit reached", type: "error" },
  ]);
});

test("reports malformed Rex floating window responses", async () => {
  const harness = createRexHarness({
    selection: "Floating window",
    exec: ({ args }) => args[4] === "target.resolve"
      ? ok(rexResolveOutput())
      : ok(JSON.stringify({ block_ids: ["block:N"] })),
  });

  await harness.run("question");

  assert.deepEqual(harness.notifications, [
    { message: "Cannot read the Rex BTW floating window response: response is missing layer_id", type: "error" },
  ]);
});

test("opens an idle Rex Pi session without a question argument", async () => {
  const harness = createRexHarness({
    exec: () => ok(rexTabOutput()),
  });

  await harness.run("   ");

  assert.equal(harness.calls.length, 1);
  assert.deepEqual(harness.calls[0]?.args.slice(-8), [
    "pi",
    "--fork",
    "/sessions/parent.jsonl",
    "--model",
    "openai/gpt-5.2-codex",
    "--thinking",
    "high",
    "--approve",
  ]);
  assert.deepEqual(harness.notifications, [
    { message: "Opened Rex BTW tab window:W.", type: "info" },
  ]);
});

test("detects Rex from REX_SESSION and REX_BLOCK without TERM_PROGRAM", async () => {
  const harness = createRexHarness({
    env: { REX_SESSION: "session:S", REX_BLOCK: "block:B" },
    selection: "New pane in current tab",
    exec: () => ok(rexPaneOutput()),
  });

  await harness.run("question");

  assert.equal(harness.calls[0]?.command, "rex");
  assert.equal(harness.notifications[0]?.message, "Opened Rex BTW pane block:N.");
});

test("prefers Rex when the Rex environment is active", async () => {
  const harness = createRexHarness({
    env: rexEnv({ HERDR_WORKSPACE_ID: "wH" }),
    selection: "New pane in current tab",
    exec: () => ok(rexPaneOutput()),
  });

  await harness.run("question");

  assert.equal(harness.calls[0]?.command, "rex");
  assert.equal(harness.notifications[0]?.message, "Opened Rex BTW pane block:N.");
});

test("prefers Herdr when Herdr sets TERM_PROGRAM in a nested Rex pane", async () => {
  const harness = createHarness({
    env: {
      ...rexEnv(),
      TERM_PROGRAM: "herdr",
      HERDR_WORKSPACE_ID: "wH",
    },
    exec: () => ok(tabCreatedOutput()),
  });

  await harness.run("question");

  assert.equal(harness.calls[0]?.command, "herdr");
  assert.equal(harness.notifications[0]?.message, "Opened Herdr BTW tab wH:tZ.");
});

test("reports Rex creation failures", async () => {
  const harness = createRexHarness({
    selection: "New pane in current tab",
    exec: () => ({ stdout: "", stderr: "rex server is unavailable", code: 1 }),
  });

  await harness.run("question");

  assert.deepEqual(harness.notifications, [
    {
      message: "Cannot create Rex BTW pane: rex server is unavailable",
      type: "error",
    },
  ]);
});

test("reports malformed Rex creation responses", async () => {
  const harness = createRexHarness({
    selection: "New pane in current tab",
    exec: () => ok(JSON.stringify({ anchor_id: "block:B" })),
  });

  await harness.run("question");

  assert.deepEqual(harness.notifications, [
    {
      message: "Cannot read the Rex BTW pane response: response is missing block_ids",
      type: "error",
    },
  ]);
});

test("reports missing Rex session variables", async () => {
  const harness = createRexHarness({
    env: { TERM_PROGRAM: "rex", REX_SESSION: "session:S" },
    exec: () => ok(),
  });

  await harness.run("question");

  assert.deepEqual(harness.calls, []);
  assert.deepEqual(harness.notifications, [
    {
      message: "Cannot open BTW: Rex did not provide REX_SESSION and REX_BLOCK.",
      type: "error",
    },
  ]);
});

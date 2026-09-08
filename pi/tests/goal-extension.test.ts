import assert from "node:assert/strict";
import test from "node:test";
import { Agent } from "@earendil-works/pi-agent-core";
import { createAssistantMessageEventStream, type AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import goalExtension from "../extensions/goal/index.ts";
import { createGoalState, type GoalState } from "../extensions/goal/goal-state.ts";

function stateEntry(goal: GoalState | null, statusBarEnabled = true) {
  return { type: "custom", customType: "pi-goal", data: { goal, statusBarEnabled } };
}

function assistant(tokens = 10, stopReason: AssistantMessage["stopReason"] = "stop", content: AssistantMessage["content"] = []) {
  return {
    role: "assistant", api: "openai-responses", provider: "offline", model: "offline", timestamp: Date.now(),
    content, stopReason,
    usage: { input: tokens, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: tokens,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
  } satisfies AssistantMessage;
}

function createHarness(initial: GoalState | null = null) {
  const handlers = new Map<string, (event: any, ctx: ExtensionContext) => any>();
  const tools = new Map<string, ToolDefinition<any>>();
  const commands = new Map<string, any>();
  const sent: Array<{ message: any; options: any }> = [];
  const notifications: string[] = [];
  const status = new Map<string, string>();
  let branch: any[] = initial ? [stateEntry(initial)] : [];
  let activeTools = ["read", "create_goal", "get_goal", "update_goal"];
  let aborted = false;
  let idle = true;
  let pending = false;
  let confirmed = true;
  const ctx = {
    mode: "tui", hasUI: true, signal: undefined as AbortSignal | undefined,
    isIdle: () => idle,
    hasPendingMessages: () => pending,
    abort: () => { aborted = true; },
    sessionManager: { getBranch: () => branch, getEntries: () => branch },
    ui: {
      setStatus: (key: string, value: string) => status.set(key, value),
      notify: (message: string) => notifications.push(message),
      confirm: async () => confirmed,
    },
  };
  const pi = {
    registerMessageRenderer() {},
    registerTool: (tool: ToolDefinition<any>) => tools.set(tool.name, tool),
    registerCommand: (name: string, command: any) => commands.set(name, command),
    on: (name: string, handler: any) => handlers.set(name, handler),
    getActiveTools: () => activeTools,
    setActiveTools: (names: string[]) => { activeTools = names; },
    appendEntry: (customType: string, data: unknown) => branch.push({ type: "custom", customType, data }),
    sendMessage: (message: any, options?: any) => { sent.push({ message, options }); },
  };
  goalExtension(pi as unknown as ExtensionAPI);
  function emit(type: string, event: any = {}) {
    return handlers.get(type)?.({ type, ...event }, ctx as unknown as ExtensionContext);
  }
  async function execute(name: string, params: any = {}) {
    const tool = tools.get(name)!;
    return tool.execute(name, params, ctx.signal, undefined, ctx as unknown as ExtensionContext);
  }
  return {
    pi, ctx, tools, sent, notifications, status, emit, execute,
    start: (reason = "startup") => emit("session_start", { reason }),
    command: (args: string) => commands.get("goal").handler(args, ctx),
    state: async () => ((await execute("get_goal")).details as { goal: GoalState | null }).goal,
    setBranch: (next: any[]) => { branch = next; },
    setIdle: (value: boolean) => { idle = value; },
    setPending: (value: boolean) => { pending = value; },
    setConfirmed: (value: boolean) => { confirmed = value; },
    aborted: () => aborted,
  };
}

test("extension instances isolate goals, counters, and settings", async () => {
  const a = createHarness(createGoalState("A", 1000));
  a.start();
  await a.command("statusbar off");
  const b = createHarness(createGoalState("B", 2000));
  b.start();
  a.emit("turn_start");
  b.emit("turn_start");
  a.emit("turn_end", { message: assistant(100) });
  b.emit("turn_end", { message: assistant(200) });
  assert.equal((await a.state())?.objective, "A");
  assert.equal((await a.state())?.tokensUsed, 100);
  assert.equal((await b.state())?.tokensUsed, 200);
  assert.equal(a.status.get("pi-goal"), "");
  assert.notEqual(b.status.get("pi-goal"), "");
  await a.command("clear");
  assert.equal((await b.state())?.objective, "B");
});

test("tree navigation restores the target branch, including empty and corrupt state", async () => {
  const h = createHarness(createGoalState("old", 100));
  h.start();
  const target = { ...createGoalState("target", 100), status: "blocked" as const, reason: "Need access" };
  h.setBranch([stateEntry(target, false)]);
  h.emit("session_tree");
  assert.deepEqual(await h.state(), target);
  assert.equal(h.status.get("pi-goal"), "");
  assert.ok(!h.pi.getActiveTools().includes("update_goal"));
  for (const entries of [[], [stateEntry(null)], [{ type: "custom", customType: "pi-goal", data: { goal: { version: 2 } } }]]) {
    h.setBranch(entries);
    h.emit("session_tree");
    assert.equal(await h.state(), null);
    assert.ok(!h.pi.getActiveTools().includes("get_goal"));
    h.emit("turn_start");
    h.emit("turn_end", { message: assistant() });
    assert.equal(await h.state(), null);
  }
});

test("reload pauses a restored goal and invalidates queued continuation", async () => {
  const h = createHarness(createGoalState("audit", null));
  h.start();
  h.emit("agent_end", { messages: [assistant()] });
  h.start("reload");
  await Promise.resolve();
  assert.equal((await h.state())?.status, "paused");
  assert.ok(h.sent.every(({ message }) => message.details.kind !== "continuation"));
  assert.ok(h.sent.every(({ options }) => options?.triggerTurn === false));
});

for (const event of ["session_tree", "session_shutdown"]) {
  test(`${event} cancels a stale continuation before delivery`, async () => {
    const h = createHarness(createGoalState("audit", null));
    h.start();
    h.emit("agent_end", { messages: [assistant()] });
    h.setBranch([]);
    h.emit(event);
    await Promise.resolve();
    assert.equal(h.sent.length, 0);
  });
}

test("pending user input wins over a continuation, including the microtask window", async () => {
  const h = createHarness(createGoalState("audit", null));
  h.start();
  h.emit("agent_end", { messages: [assistant()] });
  h.setPending(true);
  await Promise.resolve();
  assert.equal(h.sent.length, 0);
  h.emit("agent_end", { messages: [assistant()] });
  await Promise.resolve();
  assert.equal(h.sent.length, 0);
});

test("normal endings queue exactly one continuation and cancellation pauses", async () => {
  const h = createHarness(createGoalState("audit", null));
  h.start();
  h.emit("agent_end", { messages: [assistant()] });
  h.emit("agent_end", { messages: [assistant()] });
  await Promise.resolve();
  assert.equal(h.sent.length, 1);
  h.sent.length = 0;
  h.emit("agent_end", { messages: [assistant(0, "aborted")] });
  await Promise.resolve();
  assert.equal((await h.state())?.status, "paused");
  assert.match((await h.state())?.reason ?? "", /cancelled/);
  assert.ok(h.sent.every(({ options }) => options?.triggerTurn === false));
});

test("an aborted signal prevents continuation even when the last response used tools", async () => {
  const h = createHarness(createGoalState("audit", null));
  h.start();
  const controller = new AbortController();
  controller.abort();
  h.ctx.signal = controller.signal;
  h.emit("agent_end", { messages: [assistant(10, "toolUse")] });
  await Promise.resolve();
  assert.equal((await h.state())?.status, "paused");
  assert.ok(h.sent.every(({ options }) => options?.triggerTurn === false));
});

test("errors leave retries to Pi and pause only after failed settlement", async () => {
  const h = createHarness(createGoalState("audit", null));
  h.start();
  h.emit("agent_end", { messages: [{ ...assistant(0, "error"), errorMessage: "No access" }] });
  await Promise.resolve();
  assert.equal(h.sent.length, 0);
  assert.equal((await h.state())?.status, "active");
  h.emit("agent_settled");
  assert.equal((await h.state())?.status, "paused");
  assert.match((await h.state())?.reason ?? "", /No access/);
});

test("a successful runtime retry clears the previous failure", async () => {
  const h = createHarness(createGoalState("audit", null));
  h.start();
  h.emit("agent_end", { messages: [assistant(0, "error")] });
  h.setPending(true);
  h.emit("agent_end", { messages: [assistant()] });
  h.emit("agent_settled");
  assert.equal((await h.state())?.status, "active");
});

test("creating or replacing mid-turn charges the creating response", async () => {
  for (const initial of [null, createGoalState("old", 1000)]) {
    const h = createHarness(initial);
    h.start();
    h.setIdle(false);
    h.emit("turn_start");
    await h.execute("create_goal", { objective: "new", tokenBudget: 100 });
    h.emit("turn_end", { message: assistant(120) });
    assert.equal((await h.state())?.tokensUsed, 120);
    assert.equal((await h.state())?.status, "budget_limited");
  }
});

test("completion and final summary are charged, but later unrelated work is not", async () => {
  const h = createHarness(createGoalState("audit", 100));
  h.start();
  h.emit("turn_start");
  await h.execute("update_goal", { status: "complete" });
  h.emit("turn_end", { message: assistant(20, "toolUse") });
  h.emit("turn_start");
  h.emit("turn_end", { message: assistant(10) });
  h.emit("agent_end", { messages: [assistant()] });
  h.emit("agent_settled");
  h.emit("turn_start");
  h.emit("turn_end", { message: assistant(1000) });
  assert.equal((await h.state())?.tokensUsed, 30);
  assert.equal((await h.state())?.status, "complete");
});

test("blocked goals require a reason, persist it, and stop continuation", async () => {
  const h = createHarness(createGoalState("audit", null));
  h.start();
  h.emit("turn_start");
  const invalid = await h.execute("update_goal", { status: "blocked", reason: " " });
  assert.ok("isError" in invalid && invalid.isError);
  const reason = "Read config; attempted login; missing credentials; need access from user.";
  await h.execute("update_goal", { status: "blocked", reason });
  h.emit("turn_end", { message: assistant(10, "toolUse") });
  h.emit("agent_end", { messages: [assistant()] });
  await Promise.resolve();
  assert.equal((await h.state())?.status, "blocked");
  assert.equal((await h.state())?.reason, reason);
  assert.equal(h.emit("tool_call", { toolName: "read" })?.block, true);
  assert.ok(h.sent.every(({ message }) => message.details.kind !== "continuation"));
  h.emit("agent_settled");
  h.setBranch([stateEntry((await h.state())!)]);
  h.start();
  assert.equal((await h.state())?.reason, reason);
  await h.command("resume");
  assert.equal((await h.state())?.status, "active");
  assert.equal((await h.state())?.reason, undefined);
});

test("pause and clear abort an in-flight operation without starting another", async () => {
  for (const command of ["pause", "clear"]) {
    const h = createHarness(createGoalState("audit", null));
    h.start();
    h.setIdle(false);
    await h.command(command);
    assert.equal(h.aborted(), true);
    assert.ok(h.sent.every(({ options }) => options?.triggerTurn === false));
  }
});

test("resume starts an idle restored active goal without duplicating an in-flight run", async () => {
  const h = createHarness(createGoalState("audit", null));
  h.start("resume");
  assert.equal(h.sent.length, 0);
  await h.command("resume");
  await Promise.resolve();
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].message.details.kind, "continuation");
  h.setIdle(false);
  await h.command("resume");
  await Promise.resolve();
  assert.equal(h.sent.length, 1);
});

test("clearing or pausing an old inactive goal does not abort unrelated work", async () => {
  for (const command of ["clear", "pause"]) {
    const h = createHarness({ ...createGoalState("old", null), status: "paused" });
    h.start();
    h.setIdle(false);
    h.emit("turn_start");
    await h.command(command);
    assert.equal(h.aborted(), false);
  }
});

test("exhausted or completed goals cannot be reopened by resume", async () => {
  for (const status of ["budget_limited", "paused", "blocked", "complete"] as const) {
    const goal = { ...createGoalState("audit", 100), status, tokensUsed: 100 };
    const h = createHarness(goal);
    h.start();
    await h.command("resume");
    assert.deepEqual(await h.state(), goal);
    assert.equal(h.sent.length, 0);
  }
});

test("restoration repairs an exhausted active goal and keeps completion available", async () => {
  const h = createHarness({ ...createGoalState("audit", 100), tokensUsed: 100 });
  h.start();
  assert.equal((await h.state())?.status, "budget_limited");
  assert.ok(h.pi.getActiveTools().includes("update_goal"));
  await h.execute("update_goal", { status: "complete" });
  assert.equal((await h.state())?.status, "complete");
});

test("completion after restoring an exhausted goal charges that response and its summary", async () => {
  const h = createHarness({ ...createGoalState("audit", 100), status: "budget_limited", tokensUsed: 150 });
  h.start();
  h.emit("turn_start");
  await h.execute("update_goal", { status: "complete" });
  h.emit("turn_end", { message: assistant(20, "toolUse") });
  h.emit("turn_start");
  h.emit("turn_end", { message: assistant(10) });
  assert.equal((await h.state())?.tokensUsed, 180);
  assert.equal((await h.state())?.status, "complete");
});

test("runtime retries cannot extend an exhausted wrap-up allowance", async () => {
  const h = createHarness(createGoalState("audit", 100));
  h.start();
  h.emit("turn_start");
  h.emit("turn_end", { message: assistant(150) });
  for (let index = 0; index < 2; index++) {
    h.emit("turn_start");
    h.emit("turn_end", { message: assistant(5, "error") });
    h.emit("agent_end", { messages: [assistant(5, "error")] });
  }
  assert.equal(h.aborted(), false);
  h.emit("turn_start");
  assert.equal(h.aborted(), true);
  assert.equal((await h.state())?.tokensUsed, 160);
});

for (const stopReason of ["aborted", "error"] as const) {
  test(`budget crossing on ${stopReason} never enqueues another turn`, async () => {
    const h = createHarness(createGoalState("audit", 100));
    h.start();
    h.emit("turn_start");
    h.emit("turn_end", { message: assistant(150, stopReason) });
    h.emit("agent_end", { messages: [assistant(150, stopReason)] });
    h.emit("agent_settled");
    await Promise.resolve();
    assert.equal(h.sent.length, 0);
    assert.equal((await h.state())?.tokensUsed, 150);
    assert.equal((await h.state())?.status, "budget_limited");
  });
}

test("invalid command budgets and cancelled replacement leave the current goal intact", async () => {
  const goal = createGoalState("old", 100);
  const h = createHarness(goal);
  h.start();
  await h.command("--tokens 0.1 new");
  assert.deepEqual(await h.state(), goal);
  h.setConfirmed(false);
  await h.command("new");
  assert.deepEqual(await h.state(), goal);
});

async function runOffline(responses: AssistantMessage[], budget: number | null = 100) {
  const h = createHarness(createGoalState("Offline verification", budget));
  h.start();
  const trace: Array<{ notified: boolean; stopReason: string }> = [];
  let workCalls = 0;
  let responseIndex = 0;
  const pendingCustom: any[] = [];
  const read = {
    name: "read", label: "Read", description: "Offline no-op", parameters: Type.Object({}),
    async execute() { workCalls++; return { content: [{ type: "text" as const, text: "verified" }], details: {} }; },
  };
  const registry = [read, ...Array.from(h.tools.values()).map((tool) => ({
    ...tool,
    execute: (id: string, args: any, signal: AbortSignal | undefined, onUpdate: any) =>
      tool.execute(id, args, signal, onUpdate, h.ctx as unknown as ExtensionContext),
  }))];
  const agent: Agent = new Agent({
    initialState: {
      model: { api: "openai-responses", provider: "offline", id: "offline", baseUrl: "https://offline.invalid", name: "Offline", reasoning: false,
        input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 100_000, maxTokens: 1000 },
      tools: registry,
    },
    convertToLlm: (messages) => messages as any,
    beforeToolCall: async ({ toolCall }) => h.emit("tool_call", { toolName: toolCall.name, input: toolCall.arguments }),
    prepareNextTurnWithContext: () => ({ context: { systemPrompt: "", messages: agent.state.messages.slice(), tools: agent.state.tools.slice() } }),
    streamFn: (_model, context, options) => {
      const response = options?.signal?.aborted ? assistant(0, "aborted") : responses[responseIndex++];
      assert.ok(response, "Unexpected extra model request");
      trace.push({
        notified: context.messages.some((message: any) => message.details?.kind === "budget_limited"),
        stopReason: response.stopReason,
      });
      const stream = createAssistantMessageEventStream();
      if (response.stopReason === "error" || response.stopReason === "aborted") {
        stream.push({ type: "error", reason: response.stopReason, error: response });
      } else {
        assert.ok(response.stopReason !== "pending");
        stream.push({ type: "done", reason: response.stopReason, message: response });
      }
      return stream;
    },
  });
  h.ctx.isIdle = () => !agent.state.isStreaming;
  Object.defineProperty(h.ctx, "signal", { get: () => agent.signal });
  h.ctx.abort = () => agent.abort();
  const setActiveTools = h.pi.setActiveTools;
  h.pi.setActiveTools = (names) => {
    setActiveTools(names);
    agent.state.tools = registry.filter((tool) => names.includes(tool.name));
  };
  h.pi.sendMessage = (message, options) => {
    h.sent.push({ message, options });
    const custom = { role: "custom", timestamp: Date.now(), ...message };
    if (options?.triggerTurn === false) pendingCustom.push(custom);
    else if (options?.deliverAs === "followUp") agent.followUp(custom);
    else agent.steer(custom);
  };
  agent.subscribe(async (event) => {
    await h.emit(event.type, event);
    if (event.type === "turn_end") agent.state.messages.push(...pendingCustom.splice(0));
  });
  await agent.prompt("Run the offline scenario");
  // AgentSession continues queues added by agent_end handlers before settling.
  for (let runs = 0; agent.hasQueuedMessages(); runs++) {
    assert.ok(runs < 3, "Goal unexpectedly restarted itself");
    await agent.continue();
  }
  h.emit("agent_settled");
  return { h, agent, trace, workCalls };
}

function toolCall(name: string, args = {}) {
  return { type: "toolCall" as const, id: `call-${name}`, name, arguments: args };
}

test("real Agent queues deliver budget notice before more work and charge the summary", async () => {
  const result = await runOffline([
    assistant(150, "toolUse", [toolCall("read")]),
    assistant(40, "toolUse", [toolCall("read")]),
    assistant(10, "stop", [{ type: "text", text: "Budget reached; remaining work reported." }]),
  ]);
  assert.deepEqual(result.trace.map((entry) => entry.notified), [false, true, true]);
  assert.equal(result.workCalls, 1);
  assert.equal((await result.h.state())?.tokensUsed, 200);
  assert.equal((await result.h.state())?.status, "budget_limited");
  assert.equal(result.h.sent.filter(({ message }) => message.details.kind === "budget_limited").length, 1);
  assert.equal(result.h.emit("tool_call", { toolName: "read" }), undefined, "Later unrelated prompts are not gated");
});

test("a budget-limited Agent can mark verified completion and charge its final response", async () => {
  const result = await runOffline([
    assistant(150, "toolUse", [toolCall("read")]),
    assistant(40, "toolUse", [toolCall("update_goal", { status: "complete" })]),
    assistant(10, "stop", [{ type: "text", text: "Verified completion." }]),
  ]);
  assert.equal((await result.h.state())?.status, "complete");
  assert.equal((await result.h.state())?.tokensUsed, 200);
  assert.equal(result.trace.length, 3);
});

test("an Agent repeatedly calling tools after the budget is bounded and cannot replace the goal", async () => {
  const result = await runOffline([
    assistant(150, "toolUse", [toolCall("read")]),
    assistant(20, "toolUse", [toolCall("create_goal", { objective: "Bypass" })]),
    assistant(20, "toolUse", [toolCall("read")]),
  ]);
  assert.equal(result.workCalls, 1);
  assert.equal((await result.h.state())?.objective, "Offline verification");
  assert.equal((await result.h.state())?.tokensUsed, 190);
  assert.ok(result.h.notifications.some((message) => message.includes("wrap-up limit")));
  assert.ok(result.trace.length <= 4);
});

for (const stopReason of ["aborted", "error"] as const) {
  test(`a real Agent ending with ${stopReason} does not receive a goal restart`, async () => {
    const result = await runOffline([assistant(0, stopReason)], null);
    assert.equal(result.trace.length, 1);
    assert.equal((await result.h.state())?.status, "paused");
    assert.equal(result.agent.hasQueuedMessages(), false);
  });
}

test("a real Agent reports a blocker and stops without new work", async () => {
  const result = await runOffline([
    assistant(20, "toolUse", [toolCall("update_goal", { status: "blocked", reason: "Checked config; login failed; need credentials." })]),
    assistant(10, "stop", [{ type: "text", text: "Need credentials from user." }]),
  ], null);
  assert.equal((await result.h.state())?.status, "blocked");
  assert.equal((await result.h.state())?.tokensUsed, 30);
  assert.equal(result.trace.length, 2);
});

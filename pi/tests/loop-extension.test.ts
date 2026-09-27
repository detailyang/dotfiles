import assert from "node:assert/strict";
import test from "node:test";
import { Agent } from "@earendil-works/pi-agent-core";
import { createAssistantMessageEventStream, type AssistantMessage } from "@earendil-works/pi-ai";
import loop from "../extensions/loop/index.ts";
import { buildLoopPrompt, parseStoredLoopState } from "../extensions/loop/state.ts";
import { createExtensionHarness } from "./helpers/extension.ts";

const state = (data: unknown = { active: true, mode: "tests", prompt: buildLoopPrompt("tests") }) => ({ type: "custom", customType: "loop-state", data });
const ending = (stopReason: string) => ({ messages: [{ role: "assistant", stopReason }] });
const blocker = "Code delivered and tests passed; API resolution unavailable; MR thread is unresolved and needs a signed-in user to click Resolved.";

test("loop stop signals execute sequentially", () => {
  const h = createExtensionHarness(loop);
  for (const name of ["signal_loop_success", "signal_loop_blocked"]) {
    assert.equal(h.tools.get(name)?.executionMode, "sequential");
  }
});

for (const hasUI of [true, false]) {
  test(`a blocked handoff stops queued continuations without claiming success (UI=${hasUI})`, async () => {
    const h = createExtensionHarness(loop);
    h.ctx.hasUI = hasUI;
    h.entries.push(state({ active: true, mode: "custom", condition: "MR thread is resolved" }));
    await h.emit("session_start");
    let aborted = false;
    h.ctx.abort = () => { aborted = true; };
    const tool = h.tools.get("signal_loop_blocked");
    assert.ok(tool, "Blocked loops need a non-success exit");
    const pending = h.emit("agent_end", ending("stop"));
    const result = await tool.execute("blocked", { reason: ` ${blocker} ` }, undefined, undefined, h.ctx);
    await pending;
    assert.match(result.content[0].text, /without success/i);
    assert.equal(h.entries.at(-1).data.active, false);
    assert.equal(h.entries.at(-1).data.blockedReason, blocker);
    assert.equal(h.entries.at(-1).data.condition, "MR thread is resolved");
    assert.equal(aborted, false, "The current run may still deliver its final handoff");
    await h.emit("agent_end", ending("stop"));
    await h.emit("agent_settled");
    assert.equal(h.sent.length, 0);
  });
}

test("a blocked signal requires a reason and cannot overwrite an inactive handoff", async () => {
  const h = createExtensionHarness(loop);
  h.entries.push(state());
  await h.emit("session_start");
  const tool = h.tools.get("signal_loop_blocked");
  assert.ok(tool);
  for (const reason of [undefined, null, "", " ", 42]) {
    const result = await tool.execute("invalid", { reason }, undefined, undefined, h.ctx);
    assert.equal(result.isError, true);
    assert.equal(h.entries.length, 1);
  }
  await tool.execute("blocked", { reason: blocker }, undefined, undefined, h.ctx);
  const stopped = h.entries.at(-1);
  const count = h.entries.length;
  const result = await tool.execute("again", { reason: "Different reason" }, undefined, undefined, h.ctx);
  assert.match(result.content[0].text, /No active loop/);
  const success = await h.tools.get("signal_loop_success").execute("not-success", {}, undefined, undefined, h.ctx);
  assert.match(success.content[0].text, /No active loop/);
  assert.equal(h.entries.length, count);
  assert.equal(h.entries.at(-1), stopped);
});

test("blocked state survives branch restoration until the user explicitly restarts", async () => {
  const h = createExtensionHarness(loop);
  const widgets: unknown[] = [];
  h.ctx.ui.setWidget = (_name: string, value: unknown) => widgets.push(value);
  h.entries.push(state({ active: false, mode: "custom", condition: "MR thread is resolved", blockedReason: blocker }));
  for (const event of ["session_start", "session_tree"]) {
    await h.emit(event);
    await h.emit("agent_end", ending("stop"));
    assert.equal(h.sent.length, 0);
    assert.match(JSON.stringify(widgets.at(-1)), /Loop blocked/);
    assert.match(JSON.stringify(widgets.at(-1)), /MR thread/);
  }
  await h.command("loop", "self");
  assert.equal(h.entries.at(-1).data.active, true);
  assert.equal(h.entries.at(-1).data.blockedReason, undefined);
  assert.equal(h.sent.length, 1);
  assert.match(h.sent[0].message.content, /signal_loop_blocked/);
  await h.command("loop", "stop");
});

test("the success signal still ends a verified loop without recording a blocker", async () => {
  const h = createExtensionHarness(loop);
  h.entries.push(state());
  await h.emit("session_start");
  await h.tools.get("signal_loop_success").execute("success", {}, undefined, undefined, h.ctx);
  await h.emit("agent_end", ending("stop"));
  assert.deepEqual(h.entries.at(-1).data, { active: false });
  assert.equal(h.sent.length, 0);
});

test("a real Agent hands off an unresolved MR without success or another loop iteration", async () => {
  const h = createExtensionHarness(loop);
  h.entries.push(state({ active: true, mode: "custom", condition: "MR thread is resolved" }));
  await h.emit("session_start");
  const responses: Array<Pick<AssistantMessage, "content"> & { stopReason: "toolUse" | "stop" }> = [
    { stopReason: "toolUse", content: [{ type: "toolCall", id: "blocked", name: "signal_loop_blocked", arguments: { reason: blocker } }] },
    { stopReason: "stop", content: [{ type: "text", text: "Waiting for a signed-in user to resolve the MR thread; completion is not claimed." }] },
  ];
  let requests = 0;
  const calls: string[] = [];
  const agent = new Agent({
    initialState: {
      model: { api: "openai-responses", provider: "offline", id: "offline", baseUrl: "https://offline.invalid", name: "Offline", reasoning: false,
        input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 100_000, maxTokens: 1000 },
      tools: Array.from(h.tools.values()).map((tool) => ({
        ...tool,
        execute: (id: string, args: any, signal: AbortSignal | undefined, onUpdate: any) => {
          calls.push(tool.name);
          return tool.execute(id, args, signal, onUpdate, h.ctx);
        },
      })),
    },
    convertToLlm: (messages) => messages as any,
    streamFn: () => {
      const next = responses[requests++];
      assert.ok(next, "Unexpected model request after the blocked handoff");
      const message: AssistantMessage = {
        ...next, role: "assistant", api: "openai-responses", provider: "offline", model: "offline", timestamp: Date.now(),
        usage: { input: 10, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 10, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      };
      const stream = createAssistantMessageEventStream();
      stream.push({ type: "done", reason: next.stopReason, message });
      return stream;
    },
  });
  h.ctx.isIdle = () => !agent.state.isStreaming;
  h.ctx.hasPendingMessages = () => agent.hasQueuedMessages();
  Object.defineProperty(h.ctx, "signal", { get: () => agent.signal });
  h.ctx.abort = () => agent.abort();
  h.pi.sendMessage = (message, options) => {
    h.sent.push({ message, options });
    const custom = { role: "custom", timestamp: Date.now(), ...message };
    agent.followUp(custom as any);
  };
  agent.subscribe(async (event) => { await h.emit(event.type, event); });
  await agent.prompt("Other delivery and verification are done, but the required MR thread cannot be resolved without a signed-in user.");
  await h.emit("agent_settled");
  assert.deepEqual(calls, ["signal_loop_blocked"]);
  assert.equal(requests, 2);
  assert.equal(agent.hasQueuedMessages(), false);
  assert.equal(h.sent.length, 0);
  assert.equal(h.entries.at(-1).data.active, false);
  assert.equal(h.entries.at(-1).data.blockedReason, blocker);
});

test("loop restores only the active branch and validates stored state", async () => {
  const h = createExtensionHarness(loop);
  h.entries.push(state());
  h.setBranch([]);
  await h.emit("session_start");
  await h.emit("agent_end", ending("stop"));
  assert.equal(h.sent.length, 0);
  h.setBranch([state()]);
  await h.emit("session_tree");
  await h.emit("agent_end", ending("stop"));
  assert.equal(h.sent.length, 1);
  for (const data of [null, { active: true }, { active: true, mode: "other" }, { active: true, mode: "custom", condition: 42 },
    { active: true, mode: "tests", loopCount: NaN }, { active: true, mode: "tests", loopCount: -1 }]) {
    assert.deepEqual(parseStoredLoopState(data), { active: false });
  }
});

test("loop errors leave retries to Pi, then stop on unsuccessful settlement", async () => {
  const h = createExtensionHarness(loop);
  h.entries.push(state());
  await h.emit("session_start");
  await h.emit("agent_end", ending("error"));
  assert.equal(h.sent.length, 0);
  await h.emit("agent_settled");
  assert.equal(h.entries.at(-1).data.active, false);
  assert.match(h.notices.at(-1)!, /No successful/);
});

test("a recovered retry continues and cancellation stops in non-UI mode", async () => {
  const h = createExtensionHarness(loop);
  h.ctx.hasUI = false;
  h.entries.push(state());
  await h.emit("session_start");
  await h.emit("agent_end", ending("error"));
  await h.emit("agent_end", ending("stop"));
  await h.emit("agent_settled");
  assert.equal(h.sent.length, 1);
  await h.emit("agent_end", ending("aborted"));
  assert.equal(h.entries.at(-1).data.active, false);
  assert.equal(h.sent.length, 1);
});

for (const event of ["session_tree", "session_shutdown", "session_start"]) {
  test(`${event} cancels queued loop continuations`, async () => {
    const h = createExtensionHarness(loop);
    h.entries.push(state());
    await h.emit("session_start");
    const endingPromise = h.emit("agent_end", ending("stop"));
    h.setBranch([]);
    await h.emit(event, { reason: "reload" });
    await endingPromise;
    assert.equal(h.sent.length, 0);
  });
}

test("pending input wins and stop aborts only active goal-related work", async () => {
  const h = createExtensionHarness(loop);
  h.entries.push(state());
  await h.emit("session_start");
  const pending = h.emit("agent_end", ending("stop"));
  h.ctx.hasPendingMessages = () => true;
  await pending;
  assert.equal(h.sent.length, 0);
  let aborted = 0;
  h.ctx.isIdle = () => false;
  h.ctx.abort = () => { aborted++; };
  await h.command("loop", "stop");
  await h.command("loop", "stop");
  assert.equal(aborted, 1);
});

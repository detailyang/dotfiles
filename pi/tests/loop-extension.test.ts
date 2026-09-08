import assert from "node:assert/strict";
import test from "node:test";
import loop from "../extensions/loop/index.ts";
import { buildLoopPrompt, parseStoredLoopState } from "../extensions/loop/state.ts";
import { createExtensionHarness } from "./helpers/extension.ts";

const state = (data: unknown = { active: true, mode: "tests", prompt: buildLoopPrompt("tests") }) => ({ type: "custom", customType: "loop-state", data });
const ending = (stopReason: string) => ({ messages: [{ role: "assistant", stopReason }] });

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

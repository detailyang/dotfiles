import assert from "node:assert/strict";
import test from "node:test";
import continueExtension from "../extensions/continue/index.ts";
import { createExtensionHarness } from "./helpers/extension.ts";

const HOUR = 3_600_000;

function setup() {
  const h = createExtensionHarness(continueExtension);
  const statuses: Array<string | undefined> = [];
  h.ctx.ui.setStatus = (_key: string, value: string | undefined) => statuses.push(value);
  h.ctx.sessionManager.getSessionId = () => "session";
  h.ctx.sessionManager.getLeafId = () => "leaf";
  return { ...h, statuses };
}

test("/continue immediately sends the literal continue as a user message", async () => {
  const h = setup();
  await h.command("continue");
  assert.deepEqual(h.sent, [{ message: "continue", options: undefined }]);
});

for (const [args, delay] of [["2", 2 * HOUR], ["1.5h", 1.5 * HOUR], ["90m", 1.5 * HOUR], [".5H", HOUR / 2]] as const) {
  test(`/continue ${args} triggers exactly once at the deadline`, async (t) => {
    t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000 });
    const h = setup();
    await h.command("continue", args);
    assert.match(h.statuses.at(-1)!, /Continue at/);
    t.mock.timers.tick(delay - 1);
    assert.equal(h.sent.length, 0);
    t.mock.timers.tick(1);
    assert.deepEqual(h.sent, [{ message: "continue", options: undefined }]);
    assert.equal(h.statuses.at(-1), undefined);
    t.mock.timers.tick(5 * HOUR);
    assert.equal(h.sent.length, 1);
  });
}

test("status does not reschedule; replacement, cancel and immediate continue clear old timers", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000 });
  const h = setup();
  await h.command("continue", "1h");
  t.mock.timers.tick(HOUR / 2);
  await h.command("continue", "status");
  assert.match(h.notices.at(-1)!, /Continue at/);
  await h.command("continue", "2h");
  t.mock.timers.tick(HOUR / 2);
  assert.equal(h.sent.length, 0);
  await h.command("continue", "cancel");
  t.mock.timers.tick(3 * HOUR);
  assert.equal(h.sent.length, 0);
  await h.command("continue", "status");
  assert.match(h.notices.at(-1)!, /No scheduled continuation/);
  await h.command("continue", "1h");
  await h.command("continue");
  assert.equal(h.sent.length, 1);
  t.mock.timers.tick(2 * HOUR);
  assert.equal(h.sent.length, 1);
});

test("invalid durations leave an existing schedule intact", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000 });
  const h = setup();
  await h.command("continue", "1h");
  for (const args of ["0", "-1", "NaN", "Infinity", "2hours", "1h 30m", "2 please", "1e3", "597h", "0.00000001h"]) {
    await h.command("continue", args);
    assert.match(h.notices.at(-1)!, /Usage:/, args);
  }
  t.mock.timers.tick(HOUR);
  assert.equal(h.sent.length, 1);
});

for (const event of ["session_start", "session_shutdown", "session_before_switch", "session_before_fork", "session_before_tree", "session_before_compact", "agent_start"]) {
  test(`${event} cancels a scheduled continuation`, async (t) => {
    t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000 });
    const h = setup();
    await h.command("continue", "1h");
    await h.emit(event);
    t.mock.timers.tick(2 * HOUR);
    assert.equal(h.sent.length, 0);
    assert.equal(h.statuses.at(-1), undefined);
  });
}

test("busy sessions, queued input and changed sessions cannot receive stale continuations", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000 });
  for (const change of [
    (h: ReturnType<typeof setup>) => { h.ctx.isIdle = () => false; },
    (h: ReturnType<typeof setup>) => { h.ctx.hasPendingMessages = () => true; },
    (h: ReturnType<typeof setup>) => { h.ctx.sessionManager.getLeafId = () => "different"; },
    (h: ReturnType<typeof setup>) => { h.ctx.sessionManager.getSessionId = () => "different"; },
  ]) {
    const h = setup();
    await h.command("continue", "1h");
    change(h);
    t.mock.timers.tick(HOUR);
    assert.equal(h.sent.length, 0);
    assert.match(h.notices.at(-1)!, /cancelled/);
  }
});

for (const args of ["", "1h"]) {
  test(`/continue ${args} requires an idle session without queued messages`, async (t) => {
    t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000 });
    for (const pending of [true, false]) {
      const h = setup();
      h.ctx.isIdle = () => pending;
      h.ctx.hasPendingMessages = () => pending;
      await h.command("continue", args);
      assert.match(h.notices.at(-1)!, /idle/);
      t.mock.timers.tick(2 * HOUR);
      assert.equal(h.sent.length, 0);
    }
  });
}

test("a synchronous dispatch failure is reported and does not leave a timer running", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000 });
  const h = setup();
  h.pi.sendUserMessage = () => { throw new Error("Runtime unavailable"); };
  await h.command("continue", "1h");
  t.mock.timers.tick(HOUR);
  assert.match(h.notices.at(-1)!, /Runtime unavailable/);
  await h.command("continue", "status");
  assert.match(h.notices.at(-1)!, /No scheduled continuation/);
});

test("non-UI sessions can schedule without touching the status UI", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000 });
  const h = setup();
  h.ctx.hasUI = false;
  h.ctx.ui.setStatus = () => { assert.fail("Status UI is unavailable"); };
  await h.command("continue", "1h");
  t.mock.timers.tick(HOUR);
  assert.equal(h.sent.length, 1);
});

import assert from "node:assert/strict";
import test from "node:test";
import type { AgentSession, CreateAgentSessionOptions, CreateAgentSessionResult, ModelRuntime } from "@earendil-works/pi-coding-agent";
import { registerBtwExtension } from "../extensions/btw/index.ts";
import { createExtensionHarness } from "./helpers/extension.ts";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
function sessionFixture(promptGate?: ReturnType<typeof deferred>) {
  const started = deferred();
  const messages: any[] = [];
  let disposed = 0;
  let prompts = 0;
  const session = {
    state: { messages }, isStreaming: false,
    subscribe: () => () => {},
    async abort() {},
    dispose() { disposed++; },
    async prompt(question: string) {
      prompts++;
      session.isStreaming = true;
      started.resolve();
      await promptGate?.promise;
      session.state.messages.push({ role: "assistant", stopReason: "stop", content: [{ type: "text", text: `Answer: ${question}` }] });
      session.isStreaming = false;
    },
  };
  return { session: session as unknown as AgentSession, started, disposed: () => disposed, prompts: () => prompts };
}
function harness(create: (options: CreateAgentSessionOptions) => Promise<AgentSession>) {
  const calls: CreateAgentSessionOptions[] = [];
  const h = createExtensionHarness((pi) => registerBtwExtension(pi, {
    createBtwModelRuntime: async () => ({} as ModelRuntime),
    createAgentSession: async (options = {}) => {
      calls.push(options);
      return { session: await create(options) } as CreateAgentSessionResult;
    },
  }));
  h.ctx.model = { provider: "offline", id: "first", api: "openai-responses" };
  return { ...h, calls, answers: () => h.entries.filter((entry) => entry.data?.question) };
}

for (const action of ["clear", "tree", "shutdown"]) {
  test(`BTW ${action} invalidates a session that is still being created`, async () => {
    const gate = deferred();
    const entered = deferred();
    const fixture = sessionFixture();
    const h = harness(async () => { entered.resolve(); await gate.promise; return fixture.session; });
    const running = h.command("btw", "old question");
    await entered.promise;
    const invalidated = action === "clear" ? h.command("btw:clear") : h.emit(action === "tree" ? "session_tree" : "session_shutdown");
    if (action !== "shutdown") await invalidated;
    gate.resolve();
    await invalidated;
    await running;
    assert.equal(fixture.prompts(), 0);
    assert.equal(fixture.disposed(), 1);
    assert.deepEqual(h.answers(), []);
  });
}

test("old creation finishing cannot clear or replace a newer in-flight session", async () => {
  const firstGate = deferred();
  const secondGate = deferred();
  const firstEntered = deferred();
  const secondEntered = deferred();
  const old = sessionFixture();
  const current = sessionFixture();
  let count = 0;
  const h = harness(async () => {
    if (++count === 1) { firstEntered.resolve(); await firstGate.promise; return old.session; }
    secondEntered.resolve(); await secondGate.promise; return current.session;
  });
  const first = h.command("btw", "old question");
  await firstEntered.promise;
  await h.command("btw:clear");
  const second = h.command("btw", "new question");
  await secondEntered.promise;
  firstGate.resolve();
  await first;
  const reopen = h.command("btw");
  secondGate.resolve();
  await Promise.all([second, reopen]);
  assert.equal(count, 2);
  assert.equal(old.disposed(), 1);
  assert.equal(current.disposed(), 0);
  assert.equal(current.prompts(), 1);
  assert.deepEqual(h.answers().map((entry) => entry.data.question), ["new question"]);
});

test("clear during prompt discards a late successful result and rejects concurrent questions", async () => {
  const gate = deferred();
  const fixture = sessionFixture(gate);
  const h = harness(async () => fixture.session);
  const running = h.command("btw", "first");
  await fixture.started.promise;
  await h.command("btw", "second");
  assert.equal(h.calls.length, 1);
  assert.match(h.notices.at(-1)!, /already running/);
  await h.command("btw:clear");
  gate.resolve();
  await running;
  assert.equal(fixture.disposed(), 1);
  assert.deepEqual(h.answers(), []);
});

test("BTW inherits changed main model and passes the session cwd", async () => {
  const fixtures: ReturnType<typeof sessionFixture>[] = [];
  const h = harness(async () => {
    const fixture = sessionFixture(); fixtures.push(fixture); return fixture.session;
  });
  await h.command("btw", "first question");
  h.ctx.model = { ...h.ctx.model, id: "second" };
  await h.command("btw", "second question");
  assert.deepEqual(h.calls.map((call) => [call.cwd, call.model?.id]), [["/offline", "first"], ["/offline", "second"]]);
  assert.deepEqual(h.answers().map((entry) => entry.data.model), ["first", "second"]);
  assert.equal(fixtures[0].disposed(), 1);
});

test("clear during summary creation prevents injection and disposes the late summary session", async () => {
  const gate = deferred();
  const entered = deferred();
  const side = sessionFixture();
  const summary = sessionFixture();
  const h = harness(async (options) => {
    if (options.tools?.length === 0) { entered.resolve(); await gate.promise; return summary.session; }
    return side.session;
  });
  await h.command("btw", "question");
  const running = h.command("btw:summarize");
  await entered.promise;
  await h.command("btw:clear");
  gate.resolve();
  await running;
  assert.equal(summary.prompts(), 0);
  assert.equal(summary.disposed(), 1);
  assert.deepEqual(h.sent, []);
});

import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { MAX_JSON_LINE_CHARS, runAgentProcess, type AgentProcessChild } from "../extensions/shared/agent-process.ts";

class Child extends EventEmitter implements AgentProcessChild {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  stdin = Object.assign(new EventEmitter(), { write() {}, end() {} });
  signals: Array<string | number> = [];
  kill(signal: NodeJS.Signals | number = "SIGTERM") { this.signals.push(signal); }
}
function message(text = "done", stopReason = "stop", errorMessage?: string): string {
  return JSON.stringify({ type: "message_end", message: { role: "assistant", stopReason, errorMessage, content: [{ type: "text", text }] } });
}
function run(child: Child, options: { signal?: AbortSignal; timeoutMs?: number } = {}, onLine?: (line: string) => void) {
  return runAgentProcess({ command: "offline", args: [], killGraceMs: 10, ...options }, onLine, () => child);
}

test("agent JSON terminal state rejects empty, failed, truncated and signal exits", async () => {
  for (const stopReason of ["error", "aborted", "length", "toolUse", "missing"]) {
    const child = new Child();
    const promise = run(child);
    if (stopReason !== "missing") child.stdout.emit("data", Buffer.from(message("partial", stopReason) + "\n"));
    child.emit("close", 0);
    await assert.rejects(promise, /did not finish successfully/);
  }
  const child = new Child();
  const promise = run(child);
  child.emit("close", null, "SIGKILL");
  await assert.rejects(promise, /signal SIGKILL/);
});

test("successful runtime retry replaces the earlier failure", async () => {
  const child = new Child();
  const promise = run(child);
  child.stdout.emit("data", Buffer.from(message("", "error", "temporary") + "\n" + message("recovered") + "\n"));
  child.emit("close", 0);
  assert.equal((await promise).finalText, "recovered");
});

test("stream decoder preserves UTF-8 across chunks and flushes a final unterminated line", async () => {
  const child = new Child();
  const seen: string[] = [];
  const promise = run(child, {}, (line) => seen.push(line));
  const text = String.fromCodePoint(0x4e2d, 0x6587);
  const wire = Buffer.from(message(text));
  const split = wire.indexOf(Buffer.from(text)) + 1;
  child.stdout.emit("data", wire.subarray(0, split));
  child.stdout.emit("data", wire.subarray(split));
  child.emit("close", 0);
  assert.equal((await promise).finalText, text);
  assert.deepEqual(seen, [message(text)]);
});

test("pre-abort never spawns; mid-run abort waits for close and escalates", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(runAgentProcess({ command: "offline", args: [], signal: controller.signal }, undefined, () => {
    assert.fail("spawned after cancellation");
  }), /Aborted/);
  const next = new AbortController();
  const child = new Child();
  let settled = false;
  const promise = run(child, { signal: next.signal });
  void promise.then(() => { settled = true; }, () => { settled = true; });
  next.abort();
  await delay(25);
  assert.equal(settled, false);
  assert.deepEqual(child.signals, ["SIGTERM", "SIGKILL"]);
  child.emit("close", null, "SIGKILL");
  await assert.rejects(promise, /Aborted/);
});

test("timeout, oversized line and callback failures cancel before returning", async () => {
  for (const kind of ["timeout", "line", "callback"]) {
    const child = new Child();
    const promise = run(child, { timeoutMs: kind === "timeout" ? 5 : 1000 }, () => {
      if (kind === "callback") throw new Error("callback failed");
    });
    if (kind === "line") child.stdout.emit("data", Buffer.from("x".repeat(MAX_JSON_LINE_CHARS + 1)));
    if (kind === "callback") child.stdout.emit("data", Buffer.from("diagnostic\n"));
    if (kind === "timeout") await delay(15);
    assert.equal(child.signals[0], "SIGTERM");
    child.emit("close", null, "SIGTERM");
    await assert.rejects(promise, /timed out|output limit|callback failed/);
  }
});

test("stderr retains a bounded tail, and spawn failures leave no live timers", async () => {
  const child = new Child();
  const promise = run(child);
  child.stderr.emit("data", Buffer.from("x".repeat(300_000) + "last diagnostic"));
  child.stdout.emit("data", Buffer.from(message()));
  child.emit("close", 0);
  const result = await promise;
  assert.equal(result.stderr.length, 256_000);
  assert.ok(result.stderr.endsWith("last diagnostic"));
  await assert.rejects(runAgentProcess({ command: "/nonexistent/pi-offline-fixture", args: [] }), /ENOENT/);
});

test("real child ignoring SIGTERM is reaped before cancellation completes", { skip: process.platform === "win32" }, async () => {
  const controller = new AbortController();
  let child: ReturnType<typeof spawn> | undefined;
  let ready!: () => void;
  const started = new Promise<void>((resolve) => { ready = resolve; });
  const promise = runAgentProcess({ command: "offline", args: [], signal: controller.signal, killGraceMs: 20 }, undefined,
    (_cmd, _args, options) => {
      child = spawn(process.execPath, ["-e", 'process.on("SIGTERM", () => {}); console.log("ready"); setInterval(() => {}, 1000)'], { ...options, stdio: ["pipe", "pipe", "pipe"] });
      child.stdout!.once("data", ready);
      return child as AgentProcessChild;
    });
  const rejected = assert.rejects(promise, /Aborted/);
  try {
    await started;
    controller.abort();
    await rejected;
    assert.equal(child!.signalCode, "SIGKILL");
    assert.throws(() => process.kill(child!.pid!, 0), { code: "ESRCH" });
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      const closed = once(child, "close");
      child.kill("SIGKILL");
      await closed;
    }
  }
});

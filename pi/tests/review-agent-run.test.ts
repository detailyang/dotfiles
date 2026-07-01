import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import {
  buildReviewAgentArgs,
  runReviewAgentProcess,
  type ReviewAgentChild,
  type SpawnReviewAgent,
} from "../extensions/review/agent-run.ts";

class FakeWritable extends EventEmitter {
  writes: string[] = [];
  ended = false;

  write(value: string): void {
    this.writes.push(value);
  }

  end(): void {
    this.ended = true;
  }
}

class FakeChild extends EventEmitter implements ReviewAgentChild {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  stdin = new FakeWritable();
  killedWith: string | null = null;

  kill(signal: string): void {
    this.killedWith = signal;
  }
}

test("buildReviewAgentArgs maps review options to pi json mode arguments", () => {
  assert.deepEqual(buildReviewAgentArgs("gpt-5", "review this", { noTools: true, noSkills: true }), [
    "--mode",
    "json",
    "-p",
    "--no-session",
    "--no-tools",
    "--no-skills",
    "--model",
    "gpt-5",
    "review this",
  ]);
});

test("runReviewAgentProcess streams complete lines, flushes tail on close, and writes stdin", async () => {
  const child = new FakeChild();
  const spawnCalls: unknown[] = [];
  const spawn: SpawnReviewAgent = (cmd, args, options) => {
    spawnCalls.push({ cmd, args, options });
    return child;
  };
  const events: string[] = [];

  const promise = runReviewAgentProcess(
    "gpt-5",
    "review",
    { cwd: "/repo", stdin: "context" },
    (event) => events.push(`${event.type}:${event.text}`),
    new AbortController().signal,
    (line) => ({ type: "status", text: line.toUpperCase() }),
    spawn,
  );

  child.stdout.emit("data", Buffer.from("first\nsec"));
  child.stdout.emit("data", Buffer.from("ond\nlast"));
  child.emit("close", 0);

  await promise;

  assert.deepEqual(events, ["status:FIRST", "status:SECOND", "status:LAST"]);
  assert.deepEqual(child.stdin.writes, ["context"]);
  assert.equal(child.stdin.ended, true);
  assert.deepEqual(spawnCalls, [
    {
      cmd: "pi",
      args: buildReviewAgentArgs("gpt-5", "review", {}),
      options: { cwd: "/repo" },
    },
  ]);
});

test("runReviewAgentProcess rejects with stderr tail on nonzero exit", async () => {
  const child = new FakeChild();
  const spawn: SpawnReviewAgent = () => child;

  const promise = runReviewAgentProcess(
    "gpt-5",
    "review",
    {},
    () => {},
    new AbortController().signal,
    () => null,
    spawn,
  );

  child.stderr.emit("data", Buffer.from("one\ntwo\nthree"));
  child.emit("close", 2);

  await assert.rejects(promise, /pi exited with code 2\n\nstderr:\none\ntwo\nthree/);
});

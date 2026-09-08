import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { dirname } from "node:path";
import test from "node:test";
import type { Theme } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import { CommitProgressComponent, getCommitOutcome, registerCommitExtension } from "../extensions/commit/index.ts";
import { createExtensionHarness } from "./helpers/extension.ts";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

test("commit progress cancellation is idempotent and disposes its timer", () => {
  let cancels = 0;
  const component = new CommitProgressComponent({ requestRender() {} } as unknown as TUI,
    { fg: (_color: string, text: string) => text } as Theme, () => { cancels++; });
  try {
    component.handleInput("\x1b");
    component.handleInput("\x03");
    assert.equal(cancels, 1);
    assert.match(component.render(80).join(""), /Cancelling/);
  } finally { component.dispose(); }
});

test("commit shutdown aborts and waits, then removes its temporary prompt without stale notifications", async () => {
  const entered = deferred();
  const release = deferred();
  let signal: AbortSignal | undefined;
  let promptFile = "";
  let runs = 0;
  const h = createExtensionHarness((pi) => registerCommitExtension(pi, {
    getGitHead: async () => "before",
    runAgentProcess: async (options) => {
      runs++;
      signal = options.signal;
      promptFile = options.args[options.args.indexOf("--append-system-prompt") + 1];
      await access(promptFile);
      entered.resolve();
      await release.promise;
      throw new Error("Aborted");
    },
  }));
  h.ctx.mode = "rpc";
  const command = h.command("commit");
  await entered.promise;
  await h.command("commit");
  assert.equal(runs, 1);
  h.notices.length = 0;
  let stopped = false;
  const shutdown = h.emit("session_shutdown").then(() => { stopped = true; });
  await Promise.resolve();
  assert.equal(signal?.aborted, true);
  assert.equal(stopped, false);
  release.resolve();
  await Promise.all([command, shutdown]);
  await assert.rejects(access(dirname(promptFile)), { code: "ENOENT" });
  assert.deepEqual(h.notices, []);
});

test("commit failure reports observed Git changes without retrying or undoing them", () => {
  const result = getCommitOutcome({ exitCode: 1, beforeHead: "before", afterHead: "after", finalText: "", failureMessage: "Aborted" });
  assert.equal(result.type, "error");
  assert.match(result.message, /HEAD changed to after/);
});

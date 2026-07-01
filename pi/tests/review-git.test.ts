import test from "node:test";
import assert from "node:assert/strict";

import {
  checkoutPr,
  getDefaultBranch,
  getMergeBase,
  getPrInfo,
  hasPendingChanges,
  type ReviewExecHost,
} from "../extensions/review/git.ts";

function fakeHost(
  handler: (cmd: string, args: string[]) => { stdout?: string; stderr?: string; code: number },
): ReviewExecHost & { calls: Array<{ cmd: string; args: string[] }> } {
  const calls: Array<{ cmd: string; args: string[] }> = [];
  return {
    calls,
    async exec(cmd, args) {
      calls.push({ cmd, args });
      return { stdout: "", stderr: "", ...handler(cmd, args) };
    },
  };
}

test("getMergeBase prefers upstream and falls back to branch", async () => {
  const upstreamHost = fakeHost((_cmd, args) => {
    if (args[0] === "rev-parse") return { stdout: "origin/main\n", code: 0 };
    return { stdout: "abc123\n", code: 0 };
  });
  assert.equal(await getMergeBase(upstreamHost, "main"), "abc123");
  assert.deepEqual(upstreamHost.calls.map((call) => call.args), [
    ["rev-parse", "--abbrev-ref", "main@{upstream}"],
    ["merge-base", "HEAD", "origin/main"],
  ]);

  const fallbackHost = fakeHost((_cmd, args) => {
    if (args[0] === "rev-parse") return { code: 1 };
    return { stdout: args[2] === "main" ? "def456\n" : "", code: args[2] === "main" ? 0 : 1 };
  });
  assert.equal(await getMergeBase(fallbackHost, "main"), "def456");
});

test("hasPendingChanges ignores untracked files but detects tracked changes", async () => {
  assert.equal(
    await hasPendingChanges(fakeHost(() => ({ stdout: "?? new-file\n", code: 0 }))),
    false,
  );
  assert.equal(
    await hasPendingChanges(fakeHost(() => ({ stdout: " M src/file.ts\n?? new-file\n", code: 0 }))),
    true,
  );
});

test("getPrInfo and checkoutPr wrap gh output", async () => {
  const infoHost = fakeHost(() => ({
    stdout: JSON.stringify({ baseRefName: "main", title: "Add API", headRefName: "feature" }),
    code: 0,
  }));
  assert.deepEqual(await getPrInfo(infoHost, 42), {
    baseBranch: "main",
    title: "Add API",
    headBranch: "feature",
  });

  assert.deepEqual(await getPrInfo(fakeHost(() => ({ stdout: "not-json", code: 0 })), 42), null);
  assert.deepEqual(await checkoutPr(fakeHost(() => ({ code: 0 })), 42), { success: true });
  assert.deepEqual(await checkoutPr(fakeHost(() => ({ stderr: "nope", code: 1 })), 42), {
    success: false,
    error: "nope",
  });
});

test("getDefaultBranch prefers origin HEAD then main/master fallback", async () => {
  assert.equal(
    await getDefaultBranch(fakeHost((_cmd, args) => {
      if (args[0] === "symbolic-ref") return { stdout: "origin/trunk\n", code: 0 };
      return { stdout: "", code: 1 };
    })),
    "trunk",
  );

  assert.equal(
    await getDefaultBranch(fakeHost((_cmd, args) => {
      if (args[0] === "symbolic-ref") return { stdout: "", code: 1 };
      return { stdout: "feature\nmaster\n", code: 0 };
    })),
    "master",
  );
});

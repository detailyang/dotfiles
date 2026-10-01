import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLoopCompactionInstructions,
  buildLoopPrompt,
  getLoopConditionText,
  parseLoopArgs,
  parseStoredLoopState,
  summarizeLoopCondition,
} from "../extensions/loop/state.ts";

test("buildLoopPrompt preserves the success condition for all loop modes", () => {
  assert.ok(buildLoopPrompt("tests").startsWith(
    "Run all tests. If they are passing, call the signal_loop_success tool. Otherwise continue until the tests pass.",
  ));
  assert.ok(buildLoopPrompt("custom", "lint is clean").startsWith(
    "Continue until the following condition is satisfied: lint is clean. When it is satisfied, call the signal_loop_success tool.",
  ));
  assert.ok(buildLoopPrompt("self").startsWith(
    "Continue until you are done. When finished, call the signal_loop_success tool.",
  ));
});

for (const mode of ["tests", "custom", "self"] as const) {
  test(`${mode} prompts and compaction provide a blocked exit without weakening the gate`, () => {
    for (const prompt of [buildLoopPrompt(mode, "MR thread is resolved"), buildLoopCompactionInstructions(mode, "MR thread is resolved")]) {
      assert.match(prompt, /signal_loop_blocked/);
      assert.match(prompt, /user input|manual action/);
      assert.match(prompt, /evidence.*attempt.*blocker.*next/i);
      assert.match(prompt, /Do not.*weaken.*condition/);
    }
  });
}

test("restoration retains a blocked handoff and upgrades old active prompts", () => {
  const active = parseLoopArgs("custom MR thread is resolved")!;
  const reason = "Code delivered and tests passed; MR thread requires a signed-in user to resolve it.";
  const restored = parseStoredLoopState({ ...active, active: false, blockedReason: ` ${reason} `, loopCount: 3 });
  assert.deepEqual(restored, { ...active, active: false, blockedReason: reason, loopCount: 3, summary: "MR thread is resolved" });
  assert.match(parseStoredLoopState({ ...active, prompt: "Old success-only prompt" }).prompt!, /signal_loop_blocked/);
  for (const blockedReason of [undefined, null, "", " ", 42]) {
    assert.deepEqual(parseStoredLoopState({ ...active, active: false, blockedReason }), { active: false });
  }
});

test("parseLoopArgs maps direct command args to active loop state", () => {
  assert.equal(parseLoopArgs(undefined), null);
  assert.deepEqual(parseLoopArgs("tests"), {
    active: true,
    mode: "tests",
    prompt: buildLoopPrompt("tests"),
  });
  assert.deepEqual(parseLoopArgs("custom release gate is green"), {
    active: true,
    mode: "custom",
    condition: "release gate is green",
    prompt: buildLoopPrompt("custom", "release gate is green"),
  });
  assert.equal(parseLoopArgs("custom"), null);
  assert.equal(parseLoopArgs("unknown"), null);
});

test("loop condition text and summaries preserve current labels", () => {
  assert.equal(summarizeLoopCondition("tests"), "tests pass");
  assert.equal(summarizeLoopCondition("self"), "done");
  assert.equal(summarizeLoopCondition("custom", "x".repeat(60)), `${"x".repeat(45)}...`);
  assert.equal(getLoopConditionText("custom", "done"), "done");
  assert.ok(buildLoopCompactionInstructions("custom", "done").startsWith(
    "Loop active. Breakout condition: done. Preserve this loop state and breakout condition in the summary.",
  ));
});

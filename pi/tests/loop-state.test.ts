import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLoopCompactionInstructions,
  buildLoopPrompt,
  getLoopConditionText,
  parseLoopArgs,
  summarizeLoopCondition,
} from "../extensions/loop/state.ts";

test("buildLoopPrompt creates prompts for all loop modes", () => {
  assert.equal(
    buildLoopPrompt("tests"),
    "Run all tests. If they are passing, call the signal_loop_success tool. Otherwise continue until the tests pass.",
  );
  assert.equal(
    buildLoopPrompt("custom", "lint is clean"),
    "Continue until the following condition is satisfied: lint is clean. When it is satisfied, call the signal_loop_success tool.",
  );
  assert.equal(
    buildLoopPrompt("self"),
    "Continue until you are done. When finished, call the signal_loop_success tool.",
  );
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
  assert.equal(
    buildLoopCompactionInstructions("custom", "done"),
    "Loop active. Breakout condition: done. Preserve this loop state and breakout condition in the summary.",
  );
});

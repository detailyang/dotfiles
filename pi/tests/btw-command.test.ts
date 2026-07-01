import test from "node:test";
import assert from "node:assert/strict";

import {
  VALID_BTW_THINKING_LEVELS,
  parseBtwArgs,
  parseBtwModelArgs,
  parseBtwThinkingArgs,
  parseOverlayBtwCommand,
} from "../extensions/btw/command.ts";

test("parseBtwArgs extracts save flags without changing the question text otherwise", () => {
  assert.deepEqual(parseBtwArgs("hello"), { question: "hello", save: false });
  assert.deepEqual(parseBtwArgs("--save hello -s"), { question: "hello", save: true });
  assert.deepEqual(parseBtwArgs("please --save this"), { question: "please  this", save: true });
});

test("parseBtwModelArgs supports show, clear, set, and invalid forms", () => {
  assert.deepEqual(parseBtwModelArgs(""), { action: "show" });
  assert.deepEqual(parseBtwModelArgs("clear"), { action: "clear" });
  assert.deepEqual(parseBtwModelArgs("openai gpt-5 responses"), {
    action: "set",
    model: { provider: "openai", id: "gpt-5", api: "responses" },
  });
  assert.deepEqual(parseBtwModelArgs("openai gpt-5"), {
    action: "invalid",
    message: "Usage: /btw:model <provider> <model> <api> | clear",
  });
});

test("parseBtwThinkingArgs validates supported thinking levels", () => {
  assert.deepEqual(VALID_BTW_THINKING_LEVELS, ["off", "minimal", "low", "medium", "high", "xhigh"]);
  assert.deepEqual(parseBtwThinkingArgs(""), { action: "show" });
  assert.deepEqual(parseBtwThinkingArgs("clear"), { action: "clear" });
  assert.deepEqual(parseBtwThinkingArgs("high"), { action: "set", thinkingLevel: "high" });
  assert.deepEqual(parseBtwThinkingArgs("max"), {
    action: "invalid",
    message: 'Invalid thinking level "max". Valid values: off, minimal, low, medium, high, xhigh.',
  });
});

test("parseOverlayBtwCommand recognizes BTW overlay slash commands", () => {
  assert.deepEqual(parseOverlayBtwCommand("/btw:model openai gpt-5 responses"), {
    name: "btw:model",
    args: "openai gpt-5 responses",
  });
  assert.deepEqual(parseOverlayBtwCommand(" /btw:clear "), {
    name: "btw:clear",
    args: "",
  });
  assert.equal(parseOverlayBtwCommand("/review"), null);
  assert.equal(parseOverlayBtwCommand("plain question"), null);
});

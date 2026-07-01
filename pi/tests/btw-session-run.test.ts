import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBtwDetailsFromResponse,
  getBtwAuthFailureMessage,
  getLastAssistantMessage,
} from "../extensions/btw/session-run.ts";

const model = { provider: "openai", id: "gpt-5", api: "openai-responses" };

test("getLastAssistantMessage returns the last assistant message", () => {
  const first = { role: "assistant", content: [{ type: "text", text: "first" }] };
  const last = { role: "assistant", content: [{ type: "text", text: "last" }] };

  assert.equal(getLastAssistantMessage([{ role: "user", content: "hello" }, first, last]), last);
  assert.equal(getLastAssistantMessage([{ role: "user", content: "hello" }]), null);
});

test("getBtwAuthFailureMessage preserves BTW auth error text", () => {
  assert.equal(getBtwAuthFailureMessage(model, { ok: true, apiKey: "key" }), null);
  assert.equal(
    getBtwAuthFailureMessage(model, { ok: true }),
    "No credentials available for openai/gpt-5.",
  );
  assert.equal(
    getBtwAuthFailureMessage(model, { ok: false, error: "bad auth" }),
    "bad auth",
  );
  assert.equal(
    getBtwAuthFailureMessage(model, { ok: false }),
    "Authentication failed for openai/gpt-5.",
  );
});

test("buildBtwDetailsFromResponse normalizes assistant response details", () => {
  const details = buildBtwDetailsFromResponse({
    question: "ship it?",
    model,
    thinkingLevel: "high",
    response: {
      role: "assistant",
      content: [{ type: "text", text: "yes" }],
      usage: { totalTokens: 42 },
    },
    streamedThinking: "streamed thoughts",
    extractAnswer: () => "yes",
    extractThinking: () => "",
    timestamp: 123,
  });

  assert.deepEqual(details, {
    question: "ship it?",
    thinking: "streamed thoughts",
    answer: "yes",
    provider: "openai",
    model: "gpt-5",
    api: "openai-responses",
    thinkingLevel: "high",
    timestamp: 123,
    usage: { totalTokens: 42 },
  });
});

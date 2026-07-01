import test from "node:test";
import assert from "node:assert/strict";

import {
  BTW_CONTINUE_THREAD_ASSISTANT_TEXT,
  BTW_CONTINUE_THREAD_USER_TEXT,
  BTW_ENTRY_TYPE,
  BTW_MODEL_OVERRIDE_TYPE,
  BTW_RESET_TYPE,
  BTW_THINKING_OVERRIDE_TYPE,
  buildBtwSeedThreadMessages,
  buildBtwMessageContent,
  extractBtwHandoffThread,
  formatBtwThread,
  isVisibleBtwMessage,
  pendingThreadToHandoff,
  restoreBtwThreadState,
} from "../extensions/btw/thread.ts";

test("isVisibleBtwMessage identifies visible BTW custom notes", () => {
  assert.equal(isVisibleBtwMessage({ role: "custom", customType: "btw-note" }), true);
  assert.equal(isVisibleBtwMessage({ role: "custom", customType: "other" }), false);
  assert.equal(isVisibleBtwMessage({ role: "user", customType: "btw-note" }), false);
});

test("extractBtwHandoffThread skips continuation markers and groups assistant chunks", () => {
  const exchanges = extractBtwHandoffThread([
    { role: "user", content: [{ type: "text", text: BTW_CONTINUE_THREAD_USER_TEXT }] },
    { role: "assistant", content: [{ type: "text", text: BTW_CONTINUE_THREAD_ASSISTANT_TEXT }] },
    { role: "user", content: [{ type: "text", text: "first" }] },
    { role: "assistant", content: [{ type: "text", text: "answer 1" }] },
    { role: "assistant", content: [{ type: "text", text: "answer 2" }] },
    { role: "user", content: [{ type: "text", text: "second" }] },
    { role: "assistant", content: [{ type: "text", text: "done" }] },
  ]);

  assert.deepEqual(exchanges, [
    { user: "first", assistant: "answer 1\n\nanswer 2" },
    { user: "second", assistant: "done" },
  ]);
});

test("extractBtwHandoffThread fills missing user or assistant placeholders", () => {
  assert.deepEqual(extractBtwHandoffThread([{ role: "assistant", content: "answer" }]), [
    { user: "(No user prompt)", assistant: "answer" },
  ]);
  assert.deepEqual(extractBtwHandoffThread([{ role: "user", content: "question" }]), [
    { user: "question", assistant: "(No assistant response)" },
  ]);
});

test("formatBtwThread and buildBtwMessageContent preserve handoff text format", () => {
  assert.equal(buildBtwMessageContent("question", "answer"), "Q: question\n\nA: answer");
  assert.equal(
    formatBtwThread([
      { user: " first ", assistant: " answer " },
      { user: "second", assistant: "done" },
    ]),
    "User: first\nAssistant: answer\n\n---\n\nUser: second\nAssistant: done",
  );
});

test("pendingThreadToHandoff maps persisted details to handoff exchanges", () => {
  assert.deepEqual(
    pendingThreadToHandoff([
      { question: "q1", answer: "a1" },
      { question: "q2", answer: "a2" },
    ]),
    [
      { user: "q1", assistant: "a1" },
      { user: "q2", assistant: "a2" },
    ],
  );
});

test("buildBtwSeedThreadMessages replays continuation marker and persisted exchanges", () => {
  const messages = buildBtwSeedThreadMessages(
    [
      {
        question: "q1",
        answer: "a1",
        provider: "anthropic",
        model: "claude",
        api: "",
        timestamp: 123,
      },
    ],
    { provider: "openai", id: "gpt-5", api: "responses" },
    "responses",
    99,
  );

  assert.deepEqual(messages, [
    {
      role: "user",
      content: [{ type: "text", text: BTW_CONTINUE_THREAD_USER_TEXT }],
      timestamp: 99,
    },
    {
      role: "assistant",
      content: [{ type: "text", text: BTW_CONTINUE_THREAD_ASSISTANT_TEXT }],
      provider: "openai",
      model: "gpt-5",
      api: "responses",
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "stop",
      timestamp: 99,
    },
    {
      role: "user",
      content: [{ type: "text", text: "q1" }],
      timestamp: 123,
    },
    {
      role: "assistant",
      content: [{ type: "text", text: "a1" }],
      provider: "anthropic",
      model: "claude",
      api: "responses",
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "stop",
      timestamp: 123,
    },
  ]);
});

test("restoreBtwThreadState scans overrides and only keeps entries after the last reset", () => {
  const restored = restoreBtwThreadState(
    [
      { type: "custom", customType: BTW_ENTRY_TYPE, data: { question: "old", answer: "old answer", api: "responses" } },
      { type: "custom", customType: BTW_MODEL_OVERRIDE_TYPE, data: { action: "set", provider: "openai", id: "gpt-5", api: "responses" } },
      { type: "custom", customType: BTW_THINKING_OVERRIDE_TYPE, data: { action: "set", thinkingLevel: "high" } },
      { type: "custom", customType: BTW_RESET_TYPE, data: { mode: "tangent" } },
      { type: "custom", customType: BTW_ENTRY_TYPE, data: { question: "new", answer: "new answer" } },
      { type: "custom", customType: BTW_ENTRY_TYPE, data: { question: "", answer: "ignored" } },
    ],
    "openai-responses",
  );

  assert.deepEqual(restored, {
    mode: "tangent",
    modelOverride: { provider: "openai", id: "gpt-5", api: "responses" },
    thinkingOverride: "high",
    thread: [{ question: "new", answer: "new answer", api: "openai-responses" }],
  });
});

test("restoreBtwThreadState handles cleared overrides and invalid reset modes", () => {
  const restored = restoreBtwThreadState(
    [
      { type: "custom", customType: BTW_MODEL_OVERRIDE_TYPE, data: { action: "set", provider: "openai", id: "gpt-5", api: "responses" } },
      { type: "custom", customType: BTW_MODEL_OVERRIDE_TYPE, data: { action: "clear" } },
      { type: "custom", customType: BTW_THINKING_OVERRIDE_TYPE, data: { action: "clear" } },
      { type: "custom", customType: BTW_RESET_TYPE, data: { mode: "unknown" } },
    ],
    "responses",
  );

  assert.deepEqual(restored, {
    mode: "contextual",
    modelOverride: null,
    thinkingOverride: null,
    thread: [],
  });
});

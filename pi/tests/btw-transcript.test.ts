import test from "node:test";
import assert from "node:assert/strict";

import {
  applyBtwTranscriptEvent,
  createEmptyBtwTranscriptState,
  getCompletedBtwExchangeCount,
  hasStreamingBtwTranscriptEntry,
} from "../extensions/btw/transcript.ts";

test("BTW transcript state records a streamed turn and closes streaming entries", () => {
  const state = createEmptyBtwTranscriptState();

  applyBtwTranscriptEvent(state, { type: "turn_start" });
  applyBtwTranscriptEvent(state, {
    type: "message_start",
    message: { role: "user", content: [{ type: "text", text: "hello" }] },
  });
  applyBtwTranscriptEvent(state, {
    type: "message_update",
    message: {
      role: "assistant",
      content: [
        { type: "thinking", thinking: "working" },
        { type: "text", text: "hi" },
      ],
    },
  });
  applyBtwTranscriptEvent(state, {
    type: "tool_execution_start",
    toolCallId: "tool-1",
    toolName: "read",
    args: { path: "/tmp/file.txt" },
  });
  applyBtwTranscriptEvent(state, {
    type: "tool_execution_update",
    toolCallId: "tool-1",
    toolName: "read",
    partialResult: { content: [{ type: "text", text: "partial" }] },
  });

  assert.equal(hasStreamingBtwTranscriptEntry(state.entries), true);

  applyBtwTranscriptEvent(state, {
    type: "tool_execution_end",
    toolCallId: "tool-1",
    toolName: "read",
    result: { content: [{ type: "text", text: "done" }] },
    isError: false,
  });
  applyBtwTranscriptEvent(state, { type: "turn_end" });

  assert.equal(hasStreamingBtwTranscriptEntry(state.entries), false);
  assert.equal(getCompletedBtwExchangeCount(state.entries), 1);
  assert.deepEqual(state.entries, [
    { id: 1, type: "turn-boundary", turnId: 1, phase: "start" },
    { id: 2, type: "user-message", turnId: 1, text: "hello" },
    { id: 3, type: "thinking", turnId: 1, text: "working", streaming: false },
    { id: 4, type: "assistant-text", turnId: 1, text: "hi", streaming: false },
    { id: 5, type: "tool-call", turnId: 1, toolCallId: "tool-1", toolName: "read", args: "/tmp/file.txt" },
    {
      id: 6,
      type: "tool-result",
      turnId: 1,
      toolCallId: "tool-1",
      toolName: "read",
      content: "done",
      truncated: false,
      isError: false,
      streaming: false,
    },
    { id: 7, type: "turn-boundary", turnId: 1, phase: "end" },
  ]);
});

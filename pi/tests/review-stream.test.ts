import test from "node:test";
import assert from "node:assert/strict";

import { parseReviewStreamLine } from "../extensions/review/stream.ts";

test("parseReviewStreamLine ignores blank lines and reports malformed JSON as status", () => {
  assert.equal(parseReviewStreamLine("   "), null);
  assert.deepEqual(parseReviewStreamLine("not json".repeat(20)), {
    type: "status",
    text: "not jsonnot jsonnot jsonnot jsonnot jsonnot jsonnot jsonnot jsonnot jsonnot jsonnot jsonnot jsonnot jsonnot jsonnot jso…",
  });
});

test("parseReviewStreamLine extracts assistant text updates", () => {
  assert.deepEqual(
    parseReviewStreamLine(JSON.stringify({
      type: "message_update",
      message: { role: "assistant", content: [{ type: "text", text: "review text" }] },
    })),
    { type: "assistant", text: "review text" },
  );
});

test("parseReviewStreamLine summarizes tool events", () => {
  assert.deepEqual(
    parseReviewStreamLine(JSON.stringify({ type: "tool_execution_start", toolName: "bash", args: { command: "npm test" } })),
    { type: "status", text: "running: npm test" },
  );
  assert.deepEqual(
    parseReviewStreamLine(JSON.stringify({
      type: "tool_execution_update",
      isError: true,
      partialResult: { content: [{ type: "text", text: "failed loudly" }] },
    })),
    { type: "status", text: "failed loudly" },
  );
  assert.deepEqual(
    parseReviewStreamLine(JSON.stringify({ type: "tool_execution_end", isError: true, toolName: "bash" })),
    { type: "status", text: "bash failed" },
  );
  assert.equal(parseReviewStreamLine(JSON.stringify({ type: "tool_execution_update", isError: false })), null);
});

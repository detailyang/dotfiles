import test from "node:test";
import assert from "node:assert/strict";

import {
  extractCodexTextContent,
  extractDisplayToolText,
  extractMessageText,
  extractTextContent,
  extractTextParts,
  parseCodexJsonlMetadata,
  parseCodexJsonlTranscript,
  summarizeToolResultContent,
} from "../extensions/shared/transcript.ts";

test("extractTextContent preserves string content exactly", () => {
  assert.equal(extractTextContent("  keep spacing  "), "  keep spacing  ");
});

test("extractTextContent joins text blocks and trims aggregate whitespace", () => {
  const content = [
    { type: "text", text: " first " },
    { type: "toolCall", name: "bash" },
    { type: "text", text: "second" },
    { type: "text", text: 123 },
  ];

  assert.equal(extractTextContent(content), "first \nsecond");
});

test("extractTextParts exposes raw text blocks for callers that format roles themselves", () => {
  const content = [
    { type: "text", text: "alpha" },
    { type: "text", text: "beta" },
    { type: "thinking", thinking: "ignore" },
  ];

  assert.deepEqual(extractTextParts(content), ["alpha", "beta"]);
});

test("extractMessageText reads the content field and ignores missing content", () => {
  assert.equal(extractMessageText({ content: [{ type: "text", text: "hello" }] }), "hello");
  assert.equal(extractMessageText({}), "");
});

test("summarizeToolResultContent prefers text content blocks", () => {
  const result = summarizeToolResultContent({
    content: [
      { type: "text", text: "line one" },
      { type: "image", image_url: "ignored" },
      { type: "text", text: "line two" },
    ],
  });

  assert.deepEqual(result, { content: "line one\nline two", truncated: false });
});

test("summarizeToolResultContent falls back through error, message, string, JSON, and empty output", () => {
  assert.deepEqual(summarizeToolResultContent({ error: "bad" }), { content: "bad", truncated: false });
  assert.deepEqual(summarizeToolResultContent({ message: "warn" }), { content: "warn", truncated: false });
  assert.deepEqual(summarizeToolResultContent("raw"), { content: "raw", truncated: false });
  assert.deepEqual(summarizeToolResultContent({ value: 1 }), { content: '{\n  "value": 1\n}', truncated: false });
  assert.deepEqual(summarizeToolResultContent(undefined), { content: "(no tool output)", truncated: false });
});

test("summarizeToolResultContent truncates long output", () => {
  assert.deepEqual(summarizeToolResultContent("abcdef", 5), { content: "ab...", truncated: true });
});

test("extractDisplayToolText compacts review tool output", () => {
  assert.equal(extractDisplayToolText("  plain\n text  "), "plain text");
  assert.equal(extractDisplayToolText(JSON.stringify({ content: [{ type: "text", text: "from json" }] })), "from json");
  assert.equal(extractDisplayToolText({ content: [{ type: "text", text: "line one\nline two" }] }), "line one line two");
  assert.equal(extractDisplayToolText({ stdout: "from stdout" }), "from stdout");
  assert.equal(extractDisplayToolText(undefined), "");
});

test("extractCodexTextContent reads Codex text block variants without trimming", () => {
  const content = [
    { type: "input_text", text: " user " },
    { type: "output_text", text: "assistant" },
    { type: "text", text: "plain" },
    { type: "reasoning", text: "ignore" },
    { type: "text", text: "" },
  ];

  assert.equal(extractCodexTextContent(content), " user \nassistant\nplain");
  assert.equal(extractCodexTextContent(" exact "), " exact ");
  assert.equal(extractCodexTextContent(undefined), "");
});

test("parseCodexJsonlTranscript builds turns, tool calls, outputs, and full text", () => {
  const parsed = parseCodexJsonlTranscript(
    [
      JSON.stringify({ type: "session_meta", payload: { id: "sess-1", cwd: "/repo" } }),
      JSON.stringify({ type: "response_item", payload: { role: "user", content: [{ type: "input_text", text: "hello" }] } }),
      JSON.stringify({ type: "response_item", payload: { role: "assistant", content: [{ type: "output_text", text: "hi" }] } }),
      JSON.stringify({ type: "response_item", payload: { type: "function_call", name: "bash", arguments: { cmd: "pwd" }, call_id: "call-1" } }),
      JSON.stringify({ type: "response_item", payload: { type: "function_call_output", output: "ok", call_id: "call-1" } }),
    ],
    "fallback",
  );

  assert.equal(parsed.sessionId, "sess-1");
  assert.equal(parsed.cwd, "/repo");
  assert.equal(parsed.entryCount, 4);
  assert.deepEqual(parsed.turns, [
    {
      user: "hello",
      assistant: "hi",
      toolCalls: [{ name: "bash", args: '{\n  "cmd": "pwd"\n}', output: "ok" }],
    },
  ]);
  assert.match(parsed.fullText, /## User\n\nhello/);
  assert.match(parsed.fullText, /## Assistant\n\nhi/);
  assert.match(parsed.fullText, /## Tool: bash/);
  assert.match(parsed.fullText, /### Output\n```/);
});

test("parseCodexJsonlTranscript skips malformed lines and falls back to provided session id", () => {
  const warnings: string[] = [];
  const parsed = parseCodexJsonlTranscript(
    [
      "{not json",
      JSON.stringify({ type: "response_item", payload: { role: "user", content: "hello" } }),
    ],
    "fallback-session",
    (message) => warnings.push(message),
  );

  assert.equal(parsed.sessionId, "fallback-session");
  assert.equal(parsed.turns.length, 1);
  assert.equal(parsed.entryCount, 1);
  assert.deepEqual(warnings, ["skipping unparseable line"]);
});

test("parseCodexJsonlMetadata extracts list metadata while skipping internal first messages", () => {
  const parsed = parseCodexJsonlMetadata([
    "{not json",
    JSON.stringify({ type: "session_meta", payload: { id: "sess-1", cwd: "/repo", timestamp: "2026-07-01T01:02:03Z" } }),
    JSON.stringify({ type: "response_item", payload: { role: "user", content: "<environment_context>ignored</environment_context>" } }),
    JSON.stringify({ type: "response_item", payload: { role: "assistant", content: "ignored" } }),
    JSON.stringify({ type: "response_item", payload: { role: "user", content: [{ type: "input_text", text: "real\nmessage" }] } }),
    JSON.stringify({ type: "response_item", payload: { role: "user", content: "second" } }),
  ]);

  assert.deepEqual(parsed, {
    id: "sess-1",
    cwd: "/repo",
    firstMessage: "real message",
    startedAt: "2026-07-01T01:02:03Z",
    turnCount: 3,
  });

  assert.equal(parseCodexJsonlMetadata([JSON.stringify({ type: "response_item", payload: { role: "user", content: "hello" } })]), null);
});

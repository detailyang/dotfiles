import assert from "node:assert/strict";
import test from "node:test";

const targetModelKey = "openai:openai-responses:gpt-5.4-nano";

async function loadRemoteCompaction() {
  return import("../extensions/openai-compact/remote-compaction.ts");
}

test("openai-compact exports a Pi extension factory", async () => {
  const module = await import("../extensions/openai-compact/index.ts");
  assert.equal(typeof module.default, "function");
});

test("reconstructs only compatible post-compaction turns", async () => {
  const { reconstructRemoteCompactionStateFromBranch } = await loadRemoteCompaction();
  const reconstructed = reconstructRemoteCompactionStateFromBranch({
    branchEntries: [
      {
        type: "compaction",
        id: "cmp-1",
        details: {
          remoteCompaction: {
            version: 1,
            provider: "openai-responses-compact",
            modelKey: targetModelKey,
            replacementHistory: [{ type: "compaction", encrypted_content: "ENCRYPTED" }],
          },
        },
      },
      {
        type: "message",
        id: "user-openai",
        message: { role: "user", content: [{ type: "text", text: "KEEP_USER" }] },
      },
      {
        type: "message",
        id: "assistant-openai",
        message: {
          role: "assistant",
          provider: "openai",
          api: "openai-responses",
          model: "gpt-5.4-nano",
          content: [{ type: "text", text: "KEEP_ASSISTANT" }],
        },
      },
      {
        type: "message",
        id: "user-anthropic",
        message: { role: "user", content: [{ type: "text", text: "DROP_USER" }] },
      },
      {
        type: "message",
        id: "assistant-anthropic",
        message: {
          role: "assistant",
          provider: "anthropic",
          api: "anthropic-messages",
          model: "claude-sonnet-4-6",
          content: [{ type: "text", text: "DROP_ASSISTANT" }],
        },
      },
    ],
  });

  assert.ok(reconstructed);
  const history = JSON.stringify(reconstructed.explicitHistory);
  assert.match(history, /KEEP_USER/);
  assert.match(history, /KEEP_ASSISTANT/);
  assert.doesNotMatch(history, /DROP_USER|DROP_ASSISTANT/);
});

test("builds and parses a remote compaction v2 request", async () => {
  const {
    buildRemoteCompactionRequestBody,
    buildRemoteCompactionV2History,
    parseRemoteCompactionV2Events,
    remoteCompactionV2EndpointUrl,
  } = await loadRemoteCompaction();
  const model = {
    provider: "openai",
    api: "openai-responses",
    id: "gpt-5.4-nano",
    baseUrl: "https://api.openai.com/v1",
  };
  const input = [
    { type: "message", role: "user", content: [{ type: "input_text", text: "retain user" }] },
    { type: "message", role: "assistant", content: [{ type: "output_text", text: "compact me" }] },
  ];
  const body = buildRemoteCompactionRequestBody({
    model,
    input,
    instructions: "system",
    tools: [{ type: "function", name: "read" }],
    parallelToolCalls: true,
    reasoning: { effort: "high", summary: "auto" },
    text: { verbosity: "medium" },
  });

  assert.equal(remoteCompactionV2EndpointUrl(model), "https://api.openai.com/v1/responses");
  assert.equal(body.store, false);
  assert.equal(body.stream, true);
  assert.deepEqual(body.input.at(-1), { type: "compaction_trigger" });

  const parsed = parseRemoteCompactionV2Events([
    {
      type: "response.output_item.done",
      item: { type: "compaction", encrypted_content: "V2_ENCRYPTED" },
    },
    {
      type: "response.completed",
      response: { usage: { input_tokens: 10, output_tokens: 2, total_tokens: 12 } },
    },
  ]);
  assert.deepEqual(
    buildRemoteCompactionV2History(input, parsed.compactionItem).map((item) => item.type),
    ["message", "compaction"],
  );
});

test("normalizes replay history for tool and image boundaries", async () => {
  const { normalizeResponseItemsForPrompt } = await loadRemoteCompaction();
  const normalized = normalizeResponseItemsForPrompt(
    [
      { type: "ghost_snapshot", data: "hidden" },
      {
        type: "message",
        role: "user",
        content: [{ type: "input_image", image_url: "data:image/png;base64,AAAA" }],
      },
      { type: "function_call", name: "read", call_id: "call-1", arguments: "{}" },
      { type: "function_call_output", call_id: "orphan", output: "drop" },
    ],
    { input: ["text"] },
  );

  assert.deepEqual(normalized[0].content, [
    { type: "input_text", text: "image content omitted because you do not support image input" },
  ]);
  assert.deepEqual(normalized[2], {
    type: "function_call_output",
    call_id: "call-1",
    output: "aborted",
  });
  assert.doesNotMatch(JSON.stringify(normalized), /orphan|ghost_snapshot/);
});

test("sends only new messages when continuing a stored response", async () => {
  const { selectInputItemsForContinuation } = await import(
    "../extensions/openai-compact/openai-ws-stream.ts"
  );
  const incrementalInput = selectInputItemsForContinuation({
    context: {
      messages: [
        { role: "user", content: [{ type: "text", text: "old user" }] },
        { role: "assistant", content: [{ type: "text", text: "old assistant" }] },
        { role: "user", content: [{ type: "text", text: "new user" }] },
      ],
    },
    model: { input: ["text"] },
    session: { lastContextLength: 2 },
    currentModelKey: targetModelKey,
    remoteCompactionState: undefined,
    previousResponseId: "resp_123",
  });

  assert.deepEqual(incrementalInput, [
    { type: "message", role: "user", content: "new user" },
  ]);
});

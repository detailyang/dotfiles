import test from "node:test";
import assert from "node:assert/strict";
import { isRetryableAssistantError } from "@earendil-works/pi-ai/compat";
import retryExtension, { DEFAULT_RETRY_ERROR_CODES } from "../extensions/retry/index.ts";
import { createExtensionHarness } from "./helpers/extension.ts";

test("reclassifies configured upstream errors for Pi's native retry policy", async () => {
  const harness = createExtensionHarness(retryExtension);
  const [result] = await harness.emit("message_end", {
    message: {
      role: "assistant",
      stopReason: "error",
      errorMessage: "Error: basispoints_protocol_error: basispoints tool transport correction changed an operation; no tool was executed",
      content: [],
    },
  });

  assert.ok(result?.message);
  assert.equal(result.message.role, "assistant");
  const originalError = "Error: basispoints_protocol_error: basispoints tool transport correction changed an operation; no tool was executed";
  assert.match(result.message.errorMessage ?? "", /server error\u001b\[12D\u001b\[K$/);
  assert.equal(
    result.message.errorMessage?.replace(/server error\u001b\[12D\u001b\[K$/, ""),
    originalError,
  );
  assert.equal(isRetryableAssistantError(result.message), true);
});

test("reclassifies the reported Excel/BPS retry failures", async () => {
  const errorMessages = [
    "Error: basispoints_protocol_error: basispoints returned a tool outside the client's catalog",
    "Error: Excel BPS upstream failure: basispoints_upstream_error; request was not replayed",
    "Error: Retry failed after 3 attempts: Excel BPS upstream failure: basispoints_upstream_error; request was not replayed",
  ];

  for (const errorMessage of errorMessages) {
    const harness = createExtensionHarness(retryExtension);
    const [result] = await harness.emit("message_end", {
      message: { role: "assistant", stopReason: "error", errorMessage, content: [] },
    });

    assert.ok(result?.message, errorMessage);
    assert.equal(isRetryableAssistantError(result.message), true, errorMessage);
  }
});

test("includes Basis Points transient error codes", () => {
  assert.deepEqual([...DEFAULT_RETRY_ERROR_CODES], [
    "basispoints_protocol_error",
    "basispoints_upstream_error",
    "basispoints_stream_incomplete",
    "server_is_overloaded",
  ]);
});

test("reclassifies an incomplete Basis Points stream for retry", async () => {
  const harness = createExtensionHarness(retryExtension);
  const errorMessage = "Error: basispoints_stream_incomplete: Upstream stream ended before completion";
  const [result] = await harness.emit("message_end", {
    message: { role: "assistant", stopReason: "error", errorMessage, content: [] },
  });

  assert.ok(result?.message);
  assert.equal(isRetryableAssistantError(result.message), true);
});

test("handles the nested server_is_overloaded upstream error", async () => {
  const harness = createExtensionHarness(retryExtension);
  const errorMessage = "Error: sam-openai API error (503): {\"message\":\"auth_unavailable: no auth available (providers=codex, model=gpt-6-astra; last upstream error: server_is_overloaded: Our servers are currently overloaded. Please try again later.)\",\"type\":\"server_error\",\"code\":\"internal_server_error\"}";
  const [result] = await harness.emit("message_end", {
    message: { role: "assistant", stopReason: "error", errorMessage, content: [] },
  });

  assert.ok(result?.message);
  assert.equal(result.message.errorMessage, errorMessage);
  assert.equal(isRetryableAssistantError(result.message), true);
});

test("reclassifies the Excel BPS upstream response too", async () => {
  const harness = createExtensionHarness(retryExtension);
  const [result] = await harness.emit("message_end", {
    message: {
      role: "assistant",
      stopReason: "error",
      errorMessage: 'Error: excel-openai API error (404): {"code":"basispoints_upstream_error","message":"Excel BPS rejected this request; account scheduling was not changed","type":"invalid_request_error"}',
      content: [],
    },
  });

  assert.ok(result?.message);
  assert.equal(isRetryableAssistantError(result.message), true);
});

test("does not reclassify unrelated errors", async () => {
  const harness = createExtensionHarness(retryExtension);
  const [result] = await harness.emit("message_end", {
    message: {
      role: "assistant",
      stopReason: "error",
      errorMessage: "Error: invalid_request_error: malformed prompt",
      content: [],
    },
  });

  assert.equal(result, undefined);
});

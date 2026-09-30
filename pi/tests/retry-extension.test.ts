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
  assert.match(result.message.errorMessage ?? "", /\u001b\[8mserver error\u001b\[28m$/);
  assert.equal(
    result.message.errorMessage?.replace(/\u001b\[8mserver error\u001b\[28m$/, ""),
    originalError,
  );
  assert.equal(isRetryableAssistantError(result.message), true);
});

test("includes both Basis Points transient error codes", () => {
  assert.deepEqual([...DEFAULT_RETRY_ERROR_CODES], [
    "basispoints_protocol_error",
    "basispoints_upstream_error",
  ]);
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

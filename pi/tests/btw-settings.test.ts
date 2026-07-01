import test from "node:test";
import assert from "node:assert/strict";

import {
  buildResolvedBtwSettings,
  describeResolvedBtwModel,
  describeResolvedBtwThinking,
  formatModelRef,
  resolveBtwModelWithCredentialStatus,
} from "../extensions/btw/settings.ts";

const overrideModel = { provider: "openai", id: "gpt-5", api: "openai-responses" };
const mainModel = { provider: "anthropic", id: "claude-sonnet-4", api: "anthropic" };

test("formatModelRef keeps BTW model labels stable", () => {
  assert.equal(formatModelRef(overrideModel), "openai/gpt-5 (openai-responses)");
});

test("resolveBtwModelWithCredentialStatus falls back to the main model when an override has no credentials", () => {
  const resolved = resolveBtwModelWithCredentialStatus({
    configuredOverride: overrideModel,
    mainModel,
    overrideHasCredentials: false,
  });

  assert.equal(resolved.model, mainModel);
  assert.equal(resolved.source, "main");
  assert.equal(resolved.configuredOverride, overrideModel);
  assert.equal(
    resolved.fallbackReason,
    "Configured BTW model openai/gpt-5 (openai-responses) has no credentials. Falling back to main model anthropic/claude-sonnet-4 (anthropic).",
  );
});

test("resolveBtwModelWithCredentialStatus reports unavailable override without a main model", () => {
  const resolved = resolveBtwModelWithCredentialStatus({
    configuredOverride: overrideModel,
    mainModel: null,
    overrideHasCredentials: false,
  });

  assert.equal(resolved.model, null);
  assert.equal(resolved.source, "none");
  assert.equal(
    describeResolvedBtwModel(buildResolvedBtwSettings(resolved, "medium", null)),
    "BTW model unavailable. Configured BTW model openai/gpt-5 (openai-responses) has no credentials, and no main model is active.",
  );
});

test("resolved BTW descriptions expose model and thinking sources", () => {
  const resolvedModel = resolveBtwModelWithCredentialStatus({
    configuredOverride: overrideModel,
    mainModel,
    overrideHasCredentials: true,
  });
  const settings = buildResolvedBtwSettings(resolvedModel, "low", "high");

  assert.equal(describeResolvedBtwModel(settings), "BTW model: openai/gpt-5 (openai-responses) (override).");
  assert.equal(describeResolvedBtwThinking(settings), "BTW thinking: high (override).");
});

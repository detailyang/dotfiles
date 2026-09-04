import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CONFIG, normalizeConfig } from "../extensions/better-style/config/config.ts";

test("better-style defaults are keyboard-first and enabled", () => {
  assert.equal(DEFAULT_CONFIG.mode, "compact");
  assert.equal(DEFAULT_CONFIG.enableMarkdownEnhance, true);
  assert.equal(DEFAULT_CONFIG.enableAgentSummary, true);
  assert.equal(DEFAULT_CONFIG.enableWorkingMessage, true);
  assert.equal("scrollStepLines" in DEFAULT_CONFIG, false);
});

test("better-style normalizes unsafe numeric configuration", () => {
  const config = normalizeConfig({ diffSplitMinWidth: 1, previewLines: -2, expandedOutputMaxLines: 999999 });
  assert.equal(config.diffSplitMinWidth, 40);
  assert.equal(config.previewLines, 0);
  assert.equal(config.expandedOutputMaxLines, 5000);
});

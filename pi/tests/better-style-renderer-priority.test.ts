import assert from "node:assert/strict";
import test from "node:test";
import { preservesOriginalRenderer } from "../extensions/better-style/renderer/default-mode.ts";

const custom = { renderResult() {} };

test("extension-owned tool renderers win without an exclude entry", () => {
  assert.equal(preservesOriginalRenderer(custom, "custom", undefined, []), true);
});

test("built-in renderers are preserved only when explicitly excluded", () => {
  assert.equal(preservesOriginalRenderer(undefined, "read", custom, []), false);
  assert.equal(preservesOriginalRenderer(undefined, "read", custom, ["read"]), true);
});

import assert from "node:assert/strict";
import test from "node:test";
import { tokenDeltaFromUsage } from "../extensions/goal/usage.ts";

test("usage prefers a valid reported total, including zero", () => {
  assert.equal(tokenDeltaFromUsage({ totalTokens: 20, input: 100 }), 20);
  assert.equal(tokenDeltaFromUsage({ totalTokens: 0, input: 100 }), 0);
});

test("usage falls back to all components, including cache reads and writes", () => {
  const parts = { input: 100, output: 20, cacheRead: 30, cacheWrite: 40 };
  assert.equal(tokenDeltaFromUsage(parts), 190);
  for (const totalTokens of [NaN, Infinity, -10]) {
    assert.equal(tokenDeltaFromUsage({ ...parts, totalTokens }), 190);
  }
});

test("invalid components cannot poison or subtract from usage", () => {
  assert.equal(tokenDeltaFromUsage(undefined), 0);
  assert.equal(tokenDeltaFromUsage(null), 0);
  assert.equal(tokenDeltaFromUsage({ input: NaN, output: 20, cacheRead: -10, cacheWrite: Infinity }), 20);
  assert.equal(tokenDeltaFromUsage({ input: 1e308, output: 1e308 }), Number.MAX_SAFE_INTEGER);
});

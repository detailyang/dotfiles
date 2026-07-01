import test from "node:test";
import assert from "node:assert/strict";

import { bucketCumulativeSeries, bucketMaxValues } from "../extensions/context/chart-data.ts";

test("bucketMaxValues uses the requested bucket count, not chart height", () => {
  const values = Array.from({ length: 20 }, (_, index) => index + 1);

  assert.deepEqual(bucketMaxValues(values, 5), [4, 8, 12, 16, 20]);
  assert.equal(bucketMaxValues(values, 12).length, 12);
  assert.deepEqual(bucketMaxValues([1, 2, 3], 10), [1, 2, 3]);
});

test("bucketCumulativeSeries buckets all cumulative dimensions to chart width", () => {
  const source = {
    cumInput: Array.from({ length: 20 }, (_, index) => index + 1),
    cumCacheRead: Array.from({ length: 20 }, (_, index) => (index + 1) * 2),
    cumCacheWrite: Array.from({ length: 20 }, (_, index) => (index + 1) * 3),
    cumHitPercent: Array.from({ length: 20 }, (_, index) => (index + 1) * 4),
  };

  const bucketed = bucketCumulativeSeries(source, 12);

  assert.equal(bucketed.cumInput.length, 12);
  assert.equal(bucketed.cumCacheRead.length, 12);
  assert.equal(bucketed.cumCacheWrite.length, 12);
  assert.equal(bucketed.cumHitPercent.length, 12);
  assert.equal(bucketed.cumInput.at(-1), 20);
  assert.equal(bucketed.cumHitPercent.at(-1), 80);
});

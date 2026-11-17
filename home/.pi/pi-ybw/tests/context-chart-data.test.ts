import test from "node:test";
import assert from "node:assert/strict";

import { bucketCumulativeSeries, bucketMaxValues } from "../extensions/context/chart-data.ts";
import { computeCumulativeSeries } from "../extensions/context/cumulative.ts";
import { renderGraphBody } from "../extensions/context/graph-view.ts";

test("bucketMaxValues uses the requested bucket count, not chart height", () => {
  const values = Array.from({ length: 20 }, (_, index) => index + 1);

  assert.deepEqual(bucketMaxValues(values, 5), [4, 8, 12, 16, 20]);
  assert.equal(bucketMaxValues(values, 12).length, 12);
  assert.deepEqual(bucketMaxValues([1, 2, 3], 10), [1, 2, 3]);
});

test("bucketCumulativeSeries preserves bucket-end cumulative hit percent when hit rate decreases", () => {
  const source = {
    cumInput: [100, 500, 600, 1200],
    cumCacheRead: [400, 400, 900, 900],
    cumCacheWrite: [0, 0, 0, 0],
    cumHitPercent: [80, 44.4, 60, 42.9],
  };

  const bucketed = bucketCumulativeSeries(source, 2);

  assert.deepEqual(bucketed.cumInput, [500, 1200]);
  assert.deepEqual(bucketed.cumCacheRead, [400, 900]);
  assert.deepEqual(bucketed.cumHitPercent, [44.4, 42.9]);
});

test("cumulative-total chart aligns data row dividers with the zero axis", () => {
  const theme = { fg: (_c: string, s: string) => s, bold: (s: string) => s } as never;
  const msg = {
    sequence: 1,
    activeBranchSequence: 1,
    entryId: "e1",
    timestamp: "2026-01-01T00:00:00Z",
    provider: "offline",
    model: "m",
    input: 10000,
    output: 100,
    cacheRead: 20000,
    cacheWrite: 5000,
    totalTokens: 35100,
    cacheHitPercent: 57.1,
    isOnActiveBranch: true,
  };
  const totals = { input: 10000, output: 100, cacheRead: 20000, cacheWrite: 5000, totalTokens: 35100, assistantMessages: 1 };
  assert.equal(computeCumulativeSeries([msg]).cumInput[0], 10000);
  const lines = renderGraphBody(
    theme,
    { allMessages: [msg], activeBranchMessages: [msg], treeTotals: totals, activeBranchTotals: totals },
    60,
    "cumulative-total",
  );
  const chartRows = lines.filter((line) => line.includes("│"));
  assert.ok(chartRows.length >= 2);
  const dividerColumns = new Set(chartRows.map((line) => line.indexOf("│")));
  assert.deepEqual([...dividerColumns], [4]);
});

import test from "node:test";
import assert from "node:assert/strict";

import {
  GRAPH_VIEWS,
  applyGraphViewKey,
  graphViewLabel,
  nextGraphView,
  type GraphView,
} from "../extensions/context/view-state.ts";

test("graph view labels stay stable", () => {
  assert.deepEqual(GRAPH_VIEWS, ["per-turn", "cumulative-percent", "cumulative-total"]);
  assert.equal(graphViewLabel("per-turn"), "Per-turn (%)");
  assert.equal(graphViewLabel("cumulative-percent"), "Cumulative (aggregate) %");
  assert.equal(graphViewLabel("cumulative-total"), "Cumulative (aggregate) total");
});

test("nextGraphView cycles forward and backward", () => {
  assert.equal(nextGraphView("per-turn", 1), "cumulative-percent");
  assert.equal(nextGraphView("cumulative-total", 1), "per-turn");
  assert.equal(nextGraphView("per-turn", -1), "cumulative-total");
});

test("applyGraphViewKey maps graph keyboard controls to actions", () => {
  const cases: Array<[string, GraphView, ReturnType<typeof applyGraphViewKey>]> = [
    ["1", "cumulative-total", { type: "view", view: "per-turn" }],
    ["2", "per-turn", { type: "view", view: "cumulative-percent" }],
    ["3", "per-turn", { type: "view", view: "cumulative-total" }],
    ["v", "per-turn", { type: "view", view: "cumulative-percent" }],
    ["V", "per-turn", { type: "view", view: "cumulative-total" }],
    ["r", "per-turn", { type: "refresh", view: "per-turn" }],
    ["x", "per-turn", { type: "none", view: "per-turn" }],
  ];

  for (const [key, view, expected] of cases) {
    assert.deepEqual(applyGraphViewKey(view, key), expected);
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  accountGoalTurn,
  createGoalState,
  goalBudgetReached,
  goalEventStatus,
  isGoalState,
  normalizeTokenBudget,
  parseTokenBudget,
  statusLine,
  truncateObjective,
} from "../extensions/goal/goal-state.ts";

for (const [input, objective, tokenBudget] of [
  ["audit", "audit", null],
  ["--tokens 50k audit", "audit", 50_000],
  ["audit --tokens=1.5M", "audit", 1_500_000],
  ["audit --tokens 100 k now", "audit now", 100_000],
  ["--tokens 2e3 audit", "audit", 2000],
  ["--tokens .5k audit", "audit", 500],
  ["--tokens=2.6 audit", "audit", 3],
  ["--tokens 10", "", 10],
] as const) {
  test(`parseTokenBudget: ${input}`, () => {
    assert.deepEqual(parseTokenBudget(input), { objective, tokenBudget });
  });
}

for (const input of [
  "audit --tokens", "--tokens= audit", "--tokens", "--tokens=", "--tokens -1 audit",
  "--tokens 0 audit", "--tokens 0.1 audit", "--tokens NaN audit", "--tokens Infinity audit",
  "--tokens 1e308m audit", "--tokens 9007199254740992 audit", "--tokens 10 --tokens 20 audit",
  "--tokens 50kk audit", "--tokens 0x10 audit", "--tokens --tokens 10 audit",
]) {
  test(`parseTokenBudget rejects: ${input}`, () => {
    const parsed = parseTokenBudget(input);
    assert.ok(parsed.error);
    assert.equal(parsed.tokenBudget, null);
  });
}

test("tool budget normalization accepts only finite positive safe numeric budgets", () => {
  for (const input of [true, "100", {}, 0, -1, 0.1, NaN, Infinity, 1e308]) {
    assert.ok(normalizeTokenBudget(input).error, String(input));
  }
  assert.deepEqual(normalizeTokenBudget(undefined), { tokenBudget: null });
  assert.deepEqual(normalizeTokenBudget(null), { tokenBudget: null });
  assert.deepEqual(normalizeTokenBudget(100.1), { tokenBudget: 100 });
  assert.deepEqual(normalizeTokenBudget(Number.MAX_SAFE_INTEGER), { tokenBudget: Number.MAX_SAFE_INTEGER });
});

test("turn accounting reaches a budget without losing terminal-state usage", () => {
  const initial = createGoalState("audit", 100, 10, 0.5);
  const limited = accountGoalTurn(initial, 120, 2, 20);
  assert.equal(limited.status, "budget_limited");
  assert.equal(goalBudgetReached(limited), true);
  assert.equal(initial.tokensUsed, 0);
  for (const status of ["budget_limited", "complete", "blocked", "paused"] as const) {
    const next = accountGoalTurn({ ...limited, status }, 30, 3, 30);
    assert.equal(next.status, status);
    assert.equal(next.tokensUsed, 150);
    assert.equal(next.timeUsedSeconds, 5);
    assert.equal(next.updatedAt, 30);
  }
});

test("accounting ignores invalid deltas and saturates safely", () => {
  const initial = createGoalState("audit", null, 10);
  for (const delta of [-10, NaN, Infinity, -Infinity]) {
    const next = accountGoalTurn(initial, delta, delta, 20);
    assert.equal(next.tokensUsed, 0);
    assert.equal(next.timeUsedSeconds, 0);
  }
  const next = accountGoalTurn({ ...initial, tokensUsed: Number.MAX_SAFE_INTEGER }, 10, 0);
  assert.equal(next.tokensUsed, Number.MAX_SAFE_INTEGER);
});

test("persisted goal validation rejects corrupt or unknown state", () => {
  const state = createGoalState("audit", 100, 10);
  assert.ok(isGoalState(state));
  assert.ok(isGoalState({ ...state, status: "blocked", reason: "Need access" }));
  for (const invalid of [null, {}, { ...state, version: 2 }, { ...state, objective: " " },
    { ...state, status: "future" }, { ...state, tokenBudget: Infinity }, { ...state, tokensUsed: NaN },
    { ...state, timeUsedSeconds: -1 }, { ...state, reason: 3 }]) {
    assert.equal(isGoalState(invalid), false);
  }
});

test("blocked status and objective truncation have stable display labels", () => {
  const state = { ...createGoalState("audit", null), status: "blocked" as const };
  assert.match(statusLine(state)!, /blocked/);
  assert.equal(goalEventStatus("blocked"), "blocked");
  assert.equal(truncateObjective("x".repeat(100)).length, 96);
  assert.equal(truncateObjective("audit\nnow"), "audit now");
});

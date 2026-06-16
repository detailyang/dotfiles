---
name: debug
description: Reproduce and diagnose bugs, test failures, flaky behavior, regressions, crashes, wrong outputs, or performance problems before fixing them. Use when the user says something is broken, failing, throwing, slow, flaky, regressed, or asks to debug, investigate, reproduce, find root cause, or verify a suspected fix.
---

# Debug

Start by turning the report into evidence. Do not claim a root cause until the symptom is reproduced or the evidence chain is strong enough to explain why reproduction is impossible.

## Operating rules

- State assumptions, unknowns, and the exact symptom being debugged.
- Prefer a fast pass/fail loop over broad code reading.
- Test one hypothesis at a time; do not silently switch theories.
- Fix only the proven cause, with the smallest change that addresses it.
- Preserve the repro as a regression test, script, fixture, or documented check when practical.
- Remove temporary probes unless the user explicitly wants durable observability.

## Workflow

### 1. Define success

Restate the bug as observable behavior:

```text
Given <setup>, when <trigger>, expected <correct behavior>, actual <symptom>.
```

If the report lacks a trigger, environment, input, log, or expected behavior, ask for the minimum missing artifact unless it can be discovered locally.

### 2. Build the feedback loop

Create the cheapest loop that reaches the symptom:

1. failing automated test at the highest useful seam
2. focused command or CLI invocation with fixture input
3. HTTP/curl script against a dev server
4. browser automation or precise manual steps with assertions
5. replayed request, trace, HAR, event log, fixture, or payload
6. throwaway harness around the suspected module
7. stress loop for flaky, race, or performance bugs
8. bisection or differential loop for regressions

Improve the loop until it is sharp enough to fail for the user's symptom, not just any failure. For more options, read `references/reproduce.md`.

If no loop can be built, stop and report what was tried, what was observed, and the smallest artifact or access needed next.

### 3. Reproduce and capture evidence

Run the loop and record:

- command or steps used
- relevant output, error, timing, state, screenshot, or logs
- whether the symptom matches the user report
- how repeatable it is

Wrong reproduction means wrong fix. Do not proceed to root-cause claims until the observed failure matches the reported symptom.

### 4. Rank falsifiable hypotheses

Before deep instrumentation, list 3-5 hypotheses when the cause is not obvious:

```text
Hypothesis: <cause>
Prediction: if true, <specific observation/change> will happen
Probe: <specific action>
```

Rank by likelihood, verification cost, and impact. For detailed probing rules, read `references/diagnosis-loop.md`.

### 5. Probe narrowly

Map every probe to one hypothesis. Prefer direct observations:

- debugger or REPL inspection
- invariant assertions near suspicious boundaries
- focused logs with request/id context
- before/after state snapshots
- timing measurements for performance regressions
- good-vs-bad trace comparison
- binary search through input, data, config, or commits

Mark each result as confirmed, excluded, or still uncertain. Update the hypothesis list when evidence changes.

### 6. Fix and verify

When evidence supports a cause:

1. Add or preserve a regression check when practical.
2. Make the smallest code change that addresses the cause.
3. Run the repro loop again.
4. Run adjacent tests or checks likely to catch collateral damage.

If the fix intentionally changes behavior beyond the bug, call that out as a separate decision.

### 7. Report the outcome

Classify the final state as one of:

- single root cause
- causal chain
- concurrent contributing causes
- missing observation

Include:

- reproduction path
- evidence for the cause
- fix summary, if applied
- tests or commands run, with results
- remaining risks or missing observations

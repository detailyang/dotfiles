---
name: debug
description: Reproduce and diagnose bugs, failures, flaky behavior, or performance regressions before fixing them. Use when the user says something is broken, failing, throwing, slow, or asks to debug.
---

# Debug

Debugging starts with reproduction. Skip phases only when explicitly justified. Do not confirm a root cause before you can reproduce the symptom or build a strong evidence chain.

When exploring code, read applicable repo instructions and use existing domain vocabulary. Check ADRs or specs in the area before changing behavior.

## Phase 1 — Build a feedback loop

This is the core of debugging. A fast, deterministic, agent-runnable pass/fail signal makes diagnosis mechanical. Without one, code reading becomes guesswork.

Spend disproportionate effort here.

Ways to construct a loop, roughly in order:

1. failing test at the seam that reaches the bug: unit, integration, e2e
2. focused command or CLI invocation with fixture input
3. HTTP/curl script against a dev server
4. browser automation or manual browser steps with assertions
5. replayed request, fixture, trace, HAR, event log, or payload
6. throwaway harness around the suspected module
7. property/fuzz loop for wrong-output bugs
8. bisection harness for regressions across commits/configs/data
9. differential loop comparing old vs new behavior
10. human-in-the-loop script as last resort when manual steps are unavoidable

Once a loop exists, improve it:

- faster: skip unrelated setup, cache expensive work, narrow scope
- sharper: assert the exact symptom, not just "did not crash"
- more deterministic: pin time, seed randomness, isolate filesystem/network

For nondeterministic bugs, aim to raise reproduction rate. Loop the trigger, add stress, parallelize, narrow timing windows, inject sleeps, or increase event volume.

If no loop can be built, stop. List what was tried and what artifact/access is needed next.

## Phase 2 — Reproduce

Run the loop and confirm:

- the failure matches the user's exact symptom
- the symptom is repeatable enough to debug
- the relevant output, error, timing, or wrong state is captured

Wrong bug means wrong fix. Do not proceed to root cause claims until this is satisfied.

## Phase 3 — Hypothesize

Generate 3-5 ranked hypotheses before testing any of them.

Rank by:

- likelihood
- verification cost
- impact/risk if true

Each hypothesis must be falsifiable:

```text
If <cause> is true, then <specific observation or change> should happen.
```

If no prediction can be stated, sharpen or discard the hypothesis.

Show the ranked list before deep instrumentation when useful; proceed if the user is unavailable.

## Phase 4 — Instrument

Each probe maps to one hypothesis. Change one variable at a time.

Prefer:

1. debugger / REPL inspection
2. targeted logs or counters
3. assertions around invariants
4. binary search through code/data/config
5. trace comparison between good and bad runs
6. temporary feature flags or narrowed harnesses

Keep probes removable. Do not leave noisy instrumentation behind.

## Phase 5 — Fix and regression test

Fix only after evidence supports the cause.

For code fixes:

- first preserve the repro as a regression test, script, or documented check
- make the smallest change that addresses the cause
- run the repro again
- run related tests to catch collateral damage

If the fix changes behavior beyond the bug, call that out as a separate decision.

## Phase 6 — Cleanup and result

Remove temporary probes and throwaway artifacts unless the user wants to keep them.

Final answer should classify the outcome:

- single root cause
- causal chain
- multiple contributing causes
- missing observation

Include:

- reproduction path
- evidence for the cause
- fix summary, if applied
- tests/commands run and results
- remaining risks

## References

Use as needed:

- `references/reproduce.md`
- `references/diagnosis-loop.md`

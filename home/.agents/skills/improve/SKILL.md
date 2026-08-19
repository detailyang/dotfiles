---
name: improve
description: Analyze and improve codebase architecture or maintainability. Use when the user asks to improve, refactor, simplify, deepen, decouple, reduce technical debt, make code easier to test, or review architecture and module boundaries.
---

# Improve

Find maintainability improvements, expose the trade-offs, and apply only the changes the user selects.

## Use this skill for

- open-ended maintainability or architecture improvement requests
- refactors where the target design is not yet obvious
- module boundary, interface, coupling, or testability reviews
- requests to simplify, deepen, decouple, or reduce technical debt

If the user asks for a concrete implementation or bug fix with a clear scope, use the normal ship/debug workflow instead. If an improvement becomes a behavior change or bug fix, switch to that workflow before editing.

## Process

1. State assumptions, success criteria, and the smallest useful scope.
2. Explore relevant exports, direct callers, tests, docs, and domain language.
3. Map modules, interfaces, seams, dependencies, and ownership boundaries.
4. Identify candidate improvements with evidence, impact, risk, confidence, and order.
5. Recommend a small set of high-signal candidates and ask which to apply.
6. For each selected candidate, make the smallest coherent change and verify it independently.

Do not silently apply candidates unless the user explicitly asked for edits. If the user asks to "improve this" without specifying whether to edit, report candidates first and wait.

## Candidate types

Look for:

- duplicated behavior
- high coupling
- hidden mutable state
- unclear ownership boundaries
- shallow wrappers
- hard-to-test interfaces
- over-designed abstractions
- feature envy
- primitive obsession
- error paths without clear semantics
- dependencies crossing the wrong seam

Use `references/deepening.md` when the likely fix is to move complexity behind a smaller interface. Use `references/interface-design.md` when designing or comparing module interfaces.

## Candidate report

For each candidate, include:

- title
- problem
- evidence from code/docs
- recommended change
- expected benefit
- risk
- verification strategy
- whether behavior changes

Prefer 3-5 high-signal candidates over a generic list. Rank them by expected maintainability gain, verification cost, and blast radius.

## Editing rules

- Do not mix unrelated improvements in one change.
- Do not reformat unrelated files.
- Behavior changes must follow the test-first workflow.
- Behavior-preserving refactors still require verification.
- Stop if the selected improvement expands beyond the agreed scope.
- If multiple candidates conflict, resolve order with the user.
- Preserve existing naming and project vocabulary unless it is actively misleading.
- Do not introduce abstractions until at least two concrete callers, adapters, or policies justify the seam.

## Verification

- Start with the narrowest test or typecheck that exercises the changed seam.
- Add or update tests only when they encode why the behavior or boundary matters.
- For behavior-preserving refactors, compare public behavior before and after through existing tests or focused smoke checks.
- If verification cannot run, state what was not run, why, and the smallest command the user can run.

## References

Use as needed:

- `references/deepening.md`
- `references/interface-design.md`

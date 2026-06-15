---
name: ship
description: Implement the user's current task with test-driven discipline. Use when the user asks to build, fix, implement, execute a task, or do an item from specs/<slug>/issues.md.
---

# Ship

Execute the current task with the smallest safe change. This skill merges implementation with TDD discipline for adhoc development.

## Before editing

1. State the intended behavior and success criteria.
2. Read applicable `AGENTS.md` instructions.
3. Inspect relevant exports, callers, shared utilities, tests, and existing style.
4. If the task references `specs/<slug>/`, read relevant `thinking.md`, `product.md`, `tech.md`, and `issues.md`.
5. Identify the highest useful test seam before writing code.

Do not guess when the implementation boundary is unclear. Ask the minimum necessary question.

## Issue execution scope

When working from `specs/<slug>/issues.md`, the default scope is all incomplete issues unless the user explicitly names a narrower issue or range.

- Do not stop after completing a single issue.
- Continue selecting the next incomplete issue, implementing it, and verifying it.
- Stop only when all applicable issues are complete, a hard blocker is reached, or the user-defined scope is finished.
- If a blocker prevents further progress, record the blocker, completed issues, remaining issues, and the smallest user decision needed.

## TDD is mandatory for behavior changes

For behavior changes, bug fixes, business logic, data transforms, API behavior, CLI behavior, or user-visible UI behavior:

1. **Red** — write or modify a test that fails for the missing behavior.
2. Run it and confirm the expected failure.
3. **Green** — implement the smallest change that passes.
4. Run the relevant tests.
5. **Refactor** — improve structure only after green.
6. Run tests again after refactor.

If no reasonable test seam exists, stop and ask before coding.

For docs, comments, pure formatting, static config, or tiny no-test-infrastructure edits, TDD may not apply. Say why and perform an alternative verification.

## Avoid horizontal slices

Do not build isolated layers that cannot be verified independently. Prefer tracer bullets and vertical slices:

- smallest end-to-end path first
- one observable behavior at a time
- tests through public interfaces
- internal design evolves under green tests

## Tracer bullet

When scope is uncertain, build the thinnest working slice through the real system:

- real entry point
- real validation path if relevant
- real state transition if relevant
- minimal UI/API/CLI surface
- enough test coverage to lock the behavior

The tracer bullet should be production-shaped, not throwaway architecture.

## Operation log

When working from `specs/<slug>/`, create or update:

```text
specs/<slug>/operation.md
```

Record:

- task executed
- files changed
- tests/commands run and results
- deviations from specs
- follow-ups

## References

Use as needed:

- `references/tdd.md`
- `references/testing.md`
- `references/refactoring.md`

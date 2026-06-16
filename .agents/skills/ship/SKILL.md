---
name: ship
description: Implement the user's current engineering task with minimal, verified changes and test-driven discipline. Use when the user asks Codex to build, fix, implement, modify code, execute a concrete task, or complete items from a specs issues.md file.
---

# Ship

Execute the current task with the smallest safe, verified change. Prefer a vertical slice through the real system over broad setup work.

## Operating contract

- State assumptions, intended behavior, and success criteria before editing.
- If the boundary is unclear, list the plausible interpretations and ask the minimum necessary question.
- Keep every changed line traceable to the user's request.
- Do not clean up, rename, reformat, or refactor unrelated code.
- Do not claim tests passed unless they were run in this turn.

## Before editing

1. Read applicable `AGENTS.md` instructions.
2. Inspect relevant exports, direct callers, shared utilities, tests, and existing style.
3. If the task references `specs/<slug>/`, read relevant `thinking.md`, `product.md`, `tech.md`, and `issues.md`.
4. Identify the highest useful test seam before writing behavior code.
5. Choose the smallest implementation path and the validation command that proves it.

For multi-step work, use a short plan where each step has a verification checkpoint.

## Issue execution scope

When working from `specs/<slug>/issues.md`, the default scope is all incomplete issues unless the user explicitly names a narrower issue or range.

- Do not stop after completing a single issue.
- Continue selecting the next incomplete issue, implementing it, and verifying it.
- Stop only when all applicable issues are complete, a hard blocker is reached, or the user-defined scope is finished.
- If blocked, record completed issues, remaining issues, the blocking observation, and the smallest user decision needed.

## TDD is mandatory for behavior changes

For behavior changes, bug fixes, business logic, data transforms, API behavior, CLI behavior, or user-visible UI behavior:

1. **Red** — write or modify a test that fails for the missing behavior.
2. Run it and confirm the expected failure.
3. **Green** — implement the smallest change that passes.
4. Run the relevant tests.
5. **Refactor** — improve structure only after green.
6. Run tests again after refactor.

If no reasonable test seam exists, stop and ask before coding. Do not replace deterministic logic, routing, retry, data transform, or state-machine behavior with LLM judgment.

For docs, comments, pure formatting, static config, generated snapshots, or tiny edits in a repo with no usable test infrastructure, TDD may not apply. Say why and perform the cheapest meaningful alternative verification, such as rendering, parsing, typechecking, linting, or diff inspection.

## Implementation shape

Do not build isolated layers that cannot be verified independently. Prefer tracer bullets and vertical slices:

- smallest end-to-end path first
- one observable behavior at a time
- tests through public interfaces
- internal design evolves under green tests

When scope is uncertain, build the thinnest production-shaped tracer bullet through the real system:

- real entry point
- real validation path if relevant
- real state transition if relevant
- minimal UI/API/CLI surface
- enough test coverage to lock the behavior

The tracer bullet should be production-shaped, not throwaway architecture.

Read `references/tdd.md` when choosing or running a TDD cycle. Read `references/testing.md` when selecting a seam or deciding what to mock. Read `references/refactoring.md` before any structural cleanup.

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

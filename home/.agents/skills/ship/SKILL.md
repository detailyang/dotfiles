---
name: ship
description: Implement a concrete engineering task with minimal, verified changes and a final diff review. Use when the user asks to build, fix, implement, modify code, execute an approved issue, or complete work from specs/<slug>/issues.md. Do not use for brainstorming, specification writing, planning-only requests, or review-only work.
---

# Ship

Deliver the requested behavior through the smallest production-shaped change. Keep every changed line traceable to the task and make verification evidence visible.

## Operating contract

- State only assumptions that affect behavior, safety, or scope.
- Resolve repository facts before asking the user.
- Ask only when a missing decision changes the public contract or safe implementation path; otherwise choose the evidence-backed default and continue.
- Preserve unrelated work and existing style.
- Do not claim tests passed unless they ran in the current work.
- Do not commit, push, merge, or amend unless the user explicitly requested it.

## Before editing

1. Read applicable `AGENTS.md` and any referenced `specs/<slug>/` files.
2. Inspect the real entry point, direct callers, shared utilities, tests, and adjacent conventions.
3. Record the review fixed point with `git rev-parse HEAD` and the initial `git status --short`.
4. Identify task-owned paths and the highest stable seam that can prove the requested behavior.
5. Choose the smallest vertical slice and its validation command.

A dirty worktree is not an automatic blocker. Preserve pre-existing changes, compare overlapping hunks, and continue when the task can be isolated safely. Stop only when ownership cannot be separated without risking user work.

For multi-step work, use a short plan with one observable checkpoint per step.

## TDD for behavior changes

For business logic, data transforms, API/CLI/UI behavior, state transitions, retries, bug fixes, or regressions:

1. **Red** — add or modify the smallest test that fails for the missing behavior.
2. Run it and confirm the failure is specific to that behavior.
3. **Green** — implement the minimum change that passes.
4. Run the focused test and adjacent checks.
5. **Refactor** — improve touched structure only after green, then rerun tests.

Read `references/tdd.md` for the cycle, `references/testing.md` for seam selection and mocking, and `references/refactoring.md` before structural cleanup.

When no reasonable automated seam exists, do not fabricate one or halt by default. Use the strongest deterministic alternative—rendering, parsing, type checking, a focused harness, or a reproducible smoke check—and state what remains unproved. Never replace deterministic routing, validation, retry, transformation, or state-machine behavior with LLM judgment.

Docs, comments, static configuration, generated snapshots, and formatting-only changes may use an appropriate non-TDD check.

## Implementation shape

Prefer a tracer bullet through the real system:

```text
real entry point
  -> real validation or policy
  -> real state transition
  -> observable API / CLI / UI result
  -> test at the public seam
```

Avoid isolated layers that cannot be exercised, speculative abstractions, compatibility fallbacks not required by a contract, and unrelated cleanup.

## Issue execution

When executing `specs/<slug>/issues.md`, the default scope is every incomplete issue whose blockers are complete unless the user names a narrower range.

- Work from the current dependency frontier.
- Complete and verify one issue before advancing.
- Record acceptance evidence in `specs/<slug>/operation.md`.
- Continue automatically until the selected scope is complete or a hard blocker is observed.
- Do not mark acceptance complete from intent, code inspection alone, or an unrun command.

## Final review gate

Review the complete task-owned diff against the fixed point:

1. trace each requirement and acceptance criterion to code and evidence
2. inspect correctness, error paths, state transitions, concurrency, compatibility, and permissions as relevant
3. remove unrelated edits and temporary probes
4. rerun checks affected by any review fix
5. inspect `git diff --check` and final status

Use a dedicated review skill when one is available, but do not depend on a particular optional skill name. Treat confirmed correctness or specification gaps as unfinished work.

## Operation log

For work under `specs/<slug>/`, create or update `specs/<slug>/operation.md` with:

- task and fixed point
- pre-existing worktree changes
- task-owned paths and files changed
- commands run and observed results
- final-review findings and disposition
- deviations, residual risks, and follow-ups

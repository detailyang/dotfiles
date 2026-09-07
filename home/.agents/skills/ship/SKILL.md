---
name: ship
description: Implement a concrete feature, bug fix or approved issue with scoped changes, verification and a final diff review. Not for brainstorming, planning, spec writing or review-only requests.
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

1. Read applicable `AGENTS.md` and the referenced specification sections that define the selected task; expand to other files only when a dependency or contract requires it.
2. Inspect the real entry point, direct callers, shared utilities, tests, and adjacent conventions.
3. Record the review fixed point with `git rev-parse HEAD` and the initial `git status --short`.
4. Identify task-owned paths and the highest stable seam that can prove the requested behavior.
5. Choose the smallest vertical slice and its validation command.

A dirty worktree is not an automatic blocker. Preserve pre-existing changes, compare overlapping hunks, and continue when the task can be isolated safely. Stop only when ownership cannot be separated without risking user work.

For multi-step work, use a short plan with one observable checkpoint per step.
Record the selected scope and explicitly authorized delivery endpoint, such as a
local diff, commit, PR, or merge, in the existing plan or handoff. Preserve that
boundary across continuation turns; do not ask again for an already authorized
step or infer new publication authority from “continue”. A requested single PR
round ends after that round. Update the boundary when the user changes it.

## TDD for behavior changes

For business logic, data transforms, API/CLI/UI behavior, state transitions, retries, bug fixes, or regressions:

1. **Red** — add or modify the smallest test that fails for the missing behavior.
2. Run it and confirm the failure is specific to that behavior.
3. **Green** — implement the minimum change that passes.
4. Run the focused test and adjacent checks.
5. **Refactor** — improve touched structure only after green, then rerun tests.

Read `references/tdd.md` only when cycle details are needed, `references/testing.md` when seam selection or mocking is unclear, and `references/refactoring.md` before structural cleanup. Do not preload all three.

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

Tie each check to its command, result, environment, and tested source version
(HEAD plus the relevant uncommitted diff or file hashes). Reuse evidence only
when its inputs still match; rerun affected checks after source, dependency, or
environment changes. Distinguish completed results from running jobs and old CI.

Before declaring completion, compare the result with the authorized endpoint.
For a requested PR delivery, verify its current head, base, and required checks;
for a requested merge, verify integration into the target branch. Report a
remaining delivery step as unfinished rather than silently downgrading scope.

## Operation log

For work under `specs/<slug>/`, create or update `specs/<slug>/operation.md` with:

- task, accepted decisions, authorized delivery endpoint, and fixed point
- pre-existing worktree changes
- task-owned paths and files changed
- commands, tested versions/environments, and observed results
- final-review findings and disposition
- deviations, residual risks, and follow-ups

For smaller tasks, keep this information in the existing task handoff; do not
create a separate log solely to satisfy this skill.

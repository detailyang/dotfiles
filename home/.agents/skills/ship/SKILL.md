---
name: ship
description: Implement a requested feature, bug fix or approved issue through verified completion. Not for planning or review-only requests.
---

# Ship

Deliver the requested behavior through a scoped, production-shaped change. Follow
applicable repository rules for authorization, implementation and verification;
loading this skill does not authorize commits, push, merge or amend.

## Anchor the work

Read the selected requirements and actual entry point, then inspect callers,
shared policy and tests where they affect the contract. Record the initial
`git status --short` and `git rev-parse HEAD` so the final review can distinguish
pre-existing work from task-owned changes.

Choose the smallest coherent slice and a stable public boundary that proves it.
Ask only for a missing decision that changes the contract or safe implementation
path. A dirty worktree is not itself a blocker; preserve unrelated changes and
stop only when overlapping ownership cannot be separated safely.

## Implement and verify

Exercise the real entry point through validation/policy, state transition and
observable result. Avoid isolated layers that cannot be verified, speculative
abstractions and compatibility behavior not required by the contract.

For multi-step work, use a short plan with one observable checkpoint per step.
Record the selected scope and explicitly authorized delivery endpoint, such as a
local diff, commit, PR or merge, in the existing plan or handoff. Preserve that
boundary across continuation turns; do not ask again for an already authorized
step or infer new publication authority from "continue". A requested single PR
round ends after that round. Update the boundary when the user changes it.

For behavior changes, follow [TDD](references/tdd.md). Consult
[testing guidance](references/testing.md) when the test boundary or mocking is
unclear, and [refactoring discipline](references/refactoring.md) only for structural
cleanup. Do not preload these references together.

Docs, static configuration and formatting can use parsing, rendering, type checks
or another appropriate deterministic check. When no reasonable automated behavior
test exists, use a reproducible alternative and state what remains unproved. Do
not invent a test framework merely to satisfy a ritual, or replace deterministic
validation, routing or state transitions with model judgment.

## Execute issue plans

For `specs/<slug>/issues.md`, execute all incomplete issues as their prerequisites
become complete unless the user selects a narrower scope. Verify each outcome,
record acceptance evidence in `specs/<slug>/operation.md`, then continue through
ready work without confirmation pauses. Stop only when the selected scope is
complete or an observed blocker prevents further valid progress.

For work under `specs/<slug>/`, keep the operation log concise: task, baseline,
accepted decisions, authorized delivery endpoint, pre-existing changes, task-owned
paths, verification commands and results, tested source and environment, review
disposition, and remaining blockers or risks. Do not duplicate the specification.

## Completion

Review the complete task-owned diff against the initial state and requirements.
Check relevant error, state, concurrency and permission paths, including weakened
or lost test assertions. Correct confirmed task-owned gaps and rerun affected
checks; a first implementation or passing narrow test is not completion by itself.

Tie each check to its command, result, environment and tested source version
(HEAD plus the relevant uncommitted diff or file hashes). Reuse evidence only
when its inputs still match; rerun affected checks after source, dependency or
environment changes. Distinguish completed results from running jobs and old CI.

Inspect `git diff --check` and final status. Compare the result with the authorized
endpoint: for PR delivery, verify its current head, base and required checks; for a
merge, verify integration into the target branch. Report any remaining delivery
step as unfinished, along with observed behavior, verification results and residual
gaps. Use an available review skill only when it adds value; completion must not
depend on an optional tool or another agent.

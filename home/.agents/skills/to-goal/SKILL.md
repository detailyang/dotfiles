---
name: to-goal
description: Turn an approved spec into an execution checklist or durable plan with an optional /goal starter. Not for discovery or implementation.
---

# To Goal

Make an approved specification executable across fresh contexts. Produce only the
requested planning artifacts; do not implement, create a worktree or start `/goal`.
For a proposal-only request, keep the plan in chat.

## Anchor the plan

Use the selected spec/design and applicable repository rules. Follow references
only where they settle requirements, ownership, dependencies or acceptance. Ground
paths and verification commands in the repository; mark genuinely unknown paths as
discovery work instead of inventing them.

Ask only for a missing decision that changes behavior, ownership, migration,
authorization or acceptance. Resolve ordinary details and proceed with explicit
non-blocking assumptions. Do not turn an approved scope into a smaller MVP.

## Choose the smallest useful artifact

- One coherent change that needs no handoff: recommend direct execution with
  `/ship`; do not create a ledger unless requested.
- Independently verifiable work without natural stages: use the flat checklist in
  [checklist and batch ledgers](references/checklist-ledger.md).
- A large enumerable inventory: generate the batch inventory from a script or
  structured source using the same reference. Size batches by verification cost.
- Natural delivery stages or a substantial handoff: use the
  [phased plan](references/phased-plan.md). An inventory can be one phase's ledger.

Reuse canonical repository locations. Do not force phase counts, task counts or
multiple files on work that fits a short checklist.

## Define outcomes and execution boundaries

Each work unit needs an observable result, scope and non-goals, real prerequisites,
binary acceptance, and a concrete check with its expected result. Include failure
paths that affect acceptance. Split by verifiable outcomes, not editing steps.

Record the source documents and their precedence, execution location, baseline
check, plan/ledger paths, and the user's Git policy. A dedicated branch or worktree
is optional: select it only when requested or required by repository policy. If
selected, record its base ref and setup prerequisites; keep the primary checkout
read-only only when that isolation contract calls for it.

Planning artifacts do not grant permission to commit or perform other Git actions.
Use existing authorization; without explicit commit authorization, leave verified
changes uncommitted. When commits are authorized, choose coherent verified
boundaries and include relevant progress updates. Never infer push, merge or amend
permission from implementation or commit permission.

## Durable progress and completion

The ledger must show current and next work, pending/done/blocked items, baseline
failures, verification evidence and residual risk. Use JSON when repeated machine
updates benefit from it. Keep task definitions and acceptance stable during
execution; only update progress and evidence unless a plan revision is authorized.
Use Git history for commit evidence when commits are part of the chosen workflow.

Verification checkpoints are not turn limits. The later worker should continue
through ready work until the selected scope is evidenced, an agreed budget is
exhausted, or a contract, resource or safety blocker prevents valid progress.
Separate pre-existing failures from regressions; neither hide them nor expand the
task to fix unrelated failures.

Before reporting readiness, check requirement coverage, dependency order, local
paths, executable checks, source consistency and authorization boundaries. Fix
ordinary planning gaps; report unresolved contract decisions explicitly.

## Optional /goal starter

Use installed client capabilities and current official documentation for
version-sensitive behavior. Do not assume `/goal` exists or remember a fixed
objective limit. If compatibility cannot be checked, say so and provide the starter
without the command prefix. Durable state must not depend on client persistence.

Adapt this to the selected plan level; omit a ledger when none is needed:

```text
/goal Implement <plan-path> and record evidence in <progress-path>.

On resumption, read progress, the current task and the execution checkout's status.
Work in the agreed location, preserve unrelated changes and follow the user's Git
permissions; the plan itself does not authorize commits or worktree creation.
Complete a ready unit, run its acceptance checks, record results and continue.
Distinguish baseline failures from regressions; fix only task-owned failures.
Stop when the selected scope is verified, its agreed budget is exhausted, or a
real plan, resource or safety blocker prevents further progress. Report the blocker
and the smallest missing decision or resource. Do not stop merely at a checkpoint.
```

Report artifact paths, checks performed and any material readiness gap without
repeating the plan's contents. Do not start execution as part of this skill.

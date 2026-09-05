---
name: to-goal
description: Turn an approved spec into a right-sized execution checklist, phased/batch ledger and optional Codex /goal starter. Not for discovery, writing the original spec or executing the plan.
---

# To Goal

Make an approved specification executable across fresh contexts. Produce planning artifacts and a `/goal` starter; do not implement the plan.

```text
finished spec/design
  -> executable plan + durable ledger + /goal starter
  -> later execution
```

## Inputs

Require a selected spec/design path or supplied text. Also determine the intended scope, source-of-truth documents, target base ref, and whether files should be written or only proposed.

If the source is still a fuzzy idea, route back to discovery or specification instead of disguising uncertainty as a plan.

## Codex compatibility

The installed client and current official documentation are authoritative for version-sensitive `/goal` behavior. Verify them when accessible rather than relying on memory.

Do not hard-code a remembered objective limit or assume `/goal` is available. Check the installed client when needed; otherwise label compatibility unverified and provide a plain-language starter pointing to repository files. Keep durable state independent of client persistence.

## Workflow

### 1. Anchor and review the spec

Read the source spec and applicable repository rules, then follow only references needed to resolve requirements, dependencies, acceptance or implementation boundaries. Do not recursively load every referenced document.

Report whether the spec is executable. Proceed with explicit assumptions for non-blocking gaps. Stop only for a missing decision that changes product behavior, architecture ownership, migration, or acceptance.

### 2. Size the work

Choose one level and give a one-line reason:

- **S — direct execution**: one small coherent change, roughly 1–3 places, comfortably one session. Recommend `/ship`; create no worktree or ledger unless the user still requests one.
- **M — flat checklist**: 2–10 independently verifiable work units without natural phase boundaries. Read `references/checklist-ledger.md`.
- **L — phased plan**: multiple subsystems, natural delivery stages, more than 10 work units, or likely context handoff. Read `references/phased-plan.md`.

A large enumerable inventory is a **batch** dimension. Use the batch ledger from `references/checklist-ledger.md`, standalone or inside one L phase.

Split independent subsystems into separate plans when they can ship separately.

### 3. Map the implementation surface

Ground the plan in real repository evidence:

- existing entry points, modules, routes, tools, models, tests, and docs
- capabilities to reuse
- interfaces and ownership boundaries
- data/state/control flow
- discovery tasks only where exact paths genuinely cannot yet be known

Use a small ASCII or Mermaid diagram when it makes ownership or order unambiguous.

### 4. Define work units

Split by independently verifiable outcomes, not microscopic editing steps or document sections.

Each work unit must state:

- observable result
- in-scope surfaces and explicit non-goals
- prerequisites
- realistic failure mode
- binary acceptance
- exact command/check and expected result
- commit boundary

Every new user flow, code path, error path, and prompt behavior needs an automated check, browser check, or eval where practical.

### 5. Establish execution isolation

Every M/L plan must record:

- dedicated worktree path
- dedicated branch
- base ref
- baseline smoke command
- plan and ledger paths

Execution rules (for later execution, not permission for this planning step to create a worktree or commit):

1. Create the worktree before implementation; keep the primary checkout read-only.
2. If planning files are absent from the worktree, copy them and make a clean-start commit containing only those artifacts.
3. Execute every task, check, and commit inside the worktree.
4. Commit each verified work unit together with its progress update and include the task ID in the message.
5. Never commit failed verification; never push, merge, or amend automatically.
6. Advance after verified tasks/phases without confirmation pauses.

S-level work keeps normal repository behavior: no automatic worktree or commit.

### 6. Make the ledger durable

Prefer JSON when an agent will update state repeatedly. Task definitions, acceptance, worktree, branch, base ref, and execution rules are immutable during execution. The worker may update only status, evidence, verification, decision log, and turn log fields defined by the selected template.

The ledger must answer:

- current task and next allowed action
- done, pending, and blocked items
- evidence for each completed item
- baseline and residual risk
- where execution must occur

Use Git history linked by task ID as the commit audit trail; do not hand-copy commit hashes into the ledger.

### 7. Self-review

Before reporting readiness, verify:

- every source requirement maps to a task or explicit out-of-scope entry
- no `TBD`, `TODO`, “later”, “add tests”, or other placeholder acceptance remains
- paths, commands, names, and dependencies are internally consistent
- acceptance is binary and commands plausibly exist
- no stale wording conflicts with the latest direction
- phases advance automatically after evidence is recorded
- the primary checkout cannot be edited accidentally

Fix ordinary gaps directly. Ask only if the correction changes the approved direction.

## /goal starter

When supported by the selected client, end with a compact copy-ready starter. Omit the `/goal` prefix for a client without that command:

```text
/goal Implement <plan-path> using <progress-path>. Use repo-relative paths.

Each turn:
1. Read <progress-path> and work only in its dedicated worktree.
2. Read the current task in <plan-path>, recent git log, and baseline status.
3. Separate pre-existing failures from regressions; fix only task-owned failures and record relevant blockers.
4. Complete only the current unit, run its named verification, then update allowed ledger fields.
5. Commit code and progress together with the task ID only after verification passes.
6. Continue automatically until all acceptance is evidenced.

Never edit the primary checkout; never commit failed checks; never push, merge, or amend. Stop only for a real plan conflict, unsafe unrelated changes, or a decision absent from the approved spec.
```

## Output

When proposing in chat, give the executable outline and the few assumptions or blockers that affect readiness; include artifact paths, isolation settings and a starter only for the selected plan level. Do not create files for a proposal-only request.

When writing files, reuse the canonical plan location and create only the selected artifacts: one checklist for small M work, or a plan plus machine-updated ledger when needed. Report paths, validation, material risks and readiness without repeating file contents.

## Guardrails

- Do not implement or start `/goal`.
- Do not downgrade an approved scope into an MVP unless requested.
- Do not hand-maintain a large inventory a script can generate.
- Do not rely on chat memory for durable execution state.
- Preserve unrelated user changes.

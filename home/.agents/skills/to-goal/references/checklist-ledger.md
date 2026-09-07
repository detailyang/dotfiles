# Checklist And Batch Ledgers

Use the execution location and authorization policy established in the skill entry.
A checklist does not imply a new worktree, branch or commit workflow.

## Flat Checklist

Use one Markdown document for a short, mostly human-read plan. Use JSON if repeated
machine updates make it more reliable. Each item needs an observable result,
prerequisites, scope, binary acceptance, a verification command/check and status.

```markdown
# <topic> Execution Checklist

Source: <approved spec>
Execution location: <selected checkout or authorized worktree>
Git policy: <explicit user/repository permissions; no commits unless authorized>
Verification baseline: <smoke command and observed result, or not yet run>

- [ ] 1. <outcome> - scope: <surface/non-goals> - depends: none
  Accept: <binary criterion>; verify: `<command>` -> <expected result>
- [ ] 2. <outcome> - scope: <surface/non-goals> - depends: 1
  Accept: <binary criterion>; verify: `<command>` -> <expected result>

## Evidence And Blockers
```

Update evidence after verification and continue to ready items. If commits are
authorized, include the relevant checklist update with each coherent verified
change; otherwise leave changes uncommitted. Use Git history for commit evidence
rather than copying hashes into the checklist.

## Batch Inventory

Use for similar enumerable items, such as route audits or mechanical migrations.
Generate the inventory from a script or structured parser when possible. Choose a
batch that can be meaningfully verified; a costly item can justify its own batch.
A batch boundary is a recovery checkpoint, not an instruction to end the turn.

```json
{
  "goal": "Audit the target subsystem",
  "source": "scripts/generated-inventory.json",
  "execution_path": "<selected checkout>",
  "git_policy": "No commits or new worktrees unless explicitly authorized",
  "baseline": "<check and observed result, or not yet run>",
  "progress": { "next_item": "route.users.create", "blocked": [] },
  "items": [
    {
      "id": "route.users.create",
      "acceptance": "<binary criterion>",
      "check": "<command or reproducible inspection>",
      "status": "pending",
      "evidence": [],
      "notes": "",
      "verification": []
    }
  ]
}
```

The executing agent may update progress, item status, evidence, notes and observed
verification. Definitions, item IDs, acceptance, execution location and Git policy
remain stable unless their revision is authorized. After handoff, use the ledger
as the starting point and verify it against the checkout rather than relying on
chat memory. Record evidence before advancing.

## File Naming

Reuse repository conventions. Otherwise choose only the needed artifacts:

```text
docs/plans/<date>-<topic>-checklist.md   # flat checklist
docs/plans/<date>-<topic>-checklist.json # machine-updated batch inventory
```

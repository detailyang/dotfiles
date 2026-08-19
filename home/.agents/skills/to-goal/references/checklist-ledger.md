# Checklist Ledger (M Level And Batch Inventory)

Two uses of the same single-layer shape: a flat checklist for small M-level work, and a batch ledger for large enumerable inventories. No phases, no phase gates in either form.

## M-Level Flat Checklist

Use for 2-10 verifiable work units with no natural stage boundaries.

- A short markdown checklist is acceptable when the list is small and mostly read by humans; use JSON when the agent must update it repeatedly.
- Each item needs: title, binary acceptance, verification command or check, and status.
- Keep the whole plan in one document; do not split small work across files.

Minimal markdown shape:

```markdown
# <topic> Execution Checklist

Worktree: ../<repo>-<topic>-worktree
Branch: <dedicated-branch-name>
Base ref: <target-base-ref>
Verification baseline: <smoke command>

- [ ] 1. <work unit> — accept: <binary check> — verify: `<command>`
- [ ] 2. <work unit> — accept: <binary check> — verify: `<command>`
```

Execute the checklist only inside the dedicated worktree. Commit each verified item with its checklist update in the same commit, with the item number in the commit message. Do not store commit hashes here; `git log` from the worktree branch is the audit trail.

## Batch Inventory Ledger

Use when the work is a large list of similar items: reverse engineering, migrations, route audits, API extraction, processing many files.

- Generate the item list with a script or structured parser whenever possible. Do not ask the agent to hand-maintain a large inventory from memory.
- Batch size defaults to 10-20 items per turn; one-item batches require justification.
- Every turn: read the ledger, process only the next batch, verify, then commit the batch changes and the ledger update together in one commit with the batch number in the message.
- After compaction or handoff, trust the ledger over chat memory.

Minimal JSON shape:

```json
{
  "goal": "Reverse engineer the target subsystem",
  "source": "scripts/generated-inventory.json",
  "worktree_path": "../<repo>-<topic>-worktree",
  "branch": "<dedicated-branch-name>",
  "base_ref": "<target-base-ref>",
  "run_only_inside_worktree": true,
  "batching": { "batch_size": 20, "current_batch": 1 },
  "items": [
    {
      "id": "route.users.create",
      "status": "pending",
      "evidence": [],
      "notes": "",
      "verification": []
    }
  ]
}
```

The executing agent may only flip `status`, fill `evidence`, `notes`, `verification`, and advance `current_batch`. Item ids, worktree path, branch, base ref, and rules are read-only during execution.

## File Naming

Follow repo conventions if a plan directory already exists. Otherwise:

```text
docs/plans/<date>-<topic>-checklist.md        # M-level flat checklist
docs/plans/<date>-<topic>-execution-ledger.md # batch work: rules document
docs/plans/<date>-<topic>-checklist.json      # batch work: item ledger
```

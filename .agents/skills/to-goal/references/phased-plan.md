# Phased Plan Ledger (L Level)

Use this shape for work that spans multiple subsystems, has natural stage boundaries, exceeds 10 work units, or is expected to outlive a single session or context window.

## Phase Breakdown Rules

Split by independently verifiable work surfaces, not by document sections.

- A phase is a user-visible or system-visible delivery stage.
- A normal feature has 3-5 phases; a large refactor has 5-7. More than 8 phases requires a short justification or grouping.
- Each phase contains 2-5 work units. More than 6 in one phase requires justification.
- One `/goal` turn should complete one work unit when possible.
- Include exact code in a work unit only when it removes ambiguity and is stable enough to be useful.

Each phase needs:

- A clear phase goal and the visible result when it lands.
- Implementation surfaces: files, modules, routes, tools, docs, and tests likely touched.
- In-scope tasks and out-of-scope boundaries.
- Hard, binary acceptance conditions with the commands or checks that prove them.
- An automatic advancement rule: when acceptance is verified and recorded, continue to the next phase without asking the user.
- A commit boundary.

## Acceptance Examples

```text
Weak: 页面体验正常。
Hard: Browser check at 390px, 768px, and 1440px shows no horizontal scroll; the primary flow completes; key controls are clickable.

Weak: 文档已更新。
Hard: design.md, plan.md, and the progress file agree on phase goals, boundaries, and acceptance; no stale wording conflicts with the latest direction.
```

## Plan Document Sections

The plan document should include: goal, source documents, execution rules, `/goal` protocol, progress file path, dedicated worktree path, branch, base ref, implementation surface map, architecture or data-flow diagram when useful, phase list with per-phase tasks/acceptance/surfaces, a baseline smoke command, verification commands, test and eval plan, what already exists, not in scope, failure modes and residual risk, decision log, and commit rules.

## Progress File Template

```json
{
  "plan": "docs/plans/<topic>-phased-plan.md",
  "status": {
    "phase": "phase-1",
    "task": "1.1",
    "next_allowed_action": "Implement the current task; after verified completion, advance to the next task or phase automatically"
  },
  "execution_rules": {
    "worktree_path": "../<repo>-<topic>-worktree",
    "branch": "<dedicated-branch-name>",
    "base_ref": "<target-base-ref>",
    "run_only_inside_worktree": true,
    "primary_checkout_read_only": true,
    "clean_start_commit_required": true,
    "smoke_check": "<command that proves the build/tests are not broken>",
    "commit_each_verified_task": true,
    "progress_update_in_same_commit": true,
    "no_commit_on_failed_verification": true,
    "never_push_merge_or_amend": true,
    "advance_after_verified_phase": true,
    "no_user_confirmation_between_phases": true,
    "only_flip_status_fields": true
  },
  "decision_log": [],
  "phases": [
    {
      "id": "phase-1",
      "goal": "",
      "acceptance": [],
      "tasks": [
        { "id": "1.1", "title": "", "status": "pending", "verification": [] }
      ]
    }
  ],
  "turn_log": []
}
```

The executing agent may only flip `status`, fill `verification`, `decision_log`, and `turn_log` entries. Task definitions, acceptance, worktree path, branch, base ref, and rules are read-only during execution. Commit each verified task from inside the dedicated worktree with its progress update in the same commit and put the task id in the commit message; do not store commit hashes in this file.

## File Naming

Follow repo conventions if a plan directory already exists. Otherwise:

```text
docs/plans/<date>-<topic>-phased-plan.md
docs/plans/<date>-<topic>-progress.json
```

## Combining With A Batch Ledger

When one phase contains a large enumerable inventory, keep the phased plan as the outer ledger and attach a batch checklist ledger (see `checklist-ledger.md`) inside that phase. The phase's acceptance then includes "all ledger items complete".

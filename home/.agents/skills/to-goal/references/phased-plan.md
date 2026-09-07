# Phased Plan And Progress

Use phases for natural delivery stages or a substantial handoff, not to meet a
phase quota. Split by independently verifiable outcomes. Include exact code only
when it removes ambiguity and is stable enough to be useful.

## Plan Contents

Record the goal and source documents, relevant existing capabilities, ownership
and implementation surfaces, scope/non-goals, dependencies, acceptance checks,
material failure modes and unresolved decisions. Add a diagram only when it
clarifies ownership or order.

Record the selected execution location, baseline check, progress path and Git
permissions. A worktree, branch, base ref and primary-checkout protection belong
here only when the chosen isolation contract requires them. A clean-start or
per-task commit is not a default requirement.

Each phase needs a visible outcome, work units and prerequisites, binary acceptance
with concrete checks, and automatic advancement after verification. Choose commit
boundaries only when commits are explicitly authorized. No phase or task boundary
requires a new turn or a confirmation pause by itself.

## Acceptance Examples

```text
Weak: The page works.
Concrete: At the project's supported desktop/mobile viewports, the primary flow
completes without horizontal overflow and the specified controls are operable.

Weak: Documentation is updated.
Concrete: The spec, plan and progress file agree on requirements, boundaries and
acceptance; every local reference resolves and no superseded rule remains active.
```

## Progress Template

```json
{
  "plan": "docs/plans/<topic>-phased-plan.md",
  "execution": {
    "path": "<selected checkout>",
    "git_policy": "No commits or new worktrees unless explicitly authorized",
    "baseline_check": "<command>",
    "budget": "<agreed bound, or selected scope with no separate budget>"
  },
  "status": {
    "phase": "phase-1",
    "task": "1.1",
    "next_allowed_action": "Complete a ready task, verify, record evidence and continue",
    "baseline_result": "not yet run",
    "blocked": []
  },
  "phases": [
    {
      "id": "phase-1",
      "goal": "<observable stage outcome>",
      "acceptance": ["<binary phase criterion>"],
      "verification": [],
      "tasks": [
        {
          "id": "1.1",
          "outcome": "<observable result>",
          "scope": "<surfaces and non-goals>",
          "depends_on": [],
          "acceptance": ["<binary task criterion>"],
          "check": "<command and expected result>",
          "status": "pending",
          "verification": []
        }
      ]
    }
  ],
  "decision_log": [],
  "turn_log": []
}
```

Workers may update status, observed verification, decision and turn logs. Task
contracts and execution permissions remain stable unless a revision is authorized.
A decision-log entry cannot silently grant permission or change acceptance. Record
commands and observed results before advancing; separate baseline failures from
regressions and preserve unresolved blockers.

Reuse repository paths. Otherwise use `docs/plans/<date>-<topic>-phased-plan.md` and
`docs/plans/<date>-<topic>-progress.json`.

For an enumerable inventory inside a phase, attach a
[batch ledger](checklist-ledger.md). The phase is accepted only when its required
items and shared integration checks have evidence.

## Start every task

- Inspect the current branch, `git status --short --branch`, and
  `git worktree list` before changing files. Preserve other tasks' work.
- **Before the first edit, read and follow the
  [worktree skill](.agents/skills/worktree/SKILL.md).** Every independently
  reviewable slice of a feature, fix, refactor, or documentation/configuration
  task gets its own branch and worktree at `<primary-checkout>/.worktrees/<task>`.
  A requirement may span several slices; implementation steps within a slice
  share its worktree. The primary checkout is for inspection, synchronization,
  and reviewed integration, not implementation.
- Continue an existing slice in its assigned worktree. Do not create nested
  `.worktrees`, switch another task's branch, or relocate legacy worktrees.
- Read the applicable `AGENTS.md` files from the active worktree root down to
  the files being changed; deeper instructions specialize their directory tree.
- Set every tool's working directory or absolute file paths to the active
  worktree. A shell `cd` does not change the next MCP/tool call's workspace.

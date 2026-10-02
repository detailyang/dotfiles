# Worktree Workflow Skill

Use this skill before editing files for any independently reviewable feature, fix,
refactor, or documentation/configuration task.

## Workflow

1. Inspect the current branch and workspace from the primary checkout:
   `git status --short --branch` and `git worktree list`. Preserve work that
   belongs to another task.
2. Read the applicable `AGENTS.md` files from the active worktree root down to
   the files you will change. Read relevant product documentation and nearby
   implementation before choosing a path.
3. Identify the primary checkout from `git worktree list`. Continue an existing
   slice in its assigned worktree. For a new slice, create one beneath the
   primary checkout's `.worktrees/` directory with a dedicated branch, for
   example:

   ```sh
   git worktree add -b <task-branch> <primary-checkout>/.worktrees/<task> <base>
   ```

4. Set every tool's working directory, or every file path when a tool has no
   working-directory option, to the active worktree. A shell `cd` does not
   change the working directory of a later tool call.
5. Make the implementation and its verification changes in that worktree.
   Keep all implementation steps for one slice together there.
6. Before delivery, inspect the complete diff and run the checks for the changed
   surface. Use the primary checkout only for inspection, synchronization, and
   reviewed integration.

## Boundaries

- Do not switch another task's branch or use `git checkout`/`git switch` to
  repurpose a worktree.
- Do not create nested `.worktrees` directories or relocate legacy worktrees.
- Do not edit the primary checkout as part of implementation.
- A single requirement may span several independent slices; each slice still
  receives its own worktree. A slice may contain multiple related implementation
  steps and tests.
- If the assigned worktree is missing or its branch is occupied, stop and report
  the evidence and the next action instead of taking over another worktree.

## Verification

Run `git status --short --branch` and `git worktree list` again before reporting
completion. Confirm that the active path is the assigned worktree, the diff is
limited to the slice, and the relevant tests or static checks pass.

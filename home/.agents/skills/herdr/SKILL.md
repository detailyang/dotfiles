---
name: herdr
description: Inspect or control Herdr workspaces, panes, terminals or coding agents only when the user explicitly asks to use Herdr. Requires HERDR_ENV=1; not a generic delegation skill.
---

# Herdr

## Preflight and targeting

Run `test "${HERDR_ENV:-}" = 1` before control commands. If it fails, do not control
another focused session from outside Herdr. Check `herdr --help`, then only the
relevant command group's help. Never run bare `herdr` or probe a mutating command
by omitting its arguments; defaults may have side effects.

```text
workspace -> tab -> pane (terminal) -> optional recognized agent
```

Use `--current`, an explicit returned pane ID or a unique live agent name. IDs are
opaque; do not derive new IDs after moves or rely on sidebar order or UI focus.
Inspect the target's state before sending input. Agent operations address a live
recognized agent, not an arbitrary terminal or bare agent kind.

## Operations

Read [CLI recipes](references/cli.md) only for the requested operation: state
inspection, agent startup/prompt/wait, terminal commands, output sources or recovery.
Use returned JSON IDs and installed syntax rather than copying example IDs.

Default to a sibling pane in the current tab and cwd, preserving focus with
`--no-focus`. Create another workspace, worktree or cwd only when requested.
A new agent needs an available interactive shell pane, not a foreground process.

A lifecycle wait is not proof that a particular task succeeded. Inspect output and
verification evidence; `unknown`, `blocked`, stalled prompts and stale terminal
matches are not completion. Do not answer an approval prompt on the user's behalf.

Never close resources you did not create without authorization. Do not stop the
server or kill the main Herdr process during an active session unless explicitly
requested. Report completed operations and observed results, not just commands sent.

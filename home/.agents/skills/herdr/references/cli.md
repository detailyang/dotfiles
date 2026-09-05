# Herdr

> Command recipes retained from the original skill. Check the installed CLI before using a recipe; read only the section needed for the current operation.

Herdr is a terminal multiplexer for coding-agent sessions. Use its CLI only from a Herdr-managed pane and let the installed binary define the current command syntax.

## Preflight

Before any control command:

```bash
test "${HERDR_ENV:-}" = 1
```

If this fails, report that Herdr control is unavailable from the current pane. Do not inspect or control another focused session from outside Herdr.

Learn the installed CLI with:

```bash
herdr --help
herdr agent
herdr pane
herdr workspace
herdr tab
herdr worktree
herdr terminal
herdr notification
herdr integration
herdr session
```

Do not run bare `herdr` for discovery; it launches or attaches the TUI. Do not probe a mutating nested command by omitting arguments—some commands execute with defaults.

Most control commands return JSON. Parse identifiers and state from responses rather than predicting them.

## Mental model

```text
workspace
  -> tab
    -> pane (always a terminal)
      -> optional recognized coding agent
```

- Workspace, tab, and pane commands manage topology and raw terminals.
- Pane commands run shells, tests, servers, and ordinary commands.
- Agent commands operate on a supported coding agent already occupying a pane.
- `agent start` needs an existing available shell pane; it does not create layout.

Agent commands accept a unique live agent name or the pane ID hosting that agent—not a terminal ID or bare agent kind. Names must match `[a-z][a-z0-9_-]{0,31}` and be unique among live agents.

Public IDs are opaque handles such as `w1`, `w1:t1`, and `w1:p1`. Closed IDs are not reused. After a move, use the returned live ID or agent name, not a derived replacement.

Herdr injects caller context:

```bash
printf '%s\n' "$HERDR_WORKSPACE_ID" "$HERDR_TAB_ID" "$HERDR_PANE_ID"
```

Prefer `--current`, an explicit pane ID, or a unique live agent name. Omitting a target may act on the UI-focused pane owned by another client.

## Inspect current state

```bash
herdr workspace list
herdr tab list --workspace "$HERDR_WORKSPACE_ID"
herdr pane current --current
herdr pane list --workspace "$HERDR_WORKSPACE_ID"
herdr agent list
```

Creation and move responses contain the IDs required by the next command. Keep those returned values.

## Start and coordinate an agent

Default to a sibling pane in the current tab and current working directory. Create a different workspace, tab, worktree, or cwd only when requested.

Inspect geometry:

```bash
herdr pane layout --pane "$HERDR_PANE_ID"
```

Split a wide pane right; split a narrow or tall pane down. Preserve focus and cwd:

```bash
herdr pane split --current --direction right --cwd "$PWD" --no-focus
```

Read the new pane from `.result.pane.pane_id`. It must be at an interactive shell prompt with no foreground command, editor, or agent. Then start the requested supported agent with a unique name:

```bash
herdr agent start reviewer --kind codex --pane <pane-id>
```

`agent start` returns after Herdr detects the expected agent and considers it ready; its default startup timeout is 30 seconds.

Pass native agent arguments after `--`:

```bash
herdr agent start reviewer --kind codex --pane <pane-id> -- <agent-args...>
```

Submit normal work through the agent surface:

```bash
herdr agent prompt reviewer \
  "Review the current diff and report only actionable findings." \
  --wait --timeout 120000
```

Use `--until` only when waiting for a specific state:

```bash
herdr agent wait reviewer --until blocked --timeout 120000
```

Lifecycle meanings:

- `idle` — ready for input and already seen in the focused Herdr UI
- `working` — the recognized agent is actively processing
- `done` — the same settled state after unseen background work
- `blocked` — a recognized approval or question UI
- `unknown` — an agent is present but state classification is uncertain; it does not prove completion

A wait tracks lifecycle state, not a specific turn. A prompt submitted from a non-working state must produce an observed state transition within five seconds or Herdr reports `agent_prompt_stalled`. When a wait fails or returns `blocked`, inspect before sending input:

```bash
herdr agent get reviewer
herdr agent read reviewer --source recent-unwrapped --lines 120
```

Use logical keys for interactive controls:

```bash
herdr agent send-keys reviewer esc
herdr agent send-keys reviewer ctrl+c
```

## Run an ordinary command

Create a sibling pane with the same layout rule, then:

```bash
herdr pane run <pane-id> "just test"
herdr pane wait-output <pane-id> --match "test result" --timeout 120000
herdr pane read <pane-id> --source recent-unwrapped --lines 120
```

Use `--regex` for a Rust regular expression. `pane wait-output` checks the current snapshot immediately, so stale output can match; choose a distinctive marker when that matters. Choose the read source intentionally:

- `visible` — current viewport
- `recent` — rendered output with soft wraps
- `recent-unwrapped` — joined soft wraps; preferred for logs/transcripts
- `detection` — bottom-buffer plain text used for agent detection

Use `--format ansi` only when terminal styling is evidence. Alternate-screen history may be unrecoverable; if larger reads still omit a completed response, ask the agent to write its complete result to a temporary Markdown file and read that file directly.

## Safety

- Keep user focus unchanged with `--no-focus` unless switching was requested.
- Never rely on sidebar order or another client's focused pane.
- Do not close workspaces, tabs, panes, or sessions you did not create unless explicitly asked.
- Never run `herdr server stop` from an active session unless the user intends to stop the server and pane processes.
- Never kill the main Herdr process; use isolated named sessions for destructive experiments.
- CLI server errors use JSON on stderr with exit status 1; syntax errors exit with status 2.

---
name: xray-plan
description: Run an isolated multi-agent adversarial design review workflow to pressure-test a software design, architecture, or technical approach. Use when the user wants a rigorous design review, architecture critique, system design stress test, or asks to "review this architecture", "design X properly", "run adversarial design review", or "对某个系统做对抗性设计审查". Also use for follow-up iteration requests such as "iterate" or "run another round".
---

# Xray Plan

Run a five-phase adversarial design review with strict phase isolation. Do not perform any role in the main conversation context.

## Core Rules

1. Run every phase as an independent sub-agent task.
2. Before any phase begins, run a real agent availability preflight and select a healthy local LLM agent.
3. Pass state only through files under `.design-review/{topic}/`.
4. Create `.design-review/{topic}/logs/` at the start of every run.
5. Before spawning a phase, write the exact sub-agent prompt to `.design-review/{topic}/logs/phase-{N}-{role}.prompt.txt`.
6. Append lifecycle events to `.design-review/{topic}/logs/events.jsonl` for `phase_started`, `phase_completed`, `phase_failed`, `phase_retried`, and agent preflight events.
7. Do not let later phases start before their required files exist.
8. Always run the second critic after synthesis.
9. After each phase completes, report: phase name, output file path, one-line summary.
10. Finish with the exact summary format from [references/phase-prompts.md](references/phase-prompts.md).

## Topic Setup

1. Derive `topic` in kebab-case from the user's subject.
2. Create `.design-review/{topic}/` and `.design-review/{topic}/logs/`.
3. If the user provided raw requirements, write them to `.design-review/{topic}/requirements.md`.
4. If the user says `iterate` or `run another round`, treat the latest `design_final*.md` as the new design input and generate versioned outputs for the new round.
5. Initialize `.design-review/{topic}/logs/events.jsonl` for the current run.
6. Initialize `.design-review/{topic}/logs/agent-checks.jsonl` for the current run.

## Agent Preflight

1. Before Phase 1, probe candidate local agents in deterministic order and select one healthy agent for the run.
2. A probe must execute a real non-interactive model request. `command -v` alone is forbidden because it cannot detect expired keys, auth failures, or transport failures.
3. Record every probe in `.design-review/{topic}/logs/agent-checks.jsonl` with at least: `ts`, `agent`, `command`, `exit_code`, `status`, `reason`, and `selected`.
4. Append `agent_check_started`, `agent_check_completed`, `agent_selected`, and `agent_reselected` events to `.design-review/{topic}/logs/events.jsonl` as applicable.
5. Preferred default probe order is: `codex`, `opencode`, `claude`, then other configured local agents. Respect an explicit user preference if given.
6. For `codex`, use a real `codex exec` smoke test with an ephemeral session and a trivial success token such as `XRAY_OK`, then verify that exact token appears in stdout.
7. For `opencode`, use a real `opencode run` smoke test in a temp working directory with `--format json` and the same `XRAY_OK` token check, then verify the final assistant output contains that exact token rather than relying on startup logs.
8. For `claude`, force `HOME` and `XDG_*` into a writable temp directory and use `--no-session-persistence` with the same `XRAY_OK` token check so the probe reflects auth/model availability instead of local config write failures.
9. Prefer concrete probe commands over prose. Example patterns:
   - `codex exec --skip-git-repo-check --ephemeral -C <tmpdir> -s read-only "Reply exactly: XRAY_OK"`
   - `opencode run --format json --dir <tmpdir> "Reply exactly: XRAY_OK"`
   - `env HOME=<tmpdir> XDG_CONFIG_HOME=<tmpdir> XDG_DATA_HOME=<tmpdir> claude -p --no-session-persistence "Reply exactly: XRAY_OK"`
10. Classify failures explicitly, for example: `missing_cli`, `sandbox_path`, `auth_invalid`, `provider_unreachable`, `transport_error`, `unexpected_output`, or `unknown`.
11. If no agent is healthy, stop before Phase 1 and report the blocking preflight result instead of attempting the review.
12. If the selected agent later fails for auth, transport, or local runtime reasons, rerun preflight once and switch agents if possible before consuming the phase's single tighter-instruction retry.

## Execution Flow

### Fresh review

1. Run Agent Preflight.
2. Run Phase 1 Architect.
3. Run Phase 2 Critic and Phase 3 Devil's Advocate in parallel after `design_v1.md` exists.
4. Wait for both parallel phases to finish.
5. Run Phase 4 Synthesizer.
6. Run Phase 5 Second Critic.

### Iteration

1. Run Agent Preflight.
2. Discover the highest existing final design version in `.design-review/{topic}/`.
3. Use that file as the design input for the next round.
4. Re-run Critic, Devil's Advocate, Synthesizer, and Second Critic only.
5. Append version suffixes: `critique_vN.md`, `risks_vN.md`, `design_final_vN.md`, `final_review_vN.md`.

## Operating Guidance

- Use sub-agents for every phase. Do not write the role outputs yourself.
- Give each sub-agent only the minimum task-local context: file paths, topic, and requirements or input files.
- The prompt log must contain the exact message sent to the sub-agent, including wrapper instructions, file ownership, allowed inputs, and the verbatim phase prompt from [references/phase-prompts.md](references/phase-prompts.md).
- The controller may add wrapper instructions for isolation and file ownership, but must preserve the phase prompt text exactly inside the logged prompt.
- For parallel phases, each phase still gets its own prompt file and its own start/complete events.
- If a phase is retried, write a new prompt file with a retry suffix such as `phase-2-critic.retry1.prompt.txt` and append a `phase_retried` event before re-running it.
- Distinguish agent execution failures from phase-content failures. Auth, transport, and local runtime failures do not consume the phase's single tighter-instruction retry until a healthy agent has been selected.
- If the user asks what a sub-agent saw or why it produced a result, answer from the corresponding file in `.design-review/{topic}/logs/` instead of reconstructing the prompt from memory.
- Ensure the second critic reads only the final design file from its round.
- If a phase fails after running on a healthy agent, retry with tighter instructions once. If it still fails, stop and report the blocking phase and reason.
- If the user gives incomplete requirements, proceed with explicit assumptions rather than stalling, unless the missing data changes the architecture class entirely.

## Phase Prompts

Use the exact phase prompts and final summary template in [references/phase-prompts.md](references/phase-prompts.md).

## Output Discipline

- Keep all intermediate artifacts in `.design-review/{topic}/`.
- Keep all prompt logs and lifecycle events in `.design-review/{topic}/logs/`.
- Preserve previous rounds. Never overwrite an existing versioned file from an earlier iteration.
- In the final assistant response, include the selected agent, scores, fatal assumption, file inventory, logs path, and a recommendation on whether another round is worthwhile.

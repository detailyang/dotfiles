---
name: to-goal
description: Convert a finished spec or design document into a right-sized execution plan and /goal starter for Codex. Use when the user has a completed spec/design and wants phases, a phased plan, an execution checklist or JSON ledger, a progress file, hard acceptance criteria, batch-processing lists, or a /goal prompt. Triggers include "基于这个 spec 写 /goal plan", "把设计文档拆成可执行 phase", "生成 phased plan 和 progress 文件", "逆向清单做成 checklist 分批处理". Routes small tasks to a lighter ledger instead of full phases. Not for brainstorming, writing the original spec, or implementing the plan.
---

# To Goal

Use this skill after a spec/design is already written and the user wants to make it executable, usually through Codex `/goal`. Do not implement the work. Produce the plan, the execution ledger, and the starter prompt.

```text
spec or design document
-> this skill: spec review + task sizing + plan + execution ledger + /goal starter
-> /goal execution
```

## How /goal Actually Works

Facts every plan must respect (Codex >= 0.133, goals enabled by default):

- A goal objective is at most 4,000 characters. Point the objective at the plan file instead of embedding the plan.
- Codex stores the goal outside the conversation and re-injects the full objective every time the thread goes idle. Goals survive context compaction and session resume. Do not design the ledger around "the goal might be lost"; design it around "the working context will be lost".
- The official goal continuation prompt already enforces: evidence-based completion audit, no shrinking the objective to an easier task, blocked status only after the same blocker repeats for three turns, and using `update_plan` for multi-step work. Do not repeat these instructions in the starter prompt.
- Plan mode suspends goal continuation, and ephemeral (unsaved) sessions cannot hold goals.

## Required Inputs

- The spec/design document: a path, pasted text, or clearly selected text. If absent, ask for it. This skill is not for free-form planning from a vague idea.
- The intended scope, any source-of-truth docs, and whether to write files or only propose in chat.

## Workflow

### 1. Read And Anchor

Read the spec and every source-of-truth doc it references. In a repo, also read local project rules such as `AGENTS.md` or `CLAUDE.md` when present. Treat the latest user-confirmed direction as the source of truth; long plans drift when older wording survives.

### 2. Spec Review Gate

Before writing a plan, review whether the spec is executable. Report: ready yes/no, blocking gaps, drift risks, required fixes. If a blocking decision is missing, stop and ask for that decision. Do not hide uncertainty inside a phase plan.

### 3. Size The Task

Route the work before writing anything. Report the chosen level with a one-line reason; the user can override it.

- **S — recommend direct execution.** The diff is describable in one sentence, touches roughly 1-3 places, and fits comfortably in one session. Tell the user the planning overhead would exceed the task and recommend doing it directly without `/goal`. If the user still wants a plan, produce the M output — never a phased plan.
- **M — flat checklist.** 2-10 verifiable work units, no natural stage boundaries, unlikely to span sessions. Read `references/checklist-ledger.md` now and produce a single-layer ledger: no phases, no phase gates.
- **L — phased plan.** Any of: multiple subsystems, natural stage boundaries, more than 10 work units, or work expected to span sessions or context compaction. Read `references/phased-plan.md` now and produce the full phased plan plus progress file.
- **Batch inventory** is an orthogonal dimension: when the work is a large list of similar items (reverse engineering, migrations, audits, extraction), use the batch ledger shape in `references/checklist-ledger.md`, either standalone or embedded inside one phase of an L plan.

If the spec covers several independent subsystems that ship separately, propose splitting it into separate plans instead of one oversized plan.

### 4. Map Implementation Surface

Make the plan concrete enough that a fresh worker can execute it without guessing:

- Existing files, modules, routes, tools, data models, tests, or docs likely to change, and new artifacts to create.
- Existing capabilities to reuse instead of rebuild.
- Interfaces and boundaries: what each component owns, receives, returns, and must not know.
- Data or state flow for any non-trivial workflow, as a simple ASCII diagram when it clarifies ownership and direction.

If the repo is available, inspect enough code to avoid inventing file paths, framework names, or test commands. If exact paths cannot be known yet, say so and make discovery the first work unit.

### 5. Plan-Writing Principles

Resolve ordinary planning decisions yourself; only stop for decisions that would change the user's stated direction.

- Complete beats shortcut: cover real edge cases, not only the demo path.
- Reuse existing capability when the repo already has a pattern, helper, or service for the job.
- Explicit beats clever: choose the approach a new contributor understands quickly.
- Split by independently verifiable outcomes, not microscopic operations. A work unit is a chunk worth verifying and committing, such as "Implement the entry flow UI and routing", never "read file A, edit file A, run test".
- Every new user flow, code path, error path, and LLM/prompt change needs a matching automated test, browser check, or eval where practical.
- For each critical path, name one realistic failure mode and whether the user sees a clear recovery or a silent failure. A silent failure with no planned test is a plan gap.
- Record meaningful tradeoffs in a short decision log (decision, reason, rejected alternatives, source). Log choices that affect architecture, scope, tests, or flow — not tiny choices.

### 6. Hard Acceptance

Acceptance must be binary and checkable:

```text
Weak: 测试通过。
Hard: `npm run test:server` exits 0 and the result is recorded in the progress file.
```

Every code phase or work unit needs at least one automated check unless the repo has no runnable test surface; UI work needs browser verification at named viewports; document-only work needs file assertions and conflict review. Never write "tests pass" without naming what can actually run.

### 7. Git And Commit Rules

Write these rules into every M/L plan and ledger:

- Before execution starts: create a dedicated branch and make a clean-start commit. Never run a ledger on the main branch.
- Commit each verified work unit in a single commit that contains both the code change and the progress-file update, with the task id in the commit message (for example `feat: entry flow [task 1.2]`). Do not record commit hashes in the progress file; `git log` linked by task id is the audit trail. This keeps one commit per work unit instead of a paired bookkeeping commit.
- Never commit when required verification fails.
- Never push, merge, or amend automatically. Merging into the main branch requires the user's review.
- S-level work keeps default behavior: do not auto-commit; suggest a commit when done.

### 8. Progress File Rules

- Prefer JSON for anything the executing agent must update repeatedly; models corrupt structured JSON less than prose.
- The executing agent may only flip status, evidence, and log fields. It must not add, remove, or rewrite task definitions or acceptance criteria.
- The file must answer: current phase/task, next allowed action, which items are done/pending/blocked, which verification proves each done item, and what residual risk remains. The commit history, linked by task id, shows which commit completed each item.
- Concrete templates live in the reference file for the chosen ledger shape.

### 9. Plan Self-Review

Before reporting the plan ready, check:

- Every spec requirement maps to a work unit, checklist item, or explicit out-of-scope entry with rationale.
- No placeholder language: `TBD`, `TODO`, `later`, `add tests`, `similar to`, or vague equivalents.
- Paths, commands, names, and acceptance wording are consistent and realistic for the repo.
- Acceptance is binary; verification commands actually exist.
- No stale wording conflicts with the latest direction.
- The plan forbids confirmation pauses between verified phases.

Fix issues inline. If a fix would change the user's stated direction, stop and ask instead.

### 10. /goal Starter

End with a copy-ready starter. Keep it under roughly 1,000 characters — the hard limit is 4,000 — and keep it about the ledger protocol only; the official goal prompt already handles completion auditing and goal fidelity.

```text
/goal Implement <plan-path> by following its execution ledger.

Each turn:
1. Read <progress-path>, then the current task or next batch in <plan-path>.
2. Run `git log --oneline -15` and the smoke check named in the plan; repair a broken state before starting new work.
3. Work only on the current work unit or batch.
4. After verification passes: update <progress-path> (status, evidence, and log fields only) and commit the code change and that update together in one commit, with the task id in the message. Never commit on failed verification. Never push, merge, or amend.
5. When a phase's acceptance checks all pass, record it and continue to the next phase without asking for approval.

Done when every item in <plan-path> is complete, every acceptance check is proven, and <progress-path> records final status and residual risk.

Stop and report if a product decision is missing, the plan conflicts with the latest direction, or the worktree holds unrelated changes that cannot be safely separated.
```

## Output Format

When the user asks for a proposal first, respond in chat with: spec review, task size and reason, implementation map, ledger choice, plan outline, file paths, /goal starter, open questions. When asked to write files, create the plan/ledger and progress files, then report created paths, review result, and whether it is ready to start.

## Guardrails

- Do not write implementation code and do not start `/goal` yourself.
- Do not compress unclear decisions into vague acceptance criteria, and do not downgrade the spec into an MVP unless asked.
- Do not ask for phase-boundary confirmation; verified phases advance automatically. Ask only when the spec is blocked or the plan would change the user's stated direction.
- Do not hand-maintain large inventories a script can generate.
- Do not rely on chat memory for long work; write stable files.
- Preserve unrelated user changes when editing inside a repo.

## Non-Triggers

Brainstorming a direction, writing the original spec, implementing an existing plan, code review, and ordinary todo lists belong to other workflows.

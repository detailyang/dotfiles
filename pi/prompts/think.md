---
name: think
description: "Turns rough ideas into approved, decision-complete plans with validated structure before coding. Use when users ask 出方案/给方案/深入分析/怎么设计/有没有必要/值不值得/plan this/how should I/should we keep this for features, architecture, or value judgments. Not for bug fixes or small edits."
when_to_use: "出方案, 给方案, 深入分析, 怎么设计, 用什么方案, 判断一下, 有没有必要, 值不值得, what's the best approach, plan this, how should I, should we keep this"
dispatch_intent: "New feature, architecture, how should I design this, value judgment, executable plan, handoff"
---

# Think: Design and Validate Before You Build

Turn a rough idea into an approved plan. No code, no scaffolding, no pseudo-code until the user approves.

Respond in Chinese by default. Switch to English only if the user writes in English. Code, comments, and identifiers are always in English.

Give opinions directly. Take a position and state what evidence would change it. Avoid "That's interesting," "There are many ways to think about this," "You might want to consider."

## Outcome Contract

- Outcome: a rough idea becomes a decision-complete recommendation or implementation plan.
- Done when: the goal, success criteria, constraints, chosen approach, rejected tradeoffs, tests, and handoff steps are concrete enough to execute without re-deciding.
- Evidence: current repo state, project docs, live external docs when relevant, prior decisions, constraints, and explicit user preferences.
- Output: one recommended direction or a handoff plan with assumptions and verification steps.

## Scope Assessment

Before asking anything, assess the task from the user's description. State depth in one line: `Depth: Lightweight / Standard / Deep — reason.`

| Depth | Characteristics |
|-------|----------------|
| **Lightweight** | Single file, config change, isolated addition. Low ambiguity. |
| **Standard** | Multi-file feature, integration, moderate complexity. |
| **Deep** | New system, cross-cutting change, unfamiliar domain, or high risk. |

**Auto-escalate to Deep** if you discover: external API contract, shared type exported to callers, or irreversible data migration. Require explicit user confirmation and document the escalation reason before proceeding.

## Lightweight Mode

Activate when the user wants to fix something rather than build something, the problem is already defined, and the only open question is "how to fix it."

Give one recommended fix in 2–3 sentences: what changes, where (file:line if known), and why. Name the brute-force version in one line first; default to it unless the user wants elegance. List involved files, flag explicitly if more than 5. State one risk. Wait for approval before implementing.

Upgrade to full mode if you find 3 or more genuinely different approaches with meaningful tradeoffs.

## Evaluation Mode

Activate when the user wants to judge whether something should exist, be kept, exposed, or removed. Typical triggers: "判断一下", "有没有必要", "值不值得", "should we keep this", "is this worth it", "我不想做", "商业前景", "有没有必要继续".

State the evaluation target and what kind of judgment is needed (value, risk, or tradeoff). Take a current-state snapshot: what it does, who uses it, what depends on it; grep and read before opining.

For product pivot, commercialization, or business-direction requests, frame the market, user, distribution, willingness-to-pay, and maintenance burden before proposing technology. Do not assume open source, do not assume implementation comes first, and do not hide a business judgment inside a technical plan.

**Output format (Kill/Keep/Pivot):**

Line 1: one of **Kill** / **Keep** / **Pivot** as the verdict. No preamble.

Then three reasons, based on the user's actual constraints (time, motivation, business model, maintenance cost). Not generic tradeoffs.

If verdict is **Pivot**: list specific directions on separate lines, one per line, each actionable.

If verdict is **Kill** or major rework: list impact scope (files, dependents, migration cost) before asking for confirmation.

Do not use a build-plan template here. Do not list options. Give one verdict.

Distinction from Lightweight Mode: Lightweight answers "how to fix it" (method). Evaluation answers "should it exist" (value judgment).

## Before Reading Any Code

- Confirm the working path: `pwd` or `git rev-parse --show-toplevel`. Never assume `~/project` and `~/www/project` are the same.
- If the project tracks prior decisions (ADRs, design docs, issue threads), skim the ones matching the problem before proposing. Skip if none exist.
- If the plan involves a default value, env var, or config field, open the project's actual config file and lift the live value. Never quote a default from memory or docs.

## Before Proposing

Scan the project's `AGENTS.md` and `CLAUDE.md` before outputting any plan. If the proposed plan contradicts a "hard rule", "never X", "must Y", or "prefer Z" stated in those files, surface the contradiction in one sentence: which rule, which step contradicts it, recommended resolution. Do not silently override the rule. If the rule blocks the plan, stop and ask before continuing.

## Check for Official Solutions First

Before proposing custom implementations, search for framework built-ins, official patterns, and ecosystem standards. If an official solution exists, it is the default recommendation unless you can articulate why it is insufficient for this specific case.

## Targeted Questions

Ask **3–5 questions max**, one at a time. Stop when you have enough to write the plan.

- **Q1 — Goal**: What outcome does this need to produce? Not the feature — the result the user cares about. Push back if the answer describes implementation instead of outcome. Skip if task is already clear from context.
- **Q2 — Constraints**: What cannot change? Existing interfaces, performance requirements, team conventions, deadlines.
- **Q3 — Existing landscape**: What already exists that's relevant? If the user mentions files, read them before continuing. Skip if codebase has no relevant source files.
- **Q4 — Failure modes** (Standard or Deep): What would cause this to fail? Nil input, upstream timeout, partial failure, concurrent writes.
- **Q5 — Success signal** (Deep or ambiguous goal): How will you know this worked? Measurable, not "it feels better".

## Pre-Design Challenges

Before proposing options, challenge three things explicitly:

1. **Is this the right problem?** Could a different framing produce a dramatically simpler solution?
2. **What's the cheapest path?** Is there an existing tool, pattern, or 10-line function that gets 80% of the way there?
3. **What's hard to undo?** Schema changes, public API contracts, data migrations — slow down on these.

**Attack the obvious approach:** Ask what would make the most natural solution fail. If the attack holds, start with the hardened version. If it shatters the approach entirely, say so and explain why.

## Propose Approaches

Give one recommended approach with rationale. Include effort, risk, and what existing code it builds on. Mention one alternative only if the tradeoff is genuinely close (>40% chance the user would prefer it). Always include one minimal option.

For the recommendation, identify the most fragile assumption (premise collapse) and state it explicitly: "This plan assumes X. If X does not hold, Y happens." If the assumption is load-bearing and fragile, deform the design to survive its failure.

**Blocking ambiguities**: if requirements have a conflict the user must resolve, name the specific conflict in one sentence and ask which takes precedence. Do not silently pick.

**Additional attack angles** (run only when the plan involves external dependencies, high concurrency, or data migration):

| Attack angle | Question |
|---|---|
| Dependency failure | If an external API, service, or tool goes down, can the plan degrade gracefully? |
| Scale explosion | At 10x data volume or user load, which step breaks first? |
| Rollback cost | If the direction is wrong after launch, what state can we return to and how hard is it? |

If an attack holds, deform the design to survive it. If it shatters the approach entirely, discard it and tell the user why. Do not present a plan that failed an attack without disclosing the failure.

Get approval before proceeding. If the user rejects, ask specifically what did not work. Do not restart from scratch.

## Validate Before Handing Off

- More than 8 files or 1 new service? Acknowledge it explicitly.
- More than 3 components exchanging data? Draw an ASCII diagram. Look for cycles.
- Every meaningful test path listed: happy path, errors, edge cases.
- Can this be rolled back without touching data?
- Every API key, token, and third-party account the plan requires listed with one-line explanations. No credential requests mid-implementation.
- Every MCP server, external API, and third-party CLI the plan depends on verified as reachable before approval.

**No placeholders in approved plans.** Every step must be concrete before approval. Forbidden patterns: TBD, TODO, "implement later," "similar to step N," "details to be determined."

**Phase independence.** If the plan has multiple phases, each phase must be independently mergeable: after Phase N ships, the system is in a usable state, even if N+1 never lands. If the work cannot be cut into mergeable phases, say so and ship it as one phase.

**Plan red flags (self-check before handoff):**
- A phase depends on the next phase to be useful (cannot ship alone).
- A "Phase 0: investigate / spike" exists. Investigation belongs before the plan, not inside it.

Either red flag means the plan is not ready. Resolve it before handing off.

## Acceptance Scenarios

Cover at minimum: at least one happy path, at least one scenario per stated failure mode, and edge cases listed separately. No failure mode left uncovered — either add a scenario or explicitly declare `Accepted, not tested — reason: {reason}`.

```yaml
scenarios:
  - id: AC-001
    description: "{One sentence stating what this scenario verifies}"
    preconditions:
      - "{Precondition 1}"
    steps:
      - "{Action step 1}"
    expected:
      - "{Expected result 1}"
    tags: [happy-path | error | edge | regression]
```

## Implementation Handoff

A finished plan must be executable by another engineer or agent without re-deciding the direction. Include:

- Scope and non-scope.
- The chosen approach and the one rejected alternative, if the tradeoff was close.
- Public API, schema, command, config, or file-interface changes, if any.
- Verification commands and manual acceptance checks.
- Release, publish, migration, or issue/PR follow-through steps, if the task naturally continues there.
- Rollback or failure handling for any step that can leave external state changed.

When the user asks to export a handoff, or when the environment prevents further execution, make the handoff execution-ready instead of explaining the limitation.

When the user later says "Implement the plan", "可以干", "直接改", "整", or equivalent, treat that as approval of the written plan. Do not re-litigate the design. State which plan is being executed, check for obvious drift in the repo, and proceed. If the environment has changed enough that the plan is unsafe, name the specific drift and stop before editing.

## Spec Files

Once the plan is approved, write two files to disk before implementation begins.

**Directory structure:**
```
<git-root>/specs/
  <feature-name>-<YYYY-MM-DD>/
    design.md     ← full design document
    notes.md      ← empty skeleton; filled during implementation
```

**Naming rules:**
- `<feature-name>`: inferred from the approved option or task description. kebab-case, lowercase, no spaces or special characters.
- `<YYYY-MM-DD>`: current date.
- **Location:** Always use `git rev-parse --show-toplevel` to find the git root. Fall back to `pwd` if not in a git repo. Create `specs/` and the feature directory if they do not exist.

**Implementation rule:** Before closing any implementation session, update `notes.md`. A session is complete only when `notes.md` reflects what actually happened. If nothing diverged from the spec, write that explicitly. `design.md` is frozen after approval — implementation discoveries go to `notes.md` only.

### design.md template

```markdown
# Design: {Title}

Date: {YYYY-MM-DD}
Status: Draft

## Problem
{One paragraph. What needs to change and why.}

## Out of Scope
{Explicit list of what this design does NOT cover.}

## Constraints
{Hard limits that cannot be violated.}

## Assumptions
{Things believed to be true but not verified. Each is a potential blocker.}

## Approach
{The approved option, explained in full. Include data flow, component boundaries, key interfaces.
If more than 3 components exchange data, include an ASCII diagram.}

## Key Decisions
{3–5 decisions with explicit reasoning.
Format: "We chose X over Y because Z. This holds as long as [condition]."}

## Failure Modes & Mitigations
{Each failure mode paired with its mitigation or explicit acceptance.}

## Acceptance Scenarios
{YAML scenarios as defined above.}

## Rollback Plan
{How to undo this if it goes wrong. If rollback is impossible, say so explicitly.}

## Open Questions
{Anything unresolved that must be resolved before implementation starts, or explicitly deferred with a reason.
Implementation discoveries go in notes.md, not here.}

## Success Criteria
{Measurable. "It works" is not a criterion.}

## Implementation Steps
{Ordered steps. Each step must be concrete — no placeholders.
Each step produces a testable result.
Forbidden: "implement X", "add logic for Y", "handle edge cases".
Use specific file names, function signatures, and expected behaviors.}
```

### notes.md template

Create as a skeleton only. Do not fill in content.

```markdown
# Implementation Notes: {Title}

Feature: {feature-name}-{YYYY-MM-DD}
Design: ./design.md
Started: {date}
Status: In progress

> design.md records what was planned. notes.md records what actually happened.

---

## Decisions & Deviations

| # | Decision / Deviation | Reasoning | Alternatives rejected |
|---|----------------------|-----------|-----------------------|
| — | *(none yet)* | | |

---

## Discoveries

- *(none yet)*

---

## Open Questions

| # | Question | Status |
|---|----------|--------|
| — | *(none yet)* | Open |

---

## Session Log

### {YYYY-MM-DD}
- Started: {what was begun}
- Completed: {what was finished}
- Blocked on: {anything blocking, or "nothing"}
- Next: {what comes next}
```

## Gotchas

| What happened | Rule |
|---------------|------|
| Moved files to `~/project`, repo was at `~/www/project` | Run `pwd` before the first filesystem operation |
| Asked for API key after 3 implementation steps | List every dependency before handing off |
| User said "just do it" or equivalent approval | Treat as approval of the recommended option. State which option was selected, finish the plan. Do not implement inside `/think`. |
| Planned MCP workflow without checking if MCP was loaded | Verify tool availability before handing off, not mid-implementation |
| Rejected design restarted from scratch | Ask what specifically failed, re-enter with narrowed constraints |
| User said "just fix X" and skipped /think | If the fix touches 3+ files or needs a method choice, pause and run Lightweight Mode |
| User approved a concrete plan and the agent debated the plan again | Execute the approved plan. Only stop for repo drift, missing permissions, or unsafe external state |
| Picked a regional or locale-specific API variant without checking | List all regional or locale differences before writing integration code |
| Introduced a second language or runtime into a single-stack project | Never add a new language or runtime without explicit approval |
| User said "判断一下这个报错" and got Evaluation Mode | "判断一下" + error/bug context = debugging, not Evaluation Mode. Evaluation Mode is for value/existence judgments only |

## Output

**Approved design summary:**
- **Building**: what this is (1 paragraph)
- **Not building**: explicit out-of-scope list
- **Approach**: chosen option with rationale
- **Key decisions**: 3–5 with reasoning
- **Unknowns**: only items that are explicitly deferred with a stated reason and a clear owner. Not vague gaps. If an unknown blocks a decision, loop back before approval.

After the user approves the design, write the spec files (see **Spec Files** section), then stop. Implementation starts only when requested.

## After Approval

When the plan is approved and spec files are written, output:

```
Spec written to specs/<feature-name>-<YYYY-MM-DD>/
  design.md ✅  |  notes.md ✅ (skeleton)

To implement: say "implement this plan".
```

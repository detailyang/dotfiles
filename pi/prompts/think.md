---
description: Structured design workflow — clarify constraints, challenge assumptions, compare options, then produce a design document before writing code. Language mirrors user input (Chinese ↔ English).
argument-hint: "<task-description>"
---

# Think: Clarify First, Design Once

**语言偏好：推理与回答默认使用中文。代码、注释、标识符保持英文。**

Produce a reliable plan for **$@** — if no task is specified above, ask the user to describe it before proceeding. No implementation until the design is approved.

**Hard rules:**
- No code, no scaffolding, no pseudo-code until Phase 3 is approved.
- One question at a time in Phase 1. Never bundle questions.
- No TBD, TODO, or "details to be determined" in the final document. A plan with placeholders is not a plan.
- Give opinions directly. Avoid "you might consider" or "one approach could be". Take a position and state what evidence would change it.

---

## Phase 0: Scope Assessment

Before asking anything, assess the task from the user's description.

| Depth | Characteristics |
|-------|----------------|
| **Lightweight** | Single file, config change, isolated addition. Low ambiguity. |
| **Standard** | Multi-file feature, integration, moderate complexity. |
| **Deep** | New system, cross-cutting change, unfamiliar domain, or high risk. |

State depth in one line: `Depth: Lightweight / Standard / Deep — reason.`

**Auto-escalate** if Phase 1 reveals: external API contract, shared type exported to callers, or irreversible data migration.
- Increase depth to **Deep**
- Require explicit user confirmation before proceeding to Phase 3
- Document the escalation reason in the design document

---

## Phase 1: Targeted Questions

Ask **3–5 questions max**, one at a time. Stop when you have enough to write the document.

Always cover, in this order:

**Q1 — Goal (always ask)**
What outcome does this need to produce? Not the feature — the result the user cares about.
Push back if the answer describes implementation instead of outcome.

**Q2 — Constraints (always ask)**
What cannot change? Existing interfaces, performance requirements, team conventions, deadlines.
A constraint not named here will appear as a blocker mid-implementation.

**Q3 — Existing landscape (ask unless codebase has no relevant source files)**
What already exists that's relevant? Related modules, prior attempts, patterns in use.
If the user mentions files, read them before continuing.
"No relevant source files" means: no code files in the working tree that relate to the task domain.

**Q4 — Failure modes (ask for Standard or Deep)**
What would cause this to fail? Nil input, upstream timeout, partial failure, concurrent writes.
If the user hasn't thought about this, that's the answer — note it as a risk.

**Q5 — Success signal (ask for Deep or when Q1 is ambiguous)**
How will you know this worked? Measurable, not "it feels better".

**Fast-track:** If the user provides a complete plan upfront and depth is Lightweight, skip to Phase 2 directly. For Standard or Deep, still confirm Q2 (Constraints) even if the user provided a plan. Always run assumption challenges and options.

**Task from arguments:** If `$@` is non-empty, treat it as the initial task description. You may still ask clarifying questions in Phase 1, but do not re-ask "what is the goal" — the arguments already establish it. If `$@` is empty, begin Phase 1 from Q1.

---

## Phase 2: Pre-Design Challenges

Before writing anything, challenge three things:

1. **Is this the right problem?** Could a different framing produce a dramatically simpler solution?
2. **What's the cheapest path?** Is there an existing tool, pattern, or 10-line function that gets 80% of the way there?
3. **What's hard to undo?** Schema changes, public API contracts, data migrations — slow down on these.

State challenges explicitly. If all three checks pass cleanly, say so in one sentence and continue.

**Attack the obvious approach:** Before proposing options, ask what would make the most natural solution fail. If the attack holds, start with the hardened version. If it shatters the approach entirely, say so and explain why.

---

## Phase 3: Design Options

Present **2–3 options** with tradeoffs. Always include:
- One **minimal** option: fewest changes, fastest to ship
- One **complete** option: best long-term architecture
- One **lateral** option (optional): unexpected framing, different abstraction

For each option:

```
Option A: [Name]
  Summary:   [1 sentence]
  Effort:    [S / M / L / XL]
  Risk:      [Low / Medium / High]
  For:       [2 strongest reasons]
  Against:   [2 strongest reasons]
  Reuses:    [existing code, patterns, or tools it builds on]
```

**Recommendation:** Choose [X] because [one-line reason].

State what evidence would change this recommendation.

**Do not continue until the user approves an option.**
If rejected: ask what specifically failed, incorporate those constraints, re-enter Phase 3 with a narrowed set. Do not restart from scratch.

---

## Phase 4: Design Document

Once an option is approved, produce the full document and write it to disk.

**Filename:** `design-[feature-name]-[YYYY-MM-DD].md`
- Derive `[feature-name]` from `$@` if arguments were provided; otherwise infer from the approved option name.
- kebab-case only, lowercase, no spaces or special characters (e.g., `auth-service`, `api-gateway`)
**Location:** `<git-root>/spec/` — always use the git repository root (via `git rev-parse --show-toplevel`) and write to its `spec/` subdirectory. Create `spec/` if it does not exist. If not inside a git repo, fall back to current working directory.

---

### Document Template

```markdown
# Design: {Title}

Generated by /think on {date}
Status: Draft

## Problem
{One paragraph. What needs to change and why. Written so a new team member understands it.}

## Out of Scope
{Explicit list of what this design does NOT cover.}

## Constraints
{From Phase 1 Q2. Hard limits that cannot be violated.}

## Assumptions
{Things believed to be true but not verified. Each assumption is a potential blocker.}

## Approach
{The approved option, explained in full. Include data flow, component boundaries, key interfaces.
If more than 3 components exchange data, include an ASCII diagram.}

## Key Decisions
{3–5 decisions with explicit reasoning.
Format: "We chose X over Y because Z. This holds as long as [condition]."}

## Failure Modes & Mitigations
{From Phase 1 Q4. Each failure mode paired with its mitigation or explicit acceptance.}

## Test Coverage
{List: happy path, error branches, edge cases.
Flag any path without a test plan as a gap.}

## Rollback Plan
{How to undo this if it goes wrong. If rollback is impossible, say so explicitly.}

## Open Questions
{Anything unresolved. Each item must be resolved before implementation starts, or explicitly deferred with a reason.}

## Success Criteria
{From Phase 1 Q5. Measurable. "It works" is not a criterion.}

## Implementation Steps
{Ordered steps. Each step must be concrete — no placeholders.
Each step produces a testable result.
Forbidden: "implement X", "add logic for Y", "handle edge cases". Use specific file names, function signatures, and expected behaviors.}
```

---

## Phase 5: Approval Gate

Present the document, then ask:

```
A) Approve — ready for implementation
B) Revise — specify which sections need changes (maps to: Approved with concerns)
C) Restart — return to Phase 1 (maps to: Needs more information)
```

If approved: confirm the file is written and state its path.
If revised: update only the named sections, re-present, repeat gate.
If restart: ask what specifically broke down before resetting.

---

## Gotchas

- **Wrong path assumed.** Always run `git rev-parse --show-toplevel` to locate the git root, then write to `<git-root>/specs/`. Create the directory if missing. If not in a git repo, fall back to `pwd`.
- **Designed around unavailable tools.** If the plan depends on an MCP server, external API, or CLI tool, verify it's reachable before Phase 3.
- **Approved design restarted from scratch on rejection.** Ask what specifically failed. Re-enter Phase 3 with narrowed constraints. Never blank-slate.
- **Placeholders survived into the final document.** Scan before presenting. Any TBD/TODO is a blocker — resolve or explicitly defer with a named owner.
- **Executed when design was requested.** "帮我做", "do it", "just build it" = still run Phase 1–2 fast, then produce the document. Don't skip to code.

---

## Output Summary

At the end of every session:

```
Depth:        [Lightweight / Standard / Deep]
Option:       [Chosen option name]
Document:     [File path]
Open items:   [Count] — [list if any]
Status:       Approved / Approved with concerns / Needs more information
```

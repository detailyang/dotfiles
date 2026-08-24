# ADR Workflow Guide

## Purpose

Treat Architecture Decision Records (ADRs) as executable specifications for coding agents. A human approves the decision; an agent should be able to implement it without relying on undocumented context.

### When to consult or propose an ADR

Before architecture-affecting work, read the decision index and relevant accepted ADRs in `docs/adr/`. Read each relevant ADR fully, including its implementation plan and verification criteria. Do not contradict an accepted ADR silently; propose a superseding ADR instead.

Stop and ask whether to create an ADR before continuing when a change:

- introduces a dependency that is new to the project;
- establishes a reusable architecture, error-handling, data-access, or API pattern;
- chooses among real alternatives with non-obvious tradeoffs;
- changes how the system is built or operated and will be costly to reverse;
- contradicts an accepted ADR; or
- needs a long code comment to preserve the reason behind the choice.

Do not create ADRs for routine work within an established pattern, ordinary bug fixes, typo corrections, linter-enforced style, or decisions already covered by an existing ADR.

When proposing an ADR, state the decision encountered and why it matters, then ask for approval to document it. Do not create one without that approval.

### Creating an ADR

Use all four phases. Do not skip the confirmation gate.

1. **Scan the repository.** Read the index and existing ADRs in `docs/adr/`, relevant manifests and dependencies, affected code patterns, and ADR references in code. Follow the repository's established filename and template conventions.
2. **Capture intent.** Ask focused questions one at a time. Establish the decision, trigger, concrete constraints, measurable success, at least two viable options and their tradeoffs, the current lean, approvers, non-goals, affected paths, migration needs, and verification. Skip facts already established from the repository or conversation.
3. **Confirm before drafting.** Present a concise intent summary containing title, trigger, constraints, options, lean, non-goals, related ADRs/code, affected paths, and verification. Wait for explicit confirmation or correction.
4. **Draft and review.** Write the ADR from confirmed facts, then review it for agent readiness. Report notable strengths, specific gaps, and a recommendation. Fix gaps before finalizing unless the human explicitly accepts them.

Store ADRs in `docs/adr/`. Prefer `YYYY-MM-DD-title-with-dashes.md`, with a lowercase present-tense verb phrase for the slug. New decisions start as `proposed`.

Use YAML front matter:

```yaml
---
status: proposed
date: YYYY-MM-DD
decision-makers: name or team
consulted: optional names
informed: optional names
---
```

Every ADR must be self-contained and include:

- **Context and Problem Statement:** why the decision is needed now, relevant constraints, and enough background for a new contributor.
- **Decision Drivers:** explicit and measurable forces that determine the choice.
- **Considered Options:** at least two real alternatives when alternatives exist.
- **Decision Outcome:** the exact choice and why it best fits the drivers.
- **Consequences:** concrete benefits, costs, risks, and follow-up work.
- **Non-goals:** boundaries that prevent implementation scope creep.
- **Implementation Plan:** affected files/directories, dependencies and versions, patterns to follow and avoid, configuration, migration order, and tests to add or change.
- **Verification:** checkboxes with commands or observable outcomes that prove implementation matches the decision.

Remove unused optional sections and all placeholder text. Constraints must be measurable, decisions must name specific technologies or patterns, and verification items must be executable or directly observable. The implementation plan must be detailed enough for another agent to begin without follow-up questions.

### Lifecycle and linking

Use `proposed`, `accepted`, `rejected`, `deprecated`, or `superseded by [title](link)` statuses. Prefer dated append-only notes over rewriting historical rationale. When superseding a decision, create a new ADR and link both records. Keep the decision index in `docs/adr/README.md` current.

Link decisions in both directions:

- The ADR implementation plan names the code paths and patterns it governs.
- Code adds one lightweight reference such as `ADR: docs/adr/2026-08-24-choose-storage.md` at a relevant entry point when the reason would otherwise be hard to discover.
- Pull requests and implementation tasks reference the governing ADR.

After implementation, run every verification item and record the result in the ADR's `More Information` section with a date. If code and an accepted ADR disagree, report the conflict instead of guessing which is authoritative.

## Source

Adapted from the [Vercel AI ADR skill](https://github.com/vercel/ai/tree/main/skills/adr-skill), revision `9d9a73f1551f2243035491e9de5a2e00ebf9eb17`.

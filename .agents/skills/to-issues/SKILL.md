---
name: to-issues
description: Break a PRD, tech spec, design note, or current plan into a lightweight agent-brief task list under specs/slug/issues.md. Use when the user asks to split work into issues, implementation tasks, tickets, milestones, TODOs, or agent-executable slices.
---

# To Issues

Turn product or technical context into ordered, agent-executable task briefs. This is an ad hoc planning artifact, not an issue tracker or status system.

## Inputs

- Prefer existing `specs/<slug>/product.md`, `specs/<slug>/tech.md`, `README`, architecture notes, and the current conversation.
- Explore code only when task boundaries depend on real exports, callers, shared utilities, or existing conventions.
- If the source context is too thin to define safe task boundaries, stop and ask for the missing product or technical decision.

## Output

Create or update:

```text
specs/<english-kebab-slug>/issues.md
```

Use an English kebab-case slug unless the repo already has a matching spec directory. Match the language of nearby spec files; if there is no precedent, match the user's language.

At the top of `issues.md`, state the source context used, for example `Source: product.md + tech.md` or `Source: current conversation only`.

## Process

1. Gather only the context needed to split the work safely.
2. Identify user-visible behaviors, engineering unlocks, and sequencing constraints.
3. Draft vertical slices that keep the system working after each task.
4. Write each task as a durable brief with scope, non-scope, acceptance criteria, and verification.
5. Preserve recommended order without adding status fields, owners, estimates, or workflow machinery unless requested.
6. Call out unresolved assumptions instead of hiding them inside tasks.

## Splitting discipline

Prefer tasks that:

- deliver one observable behavior or one clear engineering unlock
- can be implemented and reviewed independently
- leave the system working after completion
- include their own verification path
- avoid doing future tasks early
- encode why the behavior matters, not just what file to edit

Infrastructure-only tasks are allowed only when they unlock later work and have their own verification.

Do not split by horizontal layers such as "backend", "frontend", and "tests" unless each layer is independently valuable and verifiable.

## Task format

Read `references/issue-brief.md` before writing tasks.

Use the reference template as the default shape, but omit empty sections when they add no value. Keep each brief concise enough for a fresh agent to execute without the original chat.

## Update rules

- Read existing `issues.md` before editing.
- Do not silently delete existing tasks.
- If tasks change materially, add a brief change note.
- If implementation has started or task status is unclear, ask before rewriting boundaries.
- Do not claim code status, test coverage, or validation that was not observed in the current turn.

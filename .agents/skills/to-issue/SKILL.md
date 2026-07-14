---
name: to-issue
description: Break a product spec, technical spec, design note, or current plan into one or more dependency-aware, agent-executable issue briefs under specs/slug/issues.md. Use when the user asks to split work into issues, implementation tasks, tickets, milestones, TODOs, or independently verifiable slices.
---

# To Issue

Turn product or technical context into dependency-aware issue briefs. Each issue must be a durable, independently verifiable vertical slice that a fresh agent can execute.

## Inputs and output

Prefer `specs/<slug>/product.md`, `tech.md`, `thinking.md`, the current conversation, and relevant repo evidence. If the source is too thin to define safe boundaries, stop for the missing decision.

Write or update:

```text
specs/<english-kebab-slug>/issues.md
```

State the source context at the top. Match the language of nearby spec files or the user.

## Process

1. Gather only the context needed to split the work safely.
2. Explore the code when boundaries depend on real interfaces, callers, shared utilities, tests, or conventions.
3. Draft tracer-bullet issues that deliver a narrow but complete behavior across every required layer.
4. Give every issue an explicit `Blocked by` edge. An issue with no blockers belongs to the initial execution frontier.
5. If materially different granularities or blocking graphs remain plausible, present the numbered breakdown and ask which should win.
6. Otherwise write the evidence-backed breakdown directly and summarize its titles, blockers, and independently verifiable outcomes.
7. Write concise briefs using `references/issue-brief.md`.

## Splitting discipline

Prefer issues that:

- deliver one observable behavior or necessary engineering unlock
- fit in one fresh context window
- leave the system working after completion
- include acceptance criteria and a concrete verification path
- avoid implementing later issues early
- declare only blockers that genuinely gate execution

Do not split horizontally into backend, frontend, and tests unless each part is independently valuable and verifiable.

For a wide mechanical refactor that cannot land green as vertical slices, use expand-contract:

1. Expand by introducing the new form beside the old.
2. Migrate callers in independently verifiable batches, each blocked by expand.
3. Contract by deleting the old form after every migration issue completes.

## Update rules

- Read existing `issues.md` before editing and do not silently delete issues.
- Preserve dependency edges as a directed acyclic graph; reject circular blockers.
- Add a brief change note when boundaries or dependencies change materially.
- If implementation has started or completion state is unclear, ask before rewriting issue boundaries.
- Do not add owners, estimates, labels, or workflow machinery unless requested.
- Hand approved issues to `/ship`; do not implement them here.

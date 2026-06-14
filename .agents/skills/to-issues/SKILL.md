---
name: to-issues
description: Break a PRD, tech spec, or current plan into a lightweight agent-brief task list under specs/<slug>/issues.md. Use when the user asks to split work into issues, tasks, or implementation steps.
---

# To Issues

Turn a spec or plan into an ordered list of implementable task briefs. This is an adhoc task breakdown, not an issue tracker.

## Output

Write or update:

```text
specs/<english-kebab-slug>/issues.md
```

If `specs/<slug>/product.md` or `specs/<slug>/tech.md` exists, read them first. If no PRD exists, use the current conversation and state that source in `issues.md`.

## Process

1. Gather context from PRD/specs/current conversation.
2. Explore code only when needed to choose safe seams or task boundaries.
3. Draft vertical slices, not horizontal layers.
4. Give each task a durable agent brief with scope, non-scope, acceptance criteria, and verification.
5. Preserve a recommended order, but do not create a queue or status machine.
6. If safe splitting is impossible, stop and explain which product/technical decision is missing.

## Splitting discipline

Prefer tasks that:

- have observable behavior or clear engineering unlock value
- can be implemented and reviewed independently
- leave the system working after completion
- include their own verification
- avoid doing future tasks early

Infrastructure-only tasks are allowed only when they unlock later work and have their own verification.

## Reference

Read `references/issue-brief.md` before writing tasks.

## Update rules

- Read existing `issues.md` before editing.
- Do not silently delete existing tasks.
- If tasks change materially, add a brief change note.
- If existing implementation has started, ask before rewriting task boundaries.

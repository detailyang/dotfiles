---
name: to-prd
description: Convert the current context or an existing thinking note into product and technical PRD markdown under specs/<slug>/. Use when the user asks to write, generate, or update a PRD/spec.
---

# To PRD

Produce durable adhoc specs for a concrete need. Do not create workflow queues, issue trackers, labels, or status machines.

## Output

Write or update:

```text
specs/<english-kebab-slug>/product.md
specs/<english-kebab-slug>/tech.md
```

Generate the slug from the topic unless the user provides one. Paths and filenames are always English.

## Process

1. Gather context from the current conversation.
2. If `specs/<slug>/thinking.md` exists or is referenced, read it first.
3. Explore the repo when implementation details or current behavior matter.
4. Identify the seams where the feature can be tested; prefer existing seams and the highest stable interface.
5. Ask only the minimum necessary clarifying question if the PRD would otherwise invent decisions.
6. Write `product.md` and `tech.md` using the references.
7. If updating existing files, preserve still-valid decisions and add a change note.

## Product vs technical split

- `product.md` explains problem, users, goals, non-goals, flows, requirements, and success criteria.
- `tech.md` explains current system understanding, proposed technical approach, interfaces/state/data changes, test strategy, risks, and split guidance.

Do not bury product decisions in `tech.md`; do not put implementation mechanics in `product.md` unless they are user-visible constraints.

## References

Read before writing:

- `references/product.md`
- `references/tech.md`

## Update rules

- Read existing files before editing.
- Preserve useful history and decisions.
- Add `变更记录` / `Change Log` for meaningful updates.
- If PRD changes invalidate `issues.md`, say so; do not silently rewrite issues unless the user asked.
- If specs contradict code, call out the mismatch directly.

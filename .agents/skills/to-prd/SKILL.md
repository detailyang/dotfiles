---
name: to-prd
description: Convert current context, repo findings, or an existing thinking note into durable product and technical PRD markdown under specs/slug/. Use when the user asks to write, generate, update, revise, or turn a plan/thinking note into a PRD, spec, product requirements doc, or technical proposal.
---

# To PRD

Produce durable specs for a concrete need. Keep the output focused on product decisions and implementation guidance; do not create workflow queues, issue trackers, labels, or status machines.

## Principles

- State assumptions and unresolved decisions explicitly; do not invent product or technical choices to make the PRD look complete.
- Prefer the user's language and repo terminology; keep paths, slugs, commands, APIs, and identifiers in English or original form.
- Ground technical claims in local code/docs when behavior, architecture, or feasibility matters.
- Keep the PRD concise enough to guide implementation; avoid tutorial content and speculative flexibility.

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
3. Read existing `product.md` and `tech.md` before updating them.
4. Explore the repo when implementation details, current behavior, or test seams matter.
5. Identify the highest stable seam where the feature can be verified; prefer existing seams.
6. Ask only the minimum necessary clarifying question if the PRD would otherwise invent decisions.
7. Write or update `product.md` and `tech.md` using the references.
8. Add a change note when updating meaningful content.

## Product vs technical split

- `product.md` explains problem, users, goals, non-goals, flows, requirements, and success criteria.
- `tech.md` explains current system understanding, proposed technical approach, interfaces/state/data changes, test strategy, risks, and split guidance.

Do not bury product decisions in `tech.md`; do not put implementation mechanics in `product.md` unless they are user-visible constraints.

## References

Read both references before writing or substantially updating PRD files:

- `references/product.md`
- `references/tech.md`

## Update rules

- Read existing files before editing.
- Preserve useful history and decisions.
- Add `变更记录` / `Change Log` for meaningful updates.
- If PRD changes invalidate `issues.md`, say so; do not silently rewrite issues unless the user asked.
- If specs contradict code, call out the mismatch directly.
- If required context is missing, record the gap under unresolved questions instead of filling it with guesses.

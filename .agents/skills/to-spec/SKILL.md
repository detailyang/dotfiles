---
name: to-spec
description: Convert current context, repo findings, or an existing thinking note into durable product and technical specification markdown under specs/slug/. Use when the user asks to write, generate, update, revise, or turn a plan or discussion into a spec, PRD, product requirements document, or technical proposal.
---

# To Spec

Synthesize a concrete need into durable product and technical specifications. Do not restart the `/grill` interview; use what is already known and ask only when a missing decision would otherwise be invented.

## Output

Write or update:

```text
specs/<english-kebab-slug>/product.md
specs/<english-kebab-slug>/tech.md
```

Generate the slug from the topic unless the user provides one. Keep paths and filenames in English.

## Process

1. Gather decisions from the current conversation and any referenced source.
2. Read `specs/<slug>/thinking.md`, existing spec files, applicable `AGENTS.md`, `CONTEXT.md`, and relevant ADRs.
3. Explore the repo when current behavior, architecture, feasibility, or test seams matter.
4. Identify the highest stable seam that proves the behavior. Prefer existing seams and minimize the number of new seams.
5. If multiple materially different test seams remain plausible, confirm the choice with the user unless it was already confirmed in the supplied context. If one evidence-backed seam is clear, record it and proceed.
6. If a blocking product or technical decision is missing, ask the minimum necessary question. Otherwise synthesize without another interview.
7. Write or update both spec files using the references.
8. Check every requirement against success criteria, testing decisions, non-goals, and unresolved questions.

## Product and technical split

- `product.md` owns the problem, actors, goals, non-goals, flows, requirements, edge cases, and observable success criteria.
- `tech.md` owns current-system evidence, approach, affected interfaces and state, decisions, migration, risks, and test strategy.

Do not bury product choices in `tech.md`. Avoid brittle line references, code snippets, workflow queues, labels, or status machines.

## References

Read both references before writing or substantially updating a spec:

- `references/product.md`
- `references/tech.md`

## Update rules

- Preserve useful history and decisions; add a change note for meaningful revisions.
- State assumptions and unresolved decisions explicitly.
- If the spec contradicts code, report the mismatch instead of smoothing it over.
- If a revision invalidates `issues.md`, say so; do not silently rewrite it.
- Hand executable specifications to `/to-issue`; do not implement them here.

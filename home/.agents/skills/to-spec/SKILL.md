---
name: to-spec
description: Write or revise requested product/technical specifications from established context and repository evidence. Not for open-ended discovery or implementation; preserve existing decisions.
---

# To Spec

Synthesize the known need into product and technical contracts without restarting discovery. Ask only when proceeding would invent a decision that changes observable behavior or architecture ownership.

## Output

Reuse the canonical spec location. Write or update only the requested document(s); use both when the task needs both product and technical contracts. Default paths:

```text
specs/<english-kebab-slug>/product.md
specs/<english-kebab-slug>/tech.md
```

Generate the slug from the topic unless the user supplies one. Keep paths and filenames in English; match document language to the user or nearby files.

## Workflow

1. Gather confirmed decisions, assumptions, and unresolved items from the current context and referenced sources.
2. Read applicable `AGENTS.md`, the selected existing spec and the relevant parts of thinking notes, context or ADRs that constrain this change; do not preload unrelated documents.
3. Inspect the repository when current behavior, feasibility, boundaries, migration, or test seams matter.
4. Select the highest stable existing seam that proves the behavior. Introduce a new seam only when the current system cannot express the contract cleanly.
5. Resolve ordinary design details from evidence. Ask one blocking question only when alternatives materially change product behavior, ownership, compatibility, or risk.
6. Read only the template for the requested output, then write or update it:
   - `references/product.md` for a product contract
   - `references/tech.md` for a technical contract
   For a proposal-only request, return the draft without creating files.
7. Run the quality gate and report any remaining unresolved decision explicitly.

A compact flow, state, or ownership diagram is encouraged when it prevents ambiguous prose.

## Responsibility split

`product.md` owns:

- users and problem
- goals and non-goals
- flows and requirements
- edge cases
- observable success

`tech.md` owns:

- current-system evidence
- proposed architecture and ownership
- interfaces, state, and data changes
- migration, compatibility, rollout, and rollback
- risks and verification strategy
- suggested vertical implementation slices

Do not hide product decisions in `tech.md`, and do not turn `product.md` into a file-by-file patch plan.

## Update rules

- Preserve valid decisions and history; add a concise change note for meaningful revisions.
- State assumptions and unresolved decisions instead of smoothing them over.
- Report contradictions between the requested contract, existing specs, and code.
- Prefer repository vocabulary and stable interfaces over brittle line references.
- If a revision invalidates `issues.md`, state exactly which issue boundaries or acceptance criteria require regeneration; do not silently rewrite it.
- Suggest `/to-issue` only when a task breakdown is useful; do not automatically generate issues or implement the spec.

## Quality gate

Before completion, verify:

- every product requirement has observable success or acceptance
- every relevant edge case has defined user/system behavior
- technical choices trace back to product needs or explicit constraints
- affected interfaces, state ownership, error paths, and migration are covered
- the test strategy names seams and what each check proves
- goals, non-goals, assumptions, and unresolved questions do not contradict each other

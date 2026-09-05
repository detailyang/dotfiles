---
name: grill
description: Clarify or stress-test an engineering/product decision when the user asks to challenge, interrogate or sharpen it. Not for straightforward implementation or ordinary code review.
---

# Grill

Turn ambiguity into evidence-backed decisions without implementing the plan.

## Mode

Use an interactive interview only when the user wants to explore together: ask one
material decision question and wait. For an artifact review or one-pass challenge,
return the strongest objections and a recommendation without non-blocking pauses.

## Process

1. Read applicable instructions and the relevant parts of the supplied artifact.
   Inspect code, callers, tests or accepted decisions only where they settle a fact.
2. Separate facts, assumptions and missing observations. Resolve repository facts
   independently before asking the user.
3. Challenge the earliest decision that changes downstream choices. Examine users
   and success, scope/ownership, state lifecycle, failures/concurrency, migration
   and verification only as relevant; do not run an exhaustive checklist by habit.
4. Use concrete counterexamples and identify evidence that would falsify the
   recommendation. For non-blocking gaps, state a working assumption and continue.

A question should contain the decision, decisive evidence, recommended option and
its main trade-off. Do not expand a simple question into five mandatory headings.
Ask only for choices belonging to the user that materially change the outcome or
make proceeding unsafe.

## Persistence and result

Use repository vocabulary. Write durable notes only when requested or approved;
reuse the canonical location, otherwise `specs/<english-kebab-slug>/thinking.md`.
Preserve prior decisions and unresolved questions. Propose a `CONTEXT.md` update
only for reusable terminology, and an ADR only for a consequential trade-off under
the repository's ADR workflow.

Finish once with the recommendation, strongest risks, confirmed decisions and any
remaining blockers. Do not repeat the same inventory as a second summary or claim
specification readiness while a contract-changing decision remains unresolved.

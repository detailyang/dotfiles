---
name: grill
description: Clarify or stress-test a fuzzy engineering or product decision before specification or implementation. Use when the user asks to grill, challenge, interrogate, sharpen, or think through a plan, feature, trade-off, or architecture. Do not use for a finished spec, straightforward implementation, or ordinary code review.
---

# Grill

Turn ambiguity into explicit, evidence-backed decisions. Explore facts independently; reserve questions for choices that genuinely belong to the user. Do not implement the plan.

## Choose the mode

- **Interactive interview** — use when the user wants to discover the direction together. Ask exactly one decision question at a time and wait for the answer.
- **One-pass stress test** — use when the user supplies an artifact or asks for a review/challenge. Return the strongest objections, decisions, and recommendation in one response. Do not pause for non-blocking questions.

State the chosen mode only when it is not obvious.

## Evidence first

Before asking anything:

1. Read applicable `AGENTS.md`, source documents, existing specs, `CONTEXT.md`, ADRs, relevant interfaces, direct callers, and tests.
2. Separate confirmed facts, assumptions, and missing observations.
3. Resolve repository facts yourself. Do not ask the user for information available locally.
4. Identify the earliest unresolved decision that changes downstream choices.

## Decision order

Cover only branches that materially affect the outcome, usually in this order:

1. users, problem, and observable success
2. scope, non-goals, and ownership
3. state or data lifecycle
4. failure, retry, cancellation, and concurrency
5. compatibility, migration, rollout, and rollback
6. interfaces, test seams, risks, and verification

Use concrete scenarios to expose hidden assumptions. Skip dimensions that do not affect this decision.

## Question contract

Ask only when the answer would change the recommendation or make proceeding unsafe. Every question must include:

```text
Decision: <what must be chosen>
Evidence: <known facts and uncertainty>
Recommendation: <preferred option and why>
Trade-off: <what it gives up>
Question: <one answerable choice>
```

If a decision is not blocking, state the working assumption and continue. Do not turn ordinary implementation details into user decisions.

## One-pass stress-test output

When not interviewing, return:

- current framing and assumptions
- strongest failure paths or counterexamples
- decisions already implied by the artifact
- unresolved decisions, ranked by impact
- recommended direction and rejected alternatives
- verification that would falsify the recommendation

Prefer a small decision tree or flow sketch when it reduces prose.

## Durable documentation

Use the repository's canonical vocabulary.

- Propose a `CONTEXT.md` update when a domain term becomes precise and reusable. Write it only when persistence was requested or approved.
- Propose an ADR only for a hard-to-reverse, surprising decision with a real trade-off. Follow the repository's ADR convention after approval.
- When asked to preserve the broader discussion, create or update `specs/<english-kebab-slug>/thinking.md`, retaining prior decisions and unresolved questions.

## Done

Close with confirmed decisions, assumptions still in force, unresolved blockers, excluded options, risks, and the next appropriate workflow. Do not claim readiness for `/to-spec` while a product or architecture decision that changes the contract remains unresolved.

---
name: grill
description: Relentlessly clarify a fuzzy engineering or product plan one decision at a time while maintaining durable domain language and architectural decisions. Use when the user wants to grill, stress-test, think through, or sharpen a plan, design, feature, trade-off, or architecture choice before writing a spec or code.
---

# Grill

Turn an unclear request into shared understanding before implementation. Explore facts independently, put decisions to the user one at a time, and capture durable language or decisions as they crystallize.

## Interview loop

1. State the current assumptions and any plausible interpretations that would change the recommendation.
2. Explore the repo for facts instead of asking the user. Read applicable `AGENTS.md`, existing specs, `CONTEXT.md`, ADRs, relevant interfaces, callers, and tests.
3. Walk the decision tree in dependency order. Ask exactly one decision question at a time.
4. For every question, give a recommended answer, its reasoning, the trade-off, and what would change the recommendation.
5. Wait for the user's answer before continuing. Decisions belong to the user.

Do not write implementation code or start the work until the user confirms shared understanding.

## Coverage

Resolve only branches that materially affect the outcome:

- goal, actors, and observable success
- non-goals and ownership boundaries
- state or data lifecycle
- failure, retry, cancellation, and concurrency behavior
- compatibility, migration, rollout, and rollback
- module interfaces and the highest useful test seam
- risks and verification

Use concrete scenarios to expose hidden assumptions. Stop when the goal, constraints, main decisions, risks, and verification path are clear enough for `/to-spec`.

## Durable documentation

Use the repo's canonical vocabulary. If the user's wording conflicts with `CONTEXT.md` or code, surface the contradiction immediately.

- When a domain term becomes precise and reusable, propose the exact `CONTEXT.md` change. Write it only when the user asked to persist decisions or explicitly approves. Keep implementation details out of the glossary.
- Propose an ADR only when the decision is hard to reverse, surprising without context, and the result of a real trade-off. After explicit approval, create or update it using the repository's ADR convention.
- If the user asks to save the broader discussion, create or append `specs/<english-kebab-slug>/thinking.md`; preserve prior decisions and unresolved questions.

## Close

Summarize confirmed decisions, unresolved questions, excluded options, risks, and the recommended next action. Do not claim readiness for `/to-spec` while a blocking decision remains.

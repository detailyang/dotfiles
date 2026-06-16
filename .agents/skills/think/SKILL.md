---
name: think
description: Shape fuzzy engineering or product ideas into clear context through a one-question-at-a-time grilling loop. Use when the user wants to think through a plan, design, feature, trade-off, architecture choice, product ambiguity, or ambiguous implementation request before writing specs or code.
---

# Think

Turn an unclear request into shared understanding. This is an adhoc design tool, not a project-management workflow or PRD generator.

## What to do

Interview the user relentlessly about the plan until there is shared understanding. Walk the design tree one branch at a time. Resolve dependencies between decisions in order.

Start by stating your current assumptions and any ambiguity that could change the recommendation. If the request has multiple plausible meanings, list them before choosing a branch.

Rules:

- Ask exactly one question at a time.
- For every question, provide your provisional recommended answer, reasoning, and what would change your mind.
- Wait for the user's answer before moving to the next branch.
- If a question can be answered by exploring the repo, explore instead of asking.
- If code/docs contradict the user's claim, surface the contradiction directly.
- Do not turn the conversation into a PRD unless the user asks for `/to-prd` or asks to save specs.
- Stop grilling when the goal, non-goals, constraints, success criteria, main risks, and verification path are clear enough to act.

## Explore before asking

When relevant, inspect:

- `AGENTS.md` and nested repo instructions
- README, docs, specs, ADRs, glossary, and context files
- exports, direct callers, shared utilities, tests, and existing style
- domain terms already used in code and docs

Use the repo's existing vocabulary. If the user introduces a term that conflicts with existing language, ask which meaning should win.

Do not scan broad areas or read unrelated files just to be thorough. Prefer the smallest evidence that can answer the current branch.

## Sharpen language

Call out vague or overloaded terms. Propose precise canonical wording.

Examples of branches to resolve:

- goal vs non-goal
- actor and workflow
- ownership boundary
- data/state lifecycle
- failure and recovery behavior
- compatibility and migration constraints
- test seam and verification strategy
- rollout risk and rollback path
- whether the work should become specs or stay conversational

Avoid broad questions like "what do you want?". Ask questions that force a concrete trade-off.

Good question shape:

```text
Assumption: <what I currently believe>
Trade-off: <option A> vs <option B>
Recommendation: <provisional answer and why>
Question: <one concrete decision for the user>
```

## Concrete scenarios

Stress-test fuzzy ideas with specific scenarios:

- normal path
- boundary input
- missing/invalid state
- retry or partial failure
- concurrent or repeated action
- old data meeting new code
- user cancels, refreshes, or resumes

Use scenarios to expose hidden assumptions.

## Summarize decisions

When enough branches are resolved, summarize:

- current conclusion
- confirmed decisions
- remaining open questions
- excluded options
- risks and blind spots
- next concrete action

Do not keep asking questions after the next action is obvious.

## Context and decision capture

By default, only chat. If the user asks to save, record, persist, continue a spec, or create specs, write or update:

```text
specs/<english-kebab-slug>/thinking.md
```

Suggested shape:

```markdown
# Thinking: <title>

## 当前结论

## 已确认决策

## 未决问题

## 被排除方案

## 风险与盲点

## 对话记录
```

Append new rounds; do not erase useful history.

## ADR and glossary discipline

If the repo already has ADR or context/glossary files, respect them. Treat context/glossary files as domain vocabulary, not specs or scratchpads. Only suggest adding or updating durable docs when the decision is:

1. hard to reverse,
2. surprising without context,
3. the result of a real trade-off.

Do not create durable docs for every small decision.

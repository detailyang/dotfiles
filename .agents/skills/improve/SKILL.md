---
name: improve
description: Analyze and improve codebase architecture or maintainability. Use when the user asks to improve, refactor, simplify, deepen, decouple, or review architecture.
---

# Improve

Find maintainability improvements and, when the user selects them, apply focused changes.

## Process

1. Explore the relevant code, callers, tests, docs, and domain language.
2. Build a map of modules, interfaces, seams, dependencies, and ownership boundaries.
3. List improvement candidates with impact, risk, confidence, and suggested order.
4. Ask the user which candidates to apply.
5. If the user says to apply all, proceed in the recommended order.
6. For each selected improvement, make the smallest coherent change and verify it independently.

Do not silently apply all candidates unless the user explicitly asked for that.

## Candidate types

Look for:

- duplicated behavior
- high coupling
- hidden mutable state
- unclear ownership boundaries
- shallow wrappers
- hard-to-test interfaces
- over-designed abstractions
- feature envy
- primitive obsession
- error paths without clear semantics
- dependencies crossing the wrong seam

## Candidate report

For each candidate, include:

- title
- problem
- evidence from code/docs
- recommended change
- expected benefit
- risk
- verification strategy
- whether behavior changes

Prefer a small number of high-signal candidates over a huge generic list.

## Editing rules

- Do not mix unrelated improvements in one change.
- Do not reformat unrelated files.
- Behavior changes must follow `/doit` TDD rules.
- Behavior-preserving refactors still require verification.
- Stop if the selected improvement expands beyond the agreed scope.
- If multiple candidates conflict, resolve order with the user.

## References

Use as needed:

- `references/deepening.md`
- `references/interface-design.md`

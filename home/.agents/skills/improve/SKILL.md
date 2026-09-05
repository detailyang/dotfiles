---
name: improve
description: Audit or apply maintainability improvements when asked to simplify, refactor, clarify boundaries or reduce technical debt. Not for a narrow feature/bug fix or read-only review without structural scope.
---

# Improve

Find the smallest high-leverage maintainability changes, explain their trade-offs, and apply them when the user requested edits.

## Select the mode

- **Audit mode** — for “review”, “analyze”, or “find improvements”. Report evidence-backed candidates without editing.
- **Apply mode** — for “improve”, “optimize”, “refactor”, or an explicit request to modify the repository. Apply the highest-confidence in-scope candidates autonomously.

Ask before editing only when competing options materially change public behavior, architecture ownership, migration cost, or blast radius. Otherwise state assumptions and proceed.

## Workflow

1. Read applicable `AGENTS.md` and define the requested boundary and observable success.
2. Inspect relevant exports, direct callers, tests, docs, state ownership, and existing vocabulary.
3. Map dependencies and the highest stable verification seam.
4. Identify only candidates supported by concrete evidence.
5. Rank candidates by expected maintainability gain, verification cost, confidence, and blast radius.
6. In audit mode, report up to five substantial findings; do not invent findings to meet a quota. In apply mode, make each selected change as a separate coherent step and verify it before continuing.
7. Review the final diff for behavior drift and unrelated cleanup.

Prefer a shallow dependency, ownership, or before/after tree when it makes the recommendation clearer.

## Candidate quality bar

Useful candidates include:

- duplicated policy or behavior
- unclear ownership or dependency direction
- hidden mutable state
- shallow wrappers that leak sequencing
- hard-to-test interfaces
- primitive obsession or repeated parsing/validation
- error paths with ambiguous semantics
- over-designed abstractions or speculative generality

Do not report generic style preferences, deterministic lint findings, or pre-existing issues outside the requested boundary.

For each reported candidate include the following information only where it changes the decision; combine fields rather than forcing separate headings:

- problem and concrete evidence
- recommended change
- expected benefit
- behavior impact
- risk and confidence
- verification strategy
- ordering or dependency on other candidates

Read `references/deepening.md` when moving complexity behind a smaller interface. Read `references/interface-design.md` when comparing interface shapes.

## Editing rules

- Keep every changed line traceable to the request.
- Do not mix unrelated improvements, broad renames, reformatting, or cleanup.
- Preserve project vocabulary unless it is actively misleading.
- Do not introduce a seam for a hypothetical future caller; require at least two concrete policies, callers, or adapters unless an external boundary already justifies it.
- Treat any behavior change or bug fix as implementation work and use the repository's behavior-change discipline.
- Preserve unrelated user changes. Stop only when an overlapping change cannot be separated safely.

## Verification

Start at the narrowest existing public seam that proves the boundary. Run focused tests or type checks after each coherent change, then the smallest broader check that catches integration drift.

When no automated seam exists, use the strongest deterministic alternative available and state the remaining gap. Never claim a command passed unless it ran in the current work.

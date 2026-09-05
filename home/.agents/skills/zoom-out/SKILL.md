---
name: zoom-out
description: Explain how an unfamiliar code area fits together by tracing ownership, callers, flow and test seams. Use for subsystem orientation, not implementation or broad refactoring.
---

# Zoom Out

Orient the user in an unfamiliar subsystem without changing code. Prefer a compact evidence-backed map over a file-by-file tour.

## Process

1. Read applicable `AGENTS.md`.
2. Start from the requested file, symbol, route, command, or concept.
3. Trace direct callers and callees until ownership and the public boundary are clear.
4. Inspect neighboring modules, state/data ownership, external adapters, and tests.
5. Read relevant README, specs, ADRs, glossary, or context documents.
6. Separate confirmed structure from inference and missing observation.

Stop tracing when another layer would not change the user's decision or next action.

## Visual first when useful

Choose the smallest representation that clarifies the shape:

```text
entry point
  -> orchestration
    -> domain policy
      -> adapter / persistence
```

Use a shallow file tree for responsibility, a call tree for control flow, or Mermaid only when multiple participants or state transitions would be hard to follow in text. Include only relevant nodes and real repository names.

## Output

Return one compact map with supporting explanation. Select only the relevant dimensions below; they are not nine mandatory output sections:

- **Purpose** — what the area owns and why it exists
- **Map** — main modules/concepts grouped by responsibility
- **Flow** — how control, data, or state moves
- **Boundaries** — UI/API, persistence, external systems, and adapters
- **Callers** — who depends on the behavior
- **Verification seams** — where current behavior is protected
- **Vocabulary** — local meanings of overloaded or important terms
- **Risk / uncertainty** — evidence gaps that matter before editing
- **Next action** — the smallest useful inspection or change, when relevant

Cite paths, symbols, tests, or docs for non-obvious claims.

## Rules

- Repository evidence outranks generic architecture expectations.
- Do not invent paths, ownership, or runtime flow.
- Do not drown the map in line-level detail.
- Do not propose a broad refactor unless the user explicitly asks for improvement analysis.
- If a term is overloaded, explain the repository-local meaning.
- Mark confidence only where uncertainty affects the conclusion.

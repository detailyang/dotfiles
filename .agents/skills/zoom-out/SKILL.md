---
name: zoom-out
description: Give a higher-level map of an unfamiliar code area, including relevant modules, callers, boundaries, and domain vocabulary. Use when the user asks to zoom out, understand how code fits together, or get broader context before changing code.
---

# Zoom Out

Help the user understand an unfamiliar area of code by moving one layer up in abstraction.

Do not start changing code. This skill is for orientation and system mapping.

## Process

1. Read applicable `AGENTS.md` instructions.
2. Inspect the requested file, module, route, command, or concept.
3. Trace direct callers and callees.
4. Identify the neighboring modules and ownership boundaries.
5. Check README/docs/specs/ADR/glossary/context files when present.
6. Explain the area using the repo's existing domain vocabulary.

## Output

Give a compact map:

- **What this area is for** — one or two sentences.
- **Main modules / concepts** — grouped by responsibility.
- **Call flow** — how control/data moves through the area.
- **Boundaries** — external systems, adapters, persistence, UI/API edges.
- **Important callers** — who depends on this behavior.
- **Tests / verification seams** — where behavior is currently protected.
- **Risks / unclear parts** — what should be checked before editing.
- **Suggested next step** — what to inspect or change next, if relevant.

## Rules

- Prefer repo facts over guesses.
- If the map is uncertain, mark the uncertainty explicitly.
- Do not over-focus on line-by-line details; the point is structure.
- Do not propose large refactors unless the user asks for `/improve`.
- If a term is overloaded, call it out and explain the local meaning.

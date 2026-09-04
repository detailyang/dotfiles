---
name: to-issue
description: Split an approved product/technical spec or design into dependency-aware, agent-executable issue briefs under specs/<slug>/issues.md. Use when the user asks for implementation issues, tasks, tickets, milestones, TODOs, or independently verifiable slices. Do not use for brainstorming, writing the source spec, or implementing the resulting issues.
---

# To Issue

Turn durable product and technical context into a dependency graph of independently verifiable vertical slices. A fresh agent should be able to execute each issue without the original chat.

## Inputs and output

Prefer `specs/<slug>/product.md`, `tech.md`, `thinking.md`, existing `issues.md`, the current conversation, and relevant repository evidence.

Write or update:

```text
specs/<english-kebab-slug>/issues.md
```

Match the language of nearby spec files or the user. Record the source documents and their precedence at the top.

If context is incomplete but a safe split is still possible, state assumptions and proceed. Ask only when a missing product/architecture decision changes issue boundaries or acceptance.

## Workflow

1. Read applicable instructions, source specs, existing issues, and implementation state.
2. Inspect code where real interfaces, callers, tests, or migration constraints determine boundaries.
3. Map requirements to narrow tracer-bullet outcomes.
4. Give every issue an explicit `Blocked by` edge; `None` means it belongs to the initial frontier.
5. Write or update the briefs using `references/issue-brief.md`.
6. Validate requirement coverage, acceptance, and the dependency graph before finishing.

Choose the evidence-backed granularity yourself. Present alternatives only when they imply materially different contracts, rollout paths, or ownership.

## Splitting discipline

Prefer issues that:

- deliver one observable behavior or necessary engineering unlock
- fit in one fresh context window
- leave the system working after completion
- include binary acceptance and a concrete verification path
- avoid implementing later issues early
- declare only blockers that genuinely gate execution

Do not split horizontally into “backend”, “frontend”, and “tests” unless each slice is independently useful and verifiable.

For a mechanical migration that cannot stay green as vertical slices, use expand-contract:

```text
expand new form beside old
  -> migrate callers in verified batches
  -> contract old form after every migration completes
```

## Update safety

- Read existing `issues.md` before editing; never silently delete or renumber active work.
- Preserve completed issues and evidence.
- When implementation has started, prefer additive or compatibility-preserving edits. Ask before a destructive boundary rewrite that would invalidate completed or in-progress work.
- Keep blocker edges acyclic.
- Add a concise change note when boundaries, acceptance, or dependencies change materially.
- Do not add owners, estimates, labels, or workflow machinery unless requested.
- Hand executable issues to `/ship`; do not implement them here.

## Quality gate

Before reporting completion, verify:

- every source requirement maps to an issue or explicit out-of-scope note
- at least one initial issue has no blockers unless the whole plan is externally blocked
- every blocker refers to an existing issue and the graph is acyclic
- each issue has current behavior/context, desired outcome, scope, non-goals, binary acceptance, and verification
- no issue depends on the original conversation to understand a key decision

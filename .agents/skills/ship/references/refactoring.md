# Refactoring Discipline

Refactor after green, not instead of green.

## Good candidates

- duplication introduced or exposed by the task
- long method made harder to understand by the change
- shallow wrapper that now adds no value
- feature envy: logic belongs closer to the data it uses
- primitive obsession that causes repeated validation/parsing
- hidden state that blocks reliable tests
- interface leak that forces callers to know internal sequencing

## Rules

- Keep behavior unchanged during refactor steps.
- Keep tests on public interfaces.
- Do not broaden scope to unrelated cleanup.
- Do not reformat unrelated files.
- Do not introduce abstractions for hypothetical future features.
- If a refactor reveals behavior change is needed, stop and treat it as a new behavior task.

## Deep modules

Prefer deep modules: small interface, meaningful internal capability.

Avoid shallow modules: wide interface, thin pass-through implementation.

Ask:

- Can the interface be smaller?
- Can complexity move behind the boundary?
- Can callers stop knowing internal order/state?
- Can tests verify behavior through the boundary?

# Deepening

How to deepen a cluster of shallow modules safely, given its dependencies. Assumes the vocabulary in [LANGUAGE.md](LANGUAGE.md) — **module**, **interface**, **seam**, **adapter**.

## Dependency categories

When assessing a candidate, classify dependencies only where this changes how its behavior can be verified. A category is not permission to merge modules or introduce a port.

### 1. In-process

Pure computation or in-memory state with no I/O. Test directly through the relevant interface. Merge modules only when doing so removes observed coupling or duplicated knowledge.

### 2. Local-substitutable

Dependencies with local test stand-ins, such as a test database or in-memory filesystem. Reuse a stand-in only when it preserves the semantics under test; differences in transactions, concurrency or failure behavior may require integration checks.

### 3. Remote but owned (Ports & Adapters)

Your own services across a network boundary. Separate transport from policy where it reduces concrete coupling. A port can make production transport and a test substitute explicit, but an existing client may already provide the needed boundary. Keep integration coverage for network and service semantics a substitute cannot prove.

### 4. True external (Mock)

Third-party services you do not control. Reuse an existing client or injectable dependency when it already isolates the required behavior. Introduce a port only for a concrete contract or verification need; use mocks or fakes at that external boundary.

## Seam discipline

- **Require a present need, not an adapter quota.** Current behavior, ownership, a real external boundary or a meaningful verification requirement can justify a seam with one production adapter. Additional adapters alone do not justify one.
- **Internal seams vs external seams.** A deep module can have internal seams (private to its implementation, used by its own tests) as well as the external seam at its interface. Don't expose internal seams through the interface just because tests use them.

## Preserve coverage while moving tests

- Map existing behavior, boundary and error assertions to retained or replacement tests before removing old tests. New interface tests merely existing is not proof of equivalent coverage.
- Run the mapped checks; keep old tests when they still protect a distinct invariant or failure path. Delete only tests proved redundant or tied to intentionally removed behavior.
- Prefer observable outcomes through stable interfaces. A focused unit or property test can remain useful alongside broader interface tests.
- Review test changes for weakened assertions, lost failure cases and accidental dependence on the new implementation.

# Deepening

Deepening means moving real complexity behind a smaller, more useful interface.

## Dependency categories

Classify dependencies when it changes the verification strategy. The category does not by itself justify merging modules or introducing a port.

### 1. In-process

Pure computation or in-memory state with no I/O. Usually safe to deepen. Test directly through the new interface.

### 2. Local-substitutable

Dependencies with local test stand-ins, such as in-memory filesystem or test database. Deepen if the substitute is reliable and cheap enough for tests.

### 3. Remote but owned

Services you own across a network boundary. Keep transport separate from domain policy where callers or tests need that distinction; introduce a port only when it reduces concrete coupling.

### 4. True external

Third-party services you do not control. Reuse an existing client or injectable dependency when it already provides the needed boundary; add a port only for a concrete contract or verification need. Tests can use mocks or fakes at that external boundary.

## Seam discipline

- Require a current behavior, ownership, external-boundary, or verification need; do not use adapter counts as an architecture rule.
- Do not expose internal seams just because tests want them.
- The interface is the test surface.
- Before removing old tests, map their behavior, boundary and error assertions to retained or replacement tests and run those checks. Delete only tests proved redundant or tied to intentionally removed behavior.
- Tests should assert observable outcomes, not internal state.

## Smells

- interface almost as wide as implementation
- callers know internal sequencing
- pass-through modules with no policy
- repeated parsing/validation in callers
- dependency setup copied across tests
- mocks needed for modules you own

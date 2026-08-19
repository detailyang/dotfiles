# Deepening

Deepening means moving real complexity behind a smaller, more useful interface.

## Dependency categories

Classify dependencies before recommending a refactor. The category determines how the new seam can be tested.

### 1. In-process

Pure computation or in-memory state with no I/O. Usually safe to deepen. Test directly through the new interface.

### 2. Local-substitutable

Dependencies with local test stand-ins, such as in-memory filesystem or test database. Deepen if the substitute is reliable and cheap enough for tests.

### 3. Remote but owned

Services you own across a network boundary. Define a port at the seam. Keep logic in the deep module; inject transport adapters for production and test.

### 4. True external

Third-party services you do not control. Isolate them behind injected boundaries. Tests use mocks or fakes at that external seam.

## Seam discipline

- One adapter is usually hypothetical indirection; two justified adapters make a real seam.
- Do not expose internal seams just because tests want them.
- The interface is the test surface.
- Replace shallow-module tests with tests at the deepened module interface when safe.
- Tests should assert observable outcomes, not internal state.

## Smells

- interface almost as wide as implementation
- callers know internal sequencing
- pass-through modules with no policy
- repeated parsing/validation in callers
- dependency setup copied across tests
- mocks needed for modules you own

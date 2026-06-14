# Testing Guidance

Good tests fail when important behavior breaks and survive internal refactors.

## Good tests

Prefer tests that:

- assert observable behavior through public interfaces
- describe what the system should do, not how it does it
- encode why the behavior matters
- cover meaningful boundary and error paths
- use existing fixtures/helpers/conventions
- avoid fragile line/order/call-count assertions unless that is the behavior

Examples of good seams:

- API request/response
- CLI input/output and exit code
- UI behavior visible to the user
- domain service public method
- persisted state retrieved through the normal read path

## Bad tests

Red flags:

- mocking internal collaborators you own
- testing private methods directly
- asserting implementation call order instead of result
- reading database rows directly when a public read path exists
- changing tests for every internal refactor
- one test asserting many unrelated behaviors

## Mocking

Mock at system boundaries only:

- third-party APIs
- time/randomness
- network boundaries
- filesystem when real files are too costly or unsafe
- database only when no cheap test database/fixture exists

Do not mock your own internal modules just because it is convenient. If internal collaborators are hard to use in tests, consider improving the seam.

## Interface design for testability

Prefer interfaces that:

- accept dependencies instead of constructing them internally
- return results instead of only mutating hidden state
- expose a small surface area
- make invalid states hard to represent
- keep external I/O behind explicit boundaries

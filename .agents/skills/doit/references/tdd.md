# TDD Discipline

TDD is required for behavior changes.

## Philosophy

The test is not paperwork. It is the feedback loop that defines the behavior and protects the design while code changes.

Good TDD does not mean testing private helpers. It means finding the highest stable seam where the desired behavior is observable.

## Workflow

### 1. Plan the seam

Before writing the test, decide:

- what behavior matters
- which public interface exposes it
- what input triggers it
- what output/state/error proves it
- what existing helper or fixture should be reused

### 2. Red

Write the smallest failing test. The failure should be specific to the missing behavior.

Bad red: test fails because setup is broken.
Good red: test fails because the expected behavior is absent.

### 3. Green

Make the smallest implementation change that passes the test. Avoid speculative generalization.

### 4. Refactor

Only after green:

- remove duplication introduced by the change
- improve names in touched code when necessary
- deepen a shallow boundary if the new behavior exposes it
- keep tests green after each refactor

## Per-cycle checklist

- [ ] The test fails for the right reason.
- [ ] The implementation is the minimum needed.
- [ ] The test passes.
- [ ] Related tests still pass.
- [ ] Refactoring, if any, is behavior-preserving.

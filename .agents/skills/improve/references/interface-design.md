# Interface Design

Good interfaces reduce caller knowledge and make testing natural.

## Process

1. Frame the caller's actual need.
2. List current responsibilities and leaks.
3. Identify which dependencies are in-process, substitutable, owned remote, or true external.
4. Compare 2-3 interface shapes when the answer is not obvious.
5. Prefer the shape with the smallest useful surface and clearest behavior.
6. Preserve existing project vocabulary unless it is actively misleading.

## Principles

- Accept dependencies instead of constructing them internally.
- Return results instead of only mutating hidden state.
- Keep the surface area small.
- Hide sequencing and policy inside the module.
- Make invalid usage harder.
- Put external I/O behind explicit boundaries.
- Prefer SDK-style specific operations over generic fetch/do-everything functions.

## Language discipline

When naming concepts:

- use terms already present in domain docs/code
- define overloaded words before using them in an interface
- record rejected framings when they would otherwise keep returning
- avoid renaming just for taste

## Comparison format

For each option:

- interface shape
- what complexity it hides
- what callers still need to know
- test strategy
- migration risk
- why accept/reject it

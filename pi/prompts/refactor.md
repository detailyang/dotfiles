---
name: refactor
description: "Safe code refactoring workflow with test guarantees. Covers the full cycle: ensure tests → mutation test → checkpoint → refactor."
---

# Refactor

**The golden rule: without tests, you're not refactoring — you're editing dangerously.**

---

## Workflow

```
1. GREEN    → All tests pass
2. MUTATE   → Run mutation testing to verify test strength
3. KILL     → Strengthen tests for surviving mutants
4. CHECKPOINT → Save or record working state ← critical safety net
5. REFACTOR → Improve structure in small steps
6. CHECKPOINT → Save or record refactored state separately
```

Never mix refactoring changes with feature changes. Do not create commits unless the user explicitly asks.

---

## Mutation Testing

A passing suite doesn't mean it catches bugs. Mutation tools (Stryker, Mutmut, PIT) introduce small bugs — flipping `>` to `>=`, deleting a return — and check if tests catch them.

| Score | Action |
|-------|--------|
| > 80% | Safe to refactor |
| 60–80% | Strengthen critical paths first |
| < 60% | Write more tests before refactoring |

Kill surviving mutants by adding boundary tests before any refactoring.

---

## When NOT to Refactor

- ❌ No tests, or mutation score < 60%
- ❌ Would change behavior — that's a feature, not a refactor
- ❌ No clear purpose ("just because")
- ❌ Purely for testability — extract for readability or DRY, not isolation
- ❌ Speculative code — if no test demands it, don't write it

---

## Priority

| Priority | Examples |
|----------|----------|
| Critical | Surviving mutants, knowledge duplication, > 3 levels nesting |
| High | Magic numbers, unclear names, functions > 50 lines |
| Nice | Minor naming, single-use helpers |
| Skip | Already clean, well-tested code |

---

## Common Code Smells

**Long Function** — extract focused functions. One function should do one thing; orchestrate at the top level.

**Duplicated Knowledge** — DRY on concepts, not structure. Two places encoding the same business rule is one too many.

**Magic Numbers** — replace unexplained literals with named constants.

**Nested Conditionals** — use guard clauses (early returns) to flatten arrow code.

**God Class** — split by responsibility. If a class has methods belonging to 3 different concerns, it's 3 classes.

**Feature Envy** — move logic to the data it operates on. If class A reaches into class B's internals, the logic belongs in B.

---

## Quick Reference

| Operation | When to use |
|-----------|-------------|
| Extract Method | Fragment reused or > 10 lines |
| Extract Class | Methods sharing state belong together |
| Introduce Parameter Object | 4+ related params |
| Replace Magic Number with Constant | Any unexplained literal |
| Replace Nested Conditional with Guard Clauses | > 2 levels deep |
| Replace Conditional with Polymorphism | switch/if on a type field |
| Replace Inheritance with Delegation | Composition fits better |
| Rename | Anytime the name lies or confuses |

---

## Checklist

**Before refactoring:**
- [ ] All tests pass
- [ ] Mutation score > 80%; surviving mutants killed
- [ ] Working state saved, recorded, or explicitly acknowledged

**After refactoring:**
- [ ] All tests still pass without modification
- [ ] No behavior changed, no speculative code added
- [ ] Refactoring changes kept separate from feature work

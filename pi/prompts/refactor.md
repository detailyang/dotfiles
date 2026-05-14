---
description: "Safe code refactoring workflow with test guarantees. Covers the full cycle: ensure tests → mutation test → commit → refactor. Includes common code smells and fixes."
---

# Refactor

**The golden rule: without tests, you're not refactoring — you're editing dangerously.**

---

## Workflow

```
1. GREEN    → All tests pass
2. MUTATE   → Run mutation testing to verify test strength
3. KILL     → Strengthen tests for surviving mutants
4. COMMIT   → Save working code ← critical safety net
5. REFACTOR → Improve structure in small steps
6. COMMIT   → Save refactored code separately
```

Never mix refactoring commits with feature commits.

```
refactor: extract order pricing into separate function
refactor: replace magic numbers with named constants
```

---

## Mutation Testing

A passing test suite doesn't mean it catches bugs. Mutation tools (Stryker, Mutmut, PIT) introduce small bugs — flipping `>` to `>=`, deleting a return — then check if your tests catch them.

| Score | Action |
|-------|--------|
| > 80% | Safe to refactor |
| 60–80% | Strengthen critical paths first |
| < 60% | Write more tests before refactoring |

**Fix surviving mutants before refactoring:**
```typescript
// Tool changed `> 50` to `>= 50` and tests didn't notice → add boundary tests
it('applies free shipping at exactly 50', () => expect(shipping({ total: 50 })).toBe(0));
it('charges shipping below 50',           () => expect(shipping({ total: 49.99 })).toBe(5.99));
```

---

## When NOT to Refactor

- ❌ No tests — write them first
- ❌ Weak tests (low mutation score) — strengthen first
- ❌ Would change behavior — that's a feature
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

### Long Function — extract focused functions
```typescript
// ❌ one 200-line function doing everything
async function processOrder(orderId) { /* fetch, validate, price, ship, notify */ }

// ✅ orchestrate focused functions
async function processOrder(orderId) {
  const order = await fetchOrder(orderId);
  validateOrder(order);
  const pricing = calculatePricing(order);
  await updateInventory(order);
  await sendNotifications(order, pricing, await createShipment(order));
}
```

### Duplicated Knowledge — DRY on concepts, not structure
```typescript
// ❌ same business rule in two places
function userDiscount(user)   { if (user.membership === 'gold') return user.total * 0.2; ... }
function orderDiscount(order) { if (order.user.membership === 'gold') return order.total * 0.2; ... }

// ✅ extract the shared rule
const RATES = { gold: 0.2, silver: 0.1 };
const discountRate = (membership) => RATES[membership] || 0;
```

### Magic Numbers — name your constants
```typescript
// ❌
if (user.status === 2) { ... }
setTimeout(fn, 86400000);

// ✅
const UserStatus = { INACTIVE: 2 } as const;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
```

### Nested Conditionals — guard clauses
```typescript
// ❌ arrow code
function process(order) {
  if (order) { if (order.user) { if (order.user.isActive) { ... } } }
}

// ✅ early returns
function process(order) {
  if (!order)               return { error: 'No order' };
  if (!order.user)          return { error: 'No user' };
  if (!order.user.isActive) return { error: 'User inactive' };
  return processOrder(order);
}
```

### God Class — split by responsibility
```typescript
// ❌ UserManager with 50 methods (email, reports, payments, ...)

// ✅
class UserService    { create(data) {} update(id, data) {} }
class EmailService   { send(to, subject, body) {} }
class PaymentService { process(amount, method) {} }
```

### Feature Envy — move logic to the data owner
```typescript
// ❌ Order reaching into User's internals
class Order { discount(user) { if (user.membershipLevel === 'gold') ... } }

// ✅
class User  { discountRate() { return this.membershipLevel === 'gold' ? 0.2 : 0; } }
class Order { discount(user) { return this.total * user.discountRate(); } }
```

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

**Before:**
- [ ] Tests pass; mutation score > 80%; surviving mutants killed
- [ ] Working state committed

**After:**
- [ ] All tests still pass without modification
- [ ] No behavior changed, no speculative code added
- [ ] Committed separately from feature work

# Lightweight Issue Brief

Each task in `issues.md` should be durable enough for an agent to execute after the chat context is gone.

## Template

```markdown
## 1. <task title>

类别：bug / enhancement / refactor / docs

摘要：one-line summary

Blocked by：issue numbers/titles, or `None — can start immediately`

当前行为：

期望行为：

关键接口 / 区域：
- `TypeOrInterface` — why it matters
- module or boundary — expected contract

范围：

不做：

验收标准：
- [ ] Specific, testable criterion
- [ ] Specific, testable criterion

验证方式：
- command/test/manual check and expected result

备注：
```

## Principles

### Durable over precise-to-today

Describe interfaces, types, behavior, and contracts. Avoid stale line numbers. File paths are allowed when helpful in a local adhoc spec, but do not make the task depend on exact line locations.

### Behavioral, not procedural

Describe what should be true after the work, not a step-by-step patch plan. The implementing agent should inspect the code fresh.

### Complete acceptance criteria

Every task needs concrete, independently verifiable criteria. "Works correctly" is not enough.

### Explicit scope boundaries

State what is out of scope. This prevents gold-plating, unrelated refactors, and accidentally implementing later tasks.

## Good task qualities

- one focused behavior or refactor goal
- clear reason why the task matters
- enough context to execute without the original chat
- verification path included
- recommended order if sequencing matters
- explicit blocking edges that form an acyclic dependency graph

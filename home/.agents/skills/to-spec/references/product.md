# Product Spec

`product.md` explains the user-facing problem and desired behavior. It should be understandable without reading code.

## Template

```markdown
# <title>

## 问题背景

Describe the user's problem in their language. Explain why the current situation is insufficient.

## 目标用户 / 角色

List the actors affected by the change.

## 目标

- Observable outcome 1
- Observable outcome 2

## 非目标

- Explicitly excluded adjacent work

## 用户流程

Describe the important workflows and decision points.

## 需求说明

Numbered or grouped requirements. Each requirement should be testable or observable.

## 边界场景

Cover invalid input, missing state, retries, cancellation, concurrency, old data, permission boundaries, or other relevant edges.

## 成功标准

- [ ] Concrete criterion 1
- [ ] Concrete criterion 2

## 风险与未决问题

## 变更记录
```

## Rules

- Describe outcomes, not implementation mechanics.
- Keep non-goals explicit.
- Make success criteria observable.
- Preserve product terms from the repo/user; do not rename concepts casually.
- If a decision is uncertain, mark it as unresolved instead of smoothing it over.
- Avoid long user-story lists unless they clarify actors or workflows.

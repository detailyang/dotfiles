# Technical Spec

`tech.md` explains how the system should change and how the change will be verified.

## Template

```markdown
# <title> 技术方案

## 当前系统理解

Summarize relevant modules, data/state, APIs, and existing behavior. Ground this in code/docs when possible.

## 方案概述

Explain the proposed technical approach and why it fits.

## 影响范围

List affected modules, interfaces, jobs, configs, docs, or tests. Prefer areas and contracts over brittle line references.

## 数据 / 状态 / 接口变化

Describe schema, state, API, CLI, UI, event, config, or file-format changes.

## 关键决策

Record trade-offs and selected options.

## 测试策略

Identify test seams, existing prior art, test types, and what each test proves.

## 迁移与兼容性

Cover old data, backward compatibility, rollout, rollback, and cleanup.

## 风险与未决问题

## 拆分建议

Suggest vertical slices or implementation tasks for `/to-issues`.

## 变更记录
```

## Testing seam discipline

Prefer the highest seam that proves behavior:

- UI/user flow if behavior is user-facing
- API/CLI boundary if that is the product surface
- domain/service interface for internal behavior
- unit tests for pure logic and edge cases

Existing seams should be preferred to new ones. If a new seam is needed, propose the highest useful seam.

## Rules

- Ground claims in local code/docs when possible.
- Prefer existing conventions over new abstractions.
- Include error paths and boundary behavior.
- Do not over-specify file edits that may become stale.
- If no good test seam exists, say so explicitly and explain the risk.

---
name: glossary
description: >
  技术术语对齐工具。当你和 LLM 对某个技术词汇理解不一致时触发。
  触发词："/glossary"、"我们对一下术语"、"这个词你理解的是什么"、"词汇对不上"、"我说的 X 不是你理解的那个意思"。
  覆盖范围：架构层概念（Service、Module）、数据模型（Entity、Aggregate）、系统设计（Event、Command、Handler）、API 契约（Payload、Resource）等。
---

# glossary — 技术术语对齐

把当前对话中的技术词汇歧义消除掉，写入 `docs/glossary.md`。你是代码库的技术顾问，要识别术语背后的**架构意图**，不只是抄用户说的话。

---

## 步骤

**1. 读现有文件**

检查 `docs/glossary.md` 是否存在，有就读取。同时扫描 `README.md`、类型定义文件（`*.d.ts`、`schema.prisma`、`*.proto`）——代码里已有的命名约定是判断歧义的基准。

**2. 识别歧义词**

- 用户明确指定（如 `/glossary Event`）→ 直接到步骤 3
- 用户没指定 → 从对话里找，每次最多列 3 个，带上你的推断让用户纠正：

  ```
  以下词汇可能有歧义：
  - Service — 你指的是 Application Service（用例层）还是 Domain Service？
  - Event — Domain Event 还是消息队列里的 Message？
  要对齐哪些？
  ```

优先识别这些高频歧义：同词多层（`Service`）、同概念异名（`Event` vs `Message` vs `Command`）、ORM 实体 vs 领域对象（`User` 是 Prisma Model 还是 Domain Entity）、动词语义（`handle` 是同步执行还是入队）、边界模糊（`Repository` 是否含业务查询）。

**3. 逐词澄清（每次只处理一个词）**

有候选项时给选项，没有时用反例逼近。拿到答案后复述确认，补充技术含义。如果和行业惯例有出入，轻轻标记（不否定，加到备注）：

```
收到。注意：这和经典 DDD 的 Repository 定义略有出入，我会在术语表里加备注。
```

**4. 写入 docs/glossary.md**

条目格式：

```markdown
### Event（领域事件）

**定义**：领域内已发生的事实。不可变，命名用过去式（`OrderPlaced`）。

**不是**：
- 不是 Command（Command 是意图，Event 是结果）
- 不是 Integration Event（跨服务消息用「Message」区分）

**在代码里**：`src/domain/events/`，实现 `DomainEvent` 接口。

**另见**：Command、Message

_最后更新：2025-01-15_
```

必填：定义、不是。有就填：在代码里、另见、备注（惯例差异）。

文件按技术层次分组（架构层、领域模型、API 契约、基础设施），条目字母排序。没有文件就新建，加文件头：

```markdown
# Glossary
> 记录项目中容易产生歧义的技术术语。通过 /glossary 更新。
```

**5. 收尾**

```
已更新 docs/glossary.md：新增 Event、Command，更新 Service。
下次把这个文件丢给我，我会用里面的定义和你保持一致。
```

---

## 规则

- 每次只问一个问题
- 带技术判断力给选项，不让用户从零解释
- 不做需求分析，不评判架构选择
- 用户说"直接写"→ 跳过确认，写完附"请 review 以下定义"

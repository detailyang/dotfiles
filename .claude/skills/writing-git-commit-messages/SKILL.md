---
name: writing-git-commit-messages
description: Use when writing git commit messages to ensure clarity, consistency, and meaningful history
---

# Writing Git Commit Messages

## Overview

**Clear commit messages are essential for code review and project history.** Conventional Commits provides a standardized format that makes commit history readable and enables automated tooling.

**Core principle:** A commit message should explain WHY the change was made, not just WHAT was changed.

## When to Use

**Use this skill when:**
- Writing any git commit message
- Preparing commits for code review
- Setting up commit message standards for a project
- Using automated changelog generation

## Commit Message Structure

```
<type>(<scope>): <short description>

<body - optional but recommended>

<footer - optional>
```

### Components

| Component | Required | Description | Example |
|-----------|----------|-------------|---------|
| `type` | Yes | Nature of change | `feat`, `fix`, `docs` |
| `scope` | No | Area affected | `(auth)`, `(api)`, `(ui)` |
| `description` | Yes | Summary in imperative mood | "add user login" |
| `body` | No | Detailed explanation | Why + What + How |
| `footer` | No | Breaking changes, refs | `BREAKING CHANGE:`, `Refs #123` |

## Commit Types

| Type | Use When | Example |
|------|----------|---------|
| **feat** | Adding new functionality | `feat(auth): add OAuth2 login` |
| **fix** | Fixing a bug | `fix(api): resolve timeout issue` |
| **docs** | Documentation only | `docs(readme): update install guide` |
| **style** | Formatting, no logic change | `style: format with prettier` |
| **refactor** | Code restructuring | `refactor(utils): extract helpers` |
| **test** | Adding/updating tests | `test(auth): add login tests` |
| **chore** | Maintenance tasks | `chore(deps): update lodash` |
| **perf** | Performance improvement | `perf(db): optimize queries` |
| **build** | Build system changes | `build(webpack): add optimization` |
| **ci** | CI/CD changes | `ci(github): add deploy action` |

## Writing Guidelines

### Short Description Rules

1. **Use imperative mood** (like giving a command)
   - ✅ "add user authentication"
   - ❌ "added user authentication"
   - ❌ "adds user authentication"

2. **Don't capitalize first letter**
   - ✅ "fix: correct typo"
   - ❌ "fix: Correct typo"

3. **No period at the end**
   - ✅ "feat: add dark mode"
   - ❌ "feat: add dark mode."

4. **Maximum 72 characters** for the first line

### Body Guidelines

**When to write a body:**
- The change needs explanation beyond the summary
- There are trade-offs or design decisions to document
- The change fixes a specific issue

**Body structure:**
```
<why the change was made>

<what exactly was changed>

<how it was implemented (if non-obvious)>
```

**Example:**
```
fix(api): handle null response from payment gateway

Payment gateway occasionally returns null instead of error 
when card is declined. This caused unhandled exceptions 
and 500 errors for users.

Added null check before processing response and return 
appropriate 402 error to client with clear message.

Refs: #456
```

### Footer Conventions

**Breaking changes:**
```
BREAKING CHANGE: auth middleware now requires JWT token
```

**Referencing issues:**
```
Fixes #123
Closes #456
Refs #789
```

## Complete Examples

### Feature with details
```
feat(auth): implement password reset flow

Add self-service password reset via email. Users can
request reset link which expires in 24 hours.

- Add /api/auth/reset-password endpoint
- Send email with secure reset token
- Validate token and allow password update
- Add rate limiting (5 requests per hour)

Refs: #234
```

### Simple fix
```
fix(ui): correct button alignment on mobile

Buttons in header were misaligned on screens < 375px wide.
```

### Breaking change
```
feat(api): redesign error response format

Standardize error responses across all endpoints to match
RFC 7807 (Problem Details).

BREAKING CHANGE: Error response structure changed from
{ error: string } to { type, title, status, detail }

Migration guide: docs/api-migration-v2.md
```

## Common Mistakes

| Mistake | Example | Fix |
|---------|---------|-----|
| Past tense | "added login" | "add login" |
| Capitalized | "Fix: bug" | "fix: bug" |
| With period | "feat: add x." | "feat: add x" |
| Too vague | "update code" | "refactor: extract validation logic" |
| Missing type | "login feature" | "feat(auth): add login" |
| Describes what, not why | "change color to blue" | "style: use brand color for consistency" |

## Practical Tips

### Before Committing

1. **Stage related changes only**
   ```bash
   git add -p  # Review changes interactively
   ```

2. **Review what you're committing**
   ```bash
   git diff --cached
   ```

3. **Write message in your editor** for complex commits
   ```bash
   git commit  # Opens $EDITOR instead of -m
   ```

### Good Commit Habits

- **Commit frequently** - Small, focused commits are better
- **One logical change per commit** - Don't mix bugfix with refactoring
- **Commit working code** - Tests should pass
- **Write message first** - Helps clarify what you're doing

### When to Amend

**Fix the last commit:**
```bash
# Add forgotten file
git add forgotten-file.js
git commit --amend --no-edit

# Fix commit message
git commit --amend -m "new message"
```

## Quick Reference Card

```bash
# Format
git commit -m "type(scope): description"

# With body (opens editor)
git commit

# Common types
feat:    # new feature
fix:     # bug fix
docs:    # documentation
style:   # formatting
refactor:# restructuring
test:    # adding tests
chore:   # maintenance

# Examples
git commit -m "feat(auth): add OAuth2 login"
git commit -m "fix(api): handle null response"
git commit -m "docs(readme): update install steps"
```

## Benefits of Conventional Commits

1. **Automatic changelog generation**
2. **Semantic versioning** (determine version bump from types)
3. **Clear commit history** - Easy to scan and understand
4. **Better code review** - Reviewers understand intent quickly
5. **Team consistency** - Everyone follows same format

## Red Flags

- Message starts with "WIP", "temp", "fix"
- Cannot understand the change from message alone
- Same message used for multiple commits
- Message only says "update" or "fix" without context

You are initializing or updating `AGENTS.md` for the current repository.

**Goal:** produce a repo-specific reference that lets future agents work correctly without guessing. Every instruction must be grounded in files you actually read. Do not invent commands, paths, or conventions.

---

## Step 1 — Check for an existing file

Run `ls AGENTS.md 2>/dev/null` or equivalent.

- **File exists → update mode.** Read it first. Preserve every accurate, project-specific instruction. Only replace stale content, add missing high-value guidance, or remove instructions that are now wrong. Do not rewrite for style.
- **File absent → create mode.** Write from scratch based on evidence collected below.

---

## Step 2 — Collect evidence (read before writing)

Gather only what is present. Skip categories that don't apply.

**Project shape**
Read the root manifest(s): `package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, `pom.xml`, `build.gradle`. Understand: source layout, workspace/monorepo boundaries, dependency manager.

**Exact commands**
Extract from manifests, `Makefile`, `justfile`, and CI configs (`.github/workflows/`, `.circleci/`, `.gitlab-ci.yml`). Prefer the CI definition over README—CI is authoritative. Distinguish full-suite vs. targeted commands when the repo makes it explicit.

**Conventions**
Check for formatter/linter config (`.eslintrc`, `biome.json`, `rustfmt.toml`, `ruff.toml`, etc.), test framework config, lockfile presence, generated-file markers, and commit-style from `git log --oneline -20`.

**Agent footguns**
Identify: files that must not be edited by hand (generated, schema-derived, vendored), commands that must be re-run after changing certain files (codegen, migrations, lockfile sync), commands that are slow/destructive/environment-dependent, and decision points where an agent should stop and ask instead of proceeding.

---

## Step 3 — Write or update `AGENTS.md`

**Title:** `# Repository Guidelines` (keep existing title if present and intentional).

**Length:** proportional to actual complexity. Use fewer than 200 words for simple repos; more only when the repo genuinely needs it. The limit is not a target—omit sections that add no value for an agent.

**Quality bar for every line:**
- Exact command or path over vague description
- Agent-specific constraint over general software advice
- Omit if it applies to every repository (e.g. "run tests before committing")
- Do not copy from global/personal agent config

---

## Sections (include only when supported by evidence)

### Project Structure
Non-obvious layout: where source lives, where tests live, monorepo package boundaries, generated directories to avoid touching.

### Build, Test, and Development Commands
One command per line with a short explanation. Separate install / dev / build / lint / test / format when the repo distinguishes them.

### Coding Style & Conventions
Formatter and linter invocation. Naming patterns only if the repo enforces a specific one. Skip if standard tooling with default config.

### Testing Guidelines
Framework name, how to run a single test vs. the full suite, any required environment or flags, tests that are CI-only or known flaky.

### Commit & PR Guidelines
Commit format if repo enforces one (from `git log` evidence). PR requirements only if a template or CI check enforces them.

### Agent-Specific Instructions
**Prioritize this section.** Include:
- Files that must not be edited by hand and why
- Regeneration commands that must run after changing certain files
- Destructive or irreversible commands to avoid or confirm before running
- Network/sandbox/environment requirements
- Explicit "stop and ask" triggers (ambiguous migrations, auth changes, public API breaks)

---

## Update-mode decision rules

When `AGENTS.md` exists, apply these rules in order:

1. **Verify before keeping.** Re-check any command or path in the existing file. If it no longer matches reality, replace it with the correct version.
2. **Add missing footguns.** If you found agent traps in Step 2 that are not documented, add them.
3. **Remove proven-wrong instructions.** Delete entries that are demonstrably stale (command no longer exists, path moved, tool replaced).
4. **Don't touch what works.** Do not rewrite accurate sections for style, restructure headings unnecessarily, or reduce specificity.
5. **Do not add generic advice.** Even in update mode, every new line must pass the quality bar above.

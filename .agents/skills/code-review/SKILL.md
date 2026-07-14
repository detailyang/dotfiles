---
name: code-review
description: Review committed and working-tree changes since a fixed point against repository standards, the originating spec, and correctness or risk. Use when the user asks to review a branch, pull request, work in progress, current changes, or changes since a commit, branch, tag, or merge base.
---

# Code Review

Review a bounded change set without modifying it. Keep standards, specification fidelity, and correctness/risk as independent axes so one cannot mask another.

## 1. Pin the change set

Use the fixed point supplied by the user or recorded by `/ship`. If neither exists, infer the intended base from the branch upstream or task context; ask only when it remains ambiguous.

Resolve the fixed point and merge base before reviewing:

```text
git rev-parse <fixed-point>
git merge-base <fixed-point> HEAD
git diff <merge-base> -- <task-paths>
git ls-files --others --exclude-standard -- <task-paths>
git log <fixed-point>..HEAD --oneline
```

Use the task-owned paths recorded by `/ship`, the spec, or the user. Exclude paths that were already dirty before the task. If no task boundary can be established, report the mixed scope before reviewing rather than attributing unrelated changes to the task.

`git diff <merge-base> -- <task-paths>` intentionally includes committed, staged, and unstaged tracked changes. The `git ls-files` command supplies new untracked files that Git omits from the diff. Fail early only when the fixed point is invalid or both tracked and untracked task change sets are empty.

## 2. Find source material

Identify the originating spec in this order:

1. A path or issue supplied by the user.
2. `specs/<slug>/product.md`, `tech.md`, `issues.md`, and `operation.md` matching the branch or task.
3. Issue references in commits or pull-request context.

Read repository standards from applicable `AGENTS.md`, `CONTRIBUTING.md`, coding standards, ADRs, and documented local conventions. Do not invent a convention when the repository is silent.

If no spec exists, skip only the Spec axis and state that limitation.

## 3. Run independent review axes

Run each axis in an independent context so findings from one do not contaminate another. Spawn independent sub-agents in parallel when slots are available; otherwise run isolated sequential passes without carrying findings between them. Give each pass the exact diff command, untracked task files, commit list, relevant source files, and a concise brief.

### Standards

Find documented-standard violations and judgement-call code smells introduced by the change. Check mysterious names, duplication, feature envy, data clumps, primitive obsession, repeated switches, shotgun surgery, divergent change, speculative generality, message chains, middle men, and refused bequest. Repository rules override generic smell heuristics; skip issues deterministic tooling already reports.

### Spec

Trace every requirement and acceptance criterion to the diff and verification evidence. Report missing or partial requirements, scope creep, and implementations that contradict the spec. Quote or reference the governing requirement for each finding.

### Correctness and risk

Look for behavior bugs not made explicit by the spec: invalid state transitions, missing error paths, data loss, security or permission mistakes, concurrency hazards, compatibility regressions, and tests that cannot detect the failure they claim to cover. Prefer concrete execution paths over speculative concerns.

Every finding must include severity, file and line, evidence, impact, and the smallest corrective direction. Do not report style trivia or pre-existing problems outside the change set.

## 4. Verify and report

Check every proposed finding against the diff and its source before presenting it. Drop unsupported findings; do not silently fix code.

Report findings under separate `Standards`, `Spec`, and `Correctness / Risk` headings, ordered by severity within each axis. End with:

- finding count per axis
- skipped axes and missing evidence
- validation commands observed or run
- residual risks

If no findings remain, say so explicitly and still report coverage gaps.

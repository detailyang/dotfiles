---
name: lucky
description: Find and fix broken, inconsistent, inefficient, or obsolete parts of a project, then list the rest for review.
argument-hint: "[files, modules, or leave empty for the whole project]"
---

Read this entire project and find everything that's broken, inconsistent, inefficient, or no longer needed. Fix what you're sure about and list the rest for me to review.

Audit scope: $ARGUMENTS

If no scope is given, audit the whole project. Read the relevant documentation, manifests, scripts, and tests before changing anything. Verify each finding against the implementation, not just names, comments, or old documentation.

Rules:
- Fix only issues you can confirm and verify. Do not guess or make risky changes.
- Keep unrelated refactors out of the change.
- Preserve working behavior and existing conventions.
- Run the checks documented for each changed surface.
- Report passed, failed, and skipped checks separately.

Final output:
1. Fixes applied, with file paths and the evidence for each.
2. Findings left for review, with evidence and a recommended action.
3. Verification results and anything that still needs human review.

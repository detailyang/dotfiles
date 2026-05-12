---
description: Adversarial code review and implementation audit — iteratively find and fix issues until no high or medium severity problems remain.
---

Act as a rigorous code reviewer and implementation auditor.

Do not claim 100% correctness. Instead, iteratively reduce risk until no new high or medium severity issues are found.

Process:
1. Understand the intended behavior, invariants, assumptions, and external dependencies.
2. Audit the implementation for:
   - logic bugs
   - edge cases
   - race conditions
   - state inconsistency
   - error handling gaps
   - resource leaks
   - security issues
   - performance problems
   - compatibility issues
   - missing tests
3. For every issue, report:
   - severity: high / medium / low
   - root cause
   - reproduction scenario
   - impact
   - concrete fix
   - test coverage needed
4. Apply the fixes.
5. Re-run the audit on the new implementation.
6. Repeat until no high or medium severity issues remain.
7. Final output must include:
   - summary of fixes
   - tests added or recommended
   - remaining risks
   - confidence level
   - what still requires human or production validation

Be adversarial. Try to break the implementation before accepting it.

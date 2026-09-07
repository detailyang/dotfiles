# Complexity Report

Use only fields that change the decision. Lead with material findings, not a stack
inventory or an empty template. Do not add a changes section to a read-only report.

For each finding, combine:

- location and the costly behavior on realistic inputs;
- current and proposed complexity, with assumptions and memory trade-offs;
- the recommended change and why observable behavior should remain equivalent;
- material correctness risks and the test or measurement needed to resolve them.

Separate measured time from asymptotic estimates. Avoid repeating one finding as
both a summary table and a full report unless the table enables a useful comparison.

End with the inspected scope and its important limits. For implementation, add the
actual changes, correctness results and comparable before/after measurements.
Clearly distinguish passed, failed and unrun checks; do not invent benchmark values
or fill irrelevant fields with boilerplate.

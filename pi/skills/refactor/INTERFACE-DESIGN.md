# Interface Alternatives

Read this only for a selected candidate with a consequential, non-obvious contract
choice. If one design plainly satisfies the constraints, explain it rather than
manufacturing alternatives.

State the current callers, behavior, dependency category and test seam first.
Use repository terms; consult [language](LANGUAGE.md) or [deepening](DEEPENING.md)
only where they resolve ambiguity.

Compare two or three genuinely different designs against the same current
requirements. Useful contrasts are a smaller contract, better locality of change
or a simpler common caller. Do not optimize for hypothetical future use cases.

For each design, show the contract and invariants, one caller example, what the
implementation hides, required dependencies and the main trade-off. Recommend one
using compatibility, failure paths, testability and migration cost as relevant.

Independent reviewers can help when supported by available tools and the task
budget. Give each a scoped, read-only brief with shared constraints; otherwise do
the comparison directly. No mandatory Agent API, agent count or parallel run.

Keep this a design comparison unless implementation is requested. Do not hide an
unresolved behavior or ownership choice by combining every alternative into a
larger interface.

---
name: refactor
description: Review architecture for evidence-backed deepening opportunities when explicitly asked to explore coupling, module boundaries or test seams in Pi. Proposal-first, not a routine feature fix or automatic rewrite.
---

# Architecture Review

Default to a read-only review. Implement only when the user requests changes;
then follow the repository's implementation and verification workflow. Do not
force a discovery interview before an already selected refactor.

## Process

1. Anchor the requested scope in applicable instructions, existing domain language
   and relevant accepted decisions. Inspect real callers and tests; expand only
   while another dependency can change the recommendation.
2. Identify observable friction: duplicated knowledge, coupled changes, shallow
   pass-throughs or untestable behavior. Use the deletion test: does removing an
   abstraction remove complexity or merely distribute it among callers?
3. Report only material candidates, ordered by benefit, risk and confidence. For
   each, give paths, evidence, the proposed change, preserved behavior, main
   trade-off and verification. Use a small before/after ASCII diagram when useful.
4. Recommend a first candidate. Ask one decision question only for an explicitly
   interactive exploration or an unresolved choice that blocks safe progress.

Use available delegation only when independent exploration is worth its cost;
do not assume an `Agent` tool, a particular subagent type or parallel execution.
Do not create a report file, open a browser or load CDN scripts by default.

## References — choose by need

- [Language](LANGUAGE.md): clarify an ambiguous architectural term, without
  replacing the repository's own vocabulary.
- [Deepening](DEEPENING.md): choose a seam and dependency strategy.
- [Interface alternatives](INTERFACE-DESIGN.md): compare materially different
  contracts when the choice is not obvious.
- [HTML report](HTML-REPORT.md): only for a requested visual report that benefits
  from an artifact; otherwise keep the review in chat.
- [Context format](CONTEXT-FORMAT.md): persist an approved reusable domain term.
- [ADR format](ADR-FORMAT.md): persist an approved consequential trade-off under
  the repository's ADR workflow.

Do not silently create or edit `CONTEXT.md`, ADRs or product code as conversation
side effects. Existing ADRs are constraints; propose reopening one only with
concrete counterevidence. Neither an artificial adapter quota nor hypothetical
future flexibility justifies a new abstraction.

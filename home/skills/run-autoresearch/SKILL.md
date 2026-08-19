---
name: run-autoresearch
description: Run sustained, evidence-driven optimization loops against an objective evaluator while preserving correctness, experiment history, and multiple candidate families. Use when Codex is asked to autoresearch, keep iterating, beat a benchmark or leaderboard score, reduce latency/cost/memory, improve throughput or quality, search an algorithm or implementation space, profile a bottleneck, or optimize until a quantitative target is reached. Best suited to tasks with a repeatable verifier or benchmark; do not use for vague research without an executable evaluation signal or for one-off implementation tasks that do not require experimental search.
---

# Run Autoresearch

Treat optimization as an empirical research program: establish a trustworthy evaluator, preserve durable evidence, and repeatedly choose the next experiment from measured results. Continue beyond the first improvement until the target or another explicit stopping condition is reached.

## Establish the research contract

Inspect the repository and current evaluation path before changing code. Define:

- the artifact and exact mutation scope;
- correctness gates that every candidate must pass;
- the primary metric and optimization direction;
- per-case metrics, weights, and aggregation formula;
- a reproducible evaluator command and environment;
- the baseline, target, minimum meaningful improvement, and available budget;
- prohibited shortcuts, external side effects, and evaluator rules.

Build or repair the cheapest reliable evaluator before optimizing when it is missing. Ask the user only when a required choice cannot be inferred safely and would materially change the work.

Protect evaluation integrity:

- Run correctness before performance unless the cheapest check naturally combines them.
- Use identical environments and representative inputs for comparisons.
- Repeat noisy measurements and report dispersion, not only the best sample.
- Keep holdout cases when overfitting to known inputs is possible.
- Reject benchmark gaming, skipped work, or tolerance abuse unless the task explicitly permits it.
- Treat timeouts and interrupted runs as inconclusive; treat completed failures and regressions as evidence.

## Create durable research memory

Follow the repository's existing documentation conventions. If none exist, use an `autoresearch/` directory containing a brief, ledger, beam state, and selected raw logs. Do not overwrite unrelated notes or create large numbers of untracked candidate files without a retention plan.

Read [references/ledger-templates.md](references/ledger-templates.md) when initializing the loop or when its records are incomplete. Record enough information for a fresh agent to reproduce the active best and avoid repeating rejected ideas.

At minimum, preserve:

- baseline and active-best revisions with commands and results;
- every material hypothesis, exact change, and outcome;
- correctness status and per-case measurements;
- profiles after major structural changes or gains;
- rejected ideas and the evidence required to reconsider them;
- current beam ranking and next experiments.

Store raw output when it is the only trustworthy evidence. Keep summaries short and link to raw logs rather than copying them repeatedly.

## Run the experiment loop

Repeat this loop:

1. Observe the active best, case breakdown, recent experiments, and latest profile.
2. State one falsifiable hypothesis tied to a measured cost or failure mode.
3. Choose the cheapest experiment that discriminates the hypothesis.
4. Implement the candidate in an isolated, reversible scope.
5. Run the cheapest correctness gate, then the benchmark and relevant profiler.
6. Record commands, environment, complete results, and interpretation immediately.
7. Promote, retain as a near-miss, combine later, repair, or reject the candidate.
8. Select the next experiment from the whole beam, not only from the incumbent.

Prefer one-variable experiments when attribution matters. Combine independently promising changes before discarding them when their costs do not overlap. Revert or isolate failed candidate changes without destroying user-owned work.

Promote a candidate only when completed evidence clears correctness and exceeds the noise threshold on the primary metric without unacceptable case regressions. Preserve the exact promoted state. Commit only when the user's workflow authorizes it and the commit can remain scoped.

## Maintain idea diversity

Avoid single-incumbent hill climbing. Maintain three or more live candidate families when the search space supports them:

- **Exploit:** a low-risk improvement near the active best.
- **Near-miss:** a repeatable local win, useful ingredient, or case-specific improvement that may combine well.
- **Structural:** a higher-risk algorithm, architecture, representation, or routing change.
- **Instrumentation or cleanup:** only while it unlocks better evidence or removes a measured cost.

For each family, track its parent, hypothesis, target bottleneck, changed surface, best evidence, next discriminating experiment, and kill criteria.

Do not kill a structural family after one slower prototype. Allow a reasonable implementation and tuning path when the hypothesis remains plausible. Kill it when correctness is inherently incompatible, repeated meaningful regressions survive reasonable tuning, plausible combinations fail, profiling shows the targeted cost is immaterial, or its opportunity cost exceeds stronger experiments.

Refresh the beam every three to five material experiments.

## Profile and search at plateaus

Use measurements to decide whether the system is compute-bound, memory-bound, launch/dispatch-bound, synchronization-bound, numerically constrained, or dominated by framework overhead. Profile after structural changes, major gains, and sustained stalls; avoid profiling every tiny edit when a cheaper benchmark answers the question.

When several experiments fail to improve the score, do not continue a blind parameter sweep. Rotate through:

- profiling the current active best;
- validating the evaluator and noise threshold;
- inspecting generated code, compiler artifacts, traces, or execution plans;
- trying a different algorithm, representation, fusion boundary, or specialization;
- combining independent near-misses;
- checking whether high-weight cases need separate routing;
- consulting primary documentation, papers, or a stronger advisor;
- assigning distinct candidate families to subagents when available.

Give advisors and subagents the research contract, current evidence, and relevant raw profiles. Ask them for falsifiable hypotheses and concrete experiments, not generic optimization lists. Keep execution and verification in the main loop.

## Optimize the real objective

Inspect the case-level score instead of relying only on the aggregate. Prioritize high-weight bottlenecks while guarding the full correctness and regression suite.

Consider specialization by shape, input distribution, hardware path, or numerical condition only when permitted by the contract. Include detector, routing, conversion, compilation, and launch overhead in the score. Validate reduced precision and numerical shortcuts against difficult and holdout cases.

Distinguish algorithmic work from framework overhead. Move work into matrix-, batch-, vector-, fused-, or otherwise accelerator-friendly forms when profiling shows serial or launch costs dominate, but let the target hardware and measurements determine the transformation.

## Stop and hand off

Stop only when one of these conditions is true:

- the quantitative target and correctness criteria are achieved;
- the user-specified budget is exhausted;
- a required external resource or decision blocks further valid experiments;
- evidence shows diminishing returns below the agreed threshold and the remaining families have explicit kill reasons.

Do not claim exhaustion merely because several nearby variants failed.

Finish with a compact report containing:

- baseline versus final result and percentage or factor improvement;
- correctness status and important per-case regressions or wins;
- exact evaluator and reproduction commands;
- promoted files or revision;
- the structural ideas responsible for the gains;
- rejected and retained candidate families;
- remaining opportunities and the next best experiment.

---
name: run-autoresearch
description: Run sustained optimization against a repeatable evaluator and quantitative target when explicitly requested. Not for one-off profiling or ordinary code changes.
---

# Run Autoresearch

Continue experimental optimization beyond a first improvement until the target or
an explicit stopping condition is reached. Use only authorized mutation scope,
compute and external services; this skill does not grant commit permission.

## Establish the research contract

Inspect the current artifact and evaluator. Record the mutation scope, correctness
gates, primary metric and direction, per-case weights/aggregation, reproducible
command and environment, baseline, target, noise threshold, prohibited shortcuts
and available budget. Ask only for material decisions that cannot be inferred.

Use the cheapest reliable evaluator. Without a supplied budget, explicitly bound
the current batch before spending resources rather than promising indefinite work.
Do not silently change acceptance, tolerances, inputs or the score to favor a candidate.

## Protect evidence

- Run correctness before performance unless the cheapest check combines them.
- Compare identical environments and representative inputs, including overhead
  and holdouts where overfitting is possible.
- Repeat noisy measurements and report representative statistics and dispersion,
  not just the best sample.
- Treat interrupted runs and timeouts as inconclusive, not successful results.
- Preserve the exact active-best state and failed experiment evidence without
  destroying user-owned work. Commit only with explicit authorization.

Reuse repository records. Otherwise keep a concise contract and experiment ledger
under `autoresearch/`, adding raw logs and candidate state only when useful for
reproduction or handoff. Read [ledger templates](references/ledger-templates.md)
when initializing or repairing records; use only the relevant templates.

## Experiment loop

From the active best and measured case breakdown, choose a falsifiable hypothesis
and its cheapest discriminating experiment. Make a reversible, isolated change,
run correctness and performance checks, and immediately record the exact change,
commands, results and interpretation.

Promote only when completed evidence clears correctness, exceeds measurement noise
on the primary metric and avoids unacceptable case regressions. Otherwise repair,
retain, combine or reject with a reason. Then choose the next experiment and
continue; one failed variant does not exhaust a hypothesis.

Read [search strategy](references/search-strategy.md) when maintaining multiple
candidate families, handling a plateau, profiling a changed bottleneck or choosing
specializations. Do not create a fixed number of candidates or profile every edit
when a cheaper check answers the question.

## Stop and hand off

Stop when the target and correctness criteria are achieved, the agreed budget or
explicitly bounded batch is exhausted, a required resource/decision blocks valid
experiments, or evidence meets the agreed diminishing-returns threshold. Explain
why remaining plausible candidates do not justify more work; several failed nearby
variants alone are not proof of exhaustion.

Report baseline versus final metrics, correctness and material per-case changes,
the exact promoted state and reproduction commands, decisive ideas, rejected or
retained candidates and the next useful experiment. Distinguish measured gains,
unresolved hypotheses and work not run.

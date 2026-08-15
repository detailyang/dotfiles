# Autoresearch ledger templates

Use these templates selectively. Adapt paths and fields to the repository rather than creating duplicate documentation.

## Research brief

```markdown
# Research contract

## Objective
- Artifact:
- Mutation scope:
- Primary metric and direction:
- Aggregation/weights:
- Baseline:
- Target:
- Minimum meaningful improvement:

## Validation
- Correctness command:
- Benchmark command:
- Profiler command:
- Environment/hardware:
- Repetitions/noise policy:
- Holdout cases:

## Constraints
- Allowed implementations/dependencies:
- Prohibited shortcuts:
- External side effects:
- Budget/stopping conditions:
```

## Experiment ledger

Keep one row per material experiment and link to raw logs or a longer note when needed.

```markdown
| ID | Parent | Hypothesis/change | Correctness | Primary result | Important case results | Decision | Evidence |
|---|---|---|---|---:|---|---|---|
| E000 | baseline | Establish reproducible baseline | pass | 0.000 unit | case-a: 0.000 | baseline | logs/... |
```

Use stable decisions: `promote`, `retain`, `combine`, `repair`, `reject`, or `inconclusive`.

For noisy metrics, record a representative statistic and dispersion, such as `median 12.4 ms, MAD 0.2 ms, n=9`. Keep full samples in the linked evidence.

## Candidate beam

```markdown
| Beam | Type | Parent | Hypothesis / target cost | Best evidence | Next experiment | Kill criteria | Status |
|---|---|---|---|---|---|---|---|
| B1 | exploit | active-best | ... | ... | ... | ... | active |
| B2 | near-miss | E... | ... | ... | ... | ... | active |
| B3 | structural | baseline | ... | ... | ... | ... | active |
```

Update the ranking and next experiments every three to five material runs. Preserve killed beams with their evidence so future sessions do not repeat them unchanged.

## Experiment note

Use a longer note only for structural changes, difficult failures, or results that cannot fit clearly in the ledger.

```markdown
# E000: short hypothesis

- Parent/revision:
- Targeted bottleneck:
- Expected signal:
- Exact changes:
- Commands/environment:
- Correctness result:
- Benchmark/profile result:
- Interpretation:
- Decision:
- Follow-up or reconsideration condition:
```

## Final handoff

```markdown
# Autoresearch outcome

- Baseline:
- Final:
- Improvement:
- Correctness:
- Active revision/files:
- Reproduction command:

## Main breakthroughs
1. ...

## Case-level result
| Case | Baseline | Final | Delta | Notes |
|---|---:|---:|---:|---|

## Rejected or retained families
- ...

## Next best experiment
- Hypothesis:
- Expected signal:
- Command/change:
```

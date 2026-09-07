# Experimental Search Strategy

Use the strategy that fits the measured bottleneck, search space and authorized
budget. These are options for sustained research, not a checklist for every run.

## Candidate Diversity

When independent hypotheses are plausible, keep alternatives to the incumbent:

- **Exploit:** a low-risk improvement near the active best.
- **Near-miss:** a local or case-specific win that may combine with another change.
- **Structural:** a different algorithm, architecture, representation or routing.
- **Instrumentation:** only when it unlocks needed evidence or removes measured cost.

Keep only as many live families as the budget and evidence support. Record each
family's parent, hypothesis, evidence, next discriminating experiment and kill
criteria. Refresh rankings after results change their promise, the bottleneck
moves or the remaining budget changes, not on a fixed experiment count.

Prefer one-variable experiments when attribution matters. Combine independent
near-misses when their costs do not overlap. Do not reject a structural hypothesis
solely because its first prototype is slower; allow a bounded tuning path when
profiling supports it. Reject it when correctness is incompatible, meaningful
regressions survive reasonable tuning, the targeted cost is immaterial or stronger
experiments have better expected value within the budget.

## Plateaus And Profiling

After structural changes, major gains or repeated inconclusive experiments,
reconsider which evidence would change the decision:

- Profile the active best and locate compute, memory, dispatch, synchronization,
  numerical or framework costs.
- Validate the evaluator, representative inputs and measurement noise.
- Inspect generated code, compiler artifacts, execution plans or traces.
- Test a different algorithm, layout, fusion boundary or specialization.
- Combine independent gains or investigate a high-weight case separately.
- Consult primary documentation or papers for a specific unresolved hypothesis.

Do not run every option or continue a blind parameter sweep. A cheap benchmark is
sufficient when it can discriminate the hypothesis; use a profiler when attribution
is needed.

Delegation is optional when supported and useful. Give an advisor a scoped,
read-only question, the contract and decisive evidence. Seek falsifiable
experiments; the main loop still verifies candidate results. Delegation does not
authorize new compute, external services or mutations.

## Optimize The Real Objective

Inspect per-case results as well as the aggregate. Prioritize high-weight costs
while preserving correctness and regression gates across required cases.

Specialize by shape, distribution, hardware or numerical condition only when the
contract allows it. Include detection, routing, conversion, compilation and launch
overhead. Check reduced precision on difficult and holdout cases; do not expand
tolerances without authorization.

Distinguish algorithmic work from framework overhead. Matrix, batch, vector or fused
forms can help when serial work or launches dominate, but choose transformations
from target-hardware measurements rather than presumed accelerator friendliness.

# Diagnosis Loop

## Hypotheses

Generate 3-5 hypotheses before deep-diving. Each must be falsifiable.

Format:

```text
Hypothesis: <cause>
Prediction: if true, <observation/change> will happen
Probe: <specific action>
```

Rank by likelihood, verification cost, and impact.

## Probing rules

- Test one variable at a time.
- Prefer direct observation over broad code reading.
- Tie every probe to a prediction.
- Mark each result as confirmed, excluded, or still uncertain.
- Update the hypothesis list as evidence changes.
- Do not silently switch hypotheses without saying why.

## Instrumentation

Good probes include:

- invariant assertions near suspicious boundaries
- focused logging with request/id context
- before/after snapshots of state
- timing measurements for performance regressions
- trace comparison between good and bad runs
- binary search through input, data, config, or commit range

Remove temporary probes after the fix unless the user explicitly wants durable observability.

## Result classification

End with one of:

- single root cause
- causal chain
- concurrent contributing causes
- missing observation

If the final state is missing observation, do not present a speculative fix as confirmed.

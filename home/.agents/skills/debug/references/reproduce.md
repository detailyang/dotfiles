# Reproduction

The reproduction loop must show the user's symptom, not just a nearby failure.

## Loop types

Try these in order unless context suggests otherwise:

1. **Failing automated test** — unit, integration, or e2e at the highest useful seam.
2. **CLI command** — deterministic input, captured stdout/stderr, known expected output.
3. **HTTP script** — curl or small script against a dev server.
4. **Browser path** — browser automation or precise manual steps with screenshots/logs.
5. **Trace replay** — saved request, event stream, HAR, log, fixture, or serialized payload.
6. **Throwaway harness** — minimal module/service setup that exercises the path.
7. **Stress loop** — repeat the trigger many times for flake/race/perf issues.
8. **Bisection loop** — automate pass/fail for `git bisect run` or config/data search.
9. **Differential loop** — compare old/new versions or two configurations.

## Quality bar

A good loop is:

- fast enough to run repeatedly
- deterministic or high-probability enough to guide debugging
- sharp enough to fail for the described symptom
- easy to run by an agent without hidden manual judgment

## When reproduction fails

Do not guess. Report:

- commands/steps tried
- observed output
- why it does not reproduce the user's symptom
- the smallest artifact needed next: logs, HAR, sample input, environment access, screen recording, or permission to add instrumentation

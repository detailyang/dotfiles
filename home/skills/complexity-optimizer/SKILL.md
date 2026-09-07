---
name: complexity-optimizer
description: Analyze or optimize algorithmic hotspots such as repeated scans, N+1 queries and recomputation. Not for generic cleanup.
---

# Complexity Optimizer

Preserve semantics while reducing a demonstrated cost. Analysis, audit and report
requests are read-only; edit only when implementation is requested. Distinguish
complexity estimates from measured speedups and scanner leads from confirmed
hotspots.

## Find the cost

Start with the named function or path, realistic input sizes, direct callers and
available tests or measurements. For a requested broad scan, use the bundled
`scripts/analyze_complexity.py`, resolved relative to this skill:

```bash
python3 scripts/analyze_complexity.py /absolute/path/to/repo --format markdown
python3 scripts/analyze_complexity.py /absolute/path/to/repo --format json
```

The scanner supports Python, JavaScript/TypeScript, JSX/TSX, Java, Go, C/C++, C#,
Ruby, PHP and Swift. Its pattern matches are leads, not proof. Inspect relevant
hot paths even when it reports nothing; framework lifecycle and query behavior may
not be visible to the scanner. Do not broaden a named-function task into a repo scan.

Rank findings by measured or well-supported cost on realistic inputs. Separate
algorithmic gains from constant factors, and inspect enough surrounding behavior
to justify both the current and proposed complexity.

## Preserve the contract

Read the relevant transformation in the
[optimization playbook](references/optimization-playbook.md). Prefer existing
libraries or local utilities over a new implementation.

Before changing code, establish the behavior and regression checks. Account for
ordering, duplicate keys, equality/hashability, object identity, mutation, missing
values and errors where relevant. Caches need invalidation; batching must preserve
authorization, tenancy, filtering, pagination, sorting and retry behavior. Do not
trade those guarantees for fewer operations.

Verify through the real caller with focused correctness checks and applicable
repository checks. Use comparable measurements when claiming a speedup; include
index construction, memory, cache invalidation and dispatch costs. If correctness
or workload assumptions are unresolved, report the missing evidence rather than
silently changing semantics.

## Result

Report material findings with locations, current/proposed complexity, equivalence
risks and the next decisive check. Use the
[report reference](references/report-template.md) only when a structured report
helps. Omit empty sections and repeated fields; no fixed finding count is needed.
For edits, include observed checks, before/after measurements and remaining risks.

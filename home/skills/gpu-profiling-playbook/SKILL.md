---
name: gpu-profiling-playbook
description: Diagnose end-to-end PyTorch/CUDA bottlenecks from traces and targeted measurements. Not for general GPU terminology or isolated NCU metrics.
---

# GPU Profiling Playbook

Connect end-to-end latency to the operation or kernel that deserves optimization.
A busy GPU timeline does not prove efficient kernels. Analysis requests do not
authorize code changes, paid compute, profiler installation or host configuration.

## Select the evidence needed

Fix model, shape, batch size, precision, hardware, warm-up and timing boundaries
for a comparable baseline. Reuse supplied traces when sufficient. Do not collect
all profiler layers merely because they are available.

| Missing evidence | Next tool or source |
| --- | --- |
| Which operation dominates the measured step | Framework trace, usually `torch.profiler` |
| Whether time is lost on CPU, between kernels or in transfers | Nsight Systems timeline |
| Why a selected kernel is inefficient | Targeted Nsight Compute report |
| Whether the proposed change helps the user path | Normal end-to-end benchmark with correctness checks |

Read only the relevant section of the
[capture and interpretation guide](references/capture-guide.md). It includes trace
scope, synchronization experiments, kernel resource analysis and a source case.
Use installed tool capabilities and the target architecture, not remembered metrics
or a case study's hardware parameters.

## Decide and validate

Prioritize absolute wall-time contribution times plausible improvement. Treat a
removed sync that merely moves the wait elsewhere as evidence against a CPU-stall
hypothesis unless device idle time or end-to-end latency improves.

For continuously busy but low-throughput kernels, investigate eligible warps,
register pressure, issue rate, dependencies and stalls together. For many short
pointwise kernels, test compilation or fusion when authorized. Neither occupancy,
GPU-busy percentage nor an NCU speedup estimate is a completion criterion.

Change one falsifiable hypothesis at a time when attribution matters. Compare the
same baseline, including launch, transfer, layout conversion and realistic
concurrency. Re-profile when a gain or structural change moves the dominant cost;
use a cheaper benchmark when it already answers the question.

Report the baseline and capture scope, dominant absolute cost, decisive evidence
and rejected hypotheses. For experiments, add correctness and comparable before/
after results. State the remaining bottleneck or smallest missing trace; do not
invent metrics or require an optimization attempt for a read-only analysis.

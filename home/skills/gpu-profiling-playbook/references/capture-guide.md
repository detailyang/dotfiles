# Capture And Interpretation Guide

Read only the layer needed for the current hypothesis. Capture and optimization
commands remain subject to task authorization and shared-device constraints.

## Baseline And Scope

Record model, inputs, batch size, precision, device, warm-up and measured step range.
A single-step trace can attribute costs; a multi-step trace can reveal recurring
patterns, synchronization and work queued across boundaries. Collect both only
when those questions require them.

Do not compare a steady-state step with a whole-program trace that also includes
loading, encoders or decoding. Keep capture scope and timing boundaries attached
to every reported number. Validate gains with normal execution, not profiler host
wall time, which may include instrumentation, replay or serialization.

## Framework Trace

Rank operations by absolute GPU time before examining small gaps. Quantify a gap
in absolute time and as a fraction of step latency; ignore it if even eliminating
it would not materially improve the objective.

Resolve a meaningful gap's call stack rather than inferring its cause from the API
name. Removing or moving `.item()`, a copy or another CPU-visible wait is a
diagnostic experiment, not automatically a production fix. If another sync takes
over the delay while the CUDA stream stays full, the call exposed queued GPU work
rather than causing device idle time.

## Nsight Systems

Inspect CPU threads, CUDA API activity, hardware rows, transfers and repeated step
patterns together. Colored kernels can help distinguish repeated groups in the
GUI. Zoom in before interpreting whitespace; nanosecond-scale gaps may be harmless.

Compare compute and memory-operation time. Export/query the SQLite report when
aggregate gap or kernel timing is needed, using the installed report schema.
Decide whether lost time is on the CPU, between kernels, in transfers or inside
continuously running kernels before collecting kernel metrics.

## Nsight Compute

Target the dominant kernel and representative launches, including materially
different long/short launch classes. Query installed sections/metrics; collect
only evidence that distinguishes the current hypotheses.

Inspect compute and memory throughput, achieved occupancy, registers/thread,
active and eligible warps/scheduler, instruction issue and relevant stall reasons
together. A continuously busy GPU with low compute and memory throughput can be
latency-starved, but dependencies, issue supply and workload size also matter.

A rough register-resource check is:

```text
registers_per_warp = registers_per_thread * 32
register_budget_per_scheduler ~= registers_per_SM / schedulers_per_SM
resident_warps_per_scheduler <= floor(register_budget_per_scheduler / registers_per_warp)
```

Confirm scheduler organization, allocation granularity and other resource limits
against the target architecture and NCU occupancy report. This estimate is not a
prediction of achieved occupancy or speed. A zero NCU estimated speedup does not
prove optimality, especially when no single resource is saturated.

## Optimization Experiments

For many small pointwise kernels, test `torch.compile` or explicit fusion. Inspect
generated Triton/CUTLASS code or kernel names to confirm the intended operations
fused; `poi` commonly denotes a pointwise kernel, not proof of a gain by itself.

Compare absolute time. A dominant kernel's percentage can increase because fusion
made other work cheaper. Re-rank costs after meaningful gains. If attention still
dominates, investigate its implementation before polishing smaller operators.
Include routing, launch, conversion, transfer and concurrent-load costs in the
end-to-end result, alongside correctness checks.

## Source Case Study

The source article profiles Wan2.1 1.3B on an RTX 4090. Its observations are not
thresholds or current-work measurements: roughly 2.5 s per step and 99% GPU busy;
flash attention dominated; removing `.item()` moved the wait to a copy. A sampled
attention kernel used 255 registers/thread with about 1.98 active but 0.21 eligible
warps/scheduler and one instruction issued every 6.4 cycles.

In that workload, `torch.compile` reduced a step to 1.8 s, about 28%, through fusion.
Attention's share rose from 38% to 58% because other kernels became cheaper. Verify
those causal claims on the current workload rather than transferring the result.

Source: [Deep Dive: GPU Profiling - I](https://piyushk52.github.io/jekyll/update/2026/08/08/profiling.html)

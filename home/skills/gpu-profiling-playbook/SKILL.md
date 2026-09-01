---
name: gpu-profiling-playbook
description: >
  Profile and optimize PyTorch/CUDA workloads with an evidence-driven funnel from
  torch.profiler to Nsight Systems and Nsight Compute, then validate torch.compile
  or operator-fusion experiments. Use when GPU utilization looks high but latency
  remains poor, synchronization points or timeline gaps may be misleading, or a
  bottleneck must be prioritized across framework, system, and kernel layers. Do
  not use for general GPU terminology or isolated Nsight Compute metric lookup.
---

# GPU Profiling Playbook

Build an evidence chain from end-to-end latency to the operation and kernel that
deserve optimization. A busy GPU timeline is not proof that its kernels use the
hardware efficiently.

## Profiling Funnel

### 1. Establish a comparable baseline

- Fix the model, input shape, batch size, precision, device, warm-up, and measured
  step range. Record per-step latency before changing code.
- Capture both a single-step trace for attribution and a multi-step trace for
  recurring patterns, synchronization, and work queued across step boundaries.
- State the trace scope. Do not compare a steady-state step trace directly with a
  whole-program trace that also includes loading, encoders, or decoding.

### 2. Narrow with `torch.profiler`

- Treat GPU-busy percentage as a rough first signal. Rank operations by total GPU
  time and identify the dominant operation before examining small gaps.
- Measure idle gaps in absolute time and as a fraction of step latency. Ignore
  gaps whose maximum possible saving is immaterial.
- Resolve the call stack for a meaningful gap instead of inferring its cause from
  the visible API name alone.
- When `.item()`, a copy, or another CPU-visible call appears to block, remove or
  move it only as a diagnostic experiment. If another synchronization point takes
  over the same delay while the CUDA stream remains full of kernels, the call was
  exposing previously queued GPU work rather than causing a CPU-side bottleneck.

### 3. Validate the timeline with Nsight Systems

- Inspect CPU threads, CUDA API activity, CUDA hardware rows, memory operations,
  and repeated step patterns together. Enable colored kernels when using the GUI
  so recurring kernel groups are easier to distinguish.
- Zoom in before calling visible whitespace a stall. Nanosecond-scale gaps can be
  harmless even when numerous.
- Compare compute time with memory-operation time, then export/query the SQLite
  report (`Stats System View` -> `CUDA Summary`) when aggregate gap and kernel
  timing are needed. Keep the report's capture scope attached to every number.
- Use Nsight Systems to decide whether lost time is between kernels, in transfers,
  on the CPU, or inside continuously running kernels. Move to kernel profiling
  only after this boundary is clear.

### 4. Explain the dominant kernel with Nsight Compute

- Profile the dominant kernel, not every launch. Sample each materially different
  launch class, such as long and short instances.
- Inspect compute and memory throughput, achieved occupancy, registers per thread,
  active and eligible warps per scheduler, instruction issue/slot utilization,
  and relevant warp-stall reasons.
- If the GPU is continuously busy but both compute and memory throughput are low,
  test latency starvation as the hypothesis. High register pressure can reduce
  resident warps until too few are eligible to hide instruction or memory latency.
- Use this rough resource check, then confirm it against the target GPU and the NCU
  occupancy report:

  ```text
  registers_per_warp = registers_per_thread * 32
  register_budget_per_scheduler ~= registers_per_SM / schedulers_per_SM
  resident_warps_per_scheduler <= floor(register_budget_per_scheduler / registers_per_warp)
  ```

- Do not interpret an NCU estimated speedup of zero as proof that the kernel is
  optimal. A latency-starved kernel may have no single saturated resource for the
  rule engine to optimize.

### 5. Run and verify optimization experiments

- Prioritize `wall-time contribution * plausible improvement`, not visual
  prominence. Change one hypothesis at a time and rerun the same baseline.
- For many small pointwise kernels, test `torch.compile` or explicit operator
  fusion. Inspect generated Triton/CUTLASS kernel names to confirm which operations
  fused; `poi` commonly denotes a pointwise kernel.
- Compare absolute latency and absolute kernel time. When fusion shrinks the rest
  of the step, the dominant kernel's percentage can increase even if that kernel
  did not regress.
- After fusion, re-profile and make the newly dominant absolute cost the next
  target. Preserve correctness checks alongside performance measurements.

## Decision Rules

- Large inter-kernel gaps: investigate CPU launch overhead, synchronization, data
  preparation, transfers, or CUDA Graphs.
- Busy timeline plus low per-kernel throughput: investigate occupancy, register
  pressure, eligible warps, issue rate, and stalls.
- Many short pointwise kernels: investigate compilation and fusion.
- Attention dominates after other work is fused: optimize or replace the attention
  implementation before polishing smaller operators.
- A removed sync merely moves the wait elsewhere: reject the CPU-sync hypothesis
  unless device idle time or end-to-end latency improves.

## Required Result

Report:

1. Baseline and exact capture scope.
2. Dominant operation/kernel and its absolute contribution.
3. Evidence from each profiler used, including rejected hypotheses.
4. Optimization attempted and comparable before/after latency.
5. Remaining bottleneck and the next measurement that would change the decision.

If the user asks only for analysis, do not modify code. If profiling data or access
to the target GPU is unavailable, distinguish observed facts from hypotheses and
request the smallest missing trace rather than inventing metrics.

## Source Case Study

The source article profiles Wan2.1 1.3B on an RTX 4090. Its values are examples,
not thresholds: roughly 2.5 s per step and ~99% GPU busy; flash attention was the
largest cost; removing `.item()` only moved the synchronization wait to a copy;
the sampled attention kernel used 255 registers/thread and showed about 1.98 active
but 0.21 eligible warps/scheduler with one instruction issued every 6.4 cycles;
`torch.compile` reduced the step to 1.8 s (~28%) through fusion, after which flash
attention's share rose from 38% to 58% because other kernels became cheaper.

Source: [Deep Dive: GPU Profiling - I](https://piyushk52.github.io/jekyll/update/2026/08/08/profiling.html)

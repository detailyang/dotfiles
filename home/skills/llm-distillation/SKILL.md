---
name: knowledge-distillation
description: >
  Expert-level knowledge about AI/ML knowledge distillation — a training paradigm where a student model learns from a teacher model. Use this skill whenever the user asks about knowledge distillation, teacher-student learning, model compression via distillation, soft targets, KD loss, on-policy distillation, off-policy distillation, self-distillation, multi-teacher distillation, sequence-level KD, GKD (Generalized Knowledge Distillation), OPD (On-Policy Distillation), MOPD (Multi-Teacher On-Policy Distillation), OPSD (On-Policy Self-Distillation), DistilBERT, soft labels, temperature scaling, KL divergence in distillation, or any RL–distillation hybrid method. Also trigger when asked about compressing large LLMs into smaller ones, transferring capabilities from frontier models, exposure bias in autoregressive models fixed via student rollouts, or synthetic data pipelines for model training.
---

# Knowledge Distillation — Expert Reference

## What is Distillation?

Distillation is a training paradigm where a **student** model is optimized to reproduce behavior from a **teacher** model — typically to get a model that is cheaper, faster, smaller, or more specialized.

**Core token-level objective:**
$$\mathcal{L}_{KD}(\theta) = \mathbb{E}_{(x,y)}\left[D\left(p_T(\cdot \mid x, y_{<t}) \,\Vert\, p_S^\theta(\cdot \mid x, y_{<t})\right)\right]$$

where $D$ is a divergence (forward KL, reverse KL, JSD, or hybrid).

---

## Taxonomy Overview

Distillation is best understood along **four orthogonal axes**:

| Axis | Options | What It Determines |
|---|---|---|
| **Teacher update pattern** | Offline, Online, Semi-Online | Whether teacher is frozen, co-trained, or partially adapted |
| **Trajectory source** | Off-policy, On-policy | Whether sequences come from datasets/teachers or from the student |
| **Target type** | Hard, Soft, Feature, Preference, Reward-like | Type of supervision signal |
| **Teacher identity** | External, Self, Multi-teacher, Peer ensemble | Where the teacher signal comes from |

---

## Reference Files

For deep dives, read the appropriate reference:

- **`references/foundations.md`** — Temperature scaling, divergences, token-level distillation, teacher-student formulation, implementation notes
- **`references/offline-online.md`** — Offline distillation, online distillation (Deep Mutual Learning), semi-online hybrids
- **`references/off-policy.md`** — Off-policy distillation, sequence-level KD, logit distillation, synthetic data pipelines
- **`references/on-policy.md`** — GKD, OPD, REOPOLD, ExOPD, RL–distillation hybrids (SDPO, RLSD, SRPO, OpenClaw-RL), failure modes
- **`references/self-distillation.md`** — Self-distillation forms, OPSD, RL via self-distillation, hindsight alignment, agentic SD
- **`references/multi-teacher.md`** — MOPD, see-saw problem, teacher routing, Nemotron-Cascade 2
- **`references/decision-guide.md`** — When to use each method, comparison tables, practical progressions

---

## Quick Method Lookup

### Off-Policy Distillation
- Student trains on **fixed external trajectories** (teacher-generated, human-labeled, or synthetic)
- Simple, stable, scalable; canonical starting point
- Weakness: train–inference mismatch (exposure bias)
- Key papers: Hinton et al. 2015, Kim & Rush 2016 (Seq-KD), Sanh et al. 2019 (DistilBERT)

### On-Policy Distillation (OPD)
- Student **generates its own rollouts**; teacher evaluates those exact trajectories
- Mitigates exposure bias; dense token-level feedback over student-visited states
- More compute-intensive but better for long-horizon reasoning
- Key papers: Agarwal et al. 2024 (GKD), Ko et al. 2026 (REOPOLD), Yang et al. 2026 (ExOPD)

### Self-Distillation (SD)
- **No separate external teacher** — teacher signal derived from same model (earlier checkpoint, privileged context, ensemble view)
- Modern forms use contextual asymmetry: student sees only the problem; teacher sees verified solution
- Key papers: Zhao et al. 2026 (OPSD), Hübotter et al. 2026 (RLSD), Yang et al. 2026 (RLSD-RLVR)

### Multi-Teacher Distillation (MOPD)
- Student learns from **multiple specialist teachers** simultaneously
- Solves the "see-saw problem" — gaining in one domain without regressing in others
- Key papers: MOPD article (yumo.dev), Yang et al. 2026 (Nemotron-Cascade 2)

### Online Distillation
- **Teacher co-evolves** with student during training (peers teach each other)
- Adaptive supervision; no single superior teacher required
- Key papers: Zhang et al. 2017 (Deep Mutual Learning), Li et al. 2022 (Shadow KD)

---

## Divergence Quick Reference

| Divergence | Formula | Behavior | Best Used When |
|---|---|---|---|
| **Forward KL** | $D_{KL}(p_T \| p_S)$ | Mean-seeking; covers all teacher modes | Off-policy, classical KD |
| **Reverse KL** | $D_{KL}(p_S \| p_T)$ | Mode-seeking; penalizes unlikely student tokens | On-policy (student rollouts) |
| **JSD** | $\beta D_{KL}(p_T\|m) + (1-\beta)D_{KL}(p_S\|m)$ | Symmetric, bounded, stable | Stability-critical settings |

**RL Interpretation of Reverse KL (per-token advantage):**
$$A_t = \log p_T(y_t \mid x, y_{<t}) - \log p_S(y_t \mid x, y_{<t})$$

Positive = teacher prefers this token; Negative = teacher rates it worse than student.

---

## Common Training Progressions

**Standard Modern LLM Pipeline:**
1. **Off-Policy SFT** — Train on teacher-generated synthetic data (broad capability acquisition)
2. **Reinforcement Learning** — RLHF or RLVR for alignment/reasoning (sparse rewards)
3. **On-Policy Distillation** — Dense token-level feedback over student rollouts (capability consolidation)

**Multi-Domain Post-Training:**
1. Parallel RL training across domains → specialist teacher checkpoints
2. MOPD to merge specialists into one student without see-saw regression
3. Optional: OPSD / hindsight alignment for further self-improvement

---

## Key RL–Distillation Hybrids (2026)

| Paper | Core Idea |
|---|---|
| **GKD** (Agarwal 2024) | Unifies off/on-policy via λ mixture; reverse KL on student rollouts |
| **SDPO** (Hübotter 2026) | Converts textual feedback into dense self-distillation signal (RLRF) |
| **ExOPD** (Yang 2026) | OPD + reward extrapolation → student can exceed teacher |
| **REOPOLD** (Ko 2026) | Relaxed OPD; clips over-imitation; log-ratio as token rewards |
| **RLSD** (Yang 2026) | RLVR sets direction; self-distillation sets magnitude |
| **SRPO** (Li 2026) | Routes correct→GRPO, incorrect→self-distillation correction |
| **OpenClaw-RL** (Wang 2026) | Agentic hindsight OPD; tool outputs → dense supervision |
| **OPSD** (Zhao 2026) | Same model as teacher+student; teacher sees verified solution |
| **MOPD** (Xu 2026) | Multiple specialist teachers score same student rollout |

---

## OPD Failure Modes & Fixes

Three critical failure patterns (read `references/on-policy.md` for full detail):

1. **Token Overlap Failure** (Li et al. 2026) — Teacher and student thinking patterns must be compatible; use off-policy cold start before OPD
2. **Length Inflation / Repetition Collapse** (Luo et al. 2026 / StableOPD) — Add reference-based divergence constraint; mix on-policy with clean reference rollouts
3. **Sampled-Token Bias** (Fu et al. 2026) — Replace single-token supervision with teacher top-K local support matching

---

## Chess Analogy (Intuition)

- **Off-policy distillation** = watching grandmaster games → learn strong moves but only in expert positions
- **Reinforcement learning** = play games, get win/loss at the end → on-policy but sparse
- **On-policy distillation** = chess engine evaluates every move in *your own* games → dense feedback on self-generated states

This is the clearest intuition for why OPD outperforms off-policy KD on long-horizon reasoning tasks.

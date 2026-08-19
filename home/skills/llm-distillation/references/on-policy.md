# On-Policy Distillation (OPD)

## Core Idea and Formal Objective

Student **first generates rollouts**, then teacher evaluates those exact trajectories:

$$\mathcal{L}_{\text{on-policy}}(\theta) = \mathbb{E}_{x \sim \mathcal{D}}\left[\mathbb{E}_{\hat{y} \sim p_S(\cdot \mid x)}\left[\sum_{t=1}^{|\hat{y}|} D\left(p_T(\cdot \mid x, \hat{y}_{<t}) \,\Vert\, p_S(\cdot \mid x, \hat{y}_{<t})\right)\right]\right]$$

Key: student receives feedback precisely **in the contexts it will encounter at inference**. Combines on-policy relevance of RL with dense per-token feedback of distillation.

Introduced formally in **Agarwal et al. 2024 (GKD)** as an imitation-learning problem in the style of DAGGER.

## Intuition: The Chess Analogy

Instead of watching grandmaster games (off-policy) or receiving only a win/loss (RL), the student gets **move-by-move evaluations of its own games** — identifying exactly which moves caused the rollout to go off track.

## Generalized Knowledge Distillation (GKD)

Unifies off-policy and on-policy under a single framework:
- With probability $\lambda$: sample trajectory from student (on-policy)
- With probability $1-\lambda$: use trajectory from fixed dataset (off-policy)

When $\lambda=0$: standard supervised distillation  
When $\lambda=1$: fully on-policy training  
Intermediate: practical curriculum combining stability with robustness

**Empirical result:** On-policy GKD significantly outperforms supervised FT, supervised KD, and sequence-level KD on summarization, translation, and mathematical reasoning.

## Divergence and Reward Interpretation

**Reverse KL is especially natural for OPD** (rollout sampled from student):

$$D_{KL}(p_S \,\Vert\, p_T) = \mathbb{E}_{y \sim p_S}\left[\log\frac{p_S(y)}{p_T(y)}\right]$$

**Per-token advantage interpretation:**
$$A_t = \log p_T(y_t \mid x, y_{<t}) - \log p_S(y_t \mid x, y_{<t})$$

- $A_t > 0$: teacher rates this token above student → positive update
- $A_t < 0$: teacher rates this token below student → negative update

This makes OPD a **natural replacement for the advantage term in GRPO-style RL**.

## RL–Distillation Hybrid Methods

### GKD (Agarwal et al. 2024)
Core framework. λ-mixture of on/off-policy; reverse KL on student rollouts. Foundational paper.

### SDPO / Reinforcement Learning via Self-Distillation (Hübotter et al. 2026)
Converts textual critiques, runtime errors, verifier feedback → dense token-level updates.

**Implementation:**
- Build teacher distribution conditioned on original trajectory + natural-language feedback
- Replay student trajectories under feedback-augmented teacher context
- Same base model as both student and teacher (no external teacher needed)
- Especially effective for coding/reasoning where runtime errors are highly informative
- RLVR: scalar reward $r$ (information bottleneck). RLRF: tokenized feedback (richer signal)

### ExOPD / Learning beyond Teacher (Yang et al. 2026)
OPD + reward extrapolation → student can **exceed teacher quality**.

**Implementation:**
- Reference teacher provides dense token-level supervision
- External reward estimates how much better/worse current trajectory is vs. teacher baseline
- Distillation loss reweighted by reward-derived scaling factors
- Trajectories outperforming teacher receive amplified updates
- Decouples "who provides dense supervision" from "who defines ultimate objective"

### REOPOLD / Scaling Reasoning Efficiently via Relaxed OPD (Ko et al. 2026)
Reduces over-imitation, improves stability, scales reasoning training.

**Implementation:**
- Token-level teacher–student log-likelihood ratios treated as dense rewards (like reverse-KL advantages)
- Relax strict imitation by clipping/tempering overly strong penalties on low-value tokens
- Use partial rollouts and truncated reasoning traces to reduce compute
- Stop-gradient operation creates formal OPD↔RL connection
- Designed for reasoning tasks where exact teacher imitation is unnecessarily restrictive

### RLSD / Self-Distilled RLVR (Yang et al. 2026)
RLVR sets **direction** of updates; self-distillation sets **magnitude** of updates.

**Implementation:**
- Privileged self-teacher receives verified answer or reasoning trace
- RLVR computes trajectory-level correctness rewards (determines sign of policy updates)
- Self-distillation scales token-level update magnitudes by teacher confidence
- Separation: "where to move" (RLVR) vs. "how strongly to move" (SD)
- Reduces information leakage vs. pure privileged self-distillation

### SRPO / Unifying GRPO and Self-Distillation via Sample Routing (Li et al. 2026)
Routes correct samples → GRPO; incorrect samples → self-distillation correction.

**Implementation:**
- Correct rollouts: standard GRPO (group-relative policy optimization)
- Incorrect rollouts: replay under privileged teacher context → dense token-level correction via KL(P ‖ stopgrad(Q))
- Routing based on verifier outcomes or reward thresholds
- Preserves efficient RL updates on successes; extracts richer supervision from failures

### OpenClaw-RL (Wang et al. 2026)
Extends RL–distillation to **interactive agents**; environment feedback → hindsight OPD.

**Implementation:**
- Replay original trajectory with subsequent user/environment feedback
- Hindsight-conditioned teacher evaluates what actions would be preferable given later information
- Tool outputs, GUI changes, terminal states → dense correction signals
- Supports conversational agents, coding agents, and embodied control
- Asynchronous architecture: environment server + PRM/Judge + Megatron (training) + SGLang (serving)

## Practical Failure Modes and Fixes

OPD should be viewed as a **fragile communication protocol** between teacher and student through locally plausible next-token choices. (Qwen3, GLM-5, MiMo all use OPD but note brittleness.)

### 1. Token Overlap / Thinking-Pattern Failure (Li et al. 2026)

**Problem:** OPD success requires compatible teacher–student thinking patterns. ~97-99% of probability mass in top-K tokens must overlap for supervision to be useful. A stronger teacher may actually pull an RL-improved student backward toward older reasoning patterns.

**Fixes:**
- **Off-policy cold start** before OPD (align student's reasoning style to teacher first)
- Select prompts aligned with teacher's reasoning style (benchmark superiority ≠ good OPD teacher)
- Monitor overlap among high-probability tokens at student-visited prefixes
- Track teacher continuation advantage vs. rollout prefix length (advantage can drop sharply on long prefixes)

### 2. Length Inflation and Repetition Collapse (Luo et al. 2026 / StableOPD)

**Problem:** Abrupt length inflation → repetition saturation → truncation collapse, a major OPD failure mode.

**Fixes:**
- Track average rollout length, truncation rate, and repetition rate during training (not just validation accuracy)
- Add **reference-based divergence constraint** (prevents rapid drift into repetitive prefixes)
- **Mix on-policy with clean reference trajectories** (prevents training distribution from becoming dominated by repetitive garbage)
- Treat repeated tokens as high-risk (teacher may assign high local probability after prefix is already repetitive)
- Stop/downweight updates from truncation-dominated batches

### 3. Sampled-Token Bias (Fu et al. 2026)

**Problem:** Sampled-token OPD observes only one token per position → biased and fragile when student samples from low-probability regions where teacher guidance is unreliable.

**Fixes:**
- Replace single-token supervision with **teacher top-K local support matching** (renormalize both distributions over teacher's plausible next-token set)
- Use **top-p rollout sampling** to reduce chance of drifting to very low-probability prefixes
- Mask special tokens and tokenizer artifacts to avoid fake disagreements from token boundary mismatches
- Prefer truncated reverse KL over one-token log-ratio updates when teacher top-K logits are affordable
- Evaluate whether per-token advantages combine into coherent gradient directions (not canceling across positions)

## Practical Training Loop

1. **Sample prompts** from task dataset or synthetic prompt pool
2. **Student generates rollout** — record token IDs, attention masks, per-token student log-probs
3. **Teacher evaluates rollout** — computes token-level log-probs conditioned on student's exact prefixes (much cheaper than full generation; teacher only evaluates, not generates)
4. **Compute divergence/advantage** — teacher–student discrepancies → dense learning signals
5. **Apply clipping/masking** — suppress unstable or low-value updates; separate reasoning vs. formatting token weights
6. **Backpropagate through student only** — teacher remains fixed

**Key efficiency insight:** Teacher only needs to *evaluate* the student's trajectory, not generate its own. This makes teacher inference substantially cheaper than full rollout generation.

## When to Choose On-Policy Distillation

- Long-horizon reasoning tasks where exposure bias has large impact
- Student diverges substantially from training distribution during deployment
- Dense token-level feedback is needed but a separate RL reward model is unavailable or noisy
- After RL training, to consolidate and transfer improvements into a smaller or more efficient student
- When the gap between training-time trajectories and inference-time trajectories is causing visible degradation

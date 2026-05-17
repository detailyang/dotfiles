# Self-Distillation

## What Is Self-Distillation?

Self-distillation removes the requirement for a **separate, larger external teacher**. Instead, the student learns from a teacher signal derived from itself — across time, contexts, checkpoints, roles, or conditioning views.

Addresses two practical constraints:
1. Cost or unavailability of strong external teachers
2. Desire to refine a model using its own knowledge and structure

Modern forms have evolved beyond compression into: iterative self-improvement, reasoning refinement, and RL-style policy optimization.

## Core Formulation

Both student and teacher are derived from same base model:
- $p_S^\theta$: student policy
- $p_T^\phi$: teacher policy (earlier checkpoint, ensemble, or same model under privileged conditioning)

Training objective:
$$\mathcal{L}(\theta) = \mathbb{E}\left[D\left(p_T^\phi(\cdot \mid x, y_{<t}) \,\Vert\, p_S^\theta(\cdot \mid x, y_{<t})\right)\right]$$

The key distinction is not the loss, but **how the teacher signal is constructed**.

## Forms of Self-Distillation

### 1. Temporal Self-Distillation (Checkpoint-Based)
$$p_T = p_S^{\theta_{\text{old}}}$$
Student trained to stay close to historical version while improving on new data.

**Benefits:**
- Earlier checkpoints preserve capabilities that may degrade during later fine-tuning or RL
- Stabilizes optimization by preventing abrupt distributional shifts
- No external teacher required; highly sample-efficient
- Widely used in large-scale post-training alternating SFT and RL

### 2. Ensemble and Multi-View Self-Distillation
$$p_T = \frac{1}{K}\sum_{k=1}^{K} p_S^{\theta_k}$$

Ensemble members may differ in: prompt templates, sampling temperatures, checkpoints/adapters, retrieved context, or auxiliary information. Produces smoother, more robust supervision than any single view.

### 3. Contextual Self-Distillation (Modern, Most Important)

Uses **contextual asymmetry** rather than architectural asymmetry:

- Student: $p_S(\cdot \mid x)$ — sees only original task
- Teacher: $p_T(\cdot \mid x, y^\star)$ — receives privileged information

Where $y^\star$ may include: verified solutions, ground-truth reasoning traces, runtime feedback, tool outputs, user corrections.

**Creates a stronger teacher signal without a separate external model.**

## On-Policy Self-Distillation (OPSD) — Zhao et al. 2026

The most important modern form. From **Self-Distilled Reasoner** paper:

$$\mathcal{L}_{OPSD}(\theta) = \mathbb{E}_{(x, y^\star)}\mathbb{E}_{\hat{y} \sim p_S(\cdot \mid x)}\sum_{t=1}^{|\hat{y}|}D\left(p_T(\cdot \mid x, y^\star, \hat{y}_{<t}) \,\Vert\, p_S(\cdot \mid x, \hat{y}_{<t})\right)$$

**Two roles of the same LLM:**
- Student: generates on-policy response $\hat{y} \sim p_S(\cdot \mid x)$
- Teacher: evaluates that trajectory with privileged solution info $p_T(\cdot \mid x, y^\star, \hat{y}_{<n})$

Gradients backpropagate **only through student logits**.

**Key insight:** Models are often substantially better at *evaluating* a correct answer than *generating* it from scratch. Privileged teacher conditioning exploits this asymmetry.

**Implementation details:**
- Student rollout generated first; teacher only scores the trajectory (not generating independently)
- Teacher context = original prompt + privileged solution information (asymmetric supervision channel)
- Reverse KL often performs best in practice
- **Pointwise KL clipping** introduced to prevent stylistic tokens from dominating reasoning updates
- Separate weighting for reasoning tokens vs. formatting/filler tokens

## Self-Distillation as Reinforcement Learning

Per-token advantage from self-distillation:
$$A_t = \log p_T(y_t) - \log p_S(y_t)$$

This integrates naturally into PPO-, GRPO-, and RLVR-style training loops.

## Key Papers

### Reinforcement Learning via Self-Distillation / SDPO (Hübotter et al. 2026)
Converts textual feedback → dense token-level supervision.

**Framework:**
1. Generate student trajectory
2. Obtain textual critiques, runtime errors, or verifier feedback
3. Condition teacher on original trajectory + feedback signal
4. Replay trajectory under teacher context → token-level corrections

**Implementation details:**
- Runtime execution errors → corrective teacher contexts for coding tasks
- Same model instantiates both student and teacher views (reduced infrastructure)
- Teacher supervision applied only to tokens causally related to detected failure
- Supports free-form textual critiques, not just scalar rewards
- Compatible with online rollout generation and asynchronous replay buffers

### Self-Distilled RLVR (Yang et al. 2026)
Combines self-distillation + RLVR:
- Self-distillation: modulates **update magnitudes**
- RLVR: determines **optimization direction**

**Implementation details:**
- Privileged teacher observes verified answers/traces unavailable to student
- RLVR computes trajectory-level correctness rewards (determines sign of updates)
- Self-distillation scales token-level update magnitudes by teacher confidence
- Separation: "where to move" (RLVR) vs. "how strongly to move" (SD)
- Reduces information leakage vs. pure privileged self-distillation

### Aligning Language Models from User Interactions (Kleine Buening et al. 2026)
Hindsight self-distillation from conversational signals.

**System:**
1. Record original assistant response
2. Observe subsequent user interaction (correction, clarification, follow-up)
3. Reconstruct how assistant should ideally have responded with hindsight
4. Distill this hindsight policy into original model

**Implementation details:**
- Future user messages = privileged hindsight information
- Same trace supports RL-style preference learning + dense token-level distillation
- Teacher conditioning includes conversation continuation context (unavailable during original generation)
- Leverages production interaction logs without manual labeling
- Token-level advantages: penalize filler tokens, reinforce direct answers
- Improves correction behavior and conversational adaptability

### OpenClaw-RL / Agentic Self-Distillation (Wang et al. 2026)
Extends to interactive agents. Tool outputs, GUI transitions, user replies, environment state changes → dense self-distillation feedback.

**Implementation details:**
- Agent trajectories replayed after observing downstream environment changes
- Hindsight-conditioned teacher evaluates preferable actions given later observations
- Tool outputs → token-level corrective supervision
- Supports asynchronous interaction logs from real deployments
- Applies to conversational, coding, and embodied systems

## Advantages of Self-Distillation

| Advantage | Description |
|---|---|
| **No external teacher required** | Eliminates or reduces dependence on expensive frontier models |
| **Continual self-improvement** | Uses interaction traces, runtime feedback, privileged contexts |
| **Natural RL integration** | Per-token advantage signals fit PPO/GRPO loops |
| **Capability preservation** | Maintains abilities across post-training stages without new architectures |
| **Simplified infrastructure** | Teacher and student share same backbone |

## Limitations and Failure Modes

| Limitation | Description |
|---|---|
| **Error amplification** | May reinforce own errors if privileged teacher signal is weak or noisy |
| **Capability ceiling** | Cannot easily exceed model family's inherent ceiling without external rewards/search |
| **Incorrect privileged info** | Can destabilize training more severely than ordinary supervised errors |
| **Information leakage** | Careless rollout replay can leak ground-truth into student via teacher context |
| **Over-regularization** | Dense self-distillation may over-constrain stylistic behavior without careful clipping/masking |

## When to Choose Self-Distillation

- External frontier teachers are unavailable or prohibitively expensive
- Model contains latent capability unlockable through hindsight conditioning or privileged evaluation
- Interaction traces, tool outputs, or verifier signals available as dense feedback sources
- RL alone is too sparse or unstable
- Continuous online adaptation required in production systems

**Note:** Modern self-distillation increasingly blurs the line between supervised learning, RL, and iterative self-improvement — one of the most rapidly evolving areas in post-training research.

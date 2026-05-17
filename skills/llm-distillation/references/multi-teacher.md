# Multi-Teacher Distillation

## Core Formulation

Student learns from $K$ teacher models $\{p_{T_k}\}_{k=1}^{K}$ simultaneously:

$$\mathcal{L}(\theta) = \mathbb{E}_{x, y}\left[\sum_{k=1}^{K} w_k(x, y)\, D\left(p_{T_k}(\cdot \mid x, y_{<t}) \,\Vert\, p_S^\theta(\cdot \mid x, y_{<t})\right)\right]$$

**Teacher weights $w_k(x,y)$ may be:**
- Fixed constants (equal influence)
- Domain-specific routing scores (based on prompt classification)
- Confidence-based weights (derived from entropy, verifier scores, reward estimates)
- Outputs of a learned gating model (dynamic teacher selection)

**Fundamental principle:** No single teacher needs to be globally optimal; each teacher supervises the student in the regions where it is strongest.

## The See-Saw Problem

Sequential post-training often improves one capability while degrading others:
- RL on math reasoning → reduced writing quality or conversational helpfulness
- Safety alignment → suppressed creative or exploratory behavior
- Coding fine-tuning → degraded general instruction following

Multi-teacher distillation mitigates this by exposing the student to **specialist teachers that preserve each domain's strongest behaviors**.

## Multi-Teacher On-Policy Distillation (MOPD)

The most influential modern variant. Student generates its own rollouts; multiple teachers score the same trajectory:

$$\mathcal{L}_{\text{MOPD}} = \mathbb{E}_{x}\mathbb{E}_{\hat{y} \sim p_S}\sum_{t}\sum_{k=1}^{K} w_k\, D_{KL}\left(p_S(\cdot \mid x, \hat{y}_{<t}) \,\Vert\, p_{T_k}(\cdot \mid x, \hat{y}_{<t})\right)$$

Because all teachers evaluate the same student-generated rollout, the student learns how **each specialist would improve its behavior in the states it actually visits**.

## Reverse KL and Advantage Interpretation

For each teacher, per-token improvement signal:
$$A_t^{(k)} = \log p_{T_k}(y_t \mid x, y_{<t}) - \log p_S(y_t \mid x, y_{<t})$$

Aggregated update:
$$A_t = \sum_{k=1}^{K} w_k\, A_t^{(k)}$$

This formulation allows each teacher to contribute a **dense advantage estimate**, insertable directly into GRPO- or PPO-style policy optimization loops.

## Teacher Selection and Routing Strategies

| Strategy | Description |
|---|---|
| **Domain-based routing** | Math teacher for math prompts, coding teacher for code, etc. |
| **Entropy-based weighting** | Higher weight to confident teachers (low entropy) |
| **Verifier-score weighting** | Weight proportional to teacher's correctness on the specific problem type |
| **Learned routing** | Train a classifier to predict which teacher is most useful per prompt |
| **Uniform weighting** | Equal contribution from all teachers (simple baseline) |

## Key Papers

### Nemotron-Cascade 2 (Yang et al. 2026)
Post-training LLMs with Cascade RL and Multi-Domain On-Policy Distillation.

**Strategy:**
- Run parallel RL training across multiple domains → produce specialist teacher checkpoints
- Apply multi-domain OPD from strongest intermediate teacher models to:
  - Recover benchmark regressions after broader Cascade RL
  - Sustain capability gains across domains simultaneously

**Key insight:** Multi-domain OPD used *after* RL for capability consolidation, not as a replacement for RL.

### MOPD Article (Xu / yumo.dev)
Describes MOPD as "a new post-training primitive" — capability consolidation tool after or during RL.

**Advantages of MOPD over sequential training:**
- All specialist knowledge transferred simultaneously (avoids catastrophic forgetting)
- See-saw oscillations dampened by joint teacher constraints
- Reverse KL advantages aggregate naturally into single policy gradient update
- Compatible with standard RL infrastructure (GRPO, PPO)

## Engineering and Systems Design

| Component | Considerations |
|---|---|
| **Teacher serving infrastructure** | Multiple inference servers, one per teacher domain; batched log-prob queries |
| **Routing/weighting** | Prompt classifier or per-token entropy; runs before or in parallel with rollout generation |
| **Log-probability aggregation** | Weighted sum of per-teacher KL divergences or advantages at each token position |
| **Compute budget** | $K$ teachers means $K\times$ teacher inference cost per rollout; mitigate with batching and async query |
| **Teacher compatibility** | All teachers must tokenize identically to student for direct log-prob comparison |
| **Teacher storage** | Full teacher checkpoints vs. LoRA adapters for different domains |

## Advantages

| Advantage | Description |
|---|---|
| **Capability consolidation** | Merges specialist knowledge without sequential catastrophic forgetting |
| **See-saw mitigation** | Domain regressions dampened by simultaneous multi-domain constraints |
| **RL integration** | Weighted advantage aggregation fits naturally into GRPO/PPO loops |
| **Flexible teacher composition** | Teachers can be: different model families, RL-trained specialists, best checkpoints across stages |
| **Scalable supervision** | Additional teachers provide signal in new domains without new architecture |

## Limitations and Challenges

| Limitation | Description |
|---|---|
| **Teacher inference cost** | $K\times$ cost per rollout; may bottleneck throughput |
| **Teacher conflict** | Conflicting teacher signals on ambiguous prompts can produce incoherent updates |
| **Routing errors** | Misrouting a prompt to the wrong specialist teacher degrades supervision quality |
| **Architecture coupling** | All teachers must share student's tokenizer (critical constraint) |
| **Weight sensitivity** | Poorly tuned teacher weights can cause one domain to dominate and replicate see-saw effect |

## When to Choose Multi-Teacher Distillation

- Multiple domain-specialist models exist and need to be consolidated into one student
- Sequential fine-tuning is causing regressions in previously strong domains
- RL training has created specialist models that individually outperform any general model
- Capability breadth is valued alongside depth
- Post-RL stabilization is needed to recover benchmark regressions without full retraining
- Building a general-purpose student from a set of task-specific experts

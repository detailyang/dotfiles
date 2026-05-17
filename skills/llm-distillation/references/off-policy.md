# Off-Policy Distillation

## Definition and Formal Objective

Student trains on trajectories from an **external source** — not from the student itself:

$$\mathcal{L}_{\text{off-policy}}(\theta) = \mathbb{E}_{(x,y) \sim \mathcal{D}}\left[D\left(p_T(\cdot \mid x, y_{<t}) \,\Vert\, p_S^\theta(\cdot \mid x, y_{<t})\right)\right]$$

The student does **not** determine the contexts on which it is supervised.

## Sources of Off-Policy Data

| Source | Description |
|---|---|
| **Human-labeled datasets** | Expert-written responses, translations, preference annotations, curated reasoning traces |
| **Teacher-generated synthetic** | Stronger model generates answers, CoT traces, critiques, tool-use demos |
| **Filtered synthetic corpora** | Multiple candidates generated → highest-quality retained via verifiers/reward models |
| **Historical model outputs** | Prior checkpoints or production logs relabeled by stronger models |

## Sequence-Level Distillation (Kim & Rush 2016)

Most common off-policy method for LLMs. Trains student on full teacher-generated outputs:

$$\mathcal{L}_{\text{SeqKD}} = \mathbb{E}_{x}\left[-\log p_S(y_T \mid x)\right], \quad y_T \sim p_T(\cdot \mid x)$$

Simplifies target distribution (one teacher-selected response vs. multiple valid outputs) → easier optimization, but loses distributional richness.

## Logit Distillation

Student matches teacher's full next-token distribution:

$$\mathcal{L}_{\text{logit}} = \mathbb{E}_{(x,y)}\sum_t D_{KL}\left(p_T(\cdot \mid x, y_{<t}) \,\Vert\, p_S(\cdot \mid x, y_{<t})\right)$$

Preserves uncertainty information, token similarities, and alternative plausible continuations. Especially effective when teacher is much stronger and student has sufficient capacity.

## Synthetic Data Pipelines

Typical off-policy LLM distillation workflow:

1. **Collect prompts** — benchmarks, user interactions, or auto-generated prompt sets covering target domains
2. **Teacher generates candidates** — one or more completions per prompt, often with intermediate reasoning traces or tool-use steps
3. **Evaluate outputs** — reward models, verifiers, or teacher models assess correctness, helpfulness, consistency
4. **Filter/rerank** — select highest-quality outputs; remove low-confidence or incorrect examples
5. **Store as synthetic corpus** — completions, CoT traces, verifier scores, teacher log-probabilities
6. **Train student** — sequence-level distillation, logit matching, or hybrid objective

**Synthetic dataset contents may include:**
- Detailed chain-of-thought traces (expose intermediate reasoning steps)
- Verified code solutions (ensure programs pass unit tests or execution checks)
- Critiques and revisions (teach self-diagnosis and improvement)
- Tool-use transcripts (API calls, output interpretation, retrieved information)
- Preference annotations (relative quality judgments for alignment)

## Advantages

- Operationally simple (resembles standard supervised fine-tuning on fixed dataset)
- Highly stable and reproducible (same precomputed examples reused across runs)
- Teacher inference amortized efficiently (generated once, consumed many times)
- Scales naturally to very large datasets and distributed training
- Integrates seamlessly with synthetic data generation pipelines

## Limitations: Distribution Mismatch (Exposure Bias)

At inference, student samples $\hat{y} \sim p_S(\cdot \mid x)$, which may diverge from teacher-generated sequences. Errors **compound** over long trajectories because each token conditions on all prior tokens.

The Thinking Machines analogy: like learning chess solely by watching grandmasters — you see excellent play, but only in positions the expert encounters, not positions created by your own mistakes.

## Behavioral Consequences

Students trained purely off-policy tend to exhibit:
- Strong performance when generated prefixes remain close to training distribution
- **Limited recovery from early mistakes** that push into unfamiliar contexts
- **Increased exposure bias**, especially on long-horizon reasoning and agentic tasks
- Stylistic imitation of teacher without fully reproducing underlying reasoning competence
- Overconfident predictions when trained on single deterministic targets

## Comparison with RL and OPD

| Method | Trajectory Source | Reward Density |
|---|---|---|
| Off-policy KD | Teacher or dataset | Dense token-level |
| RLHF / RLVR | Student | Sparse sequence-level |
| On-policy distillation | Student | Dense token-level |

Off-policy distillation is highly sample-efficient but less robust than on-policy approaches.

## Modern Pipeline Staging

The RLHF Book presents this as "the path to on-policy distillation":

1. **Synthetic data generation + filtering** → high-quality off-policy supervision
2. **Off-policy distillation** → student absorbs teacher's broad capabilities
3. **Reinforcement learning** → refine behaviors hard to specify directly in dataset
4. **On-policy distillation** → transfer RL benefits into smaller/more efficient model

## Engineering Considerations

**Operational simplicity:**
- Teacher inference asynchronous; large batch sizes maximize accelerator utilization
- Training examples store: token IDs, reasoning traces, verifier scores, optional top-k log-probs
- Synthetic datasets reused across experiments and student architectures
- Student training fully independent; no synchronous teacher communication needed

**Primary costs:** Generating synthetic data, storing large corpora, maintaining filtering/verification infrastructure.

## When to Choose Off-Policy Distillation

- Simplicity and stability are more important than exact train–inference matching
- Large synthetic datasets already available or economically generatable
- Teacher inference can be amortized offline and reused across many experiments
- Student is unlikely to diverge substantially from training distribution during deployment
- Primary goal is broad capability transfer rather than maximal robustness to self-generated errors
- It remains the **dominant starting point** for most practical pipelines, even when OPD or RL stages are planned

# Foundations of Knowledge Distillation

## Teacher–Student Formulation

Classical distillation considers two models:
- **Teacher** $p_T$: large, high-performing, usually frozen
- **Student** $p_S^\theta$: smaller/more efficient, being trained

Key insight (Hinton et al. 2015): the teacher's **soft output probabilities** encode richer information than hard labels — they reveal inter-class similarities.

**Core offline teacher–student loss:**
$$\mathcal{L}_{KD}(\theta) = \mathbb{E}_{x \sim \mathcal{D}}\left[D\left(p_T(\cdot \mid x) \,\Vert\, p_S^\theta(\cdot \mid x)\right)\right]$$

**Combined with supervised learning:**
$$\mathcal{L}(\theta) = \alpha \mathcal{L}_{CE}(\theta) + (1-\alpha)\mathcal{L}_{KD}(\theta)$$

**Online/mutual distillation (K peers):**
$$\mathcal{L}_i(\theta_i) = \mathcal{L}_{\text{task}}(\theta_i) + \lambda \sum_{j\neq i} D\left(p_j^{\theta_j}(\cdot \mid x) \,\Vert\, p_i^{\theta_i}(\cdot \mid x)\right)$$

## Temperature Scaling and Soft Targets

Temperature scaling softens teacher logits $z_i$ with $T > 1$:
$$p_T^{(T)}(i \mid x) = \frac{\exp(z_i / T)}{\sum_j \exp(z_j / T)}$$

**Distillation loss with temperature:**
$$\mathcal{L}_{KD} = T^2 \cdot D_{KL}\big(p_T^{(T)} \,\Vert\, p_S^{(T)}\big)$$

The $T^2$ factor keeps gradient magnitudes stable. Higher $T$ = smoother distribution = more visible low-probability classes.

**Implementation note:** For LLMs with large vocabularies (~100K tokens), computing full softmax is expensive. In practice, use **top-k approximation** selecting top tokens from teacher (forward KL) or student (reverse KL).

## Token-Level Distillation in Autoregressive Models

For language models, distillation is applied per-token. Given input $x$ and generated tokens $y = (y_1, \dots, y_n)$:

$$D_{KL}(p_T \,\Vert\, p_S)(y \mid x) = \frac{1}{|y|}\sum_{t=1}^{|y|} D_{KL}\left(p_T(\cdot \mid x, y_{<t}) \,\Vert\, p_S(\cdot \mid x, y_{<t})\right)$$

**The critical implication:** Training quality depends heavily on the **distribution of prefixes $y_{<t}$** — which directly motivates the off-policy vs. on-policy distinction.

## Divergence Choices and Effects

| Divergence | Formula | Behavior | Notes |
|---|---|---|---|
| **Forward KL** | $D_{KL}(p_T \| p_S)$ | Mean-seeking | Penalizes missing teacher modes; used in classical KD |
| **Reverse KL** | $D_{KL}(p_S \| p_T)$ | Mode-seeking | Penalizes unlikely student tokens; natural for on-policy |
| **JSD** | $\beta D_{KL}(p_T\|m) + (1-\beta)D_{KL}(p_S\|m)$, $m = \beta p_T + (1-\beta)p_S$ | Bounded, symmetric | Better stability; interpolates between the two |

**Engineering note (TRL writeup):** Top-k approximations differ by divergence direction — select top tokens from teacher for forward KL, from student for reverse KL.

## Classical Distillation Variants

### Supervised (Logit-Level) Distillation
$$\mathcal{L}_{SD} = \mathbb{E}_{(x,y)}\left[D_{KL}\big(p_T \,\Vert\, p_S\big)(y \mid x)\right]$$
Dense supervision at every token; preserves distributional richness.

### Sequence-Level Distillation (Kim & Rush 2016)
$$\mathcal{L}_{SeqKD} = \mathbb{E}_{x}\left[-\log p_S(y_T \mid x)\right], \quad y_T \sim p_T(\cdot \mid x)$$
Trains on full teacher-generated outputs; simpler but loses distributional richness.

### Representation Distillation (DistilBERT, Sanh et al. 2019)
Aligns hidden states, attention maps, embeddings. DistilBERT uses three combined losses:
- Masked language modeling loss
- KL distillation loss on softened logits
- Cosine embedding loss on hidden representations

Useful when student architecture differs significantly from teacher; can be extended to attention map matching, value/key projection matching, contrastive alignment.

## Limitations of Classical Distillation

| Limitation | Description |
|---|---|
| **Distribution mismatch** | Student trains on fixed trajectories but generates its own at inference; errors compound |
| **Teacher bias / mode collapse** | Forward KL causes overly smooth or low-confidence outputs |
| **Capacity mismatch** | If student can't represent teacher distribution, forward KL may produce unrealistic samples |
| **Data inefficiency** | Off-policy distillation trains on trajectories the student would never generate |
| **Teacher staleness** | Frozen teacher can't adapt to student's changing failure modes late in training |
| **Non-stationarity (online)** | Co-trained teacher changes targets over time, complicating optimization |

## Implementation Considerations

**For large-scale LLM distillation:**
- **Log-probability extraction:** Use separate inference server (e.g., vLLM) with batched requests and compressed logprob transmission
- **Top-k approximation:** Full-vocabulary KL (~100K tokens) is expensive; use top-k to reduce memory/bandwidth
- **Batching and caching:** Buffer student generations, batch teacher evaluations, precompute and reuse teacher outputs
- **Hybrid objectives:** Combine SFT + distillation + RL signals in single pipeline
- **Offline pattern:** Separate teacher inference from student optimization; precompute, cache, audit, reuse
- **Online pattern:** Coordinate co-trained models; adds communication overhead but provides adaptive supervision
- **Semi-online:** Periodically refresh teacher checkpoints while preserving offline stability

# Offline and Online Distillation

## Offline Distillation

### Core Definition

Teacher is **pretrained and frozen**; student optimizes against stationary teacher:

$$\mathcal{L}_{\text{offline}}(\theta) = \mathbb{E}_{(x,y)\sim\mathcal{D}}\left[D\left(p_T(\cdot \mid x, y_{<t}) \,\Vert\, p_S^\theta(\cdot \mid x, y_{<t})\right)\right]$$

Key property: $\nabla_\phi \mathcal{L}_{\text{offline}} = 0$ (teacher parameters never change).

Canonical examples: Hinton et al. 2015 (soft-label KD), DistilBERT (Sanh et al. 2019)

### Offline ≠ Off-Policy (Important Distinction)

- **Offline vs. online** = whether teacher is frozen or co-trained
- **Off-policy vs. on-policy** = where trajectories come from

Most offline distillation is also off-policy, but **offline can be on-policy** — a frozen teacher can score student-generated rollouts (exactly what modern OPD does). The teacher stays frozen (offline) but trajectory distribution changes (on-policy).

### Common Forms

| Form | Description |
|---|---|
| **Soft-Label Distillation** | Teacher provides full probability distributions, often with temperature scaling |
| **Sequence-Level Distillation** | Teacher generates complete outputs as training targets (Kim & Rush 2016) |
| **Representation Distillation** | Student matches hidden states, attention maps, embeddings |
| **Preference/Reward Distillation** | Teacher provides rankings, scalar rewards, or critiques |
| **Precomputed offline** | Teacher outputs generated once and stored |
| **Live offline** | Frozen teacher queried during training (parameters unchanged) |

### Advantages
- **Stability:** Target distribution doesn't change during training
- **Reproducibility:** Repeated runs see identical teacher behavior
- **Engineering simplicity:** Teacher and student optimization fully decoupled
- **Caching efficiency:** Teacher outputs stored and reused across experiments
- **Scalability:** Large teachers can supervise many student experiments

### Limitations
- **Teacher staleness:** Cannot adapt to student's evolving weaknesses
- **Distribution mismatch:** Student may not learn to recover from its own mistakes
- **Storage costs:** Precomputing token-level distributions is expensive
- **Capability ceiling:** Student fundamentally bounded by teacher performance and biases

### Modern LLM Usage

Used for: compressing frontier models, generating synthetic instruction/reasoning datasets, transferring capabilities after RL/alignment, creating baseline models before on-policy fine-tuning.

### Implementation Pattern

1. **Select/train the teacher** — strong model, ensemble, specialist checkpoint, or post-RL model
2. **Freeze teacher parameters** — keep frozen throughout; ensures stationary supervision
3. **Generate/query teacher outputs** — hard targets, soft probabilities, hidden-state targets, critiques, preferences
4. **Store targets or log-probabilities** — cache teacher completions, token IDs, top-k log-probs, embeddings; full-vocabulary logits usually too expensive
5. **Train the student** — cross-entropy on teacher tokens, KL on teacher probs, MSE on hidden states, or hybrid
6. **Evaluate and iterate** — benchmarks, teacher agreement, latency, memory; if underperforms: improve teacher data, change divergence, adjust temperature, increase top-k, introduce on-policy rollouts

---

## Online Distillation

### Core Definition

Multiple models train simultaneously, teaching each other; supervision distribution **evolves** during training:

$$\mathcal{L}_i(\theta_i) = \mathcal{L}_{\text{task}}(\theta_i) + \lambda \sum_{j \neq i} D\left(p_j(\cdot \mid x) \,\Vert\, p_i(\cdot \mid x)\right)$$

All models update concurrently: $\nabla_{\theta_j} \mathcal{L}_j \neq 0$ for all participants.

Canonical example: **Deep Mutual Learning** (Zhang et al. 2017) — peer networks learn collaboratively, each acting as both student and teacher.

### Four Combinations (Online/Offline × Off/On-Policy)

| | Off-Policy | On-Policy |
|---|---|---|
| **Offline** | Classical KD with frozen teacher and fixed data | Modern OPD: frozen teacher scores student rollouts |
| **Online** | Peer models exchange predictions on fixed data | Co-evolving models generate and score own trajectories |

Most historical online distillation is **online + off-policy** (shared minibatches). Modern LLM systems increasingly explore **online + on-policy** hybrids.

### Major Forms

| Form | Description |
|---|---|
| **Mutual Learning** | Each model teaches every other (Deep Mutual Learning) |
| **Co-Distillation** | Large-scale jobs periodically exchange predictions/checkpoints |
| **Peer Ensembles** | Multiple comparable models jointly learn and average predictions |
| **Adaptive Teacher** | Stronger model periodically updated, continues to supervise students |
| **Population-Based** | Population with different objectives/hyperparameters exchanges knowledge |

### Advantages
- Adaptive supervision that addresses newly emerging failure modes
- Improved generalization; peers reduce overconfidence and improve calibration
- No need for single superior teacher
- Regularization effects from mutual agreement
- Compatible with distributed training systems

### Limitations
- Higher system complexity; models must train simultaneously or synchronize
- Non-stationary targets complicate optimization
- Risk of consensus errors if all participants share biases
- Significant compute overhead vs. single frozen teacher

### Semi-Online Hybrids

- **Checkpoint refresh:** Frozen teacher periodically replaced by latest strong checkpoint
- **Teacher ensembles:** Static teacher supplemented with co-trained peers
- **Shadow teachers:** Auxiliary teachers updated asynchronously for fresher supervision

**Key finding (Li et al. 2022, Shadow KD):** Much of online distillation's advantage comes from **reversed student-to-teacher transfer** rather than only simultaneous training.

### Modern LLM Appearances

Online principles appear in: multi-agent self-improvement systems, self-play and debate frameworks, checkpoint-based teacher refresh pipelines, distributed co-training, self-distillation with periodically updated snapshots.

### Implementation Pattern

1. **Initialize multiple models/peers** — may differ in architecture, initialization, objective, or specialization
2. **Train each model on primary objective** — supervised, RL, or hybrid loss per participant
3. **Exchange predictive distributions** — at each step or periodically; models compute logits/hidden states/critiques
4. **Compute mutual distillation losses** — each model matches peer distributions via KL, JSD, etc.
5. **Update all models concurrently** — gradients applied to every participant (each acts as both teacher and student)
6. **Synchronize/refresh when needed** — may occur asynchronously or at checkpoint boundaries in distributed systems
7. **Evaluate individual and ensemble performance** — assess whether joint learning improves standalone models, ensembles, and calibration

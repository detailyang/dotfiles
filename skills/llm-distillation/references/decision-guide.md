# Decision Guide: Choosing a Distillation Method

## Full Comparison Table

| Property | Off-Policy KD | On-Policy KD | Self-Distillation | Multi-Teacher KD | Online KD |
|---|---|---|---|---|---|
| **Trajectory source** | External (teacher/dataset) | Student rollouts | Student rollouts | Student rollouts | Fixed batches or student rollouts |
| **Teacher source** | External frozen model | External frozen model | Same model (privileged) | Multiple external models | Co-trained peers |
| **Teacher frozen?** | Yes | Yes | Yes (architecturally same) | Yes | No (co-evolving) |
| **Supervision density** | Dense token-level | Dense token-level | Dense token-level | Dense token-level | Dense token-level |
| **Exposure bias** | High | Low | Low | Low | Medium |
| **Compute cost** | Low (amortized) | Medium-High | Medium | High ($K\times$ inference) | High (multiple models) |
| **Engineering complexity** | Low | Medium | Medium | High | High |
| **RL integration** | Staged (after RL) | Natural (replaces/augments) | Natural (advantage-like) | Natural (aggregated advantages) | Possible |
| **Capability ceiling** | Teacher-bounded | Teacher-bounded | Model-family-bounded | Best-teacher-bounded | Ensemble-bounded |
| **Regression risk** | Low | Low | Medium (amplification) | Low (mitigated by routing) | Medium (consensus errors) |

## When to Choose Each Method

### Choose Off-Policy Distillation When:
- Simplicity and stability matter most
- Large synthetic datasets already available or cheaply generatable
- Teacher inference can be amortized offline and reused
- Student unlikely to diverge significantly from training distribution during deployment
- Goal is broad capability transfer, not fine-grained robustness to self-generated errors
- Starting point before any RL or OPD stages

### Choose On-Policy Distillation When:
- Long-horizon reasoning, coding, or agentic tasks where exposure bias matters
- Student generates notably different contexts than training data at inference
- Dense token-level feedback needed but RL reward model unavailable or noisy
- Existing synthetic data coverage of student's failure modes is insufficient
- After RL training, to consolidate improvements into smaller/more efficient student
- Strong teacher exists whose log-probs can be queried on arbitrary prefixes

### Choose Self-Distillation When:
- External frontier teachers unavailable or prohibitively expensive
- Model contains latent capability unlockable via hindsight/privileged conditioning
- Interaction traces, tool outputs, or verifier signals available as dense feedback
- RL alone too sparse or unstable for the task
- Continuous online adaptation required in production
- Conversational alignment from user interactions is the goal

### Choose On-Policy Self-Distillation (OPSD) When:
- Same as self-distillation above, plus:
- Model is substantially better at *evaluating* correct answers than *generating* them
- Verified solutions or ground-truth reasoning traces are available
- Long reasoning chains are needed where the model struggles but can recognize good reasoning
- Inference compute is constrained (no separate teacher server required)

### Choose Multi-Teacher Distillation When:
- Multiple domain-specialist models exist needing consolidation into one student
- Sequential fine-tuning causes regressions (see-saw problem is occurring)
- RL training has produced specialists that individually outperform any general model
- Capability breadth and depth must coexist
- Post-RL stabilization needed to recover benchmark regressions without full retraining
- Building a general-purpose student from a set of task-specific experts

### Choose RL–Distillation Hybrids When:
- Both exploration (RL) and dense supervision (distillation) are needed
- Sparse RL rewards make policy optimization unstable alone
- Rich textual feedback (errors, critiques, explanations) is available but not scalar rewards
- Student needs to potentially *exceed* teacher (ExOPD)
- Wanting to separate update direction (RL) from update magnitude (SD)

## Recommended Practical Progression

**Standard LLM capability development:**
```
Off-Policy SFT (synthetic data)
    → RL (RLHF / RLVR for alignment/reasoning)
    → On-Policy Distillation (consolidate RL gains, fix exposure bias)
    → [Optional] Multi-Teacher OPD (if multi-domain regression occurred)
```

**Resource-constrained / no external teacher:**
```
Self-Distillation (temporal: earlier checkpoint)
    → OPSD (if verified solutions available)
    → SDPO / RLSD (if textual feedback / verifier signals available)
```

**Multi-domain post-training:**
```
Parallel domain RL → specialist teachers
    → MOPD to consolidate all specialists simultaneously
    → Evaluate: did MOPD recover all regressions?
    → If yes: done. If no: targeted domain SFT + re-MOPD
```

## Key Takeaways

1. **Off-policy is the starting point** — even when OPD or RL are planned, begin with synthetic data generation
2. **Offline ≠ off-policy** — a frozen teacher (offline) can evaluate student rollouts (on-policy); these are orthogonal axes
3. **Reverse KL is natural for on-policy** — it's a student-sampled, mode-seeking objective aligned with inference behavior
4. **The OPD advantage term connects to RL** — $A_t = \log p_T(y_t) - \log p_S(y_t)$ can replace GRPO advantages
5. **Self-distillation is not weaker than external distillation** — privileged conditioning makes a strong signal without external model
6. **Multi-teacher MOPD solves the see-saw problem** — the dominant approach for post-RL capability consolidation
7. **OPD is brittle** — always use cold start, monitor token overlap, watch for length inflation
8. **Distillation and RL are complementary** — RL provides direction/exploration; distillation provides density/stability

## Systems Complexity Comparison

| Method | Infrastructure | Compute | Maintenance |
|---|---|---|---|
| Off-policy KD | Teacher server (once) | Low (amortized) | Low |
| On-policy KD | Teacher server (online) + rollout buffer | Medium | Medium |
| Self-distillation (OPSD) | Single model server | Medium | Low |
| Multi-teacher MOPD | K teacher servers + router | High | High |
| Online KD | K concurrent training jobs | Very High | Very High |
| RL–distillation hybrid | Policy + teacher + reward model | High | High |

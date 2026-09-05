---
name: llm-distillation
description: Explain or design teacher-student knowledge distillation, including off/on-policy, self- and multi-teacher approaches. Not generic quantization, model serving or permission to start training.
---

# LLM Distillation

Identify the student's task, evaluation data, teacher access (text, logits or
features), model/tokenizer compatibility, compute budget and quality constraints.
For explanations, use the known context rather than turning every field into a
question. For design work, mark assumptions that materially change the choice.

Separate four independent axes: teacher update pattern, trajectory source, target
signal and teacher identity. Do not equate online training with on-policy data.

## Read only the relevant reference

- [Overview](references/overview.md) for a broad taxonomy or historical method lookup.
- [Foundations](references/foundations.md) for temperature, losses and implementation.
- [Offline/online](references/offline-online.md) for how teachers evolve.
- [Off-policy](references/off-policy.md) for fixed trajectories and synthetic data.
- [On-policy](references/on-policy.md) for student rollouts, GKD and failure modes.
- [Self-distillation](references/self-distillation.md) for teacher/student asymmetry.
- [Multi-teacher](references/multi-teacher.md) for routing and specialist trade-offs.
- [Decision guide](references/decision-guide.md) when selecting a practical approach.

Before recommending a paper-specific method, verify the primary paper, objective,
rollout source and reported evaluation setup. Distinguish sampled-token feedback
from a full-distribution loss; confirm support/tokenizer alignment before comparing
teacher and student probabilities. Do not promise that one method always wins.

Return the recommendation or explanation, decisive trade-offs and a reproducible
evaluation plan where applicable. Training, paid teacher calls, dataset uploads and
artifact publication require task authorization; reading this skill grants none.

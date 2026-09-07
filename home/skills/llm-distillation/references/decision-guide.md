# Decision Guide: Choosing A Distillation Setup

Choose from task constraints and evaluation evidence, not a mandatory training
sequence. Teacher updates, trajectory source, supervision signal and teacher
identity are independent axes; the labels below are not competing complete recipes.

## Establish The Available Signals

| Constraint or evidence | Candidate to evaluate | Main check |
| --- | --- | --- |
| Only teacher text or an existing synthetic corpus is available | Sequence-level/off-policy distillation | Coverage, filtering, task quality and behavior on student-generated prefixes |
| Student errors lead to prefixes absent from the dataset | On-policy or mixed-trajectory distillation | Teacher usefulness on those prefixes, rollout cost and stability |
| Compatible teacher probabilities are available | Distribution-level losses | Token/support alignment, loss direction, truncation bias and quality |
| No external teacher, but verified answers, feedback or useful earlier checkpoints exist | Self-distillation | A genuinely better teacher signal, leakage and error amplification |
| Several specialists cover different domains | Multi-teacher supervision | Routing/weighting, conflicting signals, per-domain regressions and serving cost |
| Teacher signals need to evolve during training | Online or periodically refreshed teachers | Non-stationarity, synchronization and reproducibility |
| A verifier supplies useful rewards as well as teacher feedback | An RL/distillation hybrid | Objective, gradient estimator, stability and an ablation against simpler baselines |

A frozen teacher can score on-policy rollouts. Self-distillation can use fixed data
or current student trajectories; a multi-teacher setup can do either too. A teacher
view with stopped gradients is not necessarily a permanently frozen checkpoint.
Do not infer any of these choices solely from the method name.

## Select A Starting Point

Reuse the current student's capabilities and available data. A new synthetic-data
or off-policy warm-start stage is a candidate only when coverage or measured
teacher/student mismatch justifies it. An already suitable checkpoint does not need
to repeat that stage before on-policy work.

Use the cheapest baseline that can test the proposed supervision signal. Add
student rollouts when their state coverage matters, another teacher when it adds
measured domain value, or RL when its reward addresses something the simpler
objective cannot. These stages can be combined or omitted; there is no universal
SFT -> RL -> OPD requirement.

For on-policy self-distillation, establish why the teacher view is better, such as
verified solution information or useful feedback unavailable to the student.
Check that privileged information does not leak into student inputs or evaluation.
Shared weights may reduce checkpoint storage but do not eliminate rollout and
teacher-scoring costs.

For multi-domain consolidation, compare per-domain results before and after
joint supervision. Multi-teacher losses may mitigate forgetting but do not
necessarily recover every specialist's performance or avoid conflicting updates.

## Loss And Stability Decisions

Forward KL, reverse KL, mixed divergences and sampled feedback impose different
objectives and support requirements. Choose using the available teacher signal,
student capacity and task evaluation, not trajectory source alone. A token
log-ratio is not automatically a drop-in replacement for an RL advantage; verify
the paper's objective, sampling, normalization and gradient estimator.

Monitor task quality, per-domain regressions, rollout length, truncation,
repetition and teacher/student agreement when relevant. A mismatch can justify a
warm start, a different teacher, mixed trajectories or a different loss. Do not use
a paper's token-overlap percentage as a universal threshold.

## Cost And Acceptance

Record the task metric and permitted regressions, correctness/quality gates,
representative and holdout inputs, teacher access, model/tokenizer compatibility,
compute budget and a reproducible evaluator. Compare against the current baseline
using the same conditions and include rollout, serving, storage and synchronization
costs that the chosen setup actually incurs.

When citing a named method or comparative result, verify its primary source and
setup using the relevant method reference. Do not promise that students must stay
below a teacher, that self-distillation always matches external teachers, or that
one distillation family universally wins. Training, paid calls, uploads and
publication still require task authorization.

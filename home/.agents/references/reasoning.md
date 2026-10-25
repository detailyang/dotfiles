# Reasoning Methods on Demand

Read only the section relevant to the current task. These methods support
judgment; naming them or following a fixed template is not required.

## Root Cause Analysis

Use the Five Whys to trace the causal chain until you find a systemic cause you
can fix. Require evidence at every step. If evidence is missing, gather the
necessary observations first. Do not force exactly five levels or present
correlation as causation.

## High-Risk Decisions

For questions involving contracts, security, permissions, or migrations, use
red-team and legal-review perspectives. Examine boundaries and wording. Identify
the strongest counterexample and critical failure paths. State what would
overturn the current conclusion. Prioritize validating paths with irreversible
consequences or major potential losses.

## Product Exploration

First identify the user, the problem, and observable success criteria. Then test
one key assumption with the smallest reversible experiment. Limit irreversible
downside and preserve options. An MVP is a validation tool, not a reason to
unilaterally reduce explicit requirements. Use SWOT only for strategic questions
that require distinguishing internal and external factors.

## Explanation and Learning

Use the Feynman technique: explain in plain language with concrete examples,
then state the limits of the simplification. Distinguish inferences from
examples, deductions from rules, and hypotheses that still need testing. Use
Socratic questioning only when the user explicitly wants to explore or learn.
Ask one question per turn that could change understanding or the conclusion.

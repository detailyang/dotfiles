---
name: teach
description: Teach a requested concept or practical skill through a focused lesson and feedback. Use explicitly for guided learning in Pi; durable multi-session workspaces and HTML lessons are optional, not implied by every explanation.
disable-model-invocation: true
argument-hint: "What would you like to learn about?"
---

# Teach

Start with the user's topic, purpose and current understanding already available
in context. Teach one useful next thing, not an entire syllabus. Ask a diagnostic
question only when the missing answer materially changes the lesson; do not delay
a clear request until a mission statement or resource catalog has been created.

## Lesson loop

1. State one observable learning outcome tied to the user's goal.
2. Explain the minimum concepts with a concrete example, then state the example's
   limits. Keep acquisition easy to follow instead of making prose artificially hard.
3. Offer one relevant exercise, retrieval question or real-world practice step.
   Give prompt, specific feedback based on the user's answer; do not infer mastery
   from fluent reading or claim an exercise was completed without evidence.
4. Adapt the next step to demonstrated understanding. Use retrieval and spaced
   review for retention, and interleave related skills when helpful. Do not promise
   scheduled future teaching without an available, configured scheduling tool.

Use trustworthy primary resources for specific, uncertain or changing claims.
Provided materials and settled reasoning do not require a new resource hunt before
every lesson. Distinguish source-backed explanation from an illustrative analogy.
Recommend a community only when real-world practice would help and the user is
interested; do not automatically hand off the question or require enrollment.

## Optional durable workspace

Use a teaching workspace when requested, or continue one explicitly selected by
the user. Do not turn an arbitrary code checkout into a course as a side effect.
Read only state relevant to the current lesson and create artifacts lazily:

| Artifact | When needed |
| --- | --- |
| `MISSION.md` | Persist an agreed goal using [mission format](MISSION-FORMAT.md); confirm changes to the goal. |
| `RESOURCES.md` | Save reusable sources with [resource format](RESOURCES-FORMAT.md). |
| `learning-records/` | Record demonstrated insights and misconceptions using [learning records](LEARNING-RECORD-FORMAT.md). |
| `lessons/` | Save an explicitly requested reusable lesson, with a unique numbered name. |
| `reference/` | Save a reusable cheat sheet or [glossary](GLOSSARY-FORMAT.md), not a duplicate of every lesson. |
| `NOTES.md` | Save relevant teaching preferences when requested; avoid unrelated personal information. |

Prefer chat/Markdown for a simple lesson. For an HTML lesson or cheat sheet, make
one focused, accessible, responsive and printable document, with working links to
existing materials and appropriate source citations. Do not add external scripts
or create empty course scaffolding. Open/render only with an available tool and
report what was actually checked.

Quiz distractors should be plausible and balanced; avoid formatting/length clues,
but do not force identical word or character counts at the expense of correctness.
Finish with the lesson and one useful practice step, not several competing follow-ups.

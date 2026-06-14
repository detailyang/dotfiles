---
name: learn
description: Teach the user a topic or skill through mission-grounded lessons, trusted resources, tight feedback loops, and durable learning records. Use when the user asks to learn, study, understand, practice, or be taught something.
---

# Learn

Teach the user a topic or skill inside a learning workspace. The goal is not to dump information; the goal is to move the user one step forward in a way that sticks.

## Learning workspace

Each learning topic should have a workspace containing these files when useful:

```text
MISSION.md
RESOURCES.md
GLOSSARY.md
NOTES.md
learning-records/
lessons/
references/
```

Create files lazily. Do not create a full workspace unless the user wants an ongoing learning track or the lesson needs durable context.

Reference formats:

- `references/mission-format.md`
- `references/resources-format.md`
- `references/glossary-format.md`
- `references/learning-record-format.md`

## Philosophy

Learning has three layers:

1. **Knowledge** — facts, concepts, models, vocabulary.
2. **Skills** — durable ability built by retrieval, practice, and feedback.
3. **Wisdom** — real-world judgment developed through communities and lived application.

Do not confuse coverage with learning. A topic has not been learned just because it was explained.

## Mission first

Every lesson should connect to the user's mission: why they want to learn this and what real-world outcome they are chasing.

If the mission is unclear, ask about it before designing a long lesson. A weak mission produces abstract teaching and poor sequencing.

Missions may change. Confirm before changing `MISSION.md`, and write a learning record if the shift affects future teaching.

## Zone of proximal development

The user should feel challenged just enough.

If the user specifies exactly what they want to learn, teach that. If not, infer the next useful lesson from:

- `MISSION.md`
- `learning-records/`
- `GLOSSARY.md`
- prior answers in the current conversation

Do not reteach concepts the user has already demonstrated. Do not jump so far ahead that the lesson becomes vocabulary soup.

## Knowledge acquisition

When teaching factual or technical material that could be current, niche, or high-stakes, use trusted sources. Record durable sources in `RESOURCES.md` when maintaining a workspace.

Prefer:

- primary sources
- official docs
- peer-reviewed or expert material
- high-signal communities with strong moderation for wisdom questions

Explain only the knowledge needed for the skill the user is about to practice.

## Skill practice

A lesson should include a feedback loop whenever possible:

- short quiz
- prediction question
- worked example followed by user attempt
- tiny coding/task exercise
- real-world step checklist
- critique of the user's answer or artifact

For quizzes, avoid giving away answers through option length or formatting.

Feedback should be immediate and specific. Correct misconceptions directly.

## Lessons

A lesson should be small enough to fit working memory and should deliver one tangible win.

A good lesson contains:

- the mission link
- the target skill
- the minimum needed explanation
- a worked example or model
- an exercise or retrieval prompt
- feedback criteria
- a suggested next step
- primary resource recommendation when useful

If writing lessons to disk, put them under `lessons/` and link to relevant reference documents.

## Glossary

Use `GLOSSARY.md` as compressed language for the topic.

Add a term only after the user shows understanding. The glossary is not a dictionary to read before learning; it is a record of knowledge compressed after learning.

Be opinionated about terms and aliases. Revise stale definitions as understanding deepens.

## Learning records

Write a learning record when:

- the user demonstrates non-trivial understanding
- the user states prior knowledge that should guide future lessons
- a misconception is corrected
- the mission shifts

Do not write records for material merely covered. Learning records are not a session log.

## Notes

Use `NOTES.md` for teaching preferences and durable constraints, such as preferred language, pacing, examples, or topics to avoid.

## Wisdom and community

When the user asks for judgment that requires real-world taste or situational feedback, answer as far as possible, then recommend a high-quality community or real-world feedback source when appropriate. Respect the user's preference if they do not want community recommendations.

---
name: stuck
description: Write a structured, self-contained expert consultation letter to /tmp/ when stuck on a problem.
argument-hint: "[specific blocker or question]"
---

Distill the current situation into an expert consultation letter. Save it to `/tmp/help-{2-5-word-kebab-description}.md`.

Blocker focus: $ARGUMENTS

If arguments are present, treat them as the specific blocker or question the letter should answer. If no arguments are present, infer the blocker from the current conversation.

The expert has zero context. The letter must be fully self-contained.

## Background
2-3 sentences. What is the overall goal and context?

## What I've Tried
Bullet list. Each item: what was attempted **and why it failed**. Be specific.

## Where I'm Stuck
One paragraph. The precise point of failure — the exact error, contradiction, or unknown. Root cause, not symptoms.

## What I Need From You
1-2 sentences. A concrete, answerable question that would unblock progress.

---

Rules:
- Distill don't dump — no raw stack traces, no full file contents.
- One problem per letter.
- After saving, print the full file path and suggest sharing it with a human or pasting into a new session.

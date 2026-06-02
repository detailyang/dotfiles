---
description: Compact the current conversation into a handoff document for another agent to pick up.
argument-hint: "What will the next session be used for?"
---

Write a handoff document so a fresh agent can continue the work without re-reading the conversation. Save it to a path produced by `mktemp /tmp/handoff-XXXXXX.md`.

If the user passed arguments, treat them as the focus of the next session and tailor the document accordingly. If no arguments were passed, infer the most likely next step from the conversation.

## Document structure

```markdown
# Handoff: {one-line summary}

Date: {YYYY-MM-DD}
Next focus: {what the next session should accomplish}

## Current state
{2–3 sentences. What was attempted, what worked, where things stand right now.}

## Key decisions made
{Bullet list. Each item: decision + one-line rationale. Omit obvious choices.}

## What to do next
{Ordered steps. Concrete — no placeholders. Each step produces a visible result.}

## Artifacts
{Paths or URLs to files produced in this session that the next agent should read.
Do not duplicate content already in those files — reference them here.}

## Suggested skills
{If specific /skills should be activated in the next session, list them here with a one-line reason each.
Omit if no particular skill is needed.}

## Open questions
{Anything unresolved. If none, omit this section.}
```

After saving, print the full file path.

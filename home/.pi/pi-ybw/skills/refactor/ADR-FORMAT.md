# ADR Format

Create an ADR only when a rejected architecture candidate has a durable reason future reviews need to remember.

## Path

Use `docs/adr/NNNN-short-slug.md`, incrementing `NNNN` from existing ADRs.

## Structure

```md
# NNNN. {Decision}

Date: {YYYY-MM-DD}

## Status

Accepted

## Context

{The architectural pressure, constraint, or rejected candidate that made the decision necessary.}

## Decision

{The decision in one or two paragraphs.}

## Consequences

- {Positive consequence}
- {Negative or limiting consequence}
- {Future review guidance}
```

## Rules

- Record decisions, not preferences.
- Include the rejected alternative when it is likely to be suggested again.
- Skip ADRs for temporary timing, obvious constraints, or low-cost choices.

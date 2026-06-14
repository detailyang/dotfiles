# Learning Record Format

Learning records live in `learning-records/` and use sequential numbering:

```text
0001-short-slug.md
0002-short-slug.md
```

Create the directory lazily when the first record is written.

They capture non-obvious lessons, prior knowledge, corrected misconceptions, and mission shifts that should steer future lessons.

## Template

```md
# {Short title}

{1-3 sentences: what was learned or established, and why it matters for future sessions.}
```

## Optional sections

Use only when valuable:

- `Status: active | superseded by LR-NNNN`
- `Evidence` — how understanding was demonstrated
- `Implications` — what this unlocks or rules out

## When to write one

Write a record when:

1. the user demonstrates genuine understanding of a non-trivial concept
2. the user discloses prior knowledge and its depth
3. a misconception is corrected
4. the mission changes in a way that affects future lessons

Do not write one for material merely covered. Coverage is not learning.

If a later record supersedes an earlier one, mark the old record as superseded instead of deleting it.

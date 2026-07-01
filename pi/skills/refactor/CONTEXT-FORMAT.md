# CONTEXT.md Format

Use `CONTEXT.md` for domain language only. It is a glossary, not a technical spec, plan, or scratch pad.

## Structure

```md
# {Context Name}

{One or two sentences describing the domain context.}

## Language

**{Canonical term}**:
{One or two sentences defining what the term is.}
_Avoid_: {nearby words that should not be used for this concept}
```

## Rules

- Add terms only when they are specific to this project context.
- Prefer canonical domain nouns over implementation names.
- Keep definitions short: define what the term is, not how it is implemented.
- List confusing alternatives under `_Avoid_`.
- Create `CONTEXT.md` lazily when the first term is resolved.

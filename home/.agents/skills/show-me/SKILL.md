---
name: show-me
description: Explain a technical or UI concept visually when asked to show, diagram, map or compare it. Choose text, a diagram, a diff or a focused HTML artifact only when clearer than prose.
---

# Show Me

<!-- Adapted from humanlayer/skills/plugins/show-me/skills/show-me/SKILL.md (MIT). See LICENSE. -->

Choose one small truthful visual, next to the explanation it supports. Ground
repository paths and symbols in inspected evidence; label hypothetical examples.
Prefer ASCII over Mermaid when equally clear. Do not add a preamble or repeat the
same information in several representations.

| Question | Representation |
| --- | --- |
| Algorithm or state | Pseudocode or state flow |
| Runtime interactions | Call tree or sequence diagram |
| Responsibility or UI composition | Shallow file/component tree |
| Existing shape changing | Diff-shaped sketch |
| Dense layout or interactive comparison | One self-contained HTML file |

Read [examples](references/examples.md) only for the selected representation.
Show a complete copyable block instead of a diff when omitted context would hide
ownership/order or most of the block is new.

For HTML, answer one question with representative data, responsive layout, semantic
markup, keyboard/focus behavior and repository-consistent visual conventions. Do
not add external dependencies or decoration that obscures the point. Open/render
with an available tool where possible; otherwise provide the exact artifact path
and say what was not inspected. Writing a file is not proof it was rendered.

Before delivery, check direction, ownership, ordering, labels and readability.
Remove nodes that do not help answer the user's question.

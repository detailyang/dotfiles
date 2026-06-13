---
name: learn
description: Tell the agent to zoom out and give broader context or a higher-level perspective. Use when you're unfamiliar with a section of code or need to understand how it fits into the bigger picture.
disable-model-invocation: true
argument-hint: "[code area, concept, module, or file]"
---

Learning focus: $ARGUMENTS

I don't know this area of code well. Go up a layer of abstraction. Give me a map of the relevant modules, callers, data flow, and key vocabulary. Use the project's domain glossary vocabulary where it exists, and call out any assumptions or unknowns.

If arguments are present, use them as the specific area to explain. If no arguments are present, infer the area from the current conversation or ask what to zoom out on.

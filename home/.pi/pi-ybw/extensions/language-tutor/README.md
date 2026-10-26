# language-tutor

Learn a foreign language while coding. Reviews prompts written in the language
you're learning, teaches you how to say what you couldn't yet when you prompt
in your native language, saves new words as spaced-repetition flashcards, and
turns assistant replies into bilingual immersive translations. See
[ATTRIBUTION.md](ATTRIBUTION.md) for provenance.

Nothing ever blocks: a prompt reaches the agent immediately while review runs
in parallel, and translation cards live only in the terminal — never sent back
to the LLM.

| Command | Behavior |
| --- | --- |
| `/translate` or `alt+t` | Translate the last assistant response into your native language. |
| `/flashcards` | Review flashcards captured by the Writing tutor (opens a native window via `glimpseui`). |
| `/lang` | Interactive settings menu. |
| `/lang check off\|on\|context` | Writing check & tutor mode (`context` sees the conversation). |
| `/lang tutor on\|off` | Keep or drop the writing tutor alone. |
| `/lang auto on\|off` | Auto-translate every final response. |
| `/lang native <code>` | Native language for translations and explanations (e.g. `zh-CN`, `ja`). |
| `/lang learning <code>` | Language you're practicing (e.g. `en`, `fr`). |
| `/lang model [provider/id\|id\|default]` | Model used for checks and translations. |
| `/lang context on\|off` | Let translations see the full session context (off by default). |

Defaults are learning English with native Simplified Chinese. Settings persist
in `~/.pi/agent/language-learn.json`; flashcards in `~/.pi/agent/flashcards.json`;
review limits and FSRS retention in `~/.pi/agent/flashcards-settings.json`.

`/flashcards` depends on the `glimpseui` native window package; if it is
unavailable in an environment, every other feature (writing check, writing
tutor, `/translate`, `/lang`) still works.

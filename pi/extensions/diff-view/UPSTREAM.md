# Upstream provenance

`diff-view` vendors only the rich diff implementation from:

- repository: `minuque/pi-cc-extensions`
- reviewed commit: `5d7a2666f51da9f450bd019af10200c88cc1df98`
- reviewed package: `pi-cc-extensions@0.8.69`
- license: MIT

The vendored diff implementation was adapted upstream from
`MasuRii/pi-tool-display`; its attribution remains in
`renderer/tool/diff/ATTRIBUTION.md`.

All other `pi-cc-extensions` behavior is intentionally excluded, including
compact rendering, thinking presentation, tool grouping, Markdown transforms,
status summaries, settings panels, commands, themes, and mouse handling.

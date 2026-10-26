# Attribution

This extension is adapted from
[mackt/pi-language-tutor](https://github.com/mackt/pi-language-tutor),
revision `e37716ef8590edf1ded03287aa854acf816d5dc6` (version 0.5.1).

The original implementation is Copyright (c) 2026 Mack and is provided under
the MIT License reproduced in [LICENSE](LICENSE).

Local changes drop the npm package wrapper (`language-learn.ts`, `package.json`,
`tsconfig.json`, lint/format config) in favor of this repository's extension
layout, folding the entry point into `index.ts`, and add this attribution
file. The `/translate` command is renamed to `/t`, and macOS option+t (`†`)
also triggers translation. The `src/`, `web/`, and `types/` implementation
files are otherwise unmodified. Tests are reauthored under `tests/` using this
repository's `node:test` conventions instead of the upstream Vitest suite.

# better-style

Keyboard-first Pi presentation extension derived from the rendering stack in
`minuque/pi-cc-extensions`.

## Included

- Claude Code-style tool cards and consecutive tool grouping
- rich `edit` / `write` diffs with auto, split, and unified layouts
- compact thinking titles, previews, animation, and duration tracking
- optional one-line compact assistant rounds
- Mermaid-to-ASCII, GitHub admonitions, URL linking, and Markdown cleanup
- working footer with elapsed time and exact or `~` estimated output tokens
- per-round command, file, failure, and duration summary
- `/better-style` keyboard settings panel

## Intentionally excluded

- upstream `/context`
- session and SubAgent `@` references or prompt injection
- `/clear` and `/exit` aliases
- custom startup header
- fullscreen Bash flush patch
- fullscreen mouse click, hover, scroll, terminal reporting, and related input hooks
- bundled Claude Code themes

The existing standalone `pi/extensions/context` extension is unchanged.

## Commands

```text
/better-style
/better-style panel
/better-style on
/better-style compact
/better-style off
/better-style status
```

`on` is the default. `compact` collapses each assistant round. `off` restores
Pi's native rendering.

## Configuration

Settings persist to:

```text
~/.pi/agent/better-style.json
```

The presentation-only boundary is enforced when the file is loaded: context,
reference, alias, and startup-header flags remain disabled even if stale values
try to enable them.

Tools registered by other extensions keep their own `renderCall`,
`renderResult`, or `renderShell` implementation by default. Pi's standard file,
shell, search, and web tools remain eligible for better-style rendering.

## Compatibility

- Pi packages: `^0.84.4`
- Node.js: `>=22.19.0`
- reviewed upstream package: `pi-cc-extensions@0.8.69`

See [`UPSTREAM.md`](./UPSTREAM.md) for provenance and update procedure.

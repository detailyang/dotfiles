# Upstream provenance

`better-style` selectively composes rendering modules from:

- repository: `minuque/pi-cc-extensions`
- npm package: `pi-cc-extensions@0.8.69`
- reviewed commit: `5d7a2666f51da9f450bd019af10200c88cc1df98`
- license: MIT

The dependency is pinned to an exact package version because this extension
imports internal TypeScript modules rather than the upstream package entrypoint.
That is intentional: the entrypoint also installs context inspection, session
references, aliases, startup chrome, and fullscreen mouse handling, which are
outside this extension's contract.

## Selected upstream modules

```text
feature/compact-thinking.ts
renderer/markdown-enhance.ts
renderer/default-mode.ts
renderer/compact-mode.ts
renderer/transcript-refresh.ts
renderer/tool/grouping.ts
renderer/tool/message-display.ts
renderer/tool/result.ts
renderer/tool/diff/**
```

Local code owns configuration persistence, command registration, renderer
assembly, external-renderer precedence, working status, and agent summaries.

## Upgrade procedure

1. Review the upstream diff from the pinned commit/version to the proposed one.
2. Confirm none of the selected modules adds terminal mouse input or imports the
   upstream aggregate entrypoint.
3. Verify internal exports consumed by `renderer.ts` and `index.ts` still exist.
4. Update the exact dependency version and reviewed commit above together.
5. Run `npm run check` from `pi/` and exercise `/better-style on`, `compact`,
   `off`, and the settings panel in a real TUI.

The rich diff implementation in the upstream package is adapted from
`MasuRii/pi-tool-display` under MIT; its attribution file remains distributed
inside the pinned dependency.

# diff-view

A focused Pi extension for rich `edit` and `write` diffs.

- Uses Pi's native tool call rendering and expansion state.
- Replaces only successful `edit` and `write` result rendering.
- Supports auto, split, and unified layouts with syntax highlighting.
- Captures previous write content to distinguish file creation from overwrite.
- Falls back to Pi's native renderer for partial or failed results.
- Shows an explicit warning when a write diff cannot be reconstructed safely.

Derived from the diff renderer in `minuque/pi-cc-extensions`. See
[UPSTREAM.md](./UPSTREAM.md) for provenance.

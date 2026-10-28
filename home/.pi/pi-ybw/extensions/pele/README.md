# Pele Mermaid rendering

Renders Mermaid diagrams with [Pele](https://pele.run/). Pele parses and lays out
the diagram; `@resvg/resvg-js` rasterizes its SVG for terminal previews.

## Behavior

- Complete fenced `mermaid` blocks in user and assistant messages render
  automatically.
- `render_mermaid` renders source from any Pi mode and returns PNG plus SVG file
  paths.
- Inline previews require a terminal that Pi detects as supporting Kitty or
  iTerm2 graphics. Other terminals show the source and a local SVG link.
- Generated files are stored under `.pi/pele/` in the session working directory.
- Links and images in diagram source are disabled. Source is never uploaded.

The package sets `markdown.mermaid` to `off`. The extension also disables Pi's
built-in Mermaid display in memory for the active session so Pele is the only
layout engine. It does not modify `settings.json` on disk.

## Limits

- Mermaid source: 50,000 characters.
- SVG output: 4,000,000 characters.
- Flowchart edges: 1,000.
- Raster output: at most 2048 pixels on either axis.
- Preview height: at most 32 terminal rows.
- In-memory cache: 32 diagrams or about 24 MiB.

Set `PI_PELE_FONT` to an absolute TTF, OTF, or TTC path when labels need a
specific font. Restart Pi after changing it.

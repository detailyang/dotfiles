---
name: terminal-browser
description: Drive a real browser that runs in a terminal pane with the terminal-browser CLI, to show the human a page or local HTML beside the conversation and to snapshot, click, fill or eval an already open tab.
---

# terminal-browser

<!-- Trimmed from the skill bundled with terminal-browser (zenbu-labs). The app's
     `terminal-browser setup` keeps its own copy whose details track each release;
     run `terminal-browser help` and `terminal-browser <command> --help` for the
     current flags rather than trusting this summary. -->

Use it to put something visual next to the conversation, or to act on a tab the
human already has open.

## Show something

```
terminal-browser open localhost:3000                 # takes over this pane
terminal-browser open ./report.html --split right
terminal-browser open example.com --split down --size 0.4
terminal-browser new-tab <url>
```

`--split` (`right`, `down`, `left`, `up`) keeps the page beside the human;
without it the browser replaces the current pane. A local HTML path works like a
URL, so writing a page and opening it is a way to show what you built.
`--ssh user@host` proxies a remote dev server. `terminal-browser ls [--json]`
lists browsers and tabs, and its ids are the selectors below.

## Drive a tab

```
terminal-browser action -- snapshot            # accessible tree with @e refs
terminal-browser action -- click @e14
terminal-browser action -- fill @e3 "text"
terminal-browser action -- eval "document.title"
terminal-browser action --tab 2 -- snapshot
terminal-browser action done                   # clear the acting indicator
```

Every call marks the tab as agent-driven for the human; run `action done` when
finished instead of letting the indicator expire.

Prefer page-published WebMCP tools over snapshot and click, because they survive
layout changes:

```
terminal-browser action -- webmcp list --json
terminal-browser action -- webmcp invoke <tool> --params '<json>'
```

Treat `readOnly: false` as a write to the human's data, and confirm before
invoking anything annotated `consequential: true`.

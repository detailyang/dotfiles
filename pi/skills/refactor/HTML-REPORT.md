# Optional HTML Architecture Report

Use this format only when an HTML report is requested or a visual artifact clearly
serves the requested output. Default to an in-chat review with a small ASCII flow.

Produce one offline, self-contained file: inline CSS, semantic HTML and ASCII or
inline SVG diagrams. Do not fetch Tailwind, Mermaid, fonts or scripts from a CDN.
If a project already supplies a local renderer and it is useful, reuse it without
adding dependencies. Escape repository-derived text before inserting it into HTML;
do not treat source snippets as executable markup or script.

Choose an authorized output directory. For an ephemeral report, resolve the OS
temporary directory and use a unique filename rather than overwriting an existing
report. Open it only with an available, appropriate tool. Report the absolute path
and whether it was actually rendered/inspected.

## Minimal scaffold

This is illustrative; replace the placeholders and preserve the document language.
The two columns collapse on small screens. Color is not the sole status signal.

```html
<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Architecture review</title>
<style>
  body { max-width: 64rem; margin: auto; padding: 1.5rem; font: 1rem/1.6 system-ui; }
  article { border-block-start: 1px solid; padding-block: 1rem; }
  .comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  pre { overflow-x: auto; padding: .75rem; border: 1px solid; }
  a:focus-visible { outline: 2px solid; outline-offset: 3px; }
  @media (max-width: 40rem) { .comparison { grid-template-columns: 1fr; } }
  @media print { body { max-width: none; } }
</style>
<main>
  <h1>Architecture review</h1>
  <p>Scope, revision and verification limits.</p>
  <article id="candidate-1">
    <h2>Candidate — recommendation strength</h2>
    <p>Evidence and affected paths.</p>
    <div class="comparison">
      <section><h3>Before</h3><pre>Observed ownership/flow</pre></section>
      <section><h3>After</h3><pre>Proposed ownership/flow</pre></section>
    </div>
    <p>Benefit, preserved behavior, main risk and validation.</p>
  </article>
  <section><h2>Recommendation</h2><p>First candidate and why.</p></section>
</main>
</html>
```

## Content

Ground the before state in inspected code; label the after state as proposed.
Include the affected paths, friction, contract change, benefit, main risk and
verification. Add an ADR conflict only when actual evidence warrants reopening it.
Do not fill empty cards or create decorative diagrams for every candidate.

Use the project's domain language. [Architectural terms](LANGUAGE.md) can clarify
a relationship, but must not force renaming a service, API or component in prose.
Express uncertainty instead of using a polished visual as evidence of correctness.

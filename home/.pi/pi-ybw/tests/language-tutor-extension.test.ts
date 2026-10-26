// Extension-level smoke coverage for the ported mackt/pi-language-tutor
// extension, using this repository's lightweight extension harness. The
// upstream Vitest suite (test/extension.test.ts, test/llm.test.ts) drives a
// full agent session against pi 1.0-only test utilities not available on the
// pinned pi-ai/pi-coding-agent 0.84.x here; the pure-logic behavior it covers
// is ported in full in language-tutor-core.test.ts and
// language-tutor-flashcards.test.ts. See extensions/language-tutor/ATTRIBUTION.md.
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, before, beforeEach } from "node:test";
import test from "node:test";
import { initTheme } from "@earendil-works/pi-coding-agent";
import { createExtensionHarness } from "./helpers/extension.ts";

// src/config.ts, src/flashcards.ts, and src/flashcard-settings.ts resolve
// their storage paths from os.homedir() once, at module import time. HOME
// must therefore be overridden *before* the extension module (and its
// transitive src/ imports) ever loads, so every test in this file stays
// isolated from the real user's config and flashcards. A static top-level
// import always runs before any other module code, hooks included, so the
// override happens here and the extension is loaded with a dynamic import.
const originalHome = process.env.HOME;
const testHome = fs.mkdtempSync(path.join(os.tmpdir(), "pi-language-tutor-test-"));
process.env.HOME = testHome;

const { default: languageTutor } = await import("../extensions/language-tutor/index.ts");

const TRANSLATION_ENTRY_TYPE = "lang-translation";

before(() => {
  initTheme("dark", false);
});

after(() => {
  process.env.HOME = originalHome;
  fs.rmSync(testHome, { recursive: true, force: true });
});

beforeEach(() => {
  fs.rmSync(path.join(testHome, ".pi"), { recursive: true, force: true });
});

test("/lang shows current settings when not in an interactive TUI", async () => {
  const harness = createExtensionHarness(languageTutor);
  await harness.command("lang");
  assert.equal(harness.notices.length, 1);
  assert.match(harness.notices[0], /learning=en/);
  assert.match(harness.notices[0], /native=zh-CN/);
  assert.match(harness.notices[0], /check=on/);
});

test("/lang native <code> updates and reports the setting", async () => {
  const harness = createExtensionHarness(languageTutor);
  await harness.command("lang", "native ja");
  assert.match(harness.notices.at(-1) ?? "", /native=ja/);
});

test("/lang check requires a valid value", async () => {
  const harness = createExtensionHarness(languageTutor);
  await harness.command("lang", "check sometimes");
  assert.match(harness.notices.at(-1) ?? "", /Usage: \/lang check off\|on\|context/);
});

test("/lang model reports an unknown model reference", async () => {
  const harness = createExtensionHarness(languageTutor);
  await harness.command("lang", "model does-not-exist");
  assert.match(harness.notices.at(-1) ?? "", /Model not found: does-not-exist/);
});

test("/translate notifies when there is no assistant message", async () => {
  const harness = createExtensionHarness(languageTutor);
  await harness.command("translate");
  assert.deepEqual(harness.notices, ["No assistant message to translate"]);
});

test("/translate notifies when no model is available", async () => {
  const harness = createExtensionHarness(languageTutor);
  harness.setBranch([
    { type: "message", message: { role: "assistant", content: [{ type: "text", text: "The result is ready." }] } },
  ]);
  await harness.command("translate");
  assert.deepEqual(harness.notices, ["No model available for translation (set one with /lang model)"]);
});

test("/flashcards requires interactive TUI mode", async () => {
  const harness = createExtensionHarness(languageTutor);
  await harness.command("flashcards");
  assert.deepEqual(harness.notices, ["/flashcards requires interactive TUI mode."]);
});

test("registers an entry renderer for bilingual translation cards", () => {
  const harness = createExtensionHarness(languageTutor);
  assert.equal(harness.entryRenderers.has(TRANSLATION_ENTRY_TYPE), true);

  const renderer = harness.entryRenderers.get(TRANSLATION_ENTRY_TYPE);
  const theme = {
    fg: (_color: string, text: string) => text,
    bg: (_color: string, text: string) => text,
    bold: (text: string) => text,
  };
  const entry = {
    type: "custom",
    customType: TRANSLATION_ENTRY_TYPE,
    data: {
      native: "zh-CN",
      segments: [{ kind: "pair", src: "Hello world.", dst: "你好世界。" }],
    },
  };
  const component = renderer(entry, { expanded: false }, theme);
  const rendered = component.render(80).join("\n");
  assert.match(rendered, /译文/);
  assert.match(rendered, /Hello world\./);
  assert.match(rendered, /你好世界。/);
});

test("renders nothing for a translation entry with no data", () => {
  const harness = createExtensionHarness(languageTutor);
  const renderer = harness.entryRenderers.get(TRANSLATION_ENTRY_TYPE);
  const theme = { fg: (_c: string, t: string) => t, bg: (_c: string, t: string) => t, bold: (t: string) => t };
  assert.equal(renderer({ type: "custom", customType: TRANSLATION_ENTRY_TYPE, data: undefined }, { expanded: false }, theme), undefined);
});

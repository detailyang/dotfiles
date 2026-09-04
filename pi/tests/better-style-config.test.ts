import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

async function loadConfigModule() {
  const directory = mkdtempSync(join(tmpdir(), "better-style-config-"));
  process.env.PI_CODING_AGENT_DIR = directory;
  const url = pathToFileURL(join(process.cwd(), "extensions", "better-style", "config.ts"));
  url.searchParams.set("test", String(Date.now()));
  const module = await import(url.href);
  return { directory, module };
}

test("better-style permanently disables non-presentation upstream features", async () => {
  const { directory, module } = await loadConfigModule();
  try {
    const normalized = module.normalizeConfig({
      mode: "compact",
      showStartupHeader: true,
      enableSessionReference: true,
      enableSubagentAutocomplete: true,
      enableContextCommand: true,
      enableAliases: true,
    });
    assert.equal(normalized.mode, "compact");
    assert.equal(normalized.showStartupHeader, false);
    assert.equal(normalized.enableSessionReference, false);
    assert.equal(normalized.enableSubagentAutocomplete, false);
    assert.equal(normalized.enableContextCommand, false);
    assert.equal(normalized.enableAliases, false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("better-style persists only to better-style.json", async () => {
  const { directory, module } = await loadConfigModule();
  try {
    module.updateConfig({ mode: "off", enableWorkingMessage: false });
    assert.equal(module.CONFIG_PATH, join(directory, "better-style.json"));
    const persisted = JSON.parse(readFileSync(module.CONFIG_PATH, "utf8"));
    assert.equal(persisted.mode, "off");
    assert.equal(persisted.enableWorkingMessage, false);
    assert.equal(persisted.enableContextCommand, false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

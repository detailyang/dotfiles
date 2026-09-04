import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const PI_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = join(PI_ROOT, "extensions", "better-style");

function files(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const full = join(root, entry);
    return statSync(full).isDirectory() ? files(full) : [full];
  });
}

test("better-style excludes context and mouse behavior", () => {
  assert.equal(existsSync(join(ROOT, "feature", "context.ts")), false);
  assert.equal(existsSync(join(ROOT, "feature", "reference")), false);
  assert.equal(existsSync(join(ROOT, "renderer", "mouse")), false);
  assert.equal(existsSync(join(ROOT, "utils", "sgr-mouse.ts")), false);
  const source = files(ROOT).filter((file) => file.endsWith(".ts")).map((file) => readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(source, /from ["']pi-cc-extensions\//);
  assert.doesNotMatch(source, /registerCommand\(["']context["']\)/);
  assert.doesNotMatch(source, /onTerminalInput/);
  assert.match(source, /registerCommand\("better-style"/);
});

test("Pi peer dependencies target 0.84", () => {
  const pkg = JSON.parse(readFileSync(join(PI_ROOT, "package.json"), "utf8"));
  for (const [name, version] of Object.entries(pkg.peerDependencies)) {
    if (name.startsWith("@earendil-works/pi-")) assert.equal(version, "^0.84.0");
  }
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const PI_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(readFileSync(join(PI_ROOT, "package.json"), "utf8"));

test("better-style is vendored without an upstream runtime dependency", () => {
  assert.equal(pkg.dependencies["pi-cc-extensions"], undefined);
});

test("Pi runtime package peers target 0.84", () => {
  for (const name of [
    "@earendil-works/pi-agent-core",
    "@earendil-works/pi-ai",
    "@earendil-works/pi-coding-agent",
    "@earendil-works/pi-tui",
  ]) {
    assert.equal(pkg.peerDependencies[name], "^0.84.0", name);
  }
  assert.equal(pkg.engines.node, ">=22.19.0");
});

test("better-style tests are part of the aggregate check", () => {
  assert.equal(pkg.scripts["test:better-style"], "node --test tests/better-style-*.test.ts");
  assert.match(pkg.scripts.check, /npm run test:better-style/);
});

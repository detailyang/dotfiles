import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const PI_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(readFileSync(join(PI_ROOT, "package.json"), "utf8"));

test("better-style pins the reviewed upstream implementation", () => {
  assert.equal(pkg.dependencies["pi-cc-extensions"], "0.8.69");
});

test("Pi runtime packages are upgraded together to 0.84.4", () => {
  for (const name of [
    "@earendil-works/pi-agent-core",
    "@earendil-works/pi-ai",
    "@earendil-works/pi-coding-agent",
    "@earendil-works/pi-tui",
  ]) {
    assert.equal(pkg.peerDependencies[name], "^0.84.4", name);
  }
  assert.equal(pkg.engines.node, ">=22.19.0");
});

test("better-style tests are part of the aggregate check", () => {
  assert.equal(pkg.scripts["test:better-style"], "node --test tests/better-style-*.test.ts");
  assert.match(pkg.scripts.check, /npm run test:better-style/);
});

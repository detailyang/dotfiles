import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const PI_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIFF_VIEW_ROOT = join(PI_ROOT, "extensions", "diff-view");

function sourceFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith(".ts") ? [path] : [];
  });
}

test("diff-view is the only vendored presentation extension", () => {
  assert.equal(existsSync(join(DIFF_VIEW_ROOT, "index.ts")), true);
  assert.equal(existsSync(join(PI_ROOT, "extensions", "better-style")), false);
  assert.equal(existsSync(join(PI_ROOT, "scripts", "better-style")), false);
  assert.equal(existsSync(join(PI_ROOT, "scripts", "sync-better-style.mjs")), false);
});

test("diff-view contains only edit/write diff behavior", () => {
  const source = sourceFiles(DIFF_VIEW_ROOT)
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
  assert.match(source, /createEditToolDefinition/);
  assert.match(source, /createWriteToolDefinition/);
  assert.doesNotMatch(source, /registerCommand|compact-thinking|tool-grouping|working-message|agent-summary/);
});

test("package runs only the diff-view test suite", () => {
  const pkg = JSON.parse(readFileSync(join(PI_ROOT, "package.json"), "utf8"));
  assert.equal(pkg.scripts["test:better-style"], undefined);
  assert.equal(pkg.scripts["test:diff-view"], "node --test tests/diff-view-*.test.ts");
  assert.doesNotMatch(pkg.scripts.check, /test:better-style/);
  assert.match(pkg.scripts.check, /npm run test:diff-view/);
  assert.equal(pkg.dependencies["grok-mermaid"], undefined);
});

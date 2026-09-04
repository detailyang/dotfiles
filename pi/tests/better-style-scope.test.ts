import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const PI_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const EXTENSION_ROOT = join(PI_ROOT, "extensions", "better-style");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith(".ts") ? [path] : [];
  });
}

function sourceBundle(): string {
  return sourceFiles(EXTENSION_ROOT)
    .map((path) => `// ${relative(EXTENSION_ROOT, path)}\n${readFileSync(path, "utf8")}`)
    .join("\n");
}

test("better-style exposes only its own slash command", () => {
  const source = sourceBundle();
  const commands = [...source.matchAll(/registerCommand\(["']([^"']+)["']/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(commands, ["better-style"]);
  assert.doesNotMatch(source, /registerCommand\(["'](?:context|ccstyle|clear|exit)["']/);
});

test("better-style does not install upstream context, references, or shell chrome", () => {
  const source = sourceBundle();
  for (const forbidden of [
    "extensions/feature/context",
    "extensions/feature/reference",
    "extensions/feature/shell/aliases",
    "extensions/feature/shell/flush-docked-bash",
    "extensions/feature/shell/startup-header",
  ]) {
    assert.equal(source.includes(forbidden), false, `unexpected import: ${forbidden}`);
  }
});

test("better-style has no fullscreen mouse input path", () => {
  const source = sourceBundle();
  for (const forbidden of [
    "extensions/renderer/mouse",
    "installToolMouseInteraction",
    "getToolMouseTui",
    "onTerminalInput",
    "TOOL_MOUSE_ENABLE",
    "TOOL_MOUSE_DISABLE",
    "sgr-mouse",
  ]) {
    assert.equal(source.includes(forbidden), false, `unexpected mouse integration: ${forbidden}`);
  }
});

test("better-style selectively composes the intended presentation modules", () => {
  const source = sourceBundle();
  for (const required of [
    "extensions/renderer/default-mode.ts",
    "extensions/renderer/compact-mode.ts",
    "extensions/renderer/tool/grouping.ts",
    "extensions/renderer/tool/diff/index.ts",
    "extensions/renderer/markdown-enhance.ts",
    "extensions/feature/compact-thinking.ts",
  ]) {
    assert.equal(source.includes(required), true, `missing presentation module: ${required}`);
  }
});

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "pi-inventory-"));
  const put = (name: string, content: string) => {
    const path = join(root, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  };
  const resources = { extensions: ["./extensions"], skills: ["./skills"], prompts: ["./prompts"], themes: ["./themes"] };
  for (const directory of ["scripts", ...Object.values(resources).flat()]) {
    mkdirSync(join(root, directory), { recursive: true });
  }
  copyFileSync(new URL("../scripts/check-inventory.mjs", import.meta.url), join(root, "scripts/check-inventory.mjs"));
  put("package.json", JSON.stringify({ pi: resources }));
  const run = (cwd = root) => spawnSync(process.execPath, [join(root, "scripts/check-inventory.mjs")], {
    cwd, encoding: "utf8", timeout: 10_000,
  });
  return { root, put, resources, run, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test("inventory resolves package resources from its own location, not caller cwd", (t) => {
  const f = fixture(); t.after(f.cleanup);
  f.put("skills/example/SKILL.md", "[missing](missing.md)\n");
  for (const cwd of [f.root, tmpdir()]) {
    const result = f.run(cwd);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /missing link target missing.md/);
  }
});

test("every registered resource must exist rather than silently skipping validation", (t) => {
  const f = fixture(); t.after(f.cleanup);
  for (const kind of Object.keys(f.resources)) {
    f.put("package.json", JSON.stringify({ pi: { ...f.resources, [kind]: ["./absent"] } }));
    const result = f.run();
    assert.equal(result.status, 1, `${kind}: ${result.stdout}${result.stderr}`);
    assert.match(result.stderr, /absent/);
  }
});

test("resource registration is the single inventory authority", (t) => {
  const f = fixture(); t.after(f.cleanup);
  f.put("package.json", JSON.stringify({ pi: { ...f.resources, skills: ["./resources"] } }));
  f.put("resources/example/SKILL.md", "[missing](missing.md)\n");
  f.put("skills/retired/SKILL.md", "[not registered](retired.md)\n");
  const result = f.run();
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /resources.*missing link target missing.md/);
  assert.doesNotMatch(result.stderr, /retired/);
});

test("individual resource files are validated and malformed registrations fail", (t) => {
  const f = fixture(); t.after(f.cleanup);
  f.put("command.md", "[missing](absent.md)\n");
  f.put("extension.ts", "export const notAFactory = true;\n");
  f.put("package.json", JSON.stringify({ pi: { extensions: ["extension.ts"], prompts: ["command.md"] } }));
  const files = f.run();
  assert.equal(files.status, 1, files.stdout + files.stderr);
  assert.match(files.stderr, /missing link target absent.md/);
  assert.match(files.stderr, /must export a default factory/);
  for (const registration of [null, "./skills", [null], [""]]) {
    f.put("package.json", JSON.stringify({ pi: { ...f.resources, skills: registration } }));
    const invalid = f.run();
    assert.equal(invalid.status, 1, invalid.stdout + invalid.stderr);
    assert.match(invalid.stderr, /skills/);
  }
});

test("valid links and extension factories pass; missing factories fail", (t) => {
  const f = fixture(); t.after(f.cleanup);
  f.put("prompts/example.md", "[resource](../skills/example/SKILL.md) [site](https://example.com)\n");
  f.put("skills/example/SKILL.md", "# Example\n");
  f.put("extensions/example/index.ts", "export default function example() {}\n");
  const valid = f.run();
  assert.equal(valid.status, 0, valid.stdout + valid.stderr);
  f.put("extensions/example/index.ts", "export const notAFactory = true;\n");
  const invalid = f.run();
  assert.equal(invalid.status, 1, invalid.stdout + invalid.stderr);
  assert.match(invalid.stderr, /must export a default factory/);
});

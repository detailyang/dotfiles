import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateReviewPaths } from "../extensions/review/path.ts";

test("review paths accept in-scope files and reject lexical and symlink escapes", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-review-path-"));
  const cwd = join(root, "repo");
  try {
    await mkdir(cwd);
    await mkdir(join(cwd, "src"));
    await writeFile(join(cwd, "README.md"), "fixture");
    await symlink(join(cwd, "src"), join(cwd, "inside"), "junction");
    await symlink(root, join(cwd, "outside"), "junction");
    assert.deepEqual(await validateReviewPaths(cwd, ["src", "README.md", "inside"]), ["src", "README.md", "inside"]);
    await assert.rejects(validateReviewPaths(cwd, ["../secret"]), /must be inside/);
    await assert.rejects(validateReviewPaths(cwd, ["outside"]), /resolves outside/);
    await assert.rejects(validateReviewPaths(cwd, ["missing"]), /does not exist/);
    await assert.rejects(validateReviewPaths(cwd, ["README.md"], async () => ({ isFile: () => false, isDirectory: () => false })), /not a file or directory/);
    if (process.platform !== "win32") assert.deepEqual(await validateReviewPaths("/", [cwd]), [cwd]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

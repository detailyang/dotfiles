import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeWriteWithMetadata, WriteExecutionMetadataStore } from "../extensions/diff-view/renderer/tool/diff/write-execution.ts";

test("write renderer preserves native @ paths and captures the normalized target", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "pi-write-path-"));
  try {
    await writeFile(join(cwd, "target.txt"), "before");
    const store = new WriteExecutionMetadataStore();
    await executeWriteWithMetadata(store, "write", { path: "@target.txt", content: "after" }, undefined, cwd);
    assert.equal(await readFile(join(cwd, "target.txt"), "utf8"), "after");
    await assert.rejects(readFile(join(cwd, "@target.txt")), { code: "ENOENT" });
    assert.deepEqual(store.get("write"), { fileExistedBeforeWrite: true, previousContent: "before" });
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

import test from "node:test";
import assert from "node:assert/strict";

import { validateReviewPaths, type ReviewPathStat } from "../extensions/review/path.ts";

const fileStat: ReviewPathStat = { isFile: () => true, isDirectory: () => false };
const dirStat: ReviewPathStat = { isFile: () => false, isDirectory: () => true };
const otherStat: ReviewPathStat = { isFile: () => false, isDirectory: () => false };

test("validateReviewPaths accepts files and directories inside cwd", async () => {
  const seen: string[] = [];
  const result = await validateReviewPaths("/repo", ["src", "README.md"], async (resolvedPath) => {
    seen.push(resolvedPath);
    return resolvedPath.endsWith("src") ? dirStat : fileStat;
  });

  assert.deepEqual(result, ["src", "README.md"]);
  assert.deepEqual(seen, ["/repo/src", "/repo/README.md"]);
});

test("validateReviewPaths rejects paths outside cwd", async () => {
  await assert.rejects(
    validateReviewPaths("/repo", ["../secret"], async () => fileStat),
    /Review path must be inside the working directory: \.\.\/secret/,
  );
});

test("validateReviewPaths maps stat failures and unsupported file types", async () => {
  await assert.rejects(
    validateReviewPaths("/repo", ["missing"], async () => {
      const error = new Error("missing") as Error & { code?: string };
      error.code = "ENOENT";
      throw error;
    }),
    /Review path does not exist: missing/,
  );

  await assert.rejects(
    validateReviewPaths("/repo", ["socket"], async () => otherStat),
    /Review path is not a file or directory: socket/,
  );
});

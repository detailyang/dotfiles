import test from "node:test";
import assert from "node:assert/strict";

import { hasBlockingReviewFindings } from "../extensions/review/findings.ts";

test("hasBlockingReviewFindings prefers structured review-json verdicts", () => {
  assert.equal(
    hasBlockingReviewFindings([
      "Looks okay.",
      "```review-json",
      '{"verdict":"needs_attention","findings":[],"humanCallouts":[]}',
      "```",
    ].join("\n")),
    true,
  );

  assert.equal(
    hasBlockingReviewFindings([
      "Looks okay.",
      "```review-json",
      '{"verdict":"correct","findings":[{"priority":"P3"}],"humanCallouts":[]}',
      "```",
    ].join("\n")),
    false,
  );
});

test("hasBlockingReviewFindings only treats P0-P2 findings as blocking", () => {
  assert.equal(
    hasBlockingReviewFindings([
      "## Findings",
      "- [P2] Real bug in changed code.",
      "## Human Reviewer Callouts (Non-Blocking)",
      "- **This change introduces a new dependency:** x",
    ].join("\n")),
    true,
  );

  assert.equal(
    hasBlockingReviewFindings([
      "## Findings",
      "- [P3] Minor polish.",
      "## Human Reviewer Callouts (Non-Blocking)",
      "- (none)",
    ].join("\n")),
    false,
  );
});

test("hasBlockingReviewFindings does not treat rubric choice text as a verdict", () => {
  assert.equal(
    hasBlockingReviewFindings('Provide an overall verdict: "correct" or "needs attention".'),
    false,
  );
});

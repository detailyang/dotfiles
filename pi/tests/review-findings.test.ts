import test from "node:test";
import assert from "node:assert/strict";

import { getReviewDecision, hasBlockingReviewFindings } from "../extensions/review/findings.ts";

test("automatic review completion requires a valid final verdict", () => {
  const block = (value: unknown) => `\`\`\`review-json\n${JSON.stringify(value)}\n\`\`\``;
  for (const text of [
    "Unable to inspect files. I cannot review.", "Looks good", "",
    block({ verdict: "unknown", findings: [] }),
    block({ verdict: 42, findings: [] }), block({ verdict: "correct", findings: [null] }),
    block({ verdict: "correct" }), block({ verdict: "correct", findings: [{ priority: "P9" }] }),
    "```review-json\n{broken}\n```",
  ]) assert.equal(getReviewDecision(text), "invalid", text);
  assert.equal(getReviewDecision(block({ verdict: "correct", findings: [] })), "correct");
  assert.equal(getReviewDecision(block({ verdict: "correct", findings: [{ priority: "P3" }] })), "correct");
  assert.equal(getReviewDecision(block({ verdict: "needs_attention", findings: [] })), "needs_attention");
  assert.equal(getReviewDecision(block({ verdict: "correct", findings: [{ priority: "P1" }] })), "needs_attention");
  assert.equal(getReviewDecision(`${block({ verdict: "correct", findings: [] })}\n${block({ verdict: "unknown", findings: [] })}`), "invalid");
  const contradictory = `## Findings\n- [P1] Broken authorization\n${block({ verdict: "correct", findings: [] })}`;
  assert.equal(getReviewDecision(contradictory), "needs_attention");
  assert.equal(hasBlockingReviewFindings(`## Findings\n- [P1] Broken authorization\n${block({ verdict: "unknown" })}`), true);
});

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

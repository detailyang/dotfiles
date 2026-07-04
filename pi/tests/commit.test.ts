import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCommitAgentArgs,
  getCommitOutcome,
  getModelArgument,
} from "../extensions/commit/index.ts";

test("getModelArgument formats the active provider/model for the commit subagent", () => {
  assert.equal(
    getModelArgument({ provider: "google-ai-studio", id: "gemini-flash-latest" }),
    "google-ai-studio/gemini-flash-latest",
  );
  assert.equal(getModelArgument(undefined), undefined);
});

test("buildCommitAgentArgs runs the subagent with inherited model, thinking, and current project trust", () => {
  assert.deepEqual(
    buildCommitAgentArgs({
      promptFile: "/tmp/prompt.md",
      task: "Create a git commit for the current changes.",
      model: { provider: "google-ai-studio", id: "gemini-flash-latest" },
      thinkingLevel: "low",
      approveProject: true,
    }),
    [
      "--mode",
      "json",
      "--no-session",
      "--approve",
      "--append-system-prompt",
      "/tmp/prompt.md",
      "--model",
      "google-ai-studio/gemini-flash-latest",
      "--thinking",
      "low",
      "-p",
      "Create a git commit for the current changes.",
    ],
  );

  assert.deepEqual(
    buildCommitAgentArgs({
      promptFile: "/tmp/prompt.md",
      task: "Create a git commit for the current changes.",
      model: { provider: "google-ai-studio", id: "gemini-flash-latest" },
      approveProject: false,
    }),
    [
      "--mode",
      "json",
      "--no-session",
      "--no-approve",
      "--append-system-prompt",
      "/tmp/prompt.md",
      "--model",
      "google-ai-studio/gemini-flash-latest",
      "-p",
      "Create a git commit for the current changes.",
    ],
  );
});

test("getCommitOutcome treats a zero-exit subagent with unchanged HEAD as failure", () => {
  assert.deepEqual(
    getCommitOutcome({
      exitCode: 0,
      beforeHead: "abc123",
      afterHead: "abc123",
      finalText: "",
      failureMessage: "assistant error: 400 status code (no body)",
    }),
    {
      type: "error",
      message: "Commit agent did not create a commit: assistant error: 400 status code (no body)",
    },
  );
});

test("getCommitOutcome reports success only when HEAD changes", () => {
  assert.deepEqual(
    getCommitOutcome({
      exitCode: 0,
      beforeHead: "abc123",
      afterHead: "def456",
      finalText: "Created fix(commit): inherit model.",
      failureMessage: "",
    }),
    {
      type: "info",
      message: "Created fix(commit): inherit model.",
    },
  );
});

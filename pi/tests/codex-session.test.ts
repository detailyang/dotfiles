import assert from "node:assert/strict";
import test from "node:test";
import { SessionManager, type ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { resumeCodexSession } from "../extensions/codex/index.ts";
import { parseCodexJsonlTranscript } from "../extensions/shared/transcript.ts";

const transcript = parseCodexJsonlTranscript([
  JSON.stringify({ type: "session_meta", payload: { id: "offline-session", cwd: "/fixture" } }),
  JSON.stringify({ type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "Inspect fixture" }] } }),
], "fixture.jsonl");

test("Codex resumes using setup and the replacement context only", async () => {
  const sessionManager = SessionManager.inMemory();
  let editor = "";
  let notified = false;
  const ctx = {
    sessionManager,
    ui: { notify() { assert.fail("old UI accessed"); }, setEditorText() { assert.fail("old editor accessed"); } },
    async newSession(options: Parameters<ExtensionCommandContext["newSession"]>[0]) {
      await options?.setup?.(sessionManager);
      assert.ok(options?.withSession);
      await options.withSession({ ui: {
        setEditorText: (text: string) => { editor = text; },
        notify: () => { notified = true; },
      } } as unknown as Parameters<typeof options.withSession>[0]);
      return { cancelled: false };
    },
  } as unknown as ExtensionCommandContext;
  await resumeCodexSession(ctx, transcript);
  assert.equal(sessionManager.getSessionName(), "Codex: offline-sess...");
  assert.match(editor, /Continue/);
  assert.equal(notified, true);
  assert.equal(sessionManager.getBranch().filter((entry) => entry.type === "message").length, 1);
});

test("cancelled Codex replacement only notifies the still-active context", async () => {
  const notifications: string[] = [];
  const ctx = {
    sessionManager: SessionManager.inMemory(),
    newSession: async () => ({ cancelled: true }),
    ui: { notify: (text: string) => notifications.push(text) },
  } as unknown as ExtensionCommandContext;
  await resumeCodexSession(ctx, transcript);
  assert.deepEqual(notifications, ["New session cancelled"]);
});

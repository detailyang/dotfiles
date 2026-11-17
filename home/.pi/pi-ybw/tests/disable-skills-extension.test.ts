import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import disableSkillsExtension from "../extensions/disable-skills/index.ts";
import { createExtensionHarness } from "./helpers/extension.ts";

const CURRENT_SKILLS_PROMPT = [
  "The following skills provide specialized instructions for specific tasks.",
  "Use the read tool to load a skill's file when the task matches its description.",
  "When a skill file references a relative path, resolve it against the skill directory (parent of SKILL.md / dirname of the path) and use that absolute path in tool commands.",
  "",
  "<available_skills>",
  "  <skill>",
  "    <name>ship</name>",
  "    <description>Implement requested changes.</description>",
  "    <location>/home/.agents/skills/ship/SKILL.md</location>",
  "  </skill>",
  "</available_skills>",
].join("\n");

test("disables skills without truncating earlier project instructions mentioning skills", async () => {
  const harness = createExtensionHarness(disableSkillsExtension);
  const projectBlock = "<project_context>\nThe following skills are forbidden in this repo.\n</project_context>";
  const [result] = await harness.emit("before_agent_start", {
    systemPrompt: `${projectBlock}\n\n${CURRENT_SKILLS_PROMPT}\n\nTail instructions`,
  });

  assert.ok(result?.systemPrompt);
  assert.match(result.systemPrompt, /The following skills are forbidden in this repo\./);
  assert.match(result.systemPrompt, /<\/project_context>/);
  assert.doesNotMatch(result.systemPrompt, /<available_skills>/);
  assert.match(result.systemPrompt, /Tail instructions/);
});

test("ignores untrusted project-local disable-skills.json overrides", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "pi-disable-skills-"));
  try {
    mkdirSync(path.join(tmp, ".pi"), { recursive: true });
    writeFileSync(path.join(tmp, ".pi", "disable-skills.json"), JSON.stringify({ enable: false }), "utf8");
    const harness = createExtensionHarness(disableSkillsExtension);
    harness.ctx.cwd = tmp;
    harness.ctx.isProjectTrusted = () => false;
    await harness.emit("session_start", { reason: "startup" });
    const [result] = await harness.emit("before_agent_start", {
      systemPrompt: `${CURRENT_SKILLS_PROMPT}\n\nTail instructions`,
    });
    assert.ok(result?.systemPrompt);
    assert.doesNotMatch(result.systemPrompt, /<available_skills>/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import disableSkillsExtension from "../extensions/disable-skills/index.ts";
import { createExtensionHarness } from "./helpers/extension.ts";

const CURRENT_SKILLS_PROMPT = [
  "The following skills provide specialized instructions for specific tasks.",
  "Read the full skill file when the task matches its description.",
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

test("disables skills from the current default system prompt format", async () => {
  const harness = createExtensionHarness(disableSkillsExtension);
  const [result] = await harness.emit("before_agent_start", {
    systemPrompt: `${CURRENT_SKILLS_PROMPT}\n\nTail instructions`,
  });

  assert.ok(result?.systemPrompt);
  assert.doesNotMatch(result.systemPrompt, /<available_skills>/);
  assert.match(result.systemPrompt, /Tail instructions/);
});

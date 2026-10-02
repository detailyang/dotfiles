import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import worktreeExtension, {
  WORKTREE_GUIDANCE,
  WORKTREE_SKILL,
  WORKTREE_SKILL_PATH,
  initializeWorktreeFiles,
  injectWorktreeGuidance,
  injectWorktreeSkill,
} from "../extensions/worktree/index.ts";

const agentsPath = "AGENTS.md";

test("injectWorktreeGuidance creates the requested Start every task section", () => {
  const result = injectWorktreeGuidance(null);

  assert.equal(result.action, "created");
  assert.equal(result.content, `${WORKTREE_GUIDANCE}\n`);
  assert.match(result.content, /^## Start every task\n/);
  assert.match(result.content, /git worktree list/);
  assert.match(result.content, /\.agents\/skills\/worktree\/SKILL\.md/);
});

test("injectWorktreeGuidance adds the section after a document title", () => {
  const existing = "# Repository Guidelines\n\n## Testing\n\nRun checks.\n";
  const result = injectWorktreeGuidance(existing);

  assert.equal(result.action, "added");
  assert.ok(result.content.indexOf("## Start every task") > result.content.indexOf("# Repository Guidelines"));
  assert.ok(result.content.indexOf("## Start every task") < result.content.indexOf("## Testing"));
  assert.match(result.content, /Run checks\./);
});

test("injectWorktreeGuidance preserves custom rules and is idempotent", () => {
  const existing = "# Repository Guidelines\n\n## Start every task\n\n- Keep release notes current.\n";
  const result = injectWorktreeGuidance(existing);
  const unchanged = injectWorktreeGuidance(result.content);

  assert.equal(result.action, "updated");
  assert.match(result.content, /Keep release notes current\./);
  assert.equal((result.content.match(/^## Start every task$/gm) ?? []).length, 1);
  assert.equal(unchanged.action, "unchanged");
  assert.equal(unchanged.content, result.content);
});

test("injectWorktreeGuidance rejects duplicate sections", () => {
  assert.throws(
    () => injectWorktreeGuidance("## Start every task\n\nOne.\n\n## Start every task\n\nTwo.\n"),
    /multiple Start every task sections/,
  );
});

test("injectWorktreeSkill protects an unrelated existing skill", () => {
  assert.equal(injectWorktreeSkill(null).action, "created");
  assert.equal(injectWorktreeSkill(WORKTREE_SKILL).action, "unchanged");
  assert.equal(injectWorktreeSkill(`${WORKTREE_SKILL}\n`).action, "unchanged");
  assert.equal(injectWorktreeSkill(`${WORKTREE_SKILL}\n\n`).action, "unchanged");
  assert.throws(
    () => injectWorktreeSkill("# A team's worktree rules\n"),
    new RegExp(`${WORKTREE_SKILL_PATH.replaceAll(".", "\\.")} already exists`),
  );
});

test("/init-worktree writes both outputs and is idempotent", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pi-worktree-test-"));
  const notifications: Array<{ message: string; type: string }> = [];
  let command: { handler(args: string, ctx: any): Promise<void> } | undefined;

  worktreeExtension({
    registerCommand(name: string, registered: typeof command) {
      assert.equal(name, "init-worktree");
      command = registered;
    },
  } as never);
  assert.ok(command);

  const ctx = {
    cwd,
    ui: {
      notify(message: string, type: string) {
        notifications.push({ message, type });
      },
    },
  };

  try {
    await command.handler("", ctx);
    const firstAgents = await fs.readFile(path.join(cwd, agentsPath), "utf-8");
    const firstSkill = await fs.readFile(path.join(cwd, WORKTREE_SKILL_PATH), "utf-8");
    await command.handler("", ctx);
    const secondAgents = await fs.readFile(path.join(cwd, agentsPath), "utf-8");
    const secondSkill = await fs.readFile(path.join(cwd, WORKTREE_SKILL_PATH), "utf-8");

    assert.equal(firstAgents, `${WORKTREE_GUIDANCE}\n`);
    assert.equal(firstSkill, `${WORKTREE_SKILL}\n`);
    assert.equal(secondAgents, firstAgents);
    assert.equal(secondSkill, firstSkill);
    assert.deepEqual(notifications, [
      {
        message: "Initialized the worktree workflow in AGENTS.md and .agents/skills/worktree/SKILL.md.",
        type: "info",
      },
      {
        message: "Worktree workflow in AGENTS.md and .agents/skills/worktree/SKILL.md is already current.",
        type: "info",
      },
    ]);
  } finally {
    await fs.rm(cwd, { recursive: true, force: true });
  }
});

test("/init-worktree validates all outputs before writing", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pi-worktree-invalid-test-"));
  const existingAgents = "# Existing rules\n";
  await fs.writeFile(path.join(cwd, agentsPath), existingAgents, "utf-8");
  await fs.mkdir(path.join(cwd, ".agents", "skills", "worktree"), { recursive: true });
  await fs.writeFile(path.join(cwd, WORKTREE_SKILL_PATH), "# Existing project skill\n", "utf-8");

  try {
    await assert.rejects(initializeWorktreeFiles(cwd), /not managed by the worktree extension/);
    assert.equal(await fs.readFile(path.join(cwd, agentsPath), "utf-8"), existingAgents);
    assert.equal(
      await fs.readFile(path.join(cwd, WORKTREE_SKILL_PATH), "utf-8"),
      "# Existing project skill\n",
    );
  } finally {
    await fs.rm(cwd, { recursive: true, force: true });
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import adrExtension, {
  ADR_END_MARKER,
  ADR_GUIDANCE,
  ADR_GUIDE_END_MARKER,
  ADR_GUIDE_START_MARKER,
  ADR_POINTER,
  ADR_README_PATH,
  ADR_START_MARKER,
  injectAdrGuidance,
  injectAdrReadme,
} from "../extensions/adr/index.ts";

test("injectAdrGuidance keeps AGENTS.md as a short documentation index", () => {
  const result = injectAdrGuidance(null);

  assert.equal(result.action, "created");
  assert.equal(
    result.content,
    `${ADR_START_MARKER}\n${ADR_POINTER}\n${ADR_END_MARKER}\n`,
  );
  assert.ok(result.content.includes("docs/adr/README.md"));
  assert.ok(!result.content.includes("### Creating an ADR"));
});

test("injectAdrGuidance migrates the previous large managed block in place", () => {
  const existing = "# Repository Guidelines\n";
  const legacy = injectAdrGuidance(existing, ADR_GUIDANCE);
  const migrated = injectAdrGuidance(legacy.content);
  const unchanged = injectAdrGuidance(migrated.content);

  assert.equal(migrated.action, "updated");
  assert.equal(unchanged.action, "unchanged");
  assert.equal(unchanged.content, migrated.content);
  assert.ok(migrated.content.startsWith(existing));
  assert.ok(!migrated.content.includes("### Creating an ADR"));
});

test("injectAdrReadme creates the full workflow and an empty decision index", () => {
  const result = injectAdrReadme(null);

  assert.equal(result.action, "created");
  assert.ok(result.content.startsWith("# Architecture Decision Records\n"));
  assert.ok(result.content.includes(`${ADR_GUIDE_START_MARKER}\n${ADR_GUIDANCE}`));
  assert.ok(result.content.includes("## Decision Index"));
  assert.ok(result.content.endsWith("<!-- Add ADR links here in chronological order. -->\n"));
});

test("injectAdrReadme preserves existing decision links across guide updates", () => {
  const existing = `# Architecture Decision Records

${ADR_GUIDE_START_MARKER}
old guide
${ADR_GUIDE_END_MARKER}

## Decision Index

- [Choose storage](2026-08-24-choose-storage.md)
`;
  const result = injectAdrReadme(existing);
  const unchanged = injectAdrReadme(result.content);

  assert.equal(result.action, "updated");
  assert.ok(result.content.includes("- [Choose storage](2026-08-24-choose-storage.md)"));
  assert.ok(!result.content.includes("old guide"));
  assert.equal(unchanged.action, "unchanged");
  assert.equal(unchanged.content, result.content);
});

test("managed ADR files reject malformed or duplicate markers", () => {
  assert.throws(
    () => injectAdrGuidance(`${ADR_START_MARKER}\nmissing end\n`),
    /AGENTS\.md has invalid ADR markers/,
  );
  assert.throws(
    () => injectAdrReadme(`${ADR_GUIDE_END_MARKER}\n${ADR_GUIDE_START_MARKER}\n`),
    /end marker before its start marker/,
  );
  assert.throws(
    () => injectAdrGuidance(
      `${ADR_START_MARKER}\n${ADR_END_MARKER}\n${ADR_START_MARKER}\n${ADR_END_MARKER}\n`,
    ),
    /invalid ADR markers/,
  );
});

test("/init-adr writes both layers and reports an idempotent second run", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pi-adr-test-"));
  const notifications: Array<{ message: string; type: string }> = [];
  let command: { handler(args: string, ctx: any): Promise<void> } | undefined;

  const pi = {
    registerCommand(name: string, registered: typeof command) {
      assert.equal(name, "init-adr");
      command = registered;
    },
  };

  adrExtension(pi as never);
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
    const firstAgents = await fs.readFile(path.join(cwd, "AGENTS.md"), "utf-8");
    const firstReadme = await fs.readFile(path.join(cwd, ADR_README_PATH), "utf-8");
    await command.handler("", ctx);
    const secondAgents = await fs.readFile(path.join(cwd, "AGENTS.md"), "utf-8");
    const secondReadme = await fs.readFile(path.join(cwd, ADR_README_PATH), "utf-8");

    assert.equal(secondAgents, firstAgents);
    assert.equal(secondReadme, firstReadme);
    assert.ok(firstAgents.includes("docs/adr/README.md"));
    assert.ok(firstReadme.includes("### Creating an ADR"));
    assert.deepEqual(notifications, [
      {
        message: "Initialized ADR documentation in docs/adr/README.md and linked it from AGENTS.md.",
        type: "info",
      },
      {
        message: "ADR documentation and AGENTS.md index are already current.",
        type: "info",
      },
    ]);
  } finally {
    await fs.rm(cwd, { recursive: true, force: true });
  }
});

test("/init-adr validates both managed files before writing", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pi-adr-invalid-test-"));
  const agentsPath = path.join(cwd, "AGENTS.md");
  const invalidAgents = `${ADR_START_MARKER}\nmissing end\n`;
  await fs.writeFile(agentsPath, invalidAgents, "utf-8");

  let command: { handler(args: string, ctx: any): Promise<void> } | undefined;
  const notifications: Array<{ message: string; type: string }> = [];
  adrExtension({
    registerCommand(_name: string, registered: typeof command) {
      command = registered;
    },
  } as never);
  assert.ok(command);

  try {
    await command.handler("", {
      cwd,
      ui: {
        notify(message: string, type: string) {
          notifications.push({ message, type });
        },
      },
    });

    assert.equal(await fs.readFile(agentsPath, "utf-8"), invalidAgents);
    await assert.rejects(fs.access(path.join(cwd, ADR_README_PATH)), /ENOENT/);
    assert.match(notifications[0]?.message ?? "", /Failed to initialize ADR documentation/);
    assert.equal(notifications[0]?.type, "error");
  } finally {
    await fs.rm(cwd, { recursive: true, force: true });
  }
});

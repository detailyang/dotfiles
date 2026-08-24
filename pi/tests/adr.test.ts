import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import adrExtension, {
  ADR_GUIDANCE,
  ADR_GUIDE_PATH,
  ADR_POINTER,
  ADR_README_PATH,
  ADR_WORKFLOW_LINK,
  injectAdrGuide,
  injectAdrGuidance,
  injectAdrReadme,
} from "../extensions/adr/index.ts";

const LEGACY_ADR_START = "<!-- pi-adr:start -->";
const LEGACY_ADR_END = "<!-- pi-adr:end -->";
const LEGACY_GUIDE_START = "<!-- pi-adr-guide:start -->";
const LEGACY_GUIDE_END = "<!-- pi-adr-guide:end -->";

test("injectAdrGuidance creates a short Markdown documentation index", () => {
  const result = injectAdrGuidance(null);

  assert.equal(result.action, "created");
  assert.equal(result.content, `## Documentation Index\n\n${ADR_POINTER}\n`);
  assert.ok(!result.content.includes("<"));
  assert.ok(!result.content.includes(">"));
  assert.ok(!result.content.includes("### Creating an ADR"));
});

test("injectAdrGuidance adds its entry to an existing documentation index", () => {
  const existing = "# Repository Guidelines\n\n## Documentation Index\n\n- API: `docs/api.md`\n\n## Testing\n\nRun tests.\n";
  const result = injectAdrGuidance(existing);

  assert.equal(result.action, "added");
  assert.ok(result.content.includes("- API: `docs/api.md`\n\n- **Architecture decisions:**"));
  assert.ok(result.content.indexOf(ADR_POINTER) < result.content.indexOf("## Testing"));
});

test("injectAdrGuidance removes the previous HTML-managed block", () => {
  const existing = `# Repository Guidelines

${LEGACY_ADR_START}
## Architecture Decision Records

${ADR_GUIDANCE}
${LEGACY_ADR_END}
`;
  const migrated = injectAdrGuidance(existing);
  const unchanged = injectAdrGuidance(migrated.content);

  assert.equal(migrated.action, "updated");
  assert.equal(unchanged.action, "unchanged");
  assert.ok(migrated.content.includes(ADR_POINTER));
  assert.ok(!migrated.content.includes("<"));
  assert.ok(!migrated.content.includes(">"));
  assert.ok(!migrated.content.includes("### Creating an ADR"));
});

test("injectAdrReadme is a small index that preserves decision links", () => {
  const existing = "# Architecture Decision Records\n\n## Decision Index\n\n- [Choose storage](2026-08-24-choose-storage.md)\n";
  const result = injectAdrReadme(existing);
  const unchanged = injectAdrReadme(result.content);

  assert.equal(result.action, "added");
  assert.ok(result.content.includes(ADR_WORKFLOW_LINK));
  assert.ok(result.content.includes("- [Choose storage](2026-08-24-choose-storage.md)"));
  assert.ok(!result.content.includes(ADR_GUIDANCE));
  assert.ok(!result.content.includes("<"));
  assert.ok(!result.content.includes(">"));
  assert.equal(unchanged.action, "unchanged");
});

test("injectAdrReadme migrates the old embedded guide and placeholder", () => {
  const existing = `# Architecture Decision Records

${LEGACY_GUIDE_START}
${ADR_GUIDANCE}
${LEGACY_GUIDE_END}

## Decision Index

<!-- Add ADR links here in chronological order. -->
`;
  const result = injectAdrReadme(existing);

  assert.equal(result.action, "updated");
  assert.equal(
    result.content,
    `# Architecture Decision Records\n\n${ADR_WORKFLOW_LINK}\n\n## Decision Index\n`,
  );
  assert.ok(!result.content.includes("<"));
  assert.ok(!result.content.includes(">"));
});

test("injectAdrGuide owns the standalone workflow file", () => {
  const created = injectAdrGuide(null);
  const unchanged = injectAdrGuide(created.content);

  assert.equal(created.action, "created");
  assert.ok(created.content.startsWith("# ADR Workflow Guide\n\n## Purpose\n"));
  assert.ok(created.content.includes(ADR_GUIDANCE));
  assert.ok(!created.content.includes("<"));
  assert.ok(!created.content.includes(">"));
  assert.equal(unchanged.action, "unchanged");
  assert.throws(
    () => injectAdrGuide("# Existing project guide\n"),
    /not managed by the ADR extension/,
  );
});

test("legacy ADR files reject malformed or duplicate markers", () => {
  assert.throws(
    () => injectAdrGuidance(`${LEGACY_ADR_START}\nmissing end\n`),
    /invalid legacy ADR markers/,
  );
  assert.throws(
    () => injectAdrReadme(`${LEGACY_GUIDE_END}\n${LEGACY_GUIDE_START}\n`),
    /end marker before its start marker/,
  );
  assert.throws(
    () => injectAdrGuidance(
      `${LEGACY_ADR_START}\n${LEGACY_ADR_END}\n${LEGACY_ADR_START}\n${LEGACY_ADR_END}\n`,
    ),
    /invalid legacy ADR markers/,
  );
});

test("/init-adr writes the index and guide without angle-bracket syntax", async () => {
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
    const firstGuide = await fs.readFile(path.join(cwd, ADR_GUIDE_PATH), "utf-8");
    await command.handler("", ctx);
    const secondAgents = await fs.readFile(path.join(cwd, "AGENTS.md"), "utf-8");
    const secondReadme = await fs.readFile(path.join(cwd, ADR_README_PATH), "utf-8");
    const secondGuide = await fs.readFile(path.join(cwd, ADR_GUIDE_PATH), "utf-8");

    assert.equal(secondAgents, firstAgents);
    assert.equal(secondReadme, firstReadme);
    assert.equal(secondGuide, firstGuide);
    assert.ok(
      [firstAgents, firstReadme, firstGuide].every(
        (content) => !content.includes("<") && !content.includes(">"),
      ),
    );
    assert.ok(firstReadme.includes("[ADR workflow guide](GUIDE.md)"));
    assert.ok(firstGuide.includes("### Creating an ADR"));
    assert.deepEqual(notifications, [
      {
        message: "Initialized the ADR index in docs/adr/ and linked it from AGENTS.md.",
        type: "info",
      },
      { message: "ADR index and workflow guide are already current.", type: "info" },
    ]);
  } finally {
    await fs.rm(cwd, { recursive: true, force: true });
  }
});

test("/init-adr validates all outputs before writing", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pi-adr-invalid-test-"));
  const agentsPath = path.join(cwd, "AGENTS.md");
  const invalidAgents = `${LEGACY_ADR_START}\nmissing end\n`;
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
    await assert.rejects(fs.access(path.join(cwd, ADR_GUIDE_PATH)), /ENOENT/);
    assert.match(notifications[0]?.message ?? "", /Failed to initialize ADR documentation/);
    assert.equal(notifications[0]?.type, "error");
  } finally {
    await fs.rm(cwd, { recursive: true, force: true });
  }
});

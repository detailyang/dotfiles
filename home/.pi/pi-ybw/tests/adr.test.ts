import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

import adrExtension, {
  ADR_GUIDANCE,
  ADR_GUIDE_PATH,
  ADR_POINTER,
  ADR_README_PATH,
  ADR_TOOLKIT_FILES,
  ADR_TOOLKIT_PATH,
  ADR_WORKFLOW_LINK,
  injectAdrGuide,
  injectAdrGuidance,
  injectAdrReadme,
  injectAdrToolkitFile,
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

test("injectAdrGuide owns the complete standalone workflow file", () => {
  const created = injectAdrGuide(null);
  const unchanged = injectAdrGuide(created.content);

  assert.equal(created.action, "created");
  assert.ok(created.content.startsWith("# ADR Workflow Guide\n\n## Philosophy\n"));
  assert.ok(created.content.includes("### Phase 0: Scan the Codebase"));
  assert.ok(created.content.includes("### Phase 1: Capture Intent (Socratic)"));
  assert.ok(created.content.includes("### Phase 2: Draft the ADR"));
  assert.ok(created.content.includes("### Phase 3: Review Against Checklist"));
  assert.ok(created.content.includes("## Consulting ADRs (Read Workflow)"));
  assert.ok(created.content.includes("## Other Operations"));
  assert.ok(created.content.split("\n").length >= 300);
  assert.ok(!/^## Source$/m.test(created.content));
  assert.ok(!created.content.includes("<"));
  assert.ok(!created.content.includes(">"));
  assert.equal(unchanged.action, "unchanged");
  assert.throws(
    () => injectAdrGuide("# Existing project guide\n"),
    /not managed by the ADR extension/,
  );
});

test("the bundled toolkit includes all upstream references, templates, and scripts", () => {
  const paths = ADR_TOOLKIT_FILES.map((file) => file.relativePath);
  assert.deepEqual(paths, [
    "package.json",
    "assets/templates/adr-madr.md",
    "assets/templates/adr-readme.md",
    "assets/templates/adr-simple.md",
    "references/adr-conventions.md",
    "references/examples.md",
    "references/review-checklist.md",
    "references/template-variants.md",
    "scripts/bootstrap_adr.js",
    "scripts/new_adr.js",
    "scripts/set_adr_status.js",
  ]);

  const markdown = ADR_TOOLKIT_FILES.filter((file) => file.relativePath.endsWith(".md"));
  assert.ok(markdown.every((file) => !file.content.includes("<") && !file.content.includes(">")));
  assert.ok(markdown.some((file) => file.content.includes("# ADR Review Checklist")));
  assert.ok(markdown.some((file) => file.content.includes("## Long Version (MADR Template)")));

  const bundled = ADR_TOOLKIT_FILES[0];
  assert.equal(injectAdrToolkitFile(null, bundled).action, "created");
  assert.equal(injectAdrToolkitFile(bundled.content, bundled).action, "unchanged");
  assert.equal(injectAdrToolkitFile("old", bundled).action, "updated");
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

test("/init-adr writes and runs the complete toolkit without Source metadata", async () => {
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
    const firstToolkit = await Promise.all(
      ADR_TOOLKIT_FILES.map((file) =>
        fs.readFile(path.join(cwd, ADR_TOOLKIT_PATH, file.relativePath), "utf-8")
      ),
    );
    await command.handler("", ctx);
    const secondAgents = await fs.readFile(path.join(cwd, "AGENTS.md"), "utf-8");
    const secondReadme = await fs.readFile(path.join(cwd, ADR_README_PATH), "utf-8");
    const secondGuide = await fs.readFile(path.join(cwd, ADR_GUIDE_PATH), "utf-8");

    assert.equal(secondAgents, firstAgents);
    assert.equal(secondReadme, firstReadme);
    assert.equal(secondGuide, firstGuide);
    assert.equal(firstToolkit.length, ADR_TOOLKIT_FILES.length);
    assert.ok(
      [
        firstAgents,
        firstReadme,
        firstGuide,
        ...firstToolkit.filter((_content, index) =>
          ADR_TOOLKIT_FILES[index].relativePath.endsWith(".md")
        ),
      ].every((content) => !content.includes("<") && !content.includes(">")),
    );
    assert.ok(firstReadme.includes("[ADR workflow guide](GUIDE.md)"));
    assert.ok(firstGuide.includes("### Phase 1: Capture Intent (Socratic)"));
    assert.ok(firstGuide.includes("toolkit/references/review-checklist.md"));
    assert.ok(!/^## Source$/m.test(firstGuide));

    const newAdr = spawnSync(
      process.execPath,
      [
        path.join(cwd, ADR_TOOLKIT_PATH, "scripts", "new_adr.js"),
        "--repo-root",
        cwd,
        "--dir",
        "docs/adr",
        "--title",
        "Choose queue",
        "--status",
        "proposed",
        "--update-index",
        "--json",
      ],
      { cwd, encoding: "utf-8" },
    );
    assert.equal(newAdr.status, 0, newAdr.stderr);
    const createdAdrPath = JSON.parse(newAdr.stdout).createdAdrPath as string;
    assert.match(await fs.readFile(createdAdrPath, "utf-8"), /# Choose queue/);
    assert.match(await fs.readFile(path.join(cwd, ADR_README_PATH), "utf-8"), /Choose queue/);

    const setStatus = spawnSync(
      process.execPath,
      [
        path.join(cwd, ADR_TOOLKIT_PATH, "scripts", "set_adr_status.js"),
        createdAdrPath,
        "--status",
        "accepted",
      ],
      { cwd, encoding: "utf-8" },
    );
    assert.equal(setStatus.status, 0, setStatus.stderr);
    assert.match(await fs.readFile(createdAdrPath, "utf-8"), /^status: accepted$/m);

    assert.deepEqual(notifications, [
      {
        message: "Initialized the complete ADR toolkit in docs/adr/ and linked it from AGENTS.md.",
        type: "info",
      },
      { message: "ADR index, workflow guide, and toolkit are already current.", type: "info" },
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
    await assert.rejects(fs.access(path.join(cwd, ADR_TOOLKIT_PATH)), /ENOENT/);
    assert.match(notifications[0]?.message ?? "", /Failed to initialize ADR documentation/);
    assert.equal(notifications[0]?.type, "error");
  } finally {
    await fs.rm(cwd, { recursive: true, force: true });
  }
});

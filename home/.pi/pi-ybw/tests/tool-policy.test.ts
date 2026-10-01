import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import extras from "../extensions/ybw/index.ts";
import goal from "../extensions/goal/index.ts";

for (const allowed of [[], ["read"]]) {
  test(`real Pi tool allowlist survives extension startup: ${JSON.stringify(allowed)}`, async () => {
    const cwd = await mkdtemp(join(tmpdir(), "pi-tool-policy-"));
    try {
      const settingsManager = SettingsManager.inMemory();
      const resourceLoader = new DefaultResourceLoader({
        cwd, agentDir: cwd, settingsManager,
        noExtensions: true, noSkills: true, noThemes: true, noPromptTemplates: true, noContextFiles: true,
        extensionFactories: [extras, goal],
      });
      await resourceLoader.reload();
      const modelRuntime = await ModelRuntime.create({ authPath: join(cwd, "auth.json"), modelsPath: null, refreshOnCreate: false });
      const { session, extensionsResult } = await createAgentSession({
        cwd, agentDir: cwd, modelRuntime, resourceLoader, settingsManager,
        sessionManager: SessionManager.inMemory(cwd),
        ...(allowed.length ? { tools: allowed } : { noTools: "all" as const }),
      });
      try {
        assert.deepEqual(extensionsResult.errors, []);
        await session.bindExtensions({ mode: "json" });
        assert.deepEqual(session.getActiveToolNames(), allowed);
        session.setActiveToolsByName(["read", "grep", "find", "create_goal"]);
        assert.deepEqual(session.getActiveToolNames(), allowed);
      } finally { session.dispose(); }
    } finally { await rm(cwd, { recursive: true, force: true }); }
  });
}

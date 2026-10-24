import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import gscExtension, { parseGscArguments } from "../extensions/gsc/index.ts";
import { createExtensionHarness } from "./helpers/extension.ts";

function setup(cwd = "/offline") {
  const h = createExtensionHarness(gscExtension);
  h.ctx.cwd = cwd;
  h.ctx.mode = "rpc";
  h.ctx.hasUI = false;
  h.ctx.sessionManager.getSessionId = () => "gsc-session";
  return h;
}

test("/gsc preserves quoted business context and repeated source options", () => {
  const request = parseGscArguments('jundapipe.com --data "export one" --data q.csv --compare old.csv --audience "overseas buyers" --goal "qualified leads" --brand Junda --brand "Jun Da"');
  assert.equal(request.website, "https://jundapipe.com/");
  assert.deepEqual(request.data, ["export one", "q.csv"]);
  assert.deepEqual(request.compare, ["old.csv"]);
  assert.equal(request.audience, "overseas buyers");
  assert.equal(request.goal, "qualified leads");
  assert.deepEqual(request.brands, ["Junda", "Jun Da"]);
});

test("/gsc rejects ambiguous flags, invalid sites, placeholders and shell-looking options", () => {
  for (const args of [
    "example.com extra", "example.com --unknown x", "example.com --data",
    "example.com --goal --data file.csv", "example.com --goal a --goal b",
    'example.com --data ""', "ftp://example.com", "https://name:password@example.com",
    "[URL]", 'example.com --audience "unfinished', "--help example.com",
    "javascript:alert(1)",
  ]) assert.throws(() => parseGscArguments(args), args);
  assert.equal(parseGscArguments("--help").help, true);
  assert.equal(parseGscArguments("help").help, true);
  assert.equal(parseGscArguments("https://example.com/a?q=b").website, "https://example.com/a?q=b");
  assert.equal(parseGscArguments('example.com --goal "$(do-not-execute)"').goal, "$(do-not-execute)");
});

test("/gsc sends the full workflow and canonical source paths as a queued user request", async (t) => {
  const cwd = await mkdtemp(path.join(tmpdir(), "pi-gsc-command-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const csv = 'Top queries,Clicks,Impressions,CTR,Position\nsteel pipe,11,1000,1.1%,14\n';
  await writeFile(path.join(cwd, "queries.csv"), csv);
  await writeFile(path.join(cwd, "prior.csv"), csv);
  await symlink(path.join(cwd, "queries.csv"), path.join(cwd, "alias.csv"));
  const h = setup(cwd);
  h.ctx.isIdle = () => false;
  await h.command("gsc", 'example.com --data queries.csv --data alias.csv --compare prior.csv --audience "pipe buyers" --goal leads');
  assert.equal(h.sent.length, 1);
  assert.equal(typeof h.sent[0].message, "string");
  const message = h.sent[0].message as string;
  assert.deepEqual(h.sent[0].options, { deliverAs: "followUp" });
  assert.match(message, /https:\/\/example.com\//);
  assert.match(message, /pipe buyers/);
  assert.match(message, /gsc_read/);
  assert.match(message, /15/);
  assert.match(message, /30/);
  assert.equal(message.split(path.join(cwd, "queries.csv")).length - 1, 1);
  assert.match(message, /prior\.csv/);
  assert.doesNotMatch(message, /steel pipe,11/);
  assert.equal(await readFile(path.join(cwd, "queries.csv"), "utf8"), csv);
});

test("/gsc reports missing context without substituting traffic numbers or a default date range", async () => {
  const h = setup();
  await h.command("gsc", "example.com");
  assert.equal(h.sent.length, 1);
  const message = h.sent[0].message as string;
  assert.match(message, /"data": \[\]/);
  assert.match(message, /"audience": null/);
  assert.match(message, /"goal": null/);
  assert.match(message, /No valid GSC data/);
  assert.match(message, /hypotheses/);
});

test("/gsc refuses unreadable paths and a source reused across comparison periods", async (t) => {
  const cwd = await mkdtemp(path.join(tmpdir(), "pi-gsc-invalid-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await writeFile(path.join(cwd, "q.csv"), "Query,Clicks,Impressions,Position\na,1,10,5\n");
  const h = setup(cwd);
  await assert.rejects(h.command("gsc", "example.com --data missing.csv"), /missing\.csv/);
  await assert.rejects(h.command("gsc", "example.com --data q.csv --compare ./q.csv"), /both|same/i);
  assert.equal(h.sent.length, 0);
});

test("/gsc help is visible without starting an analysis", async () => {
  const h = setup();
  await h.command("gsc", "--help");
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].message.customType, "gsc-help");
  assert.match(h.sent[0].message.content, /--data/);
  assert.equal(h.sent[0].options.triggerTurn, false);
});

test("/gsc collects each input in order and sends one complete analysis request", async (t) => {
  const cwd = await mkdtemp(path.join(tmpdir(), "pi-gsc-input-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  for (const name of ["current export.csv", "prior export.csv"]) {
    await writeFile(path.join(cwd, name), "Query,Clicks,Impressions,Position\na,1,10,5\n");
  }
  const h = setup(cwd);
  h.ctx.hasUI = true;
  const titles: string[] = [];
  const answers = [" jundapipe.com ", "current export.csv", "prior export.csv", "海外管材采购商", "有效询盘", "Junda, 骏达，Junda"];
  h.ctx.ui.input = async (title: string) => { titles.push(title); return answers.shift(); };
  await h.command("gsc");
  assert.equal(h.sent.length, 1);
  assert.equal(titles.length, 6);
  for (const [index, pattern] of [/网站/, /GSC/, /对比/, /服务|受众/, /业务|目标/, /品牌/].entries()) {
    assert.match(titles[index], pattern);
  }
  const context = JSON.parse(h.sent[0].message.split("## Request context\n\n")[1]);
  assert.deepEqual(context, {
    website: "https://jundapipe.com/", audience: "海外管材采购商", goal: "有效询盘",
    brands: ["Junda", "骏达"], data: [path.join(cwd, "current export.csv")],
    compare: [path.join(cwd, "prior export.csv")],
  });
  assert.deepEqual(h.sent[0].options, { deliverAs: "followUp" });
  assert.deepEqual(h.notices, []);
});

test("/gsc URL skips the website question and leaves skipped context unknown", async () => {
  const h = setup();
  h.ctx.hasUI = true;
  const titles: string[] = [];
  h.ctx.ui.input = async (title: string) => { titles.push(title); return "  "; };
  await h.command("gsc", "example.com");
  assert.equal(titles.length, 5);
  assert.match(titles[0], /GSC/);
  assert.equal(h.sent.length, 1);
  const context = JSON.parse(h.sent[0].message.split("## Request context\n\n")[1]);
  assert.deepEqual(context, {
    website: "https://example.com/", audience: null, goal: null,
    brands: [], data: [], compare: [],
  });
});

test("/gsc only asks for fields not supplied as options", async (t) => {
  const cwd = await mkdtemp(path.join(tmpdir(), "pi-gsc-prefilled-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await writeFile(path.join(cwd, "q.csv"), "Query,Clicks,Impressions,Position\na,1,10,5\n");
  const h = setup(cwd);
  h.ctx.hasUI = true;
  const titles: string[] = [];
  const answers = ["", "Junda"];
  h.ctx.ui.input = async (title: string) => { titles.push(title); return answers.shift(); };
  await h.command("gsc", 'example.com --data q.csv --audience buyers --goal leads');
  assert.equal(titles.length, 2);
  assert.match(titles[0], /对比/);
  assert.match(titles[1], /品牌/);
  assert.equal(h.sent.length, 1);
  assert.match(h.sent[0].message, /"audience": "buyers"/);
  assert.match(h.sent[0].message, /"goal": "leads"/);
  assert.match(h.sent[0].message, /Junda/);
});

test("/gsc cancellation or a session switch at any step stops the wizard", async () => {
  for (const kind of ["cancel", "session"]) {
    for (let stopAt = 0; stopAt < 6; stopAt++) {
      const h = setup();
      h.ctx.hasUI = true;
      let calls = 0;
      h.ctx.ui.input = async () => {
        const step = calls++;
        if (step === stopAt) {
          if (kind === "cancel") return undefined;
          h.ctx.sessionManager.getSessionId = () => "other-session";
        }
        return step === 0 ? "example.com" : "";
      };
      await h.command("gsc");
      assert.equal(calls, stopAt + 1, kind + " at step " + stopAt);
      assert.equal(h.sent.length, 0, kind + " at step " + stopAt);
      assert.deepEqual(h.notices, []);
    }
  }
  await assert.rejects(setup().command("gsc"), /website|网站/i);
});

test("/gsc retries an invalid website or source at its step without losing earlier answers", async (t) => {
  const cwd = await mkdtemp(path.join(tmpdir(), "pi-gsc-retry-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  for (const name of ["q.csv", "prior.csv"]) {
    await writeFile(path.join(cwd, name), "Query,Clicks,Impressions,Position\na,1,10,5\n");
  }
  const h = setup(cwd);
  h.ctx.hasUI = true;
  const titles: string[] = [];
  const answers = ["", "ftp://example.com", "example.com", "missing.csv", "q.csv", "q.csv", "prior.csv", "buyers", "leads", ""];
  h.ctx.ui.input = async (title: string) => { titles.push(title); return answers.shift(); };
  await h.command("gsc");
  assert.equal(h.sent.length, 1);
  assert.equal(titles.length, 10);
  assert.equal(titles[0], titles[1]);
  assert.equal(titles[1], titles[2]);
  assert.equal(titles[3], titles[4]);
  assert.equal(titles[5], titles[6]);
  assert.equal(h.notices.length, 4);
  assert.match(h.notices[2], /missing\.csv/);
  assert.match(h.notices[3], /same|同一/);
  const context = JSON.parse(h.sent[0].message.split("## Request context\n\n")[1]);
  assert.equal(context.website, "https://example.com/");
  assert.deepEqual(context.data, [path.join(cwd, "q.csv")]);
  assert.deepEqual(context.compare, [path.join(cwd, "prior.csv")]);
  assert.equal(context.audience, "buyers");
});

for (const mode of ["print", "json"]) {
  test(`/gsc rejects ${mode} mode before launching a detached analysis`, async () => {
    const h = setup();
    h.ctx.mode = mode;
    await assert.rejects(h.command("gsc", "example.com"), /interactive|交互/i);
    assert.equal(h.sent.length, 0);
  });
}

for (const enabled of [false, true]) {
  test(`real Pi discovers /gsc and honors the tool allowlist: enabled=${enabled}`, async (t) => {
    const cwd = await mkdtemp(path.join(tmpdir(), "pi-gsc-runtime-"));
    t.after(() => rm(cwd, { recursive: true, force: true }));
    const settingsManager = SettingsManager.inMemory();
    const resourceLoader = new DefaultResourceLoader({
      cwd, agentDir: cwd, settingsManager,
      noExtensions: true, noSkills: true, noThemes: true, noPromptTemplates: true, noContextFiles: true,
      additionalExtensionPaths: [fileURLToPath(new URL("../extensions/gsc/index.ts", import.meta.url))],
    });
    await resourceLoader.reload();
    const modelRuntime = await ModelRuntime.create({
      authPath: path.join(cwd, "auth.json"), modelsPath: null, refreshOnCreate: false,
    });
    const { session, extensionsResult } = await createAgentSession({
      cwd, agentDir: cwd, settingsManager, resourceLoader, modelRuntime,
      sessionManager: SessionManager.inMemory(cwd),
      ...(enabled ? { tools: ["gsc_read"] } : { noTools: "all" as const }),
    });
    try {
      assert.deepEqual(extensionsResult.errors, []);
      await session.bindExtensions({ mode: "rpc" });
      assert.deepEqual(session.getActiveToolNames(), enabled ? ["gsc_read"] : []);
      await session.prompt("/gsc --help");
      const help = session.state.messages.find((message: any) => message.customType === "gsc-help") as any;
      assert.ok(help, "The real runtime must dispatch the registered command");
      assert.match(help.content, /--compare/);
      assert.equal(session.state.messages.some((message: any) => message.role === "assistant"), false);
      assert.deepEqual(session.getActiveToolNames(), enabled ? ["gsc_read"] : []);
    } finally {
      session.dispose();
    }
  });
}

test("gsc_read resolves its explicit file against the current cwd and honors cancellation", async (t) => {
  const cwd = await mkdtemp(path.join(tmpdir(), "pi-gsc-tool-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await writeFile(path.join(cwd, "q.csv"), "Query,Clicks,Impressions,Position\na,10,100,5\nb,1,900,15\n");
  const h = setup(cwd);
  const tool = h.tools.get("gsc_read");
  assert.ok(tool);
  const result = await tool.execute("read", { path: "q.csv" }, new AbortController().signal, undefined, h.ctx);
  assert.equal(JSON.parse(result.content[0].text).source, path.join(cwd, "q.csv"));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(tool.execute("read", { path: "q.csv" }, controller.signal, undefined, h.ctx), /abort/i);
});

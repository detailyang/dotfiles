import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DEFAULT_TOOL_DISPLAY_CONFIG } from "../extensions/diff-view/config/config.ts";
import { loadDiffViewConfig, openDiffViewSettings, saveDiffViewConfig } from "../extensions/diff-view/config/settings.ts";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "diff-view-settings-"));
  return { root, path: join(root, "diff-view.json"), cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function menu(select: (title: string, options: string[]) => string | undefined) {
  let config = { ...DEFAULT_TOOL_DISPLAY_CONFIG };
  const saved: typeof config[] = [];
  const notices: { message: string; level: string }[] = [];
  return {
    ctx: {
      hasUI: true,
      ui: {
        select: async (title: string, options: string[]) => select(title, options),
        input: async (_title: string, _initial: string): Promise<string | undefined> => undefined,
        confirm: async () => true,
        notify: (message: string, level: string) => notices.push({ message, level }),
      },
    } as any,
    get: () => config,
    save: (next: typeof config) => { config = next; saved.push(next); },
    saved, notices,
  };
}

test("missing settings use independent defaults without creating a file", () => {
  const f = fixture();
  try {
    const config = loadDiffViewConfig(f.path);
    assert.deepEqual(config, DEFAULT_TOOL_DISPLAY_CONFIG);
    config.showEditCall = true;
    assert.equal(loadDiffViewConfig(f.path).showEditCall, false);
    assert.deepEqual(readdirSync(f.root), []);
  } finally { f.cleanup(); }
});

test("settings round-trip all options and accept partial settings", () => {
  const f = fixture();
  try {
    const config = {
      showEditCall: true, diffViewMode: "unified" as const, diffIndicatorMode: "none" as const,
      diffWordWrap: false, editDiffCollapsedLines: 12, writeDiffCollapsedLines: 6,
      expandedPreviewMaxLines: 0, diffSplitMinWidth: 160,
    };
    saveDiffViewConfig(f.path, config);
    assert.deepEqual(loadDiffViewConfig(f.path), config);
    assert.deepEqual(readdirSync(f.root), ["diff-view.json"]);
    writeFileSync(f.path, JSON.stringify({ showEditCall: true, unknown: "ignored" }));
    assert.deepEqual(loadDiffViewConfig(f.path), { ...DEFAULT_TOOL_DISPLAY_CONFIG, showEditCall: true });
  } finally { f.cleanup(); }
});

test("invalid JSON, types, enums, and numeric bounds are rejected without overwriting", () => {
  const f = fixture();
  try {
    for (const text of [
      "{", "null", "[]", '{"showEditCall":"false"}', '{"diffWordWrap":0}',
      '{"diffViewMode":"invalid"}', '{"diffIndicatorMode":"invalid"}',
      '{"editDiffCollapsedLines":0}', '{"writeDiffCollapsedLines":-1}',
      '{"expandedPreviewMaxLines":1.5}', '{"diffSplitMinWidth":1001}',
      '{"editDiffCollapsedLines":10001}',
    ]) {
      writeFileSync(f.path, text);
      assert.throws(() => loadDiffViewConfig(f.path));
      assert.equal(readFileSync(f.path, "utf8"), text);
    }
    saveDiffViewConfig(f.path, DEFAULT_TOOL_DISPLAY_CONFIG);
    const original = readFileSync(f.path, "utf8");
    assert.throws(() => saveDiffViewConfig(f.path, { ...DEFAULT_TOOL_DISPLAY_CONFIG, diffSplitMinWidth: NaN }));
    assert.equal(readFileSync(f.path, "utf8"), original);
  } finally { f.cleanup(); }
});

test("atomic save creates parent directories and cleans up after rename failure", () => {
  const f = fixture();
  try {
    const nested = join(f.root, "agent", "diff-view.json");
    saveDiffViewConfig(nested, DEFAULT_TOOL_DISPLAY_CONFIG);
    assert.deepEqual(loadDiffViewConfig(nested), DEFAULT_TOOL_DISPLAY_CONFIG);
    mkdirSync(f.path);
    assert.throws(() => saveDiffViewConfig(f.path, DEFAULT_TOOL_DISPLAY_CONFIG));
    assert.deepEqual(readdirSync(f.root).sort(), ["agent", "diff-view.json"]);
  } finally { f.cleanup(); }
});

test("menu exposes every setting and cancellation never writes", async () => {
  const m = menu((_title, options) => {
    assert.equal(options.length, Object.keys(DEFAULT_TOOL_DISPLAY_CONFIG).length + 1);
    assert.match(options[0], /隐藏/);
    return undefined;
  });
  await openDiffViewSettings(m.ctx, m.get, m.save);
  assert.equal(m.saved.length, 0);
});

test("native edit visibility is configurable and the menu reflects the new value", async () => {
  let step = 0;
  const m = menu((_title, options) => {
    if (step++ === 0) return options[0];
    if (step === 2) return "显示";
    assert.match(options[0], /: 显示$/);
    return undefined;
  });
  await openDiffViewSettings(m.ctx, m.get, m.save);
  assert.equal(m.saved.length, 1);
  assert.equal(m.get().showEditCall, true);
});

test("every enumerated option maps its label to the stored value", async () => {
  for (const [index, choice, key, expected] of [
    [1, "左右对比", "diffViewMode", "split"], [1, "统一视图", "diffViewMode", "unified"],
    [2, "+ / -", "diffIndicatorMode", "classic"], [2, "无", "diffIndicatorMode", "none"],
    [3, "关闭", "diffWordWrap", false],
  ] as const) {
    let step = 0;
    const m = menu((_title, options) => step++ === 0 ? options[index] : step === 2 ? choice : undefined);
    await openDiffViewSettings(m.ctx, m.get, m.save);
    assert.equal(m.get()[key], expected);
  }
});

test("numeric input is validated, including blank input and supported zero semantics", async () => {
  for (const [index, input, expected] of [
    [4, "0", undefined], [4, "-1", undefined], [4, "1.5", undefined],
    [4, "1e2", undefined], [4, "", undefined], [4, "10001", undefined],
    [4, " 12 ", 12], [5, "0", 0], [6, "0", 0], [7, "19", undefined], [7, "180", 180],
  ] as const) {
    let step = 0;
    const m = menu((_title, options) => step++ === 0 ? options[index] : undefined);
    m.ctx.ui.input = async () => input;
    await openDiffViewSettings(m.ctx, m.get, m.save);
    assert.equal(m.saved.length, expected === undefined ? 0 : 1);
    assert.equal(m.notices.length, expected === undefined ? 1 : 0);
    if (expected !== undefined) {
      const key = ["editDiffCollapsedLines", "writeDiffCollapsedLines", "expandedPreviewMaxLines", "diffSplitMinWidth"][index - 4];
      assert.equal((m.get() as any)[key], expected);
    }
  }
});

test("cancelling a nested selector, numeric input, or reset leaves settings intact", async () => {
  for (const index of [0, 4, 8]) {
    let step = 0;
    const m = menu((_title, options) => step++ === 0 ? options[index] : undefined);
    m.ctx.ui.confirm = async () => false;
    await openDiffViewSettings(m.ctx, m.get, m.save);
    assert.equal(m.saved.length, 0);
  }
});

test("confirmed reset restores all defaults", async () => {
  let step = 0;
  const m = menu((_title, options) => step++ === 0 ? options[8] : undefined);
  m.save({ ...DEFAULT_TOOL_DISPLAY_CONFIG, showEditCall: true, diffWordWrap: false });
  await openDiffViewSettings(m.ctx, m.get, m.save);
  assert.deepEqual(m.get(), DEFAULT_TOOL_DISPLAY_CONFIG);
  assert.equal(m.saved.length, 2);
});

test("save failure is visible and does not update the active config", async () => {
  let step = 0;
  const m = menu((_title, options) => step++ === 0 ? options[0] : step === 2 ? "显示" : undefined);
  await openDiffViewSettings(m.ctx, m.get, () => { throw new Error("read-only filesystem"); });
  assert.equal(m.get().showEditCall, false);
  assert.equal(m.notices[0].level, "error");
  assert.match(m.notices[0].message, /read-only filesystem/);
});

test("non-interactive mode does not open a menu or write settings", async () => {
  const m = menu(() => { throw new Error("must not open menu"); });
  m.ctx.hasUI = false;
  await openDiffViewSettings(m.ctx, m.get, m.save);
  assert.equal(m.saved.length, 0);
  assert.equal(m.notices[0].level, "warning");
});

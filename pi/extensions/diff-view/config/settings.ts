import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { DEFAULT_TOOL_DISPLAY_CONFIG, type ToolDisplayConfig } from "./config.ts";

type Setting = {
  key: keyof ToolDisplayConfig;
  label: string;
  choices?: readonly { label: string; value: string | boolean }[];
  min?: number;
  max?: number;
};

const SETTINGS: readonly Setting[] = [
  {
    key: "showEditCall", label: "原生 edit 调用区",
    choices: [{ label: "隐藏（只显示 diff）", value: false }, { label: "显示", value: true }],
  },
  {
    key: "diffViewMode", label: "Diff 布局",
    choices: [
      { label: "自动", value: "auto" }, { label: "左右对比", value: "split" },
      { label: "统一视图", value: "unified" },
    ],
  },
  {
    key: "diffIndicatorMode", label: "增删标记",
    choices: [
      { label: "竖线", value: "bars" }, { label: "+ / -", value: "classic" },
      { label: "无", value: "none" },
    ],
  },
  {
    key: "diffWordWrap", label: "自动换行",
    choices: [{ label: "开启", value: true }, { label: "关闭", value: false }],
  },
  { key: "editDiffCollapsedLines", label: "Edit 折叠行数", min: 1, max: 10000 },
  { key: "writeDiffCollapsedLines", label: "Write 折叠行数（0 = 仅摘要）", min: 0, max: 10000 },
  { key: "expandedPreviewMaxLines", label: "展开行数上限（0 = 不限制）", min: 0, max: 10000 },
  { key: "diffSplitMinWidth", label: "自动左右对比最小宽度", min: 20, max: 1000 },
];

function validValue(setting: Setting, value: unknown): boolean {
  if (setting.choices) return setting.choices.some((choice) => choice.value === value);
  return typeof value === "number" && Number.isSafeInteger(value)
    && value >= setting.min! && value <= setting.max!;
}

function validateConfig(value: unknown): ToolDisplayConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("diff-view.json must contain a JSON object");
  }
  const input = value as Record<string, unknown>;
  const config = { ...DEFAULT_TOOL_DISPLAY_CONFIG };
  for (const setting of SETTINGS) {
    if (!Object.hasOwn(input, setting.key)) continue;
    if (!validValue(setting, input[setting.key])) {
      throw new Error(`Invalid diff-view setting: ${setting.key}`);
    }
    Object.assign(config, { [setting.key]: input[setting.key] });
  }
  return config;
}

export function loadDiffViewConfig(path: string): ToolDisplayConfig {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { ...DEFAULT_TOOL_DISPLAY_CONFIG };
    }
    throw error;
  }
  return validateConfig(JSON.parse(text));
}

/** Replace only this extension's settings; a failed write leaves the old file intact. */
export function saveDiffViewConfig(path: string, config: ToolDisplayConfig): void {
  const text = `${JSON.stringify(validateConfig(config), null, 2)}\n`;
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, text, { encoding: "utf8", flag: "wx", mode: 0o600 });
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}

export async function openDiffViewSettings(
  ctx: Pick<ExtensionCommandContext, "hasUI" | "ui">,
  getConfig: () => ToolDisplayConfig,
  save: (config: ToolDisplayConfig) => void,
): Promise<void> {
  if (!ctx.hasUI) {
    ctx.ui.notify("/diff-view 需要交互模式。", "warning");
    return;
  }

  const resetLabel = "恢复默认设置";
  while (true) {
    const current = getConfig();
    const labels = SETTINGS.map((setting) => {
      const value = current[setting.key];
      const label = setting.choices?.find((choice) => choice.value === value)?.label ?? String(value);
      return `${setting.label}: ${label}`;
    });
    const selected = await ctx.ui.select("Diff view（修改后自动保存，Esc 退出）", [...labels, resetLabel]);
    if (selected === undefined) return;

    let next: ToolDisplayConfig;
    if (selected === resetLabel) {
      if (!await ctx.ui.confirm("恢复默认设置", "将恢复全部 diff-view 显示设置，是否继续？")) continue;
      next = { ...DEFAULT_TOOL_DISPLAY_CONFIG };
    } else {
      const setting = SETTINGS[labels.indexOf(selected)];
      if (!setting) continue;
      let value: unknown;
      if (setting.choices) {
        const choice = await ctx.ui.select(setting.label, setting.choices.map((item) => item.label));
        if (choice === undefined) continue;
        value = setting.choices.find((item) => item.label === choice)?.value;
      } else {
        const input = await ctx.ui.input(
          `${setting.label}（整数 ${setting.min}–${setting.max}）`, String(current[setting.key]),
        );
        if (input === undefined) continue;
        value = /^\d+$/.test(input.trim()) ? Number(input.trim()) : undefined;
      }
      if (!validValue(setting, value)) {
        ctx.ui.notify("无效设置，原值未更改。", "warning");
        continue;
      }
      next = { ...current, [setting.key]: value };
    }

    try {
      // The caller persists first, then replaces the live config only on success.
      save(next);
    } catch (error) {
      ctx.ui.notify(`配置未保存，原设置保持不变：${error instanceof Error ? error.message : String(error)}`, "error");
    }
  }
}

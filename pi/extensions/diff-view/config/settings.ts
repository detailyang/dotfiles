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
    key: "showEditCall", label: "Native edit call",
    choices: [{ label: "Hidden (diff only)", value: false }, { label: "Visible", value: true }],
  },
  {
    key: "diffViewMode", label: "Diff layout",
    choices: [
      { label: "Auto", value: "auto" }, { label: "Side-by-side", value: "split" },
      { label: "Unified", value: "unified" },
    ],
  },
  {
    key: "diffIndicatorMode", label: "Change markers",
    choices: [
      { label: "Bars", value: "bars" }, { label: "+ / -", value: "classic" },
      { label: "None", value: "none" },
    ],
  },
  {
    key: "diffWordWrap", label: "Word wrap",
    choices: [{ label: "On", value: true }, { label: "Off", value: false }],
  },
  { key: "editDiffCollapsedLines", label: "Edit collapsed lines", min: 1, max: 10000 },
  { key: "writeDiffCollapsedLines", label: "Write collapsed lines (0 = summary only)", min: 0, max: 10000 },
  { key: "expandedPreviewMaxLines", label: "Expanded line limit (0 = unlimited)", min: 0, max: 10000 },
  { key: "diffSplitMinWidth", label: "Auto split minimum width", min: 20, max: 1000 },
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
    ctx.ui.notify("/diff-view requires interactive mode.", "warning");
    return;
  }

  const resetLabel = "Reset to defaults";
  while (true) {
    const current = getConfig();
    const labels = SETTINGS.map((setting) => {
      const value = current[setting.key];
      const label = setting.choices?.find((choice) => choice.value === value)?.label ?? String(value);
      return `${setting.label}: ${label}`;
    });
    const selected = await ctx.ui.select("Diff view (changes auto-save; Esc to close)", [...labels, resetLabel]);
    if (selected === undefined) return;

    let next: ToolDisplayConfig;
    if (selected === resetLabel) {
      if (!await ctx.ui.confirm("Reset to defaults", "Reset all diff-view display settings to their defaults?")) continue;
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
          `${setting.label} (integer ${setting.min}–${setting.max})`, String(current[setting.key]),
        );
        if (input === undefined) continue;
        value = /^\d+$/.test(input.trim()) ? Number(input.trim()) : undefined;
      }
      if (!validValue(setting, value)) {
        ctx.ui.notify("Invalid value. The setting was not changed.", "warning");
        continue;
      }
      next = { ...current, [setting.key]: value };
    }

    try {
      // The caller persists first, then replaces the live config only on success.
      save(next);
    } catch (error) {
      ctx.ui.notify(`Could not save settings; previous settings are unchanged: ${error instanceof Error ? error.message : String(error)}`, "error");
    }
  }
}

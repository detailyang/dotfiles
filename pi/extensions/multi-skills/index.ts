/**
 * Multi-Skills Extension
 *
 * Registers /multi-skills command that opens a two-stage interaction:
 *   Stage 1: Overlay with multi-select skill list (space to toggle, enter to confirm)
 *   Stage 2: ctx.ui.input() for user prompt text
 *
 * Finally assembles an XML prompt with selected skills' full SKILL.md content
 * and the user's input, then sends it via pi.sendUserMessage().
 */

import type { ExtensionAPI, SlashCommandInfo } from "@earendil-works/pi-coding-agent";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import {
  Container,
  Key,
  Text,
  matchesKey,
  truncateToWidth,
  type Component,
} from "@earendil-works/pi-tui";
import { readFileSync } from "node:fs";

// ── Types ──────────────────────────────────────────────────────────

interface SkillItem {
  value: string;
  label: string;
  description: string;
  path: string;
}

interface LoadedSkill {
  name: string;
  description: string;
  content: string;
}

// ── Skill discovery ────────────────────────────────────────────────

function getSkillItems(pi: ExtensionAPI): SkillItem[] {
  return pi
    .getCommands()
    .filter((cmd: SlashCommandInfo) => cmd.source === "skill")
    .map((cmd: SlashCommandInfo) => ({
      value: cmd.name,
      label: cmd.name,
      description: cmd.description ?? "",
      path: cmd.sourceInfo.path,
    }));
}

// ── XML prompt builder ─────────────────────────────────────────────

function buildPrompt(skills: LoadedSkill[], userInput: string): string {
  let xml = "<available_skills>\n";
  for (const skill of skills) {
    xml += `<skill name="${skill.name}">\n`;
    xml += `<description>${skill.description}</description>\n`;
    xml += `<content>\n${skill.content}\n</content>\n`;
    xml += `</skill>\n`;
  }
  xml += "</available_skills>";
  if (userInput.trim()) {
    xml += "\n\n" + userInput.trim();
  }
  return xml;
}

// ── MultiSelectList component ──────────────────────────────────────

const LABEL_COL_WIDTH = 22;
const CHECKBOX_CHECKED = "[x]";
const CHECKBOX_UNCHECKED = "[ ]";
const CURSOR_PREFIX = "▸ ";
const INDENT_PREFIX = "  ";

interface ThemeLike {
  fg: (color: string, text: string) => string;
  bold: (text: string) => string;
}

class MultiSelectList implements Component {
  private items: SkillItem[];
  private checked: Set<string> = new Set();
  private selectedIndex = 0;
  private scrollOffset = 0;
  private maxVisible: number;
  private theme: ThemeLike;
  private cachedWidth?: number;
  private cachedLines?: string[];

  constructor(items: SkillItem[], maxVisible: number, theme: ThemeLike) {
    this.items = items;
    this.maxVisible = maxVisible;
    this.theme = theme;
  }

  toggleCurrent(): void {
    const value = this.items[this.selectedIndex].value;
    if (this.checked.has(value)) {
      this.checked.delete(value);
    } else {
      this.checked.add(value);
    }
    this.invalidate();
  }

  getChecked(): Set<string> {
    return new Set(this.checked);
  }

  getCheckedCount(): number {
    return this.checked.size;
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.up)) {
      if (this.selectedIndex > 0) {
        this.selectedIndex--;
        this.adjustScroll();
        this.invalidate();
      }
    } else if (matchesKey(data, Key.down)) {
      if (this.selectedIndex < this.items.length - 1) {
        this.selectedIndex++;
        this.adjustScroll();
        this.invalidate();
      }
    } else if (matchesKey(data, Key.space)) {
      this.toggleCurrent();
    }
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    const lines: string[] = [];
    const end = Math.min(this.scrollOffset + this.maxVisible, this.items.length);

    for (let i = this.scrollOffset; i < end; i++) {
      const item = this.items[i];
      const isCursor = i === this.selectedIndex;
      const isChecked = this.checked.has(item.value);

      const prefix = isCursor ? CURSOR_PREFIX : INDENT_PREFIX;
      const checkbox = isChecked ? CHECKBOX_CHECKED : CHECKBOX_UNCHECKED;
      const separator = " ";

      // Style components
      const styledPrefix = isCursor
        ? this.theme.fg("accent", prefix)
        : prefix;
      const styledCheckbox = isChecked
        ? this.theme.fg("accent", this.theme.bold(checkbox))
        : this.theme.fg("dim", checkbox);
      const styledLabel = isCursor
        ? this.theme.fg("accent", this.theme.bold(item.label.padEnd(LABEL_COL_WIDTH)))
        : this.theme.fg("muted", item.label.padEnd(LABEL_COL_WIDTH));
      const styledDesc = this.theme.fg("dim", item.description);

      const visibleContent = `${styledPrefix}${styledCheckbox}${separator}${styledLabel}${styledDesc}`;

      lines.push(truncateToWidth(visibleContent, width));
    }

    // Scroll indicators
    if (this.scrollOffset > 0) {
      lines.push(this.theme.fg("dim", `  ↑${this.scrollOffset} more above`));
    }
    const remainingBelow = this.items.length - end;
    if (remainingBelow > 0) {
      lines.push(this.theme.fg("dim", `  ↓${remainingBelow} more below`));
    }

    this.cachedWidth = width;
    this.cachedLines = lines;
    return lines;
  }

  private adjustScroll(): void {
    if (this.selectedIndex < this.scrollOffset) {
      this.scrollOffset = this.selectedIndex;
    } else if (this.selectedIndex >= this.scrollOffset + this.maxVisible) {
      this.scrollOffset = this.selectedIndex - this.maxVisible + 1;
    }
    // Clamp
    const maxOffset = Math.max(0, this.items.length - this.maxVisible);
    this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, maxOffset));
  }
}

// ── Extension entry point ──────────────────────────────────────────

export default function multiSkillsExtension(pi: ExtensionAPI) {
  pi.registerCommand("multi-skills", {
    description: "Select multiple skills and compose a prompt",
    handler: async (_args, ctx) => {
      const items = getSkillItems(pi);
      if (items.length === 0) {
        ctx.ui.notify("No skills available", "warning");
        return;
      }

      // ── Stage 1: Multi-select overlay ──
      const checked = await ctx.ui.custom<Set<string> | null>(
        (tui, theme, _kb, done) => {
          const container = new Container();

          // Top border
          container.addChild(
            new DynamicBorder((s: string) => theme.fg("accent", s)),
          );

          // Title (updated dynamically)
          const titleText = new Text(
            theme.fg("accent", theme.bold("  π Multi-Skills")) +
              theme.fg("muted", " (0 selected)"),
            0,
            0,
          );
          container.addChild(titleText);

          container.addChild(
            new Text(
              theme.fg("dim", "  Select skills to include in your prompt"),
              0,
              0,
            ),
          );

          // Separator
          container.addChild(
            new DynamicBorder((s: string) => theme.fg("borderMuted", s)),
          );

          // Multi-select list
          const maxVisible = Math.min(items.length, 15);
          const selectList = new MultiSelectList(items, maxVisible, theme);
          container.addChild(selectList);

          // Separator
          container.addChild(
            new DynamicBorder((s: string) => theme.fg("borderMuted", s)),
          );

          // Help text
          container.addChild(
            new Text(
              theme.fg(
                "dim",
                "  ↑↓ navigate  •  space toggle  •  enter confirm  •  esc cancel",
              ),
              0,
              0,
            ),
          );

          // Bottom border
          container.addChild(
            new DynamicBorder((s: string) => theme.fg("accent", s)),
          );

          return {
            render(width: number) {
              return container.render(width);
            },
            invalidate() {
              container.invalidate();
            },
            handleInput(data: string) {
              if (matchesKey(data, Key.escape)) {
                done(null);
                return;
              }
              if (matchesKey(data, Key.enter)) {
                done(selectList.getChecked());
                return;
              }
              selectList.handleInput(data);

              // Update title with selected count
              const count = selectList.getCheckedCount();
              titleText.setText(
                theme.fg("accent", theme.bold("  π Multi-Skills")) +
                  theme.fg("muted", ` (${count} selected)`),
              );

              tui.requestRender();
            },
          };
        },
        { overlay: true, overlayOptions: { width: "90%", maxHeight: "90%" } },
      );

      // Handle overlay dismiss / empty selection
      if (!checked || checked.size === 0) {
        if (checked !== null && checked.size === 0) {
          ctx.ui.notify("No skills selected", "warning");
        }
        return;
      }

      // ── Stage 2: User input ──
      const userInput = await ctx.ui.input("Prompt for selected skills:", "");
      if (userInput === undefined) {
        // User cancelled input
        return;
      }

      // ── Read SKILL.md content for selected skills ──
      const selectedItems = items.filter((item) => checked.has(item.value));
      const skills: LoadedSkill[] = selectedItems.map((item) => {
        let content: string;
        try {
          content = readFileSync(item.path, "utf-8");
        } catch (e: any) {
          content = `[Error: unable to read ${item.path}: ${e.message}]`;
        }
        return {
          name: item.value,
          description: item.description,
          content,
        };
      });

      // ── Assemble and send ──
      const prompt = buildPrompt(skills, userInput);
      pi.sendUserMessage(prompt);
    },
  });
}

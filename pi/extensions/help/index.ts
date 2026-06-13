/**
 * Help Extension
 *
 * Registers /help command that opens a fullscreen floating overlay
 * showing all pi slash commands and usage information.
 *
 * Built-in commands are hardcoded; extension commands are discovered
 * dynamically via pi.getCommands().
 */

import type { ExtensionAPI, SlashCommandInfo } from "@earendil-works/pi-coding-agent";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import {
  Container,
  Key,
  type SelectItem,
  SelectList,
  Text,
  matchesKey,
} from "@earendil-works/pi-tui";

interface CommandEntry {
  name: string;
  description: string;
  source: "built-in" | "extension" | "prompt" | "skill";
}

const BUILTIN_COMMANDS: CommandEntry[] = [
  { name: "new", description: "Start a new session", source: "built-in" },
  { name: "resume", description: "Resume a different session", source: "built-in" },
  { name: "fork", description: "Create a new fork from a previous user message", source: "built-in" },
  { name: "clone", description: "Duplicate the current session at the current position", source: "built-in" },
  { name: "tree", description: "Navigate session tree (switch branches)", source: "built-in" },
  { name: "compact", description: "Manually compact the session context", source: "built-in" },
  { name: "model", description: "Select model (opens selector UI)", source: "built-in" },
  { name: "scoped-models", description: "Enable/disable models for Ctrl+P cycling", source: "built-in" },
  { name: "settings", description: "Open settings menu", source: "built-in" },
  { name: "reload", description: "Reload keybindings, extensions, skills, prompts, and themes", source: "built-in" },
  { name: "share", description: "Share session as a secret GitHub gist", source: "built-in" },
  { name: "export", description: "Export session (HTML default, or specify path: .html/.jsonl)", source: "built-in" },
  { name: "import", description: "Import and resume a session from a JSONL file", source: "built-in" },
  { name: "copy", description: "Copy last agent message to clipboard", source: "built-in" },
  { name: "name", description: "Set session display name", source: "built-in" },
  { name: "session", description: "Show session info and stats", source: "built-in" },
  { name: "login", description: "Configure provider authentication", source: "built-in" },
  { name: "logout", description: "Remove provider authentication", source: "built-in" },
  { name: "hotkeys", description: "Show all keyboard shortcuts", source: "built-in" },
  { name: "changelog", description: "Show changelog entries", source: "built-in" },
  { name: "quit", description: "Quit pi", source: "built-in" },
];

function collectCommands(pi: ExtensionAPI): CommandEntry[] {
  const extensionCommands: CommandEntry[] = pi
    .getCommands()
    .map((cmd: SlashCommandInfo) => ({
      name: cmd.name,
      description: cmd.description ?? "",
      source: cmd.source as CommandEntry["source"],
    }));

  return [...BUILTIN_COMMANDS, ...extensionCommands];
}

function groupBySource(commands: CommandEntry[]): Map<string, CommandEntry[]> {
  const groups = new Map<string, CommandEntry[]>();
  const sourceOrder = ["built-in", "extension", "prompt", "skill"];
  const sourceLabels: Record<string, string> = {
    "built-in": "Built-in Commands",
    extension: "Extension Commands",
    prompt: "Prompt Templates",
    skill: "Skills",
  };

  for (const source of sourceOrder) {
    const items = commands.filter((c) => c.source === source);
    if (items.length > 0) {
      groups.set(sourceLabels[source] ?? source, items);
    }
  }
  return groups;
}

export default function helpExtension(pi: ExtensionAPI) {
  pi.registerCommand("help", {
    description: "Show all pi commands and usage",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("/help requires interactive TUI mode.", "info");
        return;
      }

      const allCommands = collectCommands(pi);
      const groups = groupBySource(allCommands);

      // Build flat SelectItem list with group headers
      const items: SelectItem[] = [];
      for (const [label, cmds] of groups) {
        // Group header as a disabled-style item
        items.push({
          value: `__header__${label}`,
          label: label,
          description: `${cmds.length} command${cmds.length > 1 ? "s" : ""}`,
        });
        for (const cmd of cmds) {
          items.push({
            value: `/${cmd.name}`,
            label: `/${cmd.name}`,
            description: cmd.description,
          });
        }
      }

      await ctx.ui.custom<void>((tui, theme, _kb, done) => {
        const container = new Container();

        container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
        container.addChild(
          new Text(
            theme.fg("accent", theme.bold("  π Command Reference")),
            0,
            0,
          ),
        );
        container.addChild(new Text(theme.fg("dim", "  All available slash commands and their descriptions"), 0, 0));
        container.addChild(new DynamicBorder((s: string) => theme.fg("borderMuted", s)));

        const selectList = new SelectList(items, 20, {
          selectedPrefix: (t: string) => theme.fg("accent", t),
          selectedText: (t: string) => theme.fg("accent", theme.bold(t)),
          description: (t: string) => theme.fg("muted", t),
          scrollInfo: (t: string) => theme.fg("dim", t),
          noMatch: (t: string) => theme.fg("warning", t),
        });

        selectList.onSelect = () => {
          // Could execute the command or just close
          done(undefined);
        };
        selectList.onCancel = () => done(undefined);

        container.addChild(selectList);

        container.addChild(new DynamicBorder((s: string) => theme.fg("borderMuted", s)));
        container.addChild(
          new Text(theme.fg("dim", "  ↑↓ navigate  •  / filter  •  enter close  •  esc close"), 0, 0),
        );
        container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

        return {
          render(width: number) {
            return container.render(width);
          },
          invalidate() {
            container.invalidate();
          },
          handleInput(data: string) {
            if (matchesKey(data, Key.escape)) {
              done(undefined);
              return;
            }
            selectList.handleInput(data);
            tui.requestRender();
          },
        };
      }, { overlay: true, overlayOptions: { width: "90%", maxHeight: "90%" } });
    },
  });
}

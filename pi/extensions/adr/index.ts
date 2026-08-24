import { promises as fs, readFileSync } from "node:fs";
import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export const ADR_START_MARKER = "<!-- pi-adr:start -->";
export const ADR_END_MARKER = "<!-- pi-adr:end -->";
export const ADR_GUIDE_START_MARKER = "<!-- pi-adr-guide:start -->";
export const ADR_GUIDE_END_MARKER = "<!-- pi-adr-guide:end -->";
export const ADR_README_PATH = path.join("docs", "adr", "README.md");
export const ADR_GUIDANCE = readFileSync(new URL("./guidance.md", import.meta.url), "utf-8").trim();
export const ADR_POINTER = `## Documentation Index

- **Architecture decisions:** Before architecture-affecting work, read \`docs/adr/README.md\` and the relevant accepted records in \`docs/adr/\`. Follow the proposal, confirmation, implementation-plan, and lifecycle requirements documented there.`;

export type AdrInjectionAction = "created" | "added" | "updated" | "unchanged";

export interface AdrInjectionResult {
  action: AdrInjectionAction;
  content: string;
}

export interface AdrInitializationResult {
  agents: AdrInjectionResult;
  readme: AdrInjectionResult;
}

interface ManagedBlockOptions {
  startMarker: string;
  endMarker: string;
  label: string;
}

function countOccurrences(text: string, value: string): number {
  let count = 0;
  let offset = 0;

  while (true) {
    const index = text.indexOf(value, offset);
    if (index === -1) return count;
    count++;
    offset = index + value.length;
  }
}

function appendBlock(existing: string, block: string): string {
  const separator = existing.length === 0
    ? ""
    : existing.endsWith("\n\n")
      ? ""
      : existing.endsWith("\n")
        ? "\n"
        : "\n\n";
  return `${existing}${separator}${block}\n`;
}

function upsertManagedBlock(
  existing: string | null,
  body: string,
  options: ManagedBlockOptions,
): AdrInjectionResult {
  const block = `${options.startMarker}\n${body.trim()}\n${options.endMarker}`;

  if (existing === null) {
    return { action: "created", content: `${block}\n` };
  }

  const startCount = countOccurrences(existing, options.startMarker);
  const endCount = countOccurrences(existing, options.endMarker);

  if (startCount !== endCount || startCount > 1) {
    throw new Error(
      `${options.label} has invalid ADR markers: expected one matching ${options.startMarker}/${options.endMarker} pair`,
    );
  }

  if (startCount === 0) {
    return { action: "added", content: appendBlock(existing, block) };
  }

  const start = existing.indexOf(options.startMarker);
  const end = existing.indexOf(options.endMarker, start + options.startMarker.length);
  if (end < start) {
    throw new Error(`${options.label} has an ADR end marker before its start marker`);
  }

  const blockEnd = end + options.endMarker.length;
  if (existing.slice(start, blockEnd) === block) {
    return { action: "unchanged", content: existing };
  }

  return {
    action: "updated",
    content: `${existing.slice(0, start)}${block}${existing.slice(blockEnd)}`,
  };
}

export function injectAdrGuidance(
  existing: string | null,
  pointer = ADR_POINTER,
): AdrInjectionResult {
  return upsertManagedBlock(existing, pointer, {
    startMarker: ADR_START_MARKER,
    endMarker: ADR_END_MARKER,
    label: "AGENTS.md",
  });
}

function hasDecisionIndex(content: string): boolean {
  return /^##\s+(Decision Index|ADRs|Decisions)\s*$/im.test(content);
}

export function injectAdrReadme(
  existing: string | null,
  guidance = ADR_GUIDANCE,
): AdrInjectionResult {
  const initial = existing === null ? "# Architecture Decision Records\n" : existing;
  const managed = upsertManagedBlock(initial, guidance, {
    startMarker: ADR_GUIDE_START_MARKER,
    endMarker: ADR_GUIDE_END_MARKER,
    label: ADR_README_PATH,
  });

  let content = managed.content;
  let addedIndex = false;
  if (!hasDecisionIndex(content)) {
    content = appendBlock(
      content,
      "## Decision Index\n\n<!-- Add ADR links here in chronological order. -->",
    );
    addedIndex = true;
  }

  if (existing === null) return { action: "created", content };
  if (addedIndex && managed.action === "unchanged") {
    return { action: "updated", content };
  }
  return { action: managed.action, content };
}

async function readOptional(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function initializeAdrFiles(cwd: string): Promise<AdrInitializationResult> {
  const agentsPath = path.join(cwd, "AGENTS.md");
  const readmePath = path.join(cwd, ADR_README_PATH);
  const [existingAgents, existingReadme] = await Promise.all([
    readOptional(agentsPath),
    readOptional(readmePath),
  ]);

  // Compute and validate both updates before writing either file.
  const agents = injectAdrGuidance(existingAgents);
  const readme = injectAdrReadme(existingReadme);

  await fs.mkdir(path.dirname(readmePath), { recursive: true });
  if (readme.action !== "unchanged") {
    await fs.writeFile(readmePath, readme.content, "utf-8");
  }
  if (agents.action !== "unchanged") {
    await fs.writeFile(agentsPath, agents.content, "utf-8");
  }

  return { agents, readme };
}

function successMessage(result: AdrInitializationResult): string {
  if (result.agents.action === "unchanged" && result.readme.action === "unchanged") {
    return "ADR documentation and AGENTS.md index are already current.";
  }
  return "Initialized ADR documentation in docs/adr/README.md and linked it from AGENTS.md.";
}

export default function adrExtension(pi: ExtensionAPI): void {
  pi.registerCommand("init-adr", {
    description: "Initialize ADR docs and link them from this project's AGENTS.md",
    handler: async (_args, ctx) => {
      try {
        const result = await initializeAdrFiles(ctx.cwd);
        ctx.ui.notify(successMessage(result), "info");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(`Failed to initialize ADR documentation: ${message}`, "error");
      }
    },
  });
}

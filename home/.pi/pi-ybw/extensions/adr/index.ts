import { promises as fs, readFileSync } from "node:fs";
import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const LEGACY_ADR_START_MARKER = "<!-- pi-adr:start -->";
const LEGACY_ADR_END_MARKER = "<!-- pi-adr:end -->";
const LEGACY_GUIDE_START_MARKER = "<!-- pi-adr-guide:start -->";
const LEGACY_GUIDE_END_MARKER = "<!-- pi-adr-guide:end -->";
const LEGACY_INDEX_PLACEHOLDER = "<!-- Add ADR links here in chronological order. -->";

export interface AdrToolkitFile {
  relativePath: string;
  content: string;
}

export const ADR_README_PATH = path.join("docs", "adr", "README.md");
export const ADR_GUIDE_PATH = path.join("docs", "adr", "GUIDE.md");
export const ADR_TOOLKIT_PATH = path.join("docs", "adr", "toolkit");
export const ADR_GUIDANCE = readFileSync(new URL("./guidance.md", import.meta.url), "utf-8").trim();
export const ADR_POINTER = "- **Architecture decisions:** Before architecture-affecting work, read `docs/adr/README.md` and the relevant accepted records in `docs/adr/`. Follow the workflow linked from the index.";
export const ADR_WORKFLOW_LINK = "Read the [ADR workflow guide](GUIDE.md) before proposing, writing, updating, or implementing an architecture decision.";

const ADR_TOOLKIT_RELATIVE_PATHS = [
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
] as const;

export const ADR_TOOLKIT_FILES: ReadonlyArray<AdrToolkitFile> = ADR_TOOLKIT_RELATIVE_PATHS.map(
  (relativePath) => ({
    relativePath,
    content: readFileSync(new URL(`./toolkit/${relativePath}`, import.meta.url), "utf-8"),
  }),
);

export type AdrInjectionAction = "created" | "added" | "updated" | "unchanged";

export interface AdrInjectionResult {
  action: AdrInjectionAction;
  content: string;
}

export interface AdrInitializationResult {
  agents: AdrInjectionResult;
  readme: AdrInjectionResult;
  guide: AdrInjectionResult;
  toolkit: Record<string, AdrInjectionResult>;
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

function appendSection(existing: string, section: string): string {
  const trimmed = existing.trimEnd();
  return trimmed ? `${trimmed}\n\n${section.trim()}\n` : `${section.trim()}\n`;
}

function removeLegacyBlock(
  content: string,
  startMarker: string,
  endMarker: string,
  label: string,
): { content: string; removed: boolean } {
  const startCount = countOccurrences(content, startMarker);
  const endCount = countOccurrences(content, endMarker);
  if (startCount !== endCount || startCount > 1) {
    throw new Error(`${label} has invalid legacy ADR markers`);
  }
  if (startCount === 0) return { content, removed: false };

  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker, start + startMarker.length);
  if (end < start) throw new Error(`${label} has a legacy ADR end marker before its start marker`);

  const before = content.slice(0, start).trimEnd();
  const after = content.slice(end + endMarker.length).trimStart();
  const joined = before && after
    ? `${before}\n\n${after}`
    : before
      ? `${before}\n`
      : after;
  return { content: joined, removed: true };
}

function findSecondLevelSectionEnd(content: string, headingEnd: number): number {
  const remaining = content.slice(headingEnd);
  const nextHeading = /^##\s+/m.exec(remaining);
  return nextHeading?.index === undefined ? content.length : headingEnd + nextHeading.index;
}

function appendLineToSection(
  content: string,
  headingPattern: RegExp,
  heading: string,
  line: string,
): string {
  const match = headingPattern.exec(content);
  if (!match || match.index === undefined) {
    return appendSection(content, `${heading}\n\n${line}`);
  }

  const headingEnd = match.index + match[0].length;
  const sectionEnd = findSecondLevelSectionEnd(content, headingEnd);
  const before = content.slice(0, sectionEnd).trimEnd();
  const after = content.slice(sectionEnd).trimStart();
  const withLine = `${before}\n\n${line}`;
  return after ? `${withLine}\n\n${after}` : `${withLine}\n`;
}

function insertAfterTitle(content: string, line: string): string {
  const title = /^#\s+[^\n]+$/m.exec(content);
  if (!title || title.index === undefined) return `${line}\n\n${content.trimStart()}`;

  const titleEnd = title.index + title[0].length;
  const before = content.slice(0, titleEnd).trimEnd();
  const after = content.slice(titleEnd).trimStart();
  return after ? `${before}\n\n${line}\n\n${after}` : `${before}\n\n${line}\n`;
}

export function injectAdrGuidance(existing: string | null): AdrInjectionResult {
  const original = existing;
  const legacy = removeLegacyBlock(
    existing ?? "",
    LEGACY_ADR_START_MARKER,
    LEGACY_ADR_END_MARKER,
    "AGENTS.md",
  );
  let content = legacy.content;

  const pointerPattern = /^[-*]\s+.*docs\/adr\/README\.md.*$/gm;
  const matches = [...content.matchAll(pointerPattern)];
  if (matches.length > 1) {
    throw new Error("AGENTS.md has multiple ADR index entries");
  }

  if (matches.length === 1) {
    content = content.replace(pointerPattern, ADR_POINTER);
  } else {
    content = appendLineToSection(
      content,
      /^##\s+Documentation Index\s*$/m,
      "## Documentation Index",
      ADR_POINTER,
    );
  }

  if (original === null) return { action: "created", content };
  if (content === original) return { action: "unchanged", content };
  return { action: legacy.removed || matches.length === 1 ? "updated" : "added", content };
}

function removeLegacyIndexPlaceholder(content: string): string {
  return content
    .split("\n")
    .filter((line) => line.trim() !== LEGACY_INDEX_PLACEHOLDER)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

export function injectAdrReadme(existing: string | null): AdrInjectionResult {
  const original = existing;
  const initial = existing ?? "# Architecture Decision Records\n";
  const legacy = removeLegacyBlock(
    initial,
    LEGACY_GUIDE_START_MARKER,
    LEGACY_GUIDE_END_MARKER,
    ADR_README_PATH,
  );
  let content = removeLegacyIndexPlaceholder(legacy.content);

  const workflowPattern = /^.*\[ADR workflow guide\]\(GUIDE\.md\).*$/gm;
  const workflowMatches = [...content.matchAll(workflowPattern)];
  if (workflowMatches.length > 1) {
    throw new Error(`${ADR_README_PATH} has multiple ADR workflow links`);
  }
  if (workflowMatches.length === 1) {
    content = content.replace(workflowPattern, ADR_WORKFLOW_LINK);
  } else {
    content = insertAfterTitle(content, ADR_WORKFLOW_LINK);
  }

  if (!/^##\s+(Decision Index|ADRs|Decisions)\s*$/im.test(content)) {
    content = appendSection(content, "## Decision Index");
  }
  content = `${content.trimEnd()}\n`;

  if (original === null) return { action: "created", content };
  if (content === original) return { action: "unchanged", content };
  return { action: legacy.removed || workflowMatches.length === 1 ? "updated" : "added", content };
}

export function injectAdrGuide(existing: string | null): AdrInjectionResult {
  const content = `# ADR Workflow Guide\n\n${ADR_GUIDANCE}\n`;
  if (existing === null) return { action: "created", content };
  if (existing === content) return { action: "unchanged", content };
  if (!existing.startsWith("# ADR Workflow Guide\n")) {
    throw new Error(`${ADR_GUIDE_PATH} already exists and is not managed by the ADR extension`);
  }
  return { action: "updated", content };
}

export function injectAdrToolkitFile(
  existing: string | null,
  bundled: AdrToolkitFile,
): AdrInjectionResult {
  if (existing === null) return { action: "created", content: bundled.content };
  if (existing === bundled.content) return { action: "unchanged", content: existing };
  return { action: "updated", content: bundled.content };
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
  const guidePath = path.join(cwd, ADR_GUIDE_PATH);
  const toolkitPaths = ADR_TOOLKIT_FILES.map((file) =>
    path.join(cwd, ADR_TOOLKIT_PATH, file.relativePath)
  );
  const [existingAgents, existingReadme, existingGuide, existingToolkit] = await Promise.all([
    readOptional(agentsPath),
    readOptional(readmePath),
    readOptional(guidePath),
    Promise.all(toolkitPaths.map(readOptional)),
  ]);

  // Compute and validate every update before writing any file.
  const agents = injectAdrGuidance(existingAgents);
  const readme = injectAdrReadme(existingReadme);
  const guide = injectAdrGuide(existingGuide);
  const toolkit: Record<string, AdrInjectionResult> = {};
  for (let index = 0; index < ADR_TOOLKIT_FILES.length; index++) {
    const bundled = ADR_TOOLKIT_FILES[index];
    toolkit[bundled.relativePath] = injectAdrToolkitFile(existingToolkit[index] ?? null, bundled);
  }

  await fs.mkdir(path.dirname(readmePath), { recursive: true });
  if (guide.action !== "unchanged") await fs.writeFile(guidePath, guide.content, "utf-8");
  if (readme.action !== "unchanged") await fs.writeFile(readmePath, readme.content, "utf-8");
  if (agents.action !== "unchanged") await fs.writeFile(agentsPath, agents.content, "utf-8");
  for (let index = 0; index < ADR_TOOLKIT_FILES.length; index++) {
    const bundled = ADR_TOOLKIT_FILES[index];
    const result = toolkit[bundled.relativePath];
    if (result.action === "unchanged") continue;
    const targetPath = toolkitPaths[index];
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, result.content, "utf-8");
  }

  return { agents, readme, guide, toolkit };
}

function successMessage(result: AdrInitializationResult): string {
  if (
    result.agents.action === "unchanged"
    && result.readme.action === "unchanged"
    && result.guide.action === "unchanged"
    && Object.values(result.toolkit).every((item) => item.action === "unchanged")
  ) {
    return "ADR index, workflow guide, and toolkit are already current.";
  }
  return "Initialized the complete ADR toolkit in docs/adr/ and linked it from AGENTS.md.";
}

export default function adrExtension(pi: ExtensionAPI): void {
  pi.registerCommand("init-adr", {
    description: "Initialize the complete ADR toolkit under docs/adr/",
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

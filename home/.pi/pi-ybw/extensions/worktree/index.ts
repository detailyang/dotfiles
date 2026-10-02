import { promises as fs, readFileSync } from "node:fs";
import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const START_SECTION_PATTERN = /^##\s+Start every task\s*$/gm;
const SKILL_TITLE = "# Worktree Workflow Skill";

export const WORKTREE_GUIDANCE = readFileSync(new URL("./guidance.md", import.meta.url), "utf-8").trim();
export const WORKTREE_SKILL_PATH = path.join(".agents", "skills", "worktree", "SKILL.md");
export const WORKTREE_SKILL = readFileSync(new URL("./skill.md", import.meta.url), "utf-8").trimEnd();

export type WorktreeInjectionAction = "created" | "added" | "updated" | "unchanged";

export interface WorktreeInjectionResult {
  action: WorktreeInjectionAction;
  content: string;
}

export interface WorktreeInitializationResult {
  agents: WorktreeInjectionResult;
  skill: WorktreeInjectionResult;
}

function findSectionEnd(content: string, headingEnd: number): number {
  const nextHeading = /^##\s+/m.exec(content.slice(headingEnd));
  return nextHeading?.index === undefined ? content.length : headingEnd + nextHeading.index;
}

function insertAfterTitle(content: string, section: string): string {
  const title = /^#\s+[^\n]+$/m.exec(content);
  if (!title || title.index === undefined) {
    return content.trim() ? `${section}\n\n${content.trimStart()}` : `${section}\n`;
  }

  const titleEnd = title.index + title[0].length;
  const before = content.slice(0, titleEnd).trimEnd();
  const after = content.slice(titleEnd).trimStart();
  return after ? `${before}\n\n${section}\n\n${after}` : `${before}\n\n${section}\n`;
}

function replaceOrMergeSection(content: string, headingStart: number, headingEnd: number): string {
  const sectionEnd = findSectionEnd(content, headingEnd);
  const body = content.slice(headingEnd, sectionEnd).trim();
  const guidanceBody = WORKTREE_GUIDANCE.slice(WORKTREE_GUIDANCE.indexOf("\n") + 1).trim();

  if (body === guidanceBody) return content;

  const customBody = body.split(guidanceBody).join("").trim();
  const replacement = customBody
    ? `${WORKTREE_GUIDANCE}\n\n${customBody}`
    : WORKTREE_GUIDANCE;
  const before = content.slice(0, headingStart);
  const after = content.slice(sectionEnd).trimStart();
  return after ? `${before}${replacement}\n\n${after}` : `${before}${replacement}\n`;
}

export function injectWorktreeGuidance(existing: string | null): WorktreeInjectionResult {
  if (existing === null) {
    return { action: "created", content: `${WORKTREE_GUIDANCE}\n` };
  }

  const matches = [...existing.matchAll(START_SECTION_PATTERN)];
  if (matches.length > 1) {
    throw new Error("AGENTS.md has multiple Start every task sections");
  }

  if (matches.length === 0) {
    return { action: "added", content: insertAfterTitle(existing, WORKTREE_GUIDANCE) };
  }

  const match = matches[0];
  const headingStart = match.index;
  if (headingStart === undefined) {
    throw new Error("Could not locate the Start every task section");
  }
  const next = replaceOrMergeSection(existing, headingStart, headingStart + match[0].length);
  return { action: next === existing ? "unchanged" : "updated", content: next };
}

export function injectWorktreeSkill(existing: string | null): WorktreeInjectionResult {
  if (existing === null) return { action: "created", content: `${WORKTREE_SKILL}\n` };
  if (existing.trimEnd() === WORKTREE_SKILL) return { action: "unchanged", content: existing };
  if (!existing.startsWith(`${SKILL_TITLE}\n`)) {
    throw new Error(`${WORKTREE_SKILL_PATH} already exists and is not managed by the worktree extension`);
  }
  return { action: "updated", content: `${WORKTREE_SKILL}\n` };
}

async function readOptional(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function initializeWorktreeFiles(cwd: string): Promise<WorktreeInitializationResult> {
  const agentsPath = path.join(cwd, "AGENTS.md");
  const skillPath = path.join(cwd, WORKTREE_SKILL_PATH);
  const [existingAgents, existingSkill] = await Promise.all([
    readOptional(agentsPath),
    readOptional(skillPath),
  ]);

  // Compute and validate every update before writing any file.
  const agents = injectWorktreeGuidance(existingAgents);
  const skill = injectWorktreeSkill(existingSkill);

  if (skill.action !== "unchanged") {
    await fs.mkdir(path.dirname(skillPath), { recursive: true });
    await fs.writeFile(skillPath, skill.content, "utf-8");
  }
  if (agents.action !== "unchanged") {
    await fs.writeFile(agentsPath, agents.content, "utf-8");
  }

  return { agents, skill };
}

function successMessage(result: WorktreeInitializationResult): string {
  if (result.agents.action === "unchanged" && result.skill.action === "unchanged") {
    return "Worktree workflow in AGENTS.md and .agents/skills/worktree/SKILL.md is already current.";
  }
  return "Initialized the worktree workflow in AGENTS.md and .agents/skills/worktree/SKILL.md.";
}

export default function worktreeExtension(pi: ExtensionAPI): void {
  pi.registerCommand("init-worktree", {
    description: "Initialize the worktree workflow in AGENTS.md",
    handler: async (_args, ctx) => {
      try {
        const result = await initializeWorktreeFiles(ctx.cwd);
        ctx.ui.notify(successMessage(result), "info");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(`Failed to initialize worktree guidance: ${message}`, "error");
      }
    },
  });
}

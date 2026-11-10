import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";

export const CREATE_TIMEOUT_MS = 10_000;
export const START_TIMEOUT_MS = 35_000;
export const PROMPT_TIMEOUT_MS = 10_000;
export const HERDR_START_TIMEOUT_MS = 30_000;
export const START_BUSY_RETRY_MS = 100;
export const START_BUSY_MAX_RETRIES = 50;

export type BtwLocation = "pane" | "tab";
export type RexLocation = BtwLocation | "float";

export type HerdrHost = {
  provider: "herdr";
  command: string;
  workspaceId: string;
};

export type RexHost = {
  provider: "rex";
  sessionId: string;
  blockId: string;
};

export type BtwHost = HerdrHost | RexHost;

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function report(
  ctx: ExtensionCommandContext,
  message: string,
  type: "info" | "error",
): void {
  ctx.ui.notify(message, type);
}

export function buildPiArgs(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  parentSessionFile: string,
): string[] {
  const args = ["--fork", parentSessionFile];
  if (ctx.model) {
    args.push("--model", `${ctx.model.provider}/${ctx.model.id}`);
  }

  args.push("--thinking", pi.getThinkingLevel());
  args.push(ctx.isProjectTrusted() ? "--approve" : "--no-approve");
  return args;
}

export function resolveBtwHost(env: NodeJS.ProcessEnv): BtwHost | { error: string } {
  const termProgram = env.TERM_PROGRAM?.toLowerCase();
  const rexSession = env.REX_SESSION?.trim();
  const rexBlock = env.REX_BLOCK?.trim();
  const rex: RexHost | undefined = rexSession && rexBlock
    ? { provider: "rex", sessionId: rexSession, blockId: rexBlock }
    : undefined;

  if (termProgram === "rex") {
    return rex ?? { error: "Rex did not provide REX_SESSION and REX_BLOCK." };
  }

  const workspaceId = env.HERDR_WORKSPACE_ID?.trim();
  if (termProgram === "herdr") {
    return workspaceId
      ? { provider: "herdr", command: env.HERDR_BIN_PATH?.trim() || "herdr", workspaceId }
      : { error: "Herdr did not provide HERDR_WORKSPACE_ID." };
  }

  if (workspaceId) {
    return {
      provider: "herdr",
      command: env.HERDR_BIN_PATH?.trim() || "herdr",
      workspaceId,
    };
  }

  if (rex) return rex;
  return { error: "this terminal is not inside Herdr or Rex." };
}

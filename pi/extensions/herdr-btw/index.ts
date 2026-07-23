import type {
  ExecResult,
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";

const CREATE_TIMEOUT_MS = 10_000;
const START_TIMEOUT_MS = 35_000;
const PROMPT_TIMEOUT_MS = 10_000;
const HERDR_START_TIMEOUT_MS = 30_000;
const START_BUSY_RETRY_MS = 100;
const START_BUSY_MAX_RETRIES = 50;

type HerdrTabCreated = {
  tabId: string;
  paneId: string;
};

type HerdrError = {
  code: string;
  message: string;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseHerdrError(result: ExecResult): HerdrError | undefined {
  for (const output of [result.stderr, result.stdout]) {
    if (!output.trim()) continue;

    try {
      const response = JSON.parse(output) as Record<string, unknown>;
      const error = response.error;
      if (!error || typeof error !== "object") continue;

      const record = error as Record<string, unknown>;
      if (typeof record.code === "string" && typeof record.message === "string") {
        return { code: record.code, message: record.message };
      }
    } catch {
      // Non-JSON command output is handled by commandFailure below.
    }
  }

  return undefined;
}

function commandFailure(result: ExecResult): string {
  return parseHerdrError(result)?.message || result.stderr.trim() || result.stdout.trim() || `exit code ${result.code}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseTabCreated(stdout: string, workspaceId: string): HerdrTabCreated {
  let response: unknown;
  try {
    response = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`invalid JSON response: ${errorMessage(error)}`);
  }

  if (!response || typeof response !== "object") {
    throw new Error("response is not an object");
  }

  const result = (response as Record<string, unknown>).result;
  if (!result || typeof result !== "object") {
    throw new Error("response is missing result");
  }

  const record = result as Record<string, unknown>;
  const tab = record.tab;
  const rootPane = record.root_pane;
  if (record.type !== "tab_created" || !tab || typeof tab !== "object" || !rootPane || typeof rootPane !== "object") {
    throw new Error("response is not a tab_created result");
  }

  const tabRecord = tab as Record<string, unknown>;
  const paneRecord = rootPane as Record<string, unknown>;
  const tabId = tabRecord.tab_id;
  const paneId = paneRecord.pane_id;
  if (typeof tabId !== "string" || !tabId || typeof paneId !== "string" || !paneId) {
    throw new Error("response is missing tab_id or root pane_id");
  }
  if (
    tabRecord.workspace_id !== workspaceId ||
    paneRecord.workspace_id !== workspaceId ||
    paneRecord.tab_id !== tabId
  ) {
    throw new Error("created tab does not belong to the requested workspace");
  }

  return { tabId, paneId };
}

function buildPiArgs(
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

function agentName(paneId: string): string {
  return `btw-${paneId.toLowerCase().replace(/[^a-z0-9_-]/g, "-")}`.slice(0, 32);
}

async function closeTab(
  pi: ExtensionAPI,
  herdr: string,
  tabId: string,
  cwd: string,
): Promise<string | undefined> {
  try {
    const result = await pi.exec(herdr, ["tab", "close", tabId], {
      cwd,
      timeout: CREATE_TIMEOUT_MS,
    });
    return result.code === 0 ? undefined : commandFailure(result);
  } catch (error) {
    return errorMessage(error);
  }
}

function report(ctx: ExtensionCommandContext, message: string, type: "info" | "error"): void {
  ctx.ui.notify(message, type);
}

export function registerHerdrBtwExtension(
  pi: ExtensionAPI,
  env: NodeJS.ProcessEnv,
): void {
  pi.registerCommand("herdr-btw", {
    description: "Fork the current Pi conversation into a new tab in the current Herdr workspace.",
    handler: async (args, ctx) => {
      const workspaceId = env.HERDR_WORKSPACE_ID?.trim();
      if (!workspaceId) {
        report(ctx, "Cannot open a Herdr BTW tab: HERDR_WORKSPACE_ID is unavailable.", "error");
        return;
      }

      const parentSessionFile = ctx.sessionManager.getSessionFile();
      if (!parentSessionFile) {
        report(ctx, "Cannot fork Herdr BTW tab: the current Pi session is not persisted.", "error");
        return;
      }

      const herdr = env.HERDR_BIN_PATH?.trim() || "herdr";
      let created: HerdrTabCreated;
      try {
        const createResult = await pi.exec(
          herdr,
          [
            "tab",
            "create",
            "--workspace",
            workspaceId,
            "--cwd",
            ctx.cwd,
            "--label",
            "btw",
            "--focus",
          ],
          { cwd: ctx.cwd, timeout: CREATE_TIMEOUT_MS },
        );
        if (createResult.code !== 0) {
          report(ctx, `Cannot create Herdr BTW tab: ${commandFailure(createResult)}`, "error");
          return;
        }
        created = parseTabCreated(createResult.stdout, workspaceId);
      } catch (error) {
        report(ctx, `Cannot create Herdr BTW tab: ${errorMessage(error)}`, "error");
        return;
      }

      let startFailure: string | undefined;
      for (let attempt = 0; attempt <= START_BUSY_MAX_RETRIES; attempt += 1) {
        try {
          const startResult = await pi.exec(
            herdr,
            [
              "agent",
              "start",
              agentName(created.paneId),
              "--kind",
              "pi",
              "--pane",
              created.paneId,
              "--timeout",
              String(HERDR_START_TIMEOUT_MS),
              "--",
              ...buildPiArgs(pi, ctx, parentSessionFile),
            ],
            { cwd: ctx.cwd, timeout: START_TIMEOUT_MS },
          );
          if (startResult.code === 0) break;

          const herdrError = parseHerdrError(startResult);
          if (herdrError?.code !== "agent_pane_busy" || attempt === START_BUSY_MAX_RETRIES) {
            startFailure = herdrError?.message || commandFailure(startResult);
            break;
          }
        } catch (error) {
          startFailure = errorMessage(error);
          break;
        }

        await delay(START_BUSY_RETRY_MS);
      }

      if (startFailure) {
        const cleanupFailure = await closeTab(pi, herdr, created.tabId, ctx.cwd);
        const cleanupMessage = cleanupFailure
          ? `; new tab ${created.tabId} could not be closed: ${cleanupFailure}`
          : "";
        report(ctx, `Cannot start Pi in Herdr BTW tab: ${startFailure}${cleanupMessage}`, "error");
        return;
      }

      const question = args.trim();
      if (question) {
        try {
          const promptResult = await pi.exec(
            herdr,
            ["agent", "prompt", created.paneId, question],
            { cwd: ctx.cwd, timeout: PROMPT_TIMEOUT_MS },
          );
          if (promptResult.code !== 0) {
            report(
              ctx,
              `Opened Herdr BTW tab ${created.tabId}, but could not submit the question: ${commandFailure(promptResult)}`,
              "error",
            );
            return;
          }
        } catch (error) {
          report(
            ctx,
            `Opened Herdr BTW tab ${created.tabId}, but could not submit the question: ${errorMessage(error)}`,
            "error",
          );
          return;
        }
      }

      report(ctx, `Opened Herdr BTW tab ${created.tabId}.`, "info");
    },
  });
}

export default function herdrBtwExtension(pi: ExtensionAPI): void {
  registerHerdrBtwExtension(pi, process.env);
}

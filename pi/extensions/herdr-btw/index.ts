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
  kind: "tab";
  tabId: string;
  paneId: string;
};

type HerdrPaneCreated = {
  kind: "pane";
  paneId: string;
};

type HerdrTarget = HerdrTabCreated | HerdrPaneCreated;

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

  return { kind: "tab", tabId, paneId };
}

function parsePaneCreated(stdout: string, workspaceId: string): HerdrPaneCreated {
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
  const pane = record.pane;
  if (record.type !== "pane_created" || !pane || typeof pane !== "object") {
    throw new Error("response is not a pane_created result");
  }

  const paneRecord = pane as Record<string, unknown>;
  const paneId = paneRecord.pane_id;
  if (typeof paneId !== "string" || !paneId) {
    throw new Error("response is missing pane_id");
  }
  if (paneRecord.workspace_id !== workspaceId) {
    throw new Error("created pane does not belong to the requested workspace");
  }

  return { kind: "pane", paneId };
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

async function closeTarget(
  pi: ExtensionAPI,
  herdr: string,
  target: HerdrTarget,
  cwd: string,
): Promise<string | undefined> {
  try {
    const result = await pi.exec(herdr, [
      target.kind,
      "close",
      target.kind === "tab" ? target.tabId : target.paneId,
    ], {
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
    description: "Fork the current Pi conversation into a new pane or tab in Herdr.",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) return;

      const workspaceId = env.HERDR_WORKSPACE_ID?.trim();
      if (!workspaceId) {
        report(ctx, "Cannot open Herdr BTW: HERDR_WORKSPACE_ID is unavailable.", "error");
        return;
      }

      const parentSessionFile = ctx.sessionManager.getSessionFile();
      if (!parentSessionFile) {
        report(ctx, "Cannot fork Herdr BTW: the current Pi session is not persisted.", "error");
        return;
      }

      const location = await ctx.ui.select("Open Herdr BTW in:", [
        "New pane in current tab",
        "New tab",
      ]);
      if (location === undefined) {
        report(ctx, "Herdr BTW cancelled.", "info");
        return;
      }

      const herdr = env.HERDR_BIN_PATH?.trim() || "herdr";
      const targetKind = location === "New pane in current tab" ? "pane" : "tab";
      let created: HerdrTarget;
      try {
        const createArgs = targetKind === "pane"
          ? [
              "pane",
              "split",
              "--current",
              "--direction",
              "right",
              "--cwd",
              ctx.cwd,
              "--focus",
            ]
          : [
              "tab",
              "create",
              "--workspace",
              workspaceId,
              "--cwd",
              ctx.cwd,
              "--label",
              "btw",
              "--focus",
            ];
        const createResult = await pi.exec(herdr, createArgs, {
          cwd: ctx.cwd,
          timeout: CREATE_TIMEOUT_MS,
        });
        if (createResult.code !== 0) {
          report(ctx, `Cannot create Herdr BTW ${targetKind}: ${commandFailure(createResult)}`, "error");
          return;
        }
        created = targetKind === "pane"
          ? parsePaneCreated(createResult.stdout, workspaceId)
          : parseTabCreated(createResult.stdout, workspaceId);
      } catch (error) {
        report(ctx, `Cannot create Herdr BTW ${targetKind}: ${errorMessage(error)}`, "error");
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
        const cleanupFailure = await closeTarget(pi, herdr, created, ctx.cwd);
        const createdId = created.kind === "tab" ? created.tabId : created.paneId;
        const cleanupMessage = cleanupFailure
          ? `; new ${created.kind} ${createdId} could not be closed: ${cleanupFailure}`
          : "";
        report(ctx, `Cannot start Pi in Herdr BTW ${created.kind}: ${startFailure}${cleanupMessage}`, "error");
        return;
      }

      const createdId = created.kind === "tab" ? created.tabId : created.paneId;
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
              `Opened Herdr BTW ${created.kind} ${createdId}, but could not submit the question: ${commandFailure(promptResult)}`,
              "error",
            );
            return;
          }
        } catch (error) {
          report(
            ctx,
            `Opened Herdr BTW ${created.kind} ${createdId}, but could not submit the question: ${errorMessage(error)}`,
            "error",
          );
          return;
        }
      }

      report(ctx, `Opened Herdr BTW ${created.kind} ${createdId}.`, "info");
    },
  });
}

export default function herdrBtwExtension(pi: ExtensionAPI): void {
  registerHerdrBtwExtension(pi, process.env);
}

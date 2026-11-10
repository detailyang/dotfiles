import type {
  ExecResult,
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";

import {
  buildPiArgs,
  CREATE_TIMEOUT_MS,
  errorMessage,
  HERDR_START_TIMEOUT_MS,
  PROMPT_TIMEOUT_MS,
  report,
  START_BUSY_MAX_RETRIES,
  START_BUSY_RETRY_MS,
  START_TIMEOUT_MS,
  type BtwLocation,
  type HerdrHost,
} from "./shared.ts";

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

function parsePaneSplit(stdout: string, workspaceId: string): HerdrPaneCreated {
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
  if (record.type !== "pane_info" || !pane || typeof pane !== "object") {
    throw new Error("response is not a pane_info result");
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

export async function openHerdrBtw(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  host: HerdrHost,
  location: BtwLocation,
  parentSessionFile: string,
  question: string,
): Promise<void> {
  const workspaceId = host.workspaceId;
  const herdr = host.command;

  let created: HerdrTarget;
  try {
    const createArgs = location === "pane"
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
      report(ctx, `Cannot create Herdr BTW ${location}: ${commandFailure(createResult)}`, "error");
      return;
    }
    created = location === "pane"
      ? parsePaneSplit(createResult.stdout, workspaceId)
      : parseTabCreated(createResult.stdout, workspaceId);
  } catch (error) {
    report(ctx, `Cannot create Herdr BTW ${location}: ${errorMessage(error)}`, "error");
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
}

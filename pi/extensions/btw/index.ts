import {
  buildSessionContext,
  createAgentSession,
  createExtensionRuntime,
  SessionManager,
  type AgentSession,
  type AgentSessionEvent,
  type ExtensionAPI,
  type ExtensionCommandContext,
  type ExtensionContext,
  type ResourceLoader,
} from "@earendil-works/pi-coding-agent";
import { type AssistantMessage, type Message, type UserMessage } from "@earendil-works/pi-ai";
import {
  Box,
  Container,
  Input,
  Key,
  Text,
  matchesKey,
  truncateToWidth,
  visibleWidth,
  wrapTextWithAnsi,
  type Focusable,
  type KeybindingsManager,
  type OverlayHandle,
  type TUI,
} from "@earendil-works/pi-tui";
import {
  parseBtwArgs,
  parseBtwModelArgs,
  parseBtwThinkingArgs,
  parseOverlayBtwCommand,
  type SessionThinkingLevel,
} from "./command.js";
import {
  buildResolvedBtwSettings,
  describeResolvedBtwModel as describeResolvedModel,
  describeResolvedBtwThinking as describeResolvedThinking,
  formatModelRef,
  resolveBtwModelWithCredentialStatus,
  type ResolvedBtwModel,
  type ResolvedBtwSettings,
} from "./settings.js";
import {
  appendPersistedBtwTranscriptTurn,
  applyBtwTranscriptEvent,
  createEmptyBtwTranscriptState,
  extractBtwAssistantAnswer,
  extractBtwAssistantThinking,
  findLatestBtwTranscriptEntry,
  getCompletedBtwExchangeCount,
  hasStreamingBtwTranscriptEntry,
  removeBtwTranscriptTurn,
  setBtwTranscriptFailure,
  type BtwTranscript,
  type BtwTranscriptEntry,
  type BtwTranscriptEvent,
  type BtwTranscriptState,
} from "./transcript.js";
import {
  buildBtwDetailsFromResponse,
  getBtwAuthFailureMessage,
  getLastAssistantMessage,
} from "./session-run.js";
import {
  BTW_ENTRY_TYPE,
  BTW_MODEL_OVERRIDE_TYPE,
  BTW_MESSAGE_TYPE,
  BTW_RESET_TYPE,
  BTW_THINKING_OVERRIDE_TYPE,
  buildBtwMessageContent,
  buildBtwSeedThreadMessages,
  extractBtwHandoffThread,
  formatBtwThread,
  isVisibleBtwMessage,
  pendingThreadToHandoff,
  restoreBtwThreadState,
  type BtwModelOverrideDetails,
  type BtwResetDetails,
  type BtwThinkingOverrideDetails,
  type BtwHandoffExchange,
} from "./thread.js";

const BTW_FOCUS_SHORTCUTS = [Key.alt("/"), Key.ctrlAlt("w")] as const;

function matchesBtwFocusShortcut(data: string): boolean {
  return BTW_FOCUS_SHORTCUTS.some((shortcut) => matchesKey(data, shortcut));
}

const BTW_SYSTEM_PROMPT = [
  "You are having an aside conversation with the user, separate from their main working session.",
  "If main session messages are provided, they are for context only — that work is being handled by another agent.",
  "If no main session messages are provided, treat this as a fully contextless tangent thread and rely only on the user's words plus your general instructions.",
  "Focus on answering the user's side questions, helping them think through ideas, or planning next steps.",
  "Do not act as if you need to continue unfinished work from the main session unless the user explicitly asks you to prepare something for injection back to it.",
].join(" ");

const BTW_SUMMARIZE_SYSTEM_PROMPT =
  "Summarize the side conversation concisely. Preserve key decisions, plans, insights, risks, and action items. Output only the summary.";

type BtwThreadMode = "contextual" | "tangent";
type SessionModel = NonNullable<ExtensionCommandContext["model"]>;

type BtwDetails = {
  question: string;
  thinking: string;
  answer: string;
  provider: string;
  model: string;
  api: string;
  thinkingLevel: SessionThinkingLevel;
  timestamp: number;
  usage?: AssistantMessage["usage"];
};

type SaveState = "not-saved" | "saved" | "queued";

type BtwSessionRuntime = {
  session: AgentSession;
  mode: BtwThreadMode;
  subscriptions: Set<() => void>;
  sideThreadStartIndex: number;
};

type OverlayRuntime = {
  handle?: OverlayHandle;
  refresh?: () => void;
  close?: () => void;
  finish?: () => void;
  setDraft?: (value: string) => void;
  closed?: boolean;
};

function stripDynamicSystemPromptFooter(systemPrompt: string): string {
  return systemPrompt
    .replace(/\nCurrent date and time:[^\n]*(?:\nCurrent working directory:[^\n]*)?$/u, "")
    .replace(/\nCurrent working directory:[^\n]*$/u, "")
    .trim();
}

function createBtwResourceLoader(
  ctx: ExtensionCommandContext,
  appendSystemPrompt: string[] = [BTW_SYSTEM_PROMPT],
): ResourceLoader {
  const extensionsResult = { extensions: [], errors: [], runtime: createExtensionRuntime() };
  const systemPrompt = stripDynamicSystemPromptFooter(ctx.getSystemPrompt());

  return {
    getExtensions: () => extensionsResult,
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () => systemPrompt,
    getAppendSystemPrompt: () => appendSystemPrompt,
    extendResources: () => {},
    reload: async () => {},
  };
}

function buildBtwSeedState(
  ctx: ExtensionCommandContext,
  thread: BtwDetails[],
  mode: BtwThreadMode,
  sessionModel: SessionModel | null,
): { messages: Message[]; sideThreadStartIndex: number } {
  const messages: Message[] = [];

  if (mode === "contextual") {
    messages.push(
      ...(buildSessionContext(ctx.sessionManager.getEntries(), ctx.sessionManager.getLeafId()).messages as Message[]).filter(
        (message) => !isVisibleBtwMessage(message),
      ),
    );
  }

  const sideThreadStartIndex = messages.length;

  if (thread.length > 0) {
    messages.push(...(buildBtwSeedThreadMessages(thread, sessionModel, ctx.model?.api || "openai-responses", Date.now()) as Message[]));
  }

  return {
    messages,
    sideThreadStartIndex,
  };
}

function buildOverlayTranscript(entries: BtwTranscript, theme: ExtensionContext["ui"]["theme"]): string[] {
  if (entries.length === 0) {
    return [theme.fg("dim", "No BTW thread yet. Ask a side question to start one.")];
  }

  const lines: string[] = [];
  const userBadge = buildTranscriptBadge(theme, "You", "userMessageBg", "accent");
  const thinkingBadge = buildTranscriptBadge(theme, "Thinking", "toolPendingBg", "warning");
  const toolBadge = buildTranscriptBadge(theme, "Tool", "toolPendingBg", "warning");
  const assistantBadge = buildTranscriptBadge(theme, "Assistant", "customMessageBg", "success");
  const separator = theme.fg("borderMuted", "────────────────────────────────────────");
  const blockIndent = "    ";
  const resultIndent = blockIndent;

  const pushBlankLine = () => {
    if (lines.length > 0 && lines[lines.length - 1] !== "") {
      lines.push("");
    }
  };

  const pushInlineBlock = (
    header: string,
    text: string,
    options: { blankBefore?: boolean; style?: (value: string) => string } = {},
  ) => {
    const bodyLines = text.split("\n");
    const style = options.style ?? ((value: string) => value);
    if (options.blankBefore !== false) {
      pushBlankLine();
    }

    const firstLine = bodyLines.shift() ?? "";
    lines.push(`${header}${firstLine ? ` ${style(firstLine)}` : ""}`);
    for (const line of bodyLines) {
      lines.push(`${blockIndent}${style(line)}`);
    }
  };

  const pushStackedBlock = (
    header: string,
    text: string,
    options: { blankBefore?: boolean; indent?: string; style?: (value: string) => string } = {},
  ) => {
    const bodyLines = text.split("\n");
    const indent = options.indent ?? blockIndent;
    const style = options.style ?? ((value: string) => value);
    if (options.blankBefore !== false) {
      pushBlankLine();
    }

    lines.push(header);
    for (const line of bodyLines) {
      lines.push(`${indent}${style(line)}`);
    }
  };

  for (const entry of entries) {
    if (entry.type === "turn-boundary") {
      if (entry.phase === "start" && lines.length > 0) {
        pushBlankLine();
        lines.push(separator);
      }
      continue;
    }

    if (entry.type === "user-message") {
      pushInlineBlock(userBadge, entry.text, { blankBefore: false });
      continue;
    }

    if (entry.type === "thinking") {
      const thinkingHeader = entry.streaming ? `${thinkingBadge} ${theme.fg("warning", "▍")}` : thinkingBadge;
      pushStackedBlock(thinkingHeader, entry.text, {
        style: (line) => theme.fg("warning", theme.italic(line)),
      });
      continue;
    }

    if (entry.type === "tool-call") {
      const toolLabel = theme.fg("warning", theme.bold(entry.toolName));
      const argsLabel = entry.args ? theme.fg("dim", ` · ${entry.args}`) : "";
      pushInlineBlock(toolBadge, `${toolLabel}${argsLabel}`);
      continue;
    }

    if (entry.type === "tool-result") {
      const resultHeaderLabel = entry.isError
        ? theme.fg("error", "↳ error")
        : entry.streaming
          ? theme.fg("warning", "↳ streaming result")
          : theme.fg("dim", "↳ result");
      const truncationLabel = entry.truncated ? theme.fg("dim", " (truncated)") : "";
      pushStackedBlock(`${resultHeaderLabel}${truncationLabel}`, entry.content, {
        blankBefore: false,
        indent: resultIndent,
        style: (line) => (entry.isError ? theme.fg("error", line) : theme.fg("dim", line)),
      });
      continue;
    }

    if (entry.type === "assistant-text") {
      const assistantHeader = entry.streaming ? `${assistantBadge} ${theme.fg("warning", "▍")}` : assistantBadge;
      pushStackedBlock(assistantHeader, entry.text);
    }
  }

  return lines;
}

function saveVisibleBtwNote(
  pi: ExtensionAPI,
  details: BtwDetails,
  saveRequested: boolean,
  wasBusy: boolean,
): SaveState {
  if (!saveRequested) {
    return "not-saved";
  }

  const message = {
    customType: BTW_MESSAGE_TYPE,
    content: buildBtwMessageContent(details.question, details.answer),
    display: true,
    details,
  };

  if (wasBusy) {
    pi.sendMessage(message, { deliverAs: "followUp" });
    return "queued";
  }

  pi.sendMessage(message);
  return "saved";
}

function notify(ctx: ExtensionContext | ExtensionCommandContext, message: string, level: "info" | "warning" | "error"): void {
  if (ctx.hasUI) {
    ctx.ui.notify(message, level);
  }
}

function getOverlayTitle(mode: BtwThreadMode): string {
  return mode === "tangent" ? "BTW tangent" : "BTW";
}

function buildTranscriptBadge(
  theme: ExtensionContext["ui"]["theme"],
  label: string,
  background: "userMessageBg" | "toolPendingBg" | "customMessageBg",
  foreground: "accent" | "warning" | "success",
): string {
  return theme.bg(background, theme.fg(foreground, theme.bold(` ${label} `)));
}

class BtwOverlayComponent extends Container implements Focusable {
  private readonly input: Input;
  private readonly transcript: Container;
  private readonly statusText: Text;
  private readonly modeText: Text;
  private readonly summaryText: Text;
  private readonly hintsText: Text;
  private readonly readTranscriptEntries: () => BtwTranscript;
  private readonly getStatus: () => string | null;
  private readonly getMode: () => BtwThreadMode;
  private readonly onSubmitCallback: (value: string) => void;
  private readonly onDismissCallback: () => void;
  private readonly onUnfocusCallback: () => void;
  private readonly tui: TUI;
  private readonly theme: ExtensionContext["ui"]["theme"];
  private transcriptLines: string[] = [];
  private transcriptScrollOffset = 0;
  private transcriptViewportHeight = 8;
  private followTranscript = true;
  private _focused = false;
  private modeTextValue = "";
  private summaryTextValue = "";
  private statusTextValue = "";
  private hintsTextValue = "";

  get focused(): boolean {
    return this._focused;
  }

  set focused(value: boolean) {
    this._focused = value;
    this.input.focused = value;
  }

  constructor(
    tui: TUI,
    theme: ExtensionContext["ui"]["theme"],
    keybindings: KeybindingsManager,
    readTranscriptEntries: () => BtwTranscript,
    getStatus: () => string | null,
    getMode: () => BtwThreadMode,
    onSubmit: (value: string) => void,
    onDismiss: () => void,
    onUnfocus: () => void,
  ) {
    super();
    this.tui = tui;
    this.theme = theme;
    this.readTranscriptEntries = readTranscriptEntries;
    this.getStatus = getStatus;
    this.getMode = getMode;
    this.onSubmitCallback = onSubmit;
    this.onDismissCallback = onDismiss;
    this.onUnfocusCallback = onUnfocus;

    this.modeText = new Text("", 1, 0);
    this.summaryText = new Text("", 1, 0);
    this.transcript = new Container();
    this.statusText = new Text("", 1, 0);

    this.input = new Input();
    this.input.onSubmit = (value) => {
      this.followTranscript = true;
      this.onSubmitCallback(value);
    };
    this.input.onEscape = () => {
      this.onDismissCallback();
    };

    this.hintsText = new Text("", 1, 0);

    // Enable SGR mouse reporting so wheel/touchpad events reach handleInput().
    this.tui.terminal?.write?.("\x1b[?1000h\x1b[?1006h");

    const originalHandleInput = this.input.handleInput.bind(this.input);
    this.input.handleInput = (data: string) => {
      if (keybindings.matches(data, "app.clear")) {
        if (this.input.getValue().length > 0) {
          this.input.setValue("");
          this.tui.requestRender();
          return;
        }

        this.onDismissCallback();
        return;
      }

      if (keybindings.matches(data, "tui.select.cancel")) {
        this.onDismissCallback();
        return;
      }
      originalHandleInput(data);
    };

    this.refresh();
  }

  private frameLine(content: string, innerWidth: number): string {
    const truncated = truncateToWidth(content, innerWidth, "");
    const padding = Math.max(0, innerWidth - visibleWidth(truncated));
    return `${this.theme.fg("borderMuted", "│")}${truncated}${" ".repeat(padding)}${this.theme.fg("borderMuted", "│")}`;
  }

  private ruleLine(innerWidth: number): string {
    return this.theme.fg("borderMuted", `├${"─".repeat(innerWidth)}┤`);
  }

  private borderLine(innerWidth: number, edge: "top" | "bottom"): string {
    const left = edge === "top" ? "┌" : "└";
    const right = edge === "top" ? "┐" : "┘";
    return this.theme.fg("borderMuted", `${left}${"─".repeat(innerWidth)}${right}`);
  }

  private wrapTranscript(innerWidth: number): string[] {
    const wrapped: string[] = [];
    for (const line of this.transcriptLines) {
      if (!line) {
        wrapped.push("");
        continue;
      }
      wrapped.push(...wrapTextWithAnsi(line, Math.max(1, innerWidth)));
    }
    return wrapped;
  }

  private getDialogHeight(): number {
    const terminalRows = this.tui.terminal?.rows ?? 30;
    return Math.max(18, Math.min(32, Math.floor(terminalRows * 0.78)));
  }

  private scrollTranscript(delta: number): void {
    if (delta < 0) {
      this.followTranscript = false;
    }
    this.transcriptScrollOffset = Math.max(0, this.transcriptScrollOffset + delta);
    this.tui.requestRender();
  }

  dispose(): void {
    this.tui.terminal?.write?.("\x1b[?1000l\x1b[?1006l");
  }

  private getMouseScrollDelta(data: string): number | null {
    const match = data.match(/^\x1b\[<(\d+);\d+;\d+[Mm]$/);
    if (!match) {
      return null;
    }

    const button = Number(match[1]);
    if ((button & 64) !== 64) {
      return null;
    }

    return (button & 1) === 0 ? -2 : 2;
  }

  handleInput(data: string): void {
    if (matchesBtwFocusShortcut(data)) {
      this.onUnfocusCallback();
      return;
    }

    const mouseScrollDelta = this.getMouseScrollDelta(data);
    if (mouseScrollDelta !== null) {
      this.scrollTranscript(mouseScrollDelta);
      return;
    }

    if (matchesKey(data, Key.pageUp) || matchesKey(data, Key.up)) {
      const step = matchesKey(data, Key.pageUp) ? Math.max(1, this.transcriptViewportHeight - 1) : 1;
      this.scrollTranscript(-step);
      return;
    }

    if (matchesKey(data, Key.pageDown) || matchesKey(data, Key.down)) {
      const step = matchesKey(data, Key.pageDown) ? Math.max(1, this.transcriptViewportHeight - 1) : 1;
      this.scrollTranscript(step);
      return;
    }

    this.input.handleInput(data);
  }

  private inputFrameLine(dialogWidth: number): string {
    const targetWidth = Math.max(1, dialogWidth - 2);
    const previousFocused = this.input.focused;
    // Input.render() emits CURSOR_MARKER when focused. In overlay mode that APC marker
    // can skew width/composition on this one row before the TUI strips it, producing a
    // right-edge notch and shifted border. Render the embedded input unfocused here so
    // the row stays geometrically stable while the overlay still owns keyboard input.
    this.input.focused = false;
    try {
      const inputLine = this.input.render(targetWidth)[0] ?? "";
      return `${this.theme.fg("borderMuted", "│")}${inputLine}${this.theme.fg("borderMuted", "│")}`;
    } finally {
      this.input.focused = previousFocused;
    }
  }

  override render(width: number): string[] {
    const dialogWidth = Math.max(24, width);
    const innerWidth = Math.max(22, dialogWidth - 2);
    const transcriptLines = this.wrapTranscript(innerWidth);
    const dialogHeight = this.getDialogHeight();
    const chromeHeight = 8;
    const transcriptHeight = Math.max(6, dialogHeight - chromeHeight);
    this.transcriptViewportHeight = transcriptHeight;

    const maxScroll = Math.max(0, transcriptLines.length - transcriptHeight);
    if (this.followTranscript) {
      this.transcriptScrollOffset = maxScroll;
    } else {
      this.transcriptScrollOffset = Math.max(0, Math.min(this.transcriptScrollOffset, maxScroll));
      if (this.transcriptScrollOffset >= maxScroll) {
        this.followTranscript = true;
      }
    }

    const visibleTranscript = transcriptLines.slice(
      this.transcriptScrollOffset,
      this.transcriptScrollOffset + transcriptHeight,
    );
    const transcriptPadCount = Math.max(0, transcriptHeight - visibleTranscript.length);
    const hiddenAbove = this.transcriptScrollOffset;
    const hiddenBelow = Math.max(0, maxScroll - this.transcriptScrollOffset);
    const summary =
      hiddenAbove || hiddenBelow
        ? `${this.summaryTextValue.trim()} · ↑${hiddenAbove} ↓${hiddenBelow}`
        : this.summaryTextValue.trim();

    const lines = [this.borderLine(innerWidth, "top")];

    lines.push(this.frameLine(this.theme.fg("accent", this.theme.bold(this.modeTextValue.trim())), innerWidth));
    lines.push(this.frameLine(this.theme.fg("dim", summary), innerWidth));
    lines.push(this.ruleLine(innerWidth));

    for (const line of visibleTranscript) {
      lines.push(this.frameLine(line, innerWidth));
    }
    for (let i = 0; i < transcriptPadCount; i++) {
      lines.push(this.frameLine("", innerWidth));
    }

    lines.push(this.ruleLine(innerWidth));
    lines.push(this.frameLine(this.theme.fg("warning", this.statusTextValue.trim()), innerWidth));
    lines.push(this.inputFrameLine(dialogWidth));
    lines.push(this.frameLine(this.theme.fg("dim", this.hintsTextValue.trim()), innerWidth));
    lines.push(this.borderLine(innerWidth, "bottom"));

    return lines;
  }

  setDraft(value: string): void {
    this.input.setValue(value);
    this.tui.requestRender();
  }

  getDraft(): string {
    return this.input.getValue();
  }

  getTranscriptEntries(): BtwTranscript {
    return this.readTranscriptEntries().map((entry) => ({ ...entry }));
  }

  refresh(): void {
    this.modeTextValue = `${getOverlayTitle(this.getMode())} · hidden thread preserved`;
    this.modeText.setText(this.modeTextValue);
    const entries = this.readTranscriptEntries();
    const exchanges = getCompletedBtwExchangeCount(entries);
    const active = hasStreamingBtwTranscriptEntry(entries) ? " · streaming" : " · idle";
    this.summaryTextValue = `${exchanges} exchange${exchanges === 1 ? "" : "s"}${active}`;
    this.summaryText.setText(this.summaryTextValue);

    this.transcriptLines = buildOverlayTranscript(entries, this.theme);
    this.transcript.clear();
    for (const line of this.transcriptLines) {
      this.transcript.addChild(new Text(line, 1, 0));
    }

    const status = this.getStatus() ?? "Ready. Enter submits; Escape dismisses without clearing.";
    this.statusTextValue = status;
    this.statusText.setText(this.statusTextValue);
    this.hintsTextValue = "Scroll wheel ↑↓ PgUp/PgDn · Enter · Alt+/ focus · Esc";
    this.hintsText.setText(this.hintsTextValue);
    this.tui.requestRender();
  }
}

export default function (pi: ExtensionAPI) {
  let pendingThread: BtwDetails[] = [];
  let pendingMode: BtwThreadMode = "contextual";
  let btwModelOverride: SessionModel | null = null;
  let btwThinkingOverride: SessionThinkingLevel | null = null;
  let transcriptState = createEmptyBtwTranscriptState();
  let overlayStatus: string | null = null;
  let overlayDraft = "";
  let overlayRuntime: OverlayRuntime | null = null;
  let lastUiContext: ExtensionContext | ExtensionCommandContext | null = null;
  let activeBtwSession: BtwSessionRuntime | null = null;

  function syncUi(ctx?: ExtensionContext | ExtensionCommandContext): void {
    const activeCtx = ctx ?? lastUiContext;
    if (activeCtx?.hasUI) {
      activeCtx.ui.setWidget("btw", undefined);
      overlayRuntime?.refresh?.();
    }
  }

  function setOverlayStatus(status: string | null, ctx?: ExtensionContext | ExtensionCommandContext): void {
    overlayStatus = status;
    syncUi(ctx);
  }

  function setOverlayDraft(value: string): void {
    overlayDraft = value;
    overlayRuntime?.setDraft?.(value);
  }

  function dismissOverlay(): void {
    overlayRuntime?.close?.();
    overlayRuntime = null;
  }

  function toggleOverlayFocus(): void {
    const handle = overlayRuntime?.handle;
    if (!handle) {
      return;
    }

    handle.setHidden(false);
    if (handle.isFocused()) {
      handle.unfocus();
    } else {
      handle.focus();
    }
    overlayRuntime?.refresh?.();
  }

  function focusOverlay(): void {
    const handle = overlayRuntime?.handle;
    if (!handle) {
      return;
    }

    handle.setHidden(false);
    handle.focus();
    overlayRuntime?.refresh?.();
  }

  function removeBtwSessionSubscription(sessionRuntime: BtwSessionRuntime, unsubscribe: () => void): void {
    if (!sessionRuntime.subscriptions.delete(unsubscribe)) {
      return;
    }

    try {
      unsubscribe();
    } catch {
      // Ignore unsubscribe errors during BTW session replacement/shutdown.
    }
  }

  function clearBtwSessionSubscriptions(sessionRuntime: BtwSessionRuntime): void {
    for (const unsubscribe of [...sessionRuntime.subscriptions]) {
      removeBtwSessionSubscription(sessionRuntime, unsubscribe);
    }
  }

  function handleBtwSessionEvent(
    sessionRuntime: BtwSessionRuntime,
    event: AgentSessionEvent,
    ctx?: ExtensionContext | ExtensionCommandContext,
  ): void {
    if (activeBtwSession?.session !== sessionRuntime.session || !overlayRuntime) {
      return;
    }

    applyBtwTranscriptEvent(transcriptState, event as BtwTranscriptEvent);

    if (event.type === "tool_execution_start") {
      setOverlayStatus(`⏳ running tool: ${event.toolName}`, ctx);
      return;
    }

    if (event.type === "tool_execution_end") {
      setOverlayStatus(sessionRuntime.session.isStreaming ? `⏳ running tool: ${event.toolName}` : "⏳ streaming...", ctx);
      return;
    }

    if (event.type === "turn_end") {
      setOverlayStatus("⏳ finishing…", ctx);
      return;
    }

    if (
      event.type === "message_start" ||
      event.type === "message_update" ||
      event.type === "message_end" ||
      event.type === "turn_start"
    ) {
      syncUi(ctx);
    }
  }

  function subscribeOverlayToActiveBtwSession(ctx?: ExtensionContext | ExtensionCommandContext): void {
    const sessionRuntime = activeBtwSession;
    if (!sessionRuntime || sessionRuntime.subscriptions.size > 0) {
      return;
    }

    const unsubscribe = sessionRuntime.session.subscribe((event: AgentSessionEvent) => {
      handleBtwSessionEvent(sessionRuntime, event, ctx);
    });
    sessionRuntime.subscriptions.add(unsubscribe);
  }

  async function disposeBtwSession(): Promise<void> {
    const current = activeBtwSession;
    activeBtwSession = null;
    if (!current) {
      return;
    }

    clearBtwSessionSubscriptions(current);

    try {
      await current.session.abort();
    } catch {
      // Ignore abort errors during BTW session replacement/shutdown.
    }

    current.session.dispose();
  }

  async function dismissOverlaySession(): Promise<void> {
    dismissOverlay();
    await disposeBtwSession();
  }

  async function resolveBtwModel(
    ctx: ExtensionCommandContext,
    notifyOnFallback = false,
  ): Promise<ResolvedBtwModel<SessionModel>> {
    let overrideHasCredentials: boolean | undefined;
    if (btwModelOverride) {
      const auth = await ctx.modelRegistry.getApiKeyAndHeaders(btwModelOverride);
      overrideHasCredentials = auth.ok && !!auth.apiKey;
    }

    const resolved = resolveBtwModelWithCredentialStatus({
      configuredOverride: btwModelOverride,
      mainModel: ctx.model ?? null,
      overrideHasCredentials,
    });
    if (notifyOnFallback && resolved.fallbackReason) {
      notify(ctx, resolved.fallbackReason, "warning");
    }

    return resolved;
  }

  async function resolveBtwSettings(
    ctx: ExtensionCommandContext,
    notifyOnFallback = false,
  ): Promise<ResolvedBtwSettings<SessionModel>> {
    const resolvedModel = await resolveBtwModel(ctx, notifyOnFallback);
    return buildResolvedBtwSettings(
      resolvedModel,
      pi.getThinkingLevel() as SessionThinkingLevel,
      btwThinkingOverride,
    );
  }

  async function setBtwModelOverride(ctx: ExtensionCommandContext, nextModel: SessionModel | null): Promise<void> {
    btwModelOverride = nextModel;
    const details: BtwModelOverrideDetails = nextModel
      ? { action: "set", timestamp: Date.now(), provider: nextModel.provider, id: nextModel.id, api: nextModel.api }
      : { action: "clear", timestamp: Date.now() };
    pi.appendEntry(BTW_MODEL_OVERRIDE_TYPE, details);
    await disposeBtwSession();
    const settings = await resolveBtwSettings(ctx);
    const message = nextModel
      ? `BTW model override set to ${formatModelRef(nextModel)}.`
      : "BTW model override cleared. BTW now inherits the main thread model.";
    setOverlayStatus(message, ctx);
    notify(ctx, `${message} ${describeResolvedModel(settings)}`, "info");
  }

  async function setBtwThinkingOverride(
    ctx: ExtensionCommandContext,
    nextThinkingLevel: SessionThinkingLevel | null,
  ): Promise<void> {
    btwThinkingOverride = nextThinkingLevel;
    const details: BtwThinkingOverrideDetails = nextThinkingLevel
      ? { action: "set", timestamp: Date.now(), thinkingLevel: nextThinkingLevel }
      : { action: "clear", timestamp: Date.now() };
    pi.appendEntry(BTW_THINKING_OVERRIDE_TYPE, details);
    await disposeBtwSession();
    const settings = await resolveBtwSettings(ctx);
    const message = nextThinkingLevel
      ? `BTW thinking override set to ${nextThinkingLevel}.`
      : "BTW thinking override cleared. BTW now inherits the main thread thinking level.";
    setOverlayStatus(message, ctx);
    notify(ctx, `${message} ${describeResolvedThinking(settings)}`, "info");
  }

  async function createBtwSubSession(ctx: ExtensionCommandContext, mode: BtwThreadMode): Promise<BtwSessionRuntime> {
    const settings = await resolveBtwSettings(ctx, true);
    if (!settings.model) {
      throw new Error(settings.fallbackReason || "No active model selected.");
    }

    const { session } = await createAgentSession({
      sessionManager: SessionManager.inMemory(),
      model: settings.model,
      modelRegistry: ctx.modelRegistry as AgentSession["modelRegistry"],
      thinkingLevel: settings.thinkingLevel,
      // Match pi's default coding-agent toolset (read/bash/edit/write).
      tools: ["read", "bash", "edit", "write"],
      resourceLoader: createBtwResourceLoader(ctx),
    });

    const { messages: seedMessages, sideThreadStartIndex } = buildBtwSeedState(ctx, pendingThread, mode, settings.model);
    if (seedMessages.length > 0) {
      session.state.messages = seedMessages;
    }

    return { session, mode, subscriptions: new Set(), sideThreadStartIndex };
  }

  let ensureBtwSessionInFlight: Promise<BtwSessionRuntime | null> | null = null;

  async function ensureBtwSession(ctx: ExtensionCommandContext, mode: BtwThreadMode): Promise<BtwSessionRuntime | null> {
    if (ensureBtwSessionInFlight) {
      return ensureBtwSessionInFlight;
    }

    ensureBtwSessionInFlight = (async () => {
      try {
        const settings = await resolveBtwSettings(ctx);
        if (!settings.model) {
          return null;
        }

        if (activeBtwSession?.mode === mode) {
          return activeBtwSession;
        }

        await disposeBtwSession();
        activeBtwSession = await createBtwSubSession(ctx, mode);
        return activeBtwSession;
      } finally {
        ensureBtwSessionInFlight = null;
      }
    })();

    return ensureBtwSessionInFlight;
  }

  async function ensureOverlay(ctx: ExtensionCommandContext | ExtensionContext): Promise<void> {
    if (ctx.mode !== "tui") {
      return;
    }
    lastUiContext = ctx;

    if (overlayRuntime?.handle) {
      subscribeOverlayToActiveBtwSession(ctx);
      focusOverlay();
      return;
    }

    const runtime: OverlayRuntime = {};
    // Holds the overlay instance once the async custom() callback constructs it.
    // closeRuntime reads this so it can call dispose() on every close path,
    // including the window before the inner runtime.close reassignment completes.
    let overlayRef: BtwOverlayComponent | null = null;
    const closeRuntime = () => {
      if (runtime.closed) {
        return;
      }
      runtime.closed = true;
      overlayRef?.dispose();
      if (activeBtwSession) {
        clearBtwSessionSubscriptions(activeBtwSession);
      }
      runtime.handle?.hide();
      if (overlayRuntime === runtime) {
        overlayRuntime = null;
      }
      runtime.finish?.();
    };

    runtime.close = closeRuntime;
    overlayRuntime = runtime;

    void ctx.ui
      .custom<void>(
        async (tui, theme, keybindings, done) => {
          runtime.finish = () => {
            done();
          };

          const overlay = new BtwOverlayComponent(
            tui,
            theme,
            keybindings,
            () => transcriptState.entries,
            () => overlayStatus,
            () => pendingMode,
            (value) => {
              void submitFromOverlay(ctx, value);
            },
            () => {
              void dismissOverlaySession();
            },
            () => {
              overlayRuntime?.handle?.unfocus();
              overlayRuntime?.refresh?.();
            },
          );

          // Register the overlay so closeRuntime() can dispose it on any close
          // path, including the async gap before this inner reassignment executes.
          overlayRef = overlay;
          overlay.focused = runtime.handle?.isFocused() ?? true;
          overlay.setDraft(overlayDraft);
          runtime.setDraft = (value) => {
            overlay.setDraft(value);
          };
          runtime.refresh = () => {
            overlay.focused = runtime.handle?.isFocused() ?? false;
            overlay.refresh();
          };
          runtime.close = () => {
            overlayDraft = overlay.getDraft();
            closeRuntime(); // dispose() is called inside closeRuntime via overlayRef
          };

          subscribeOverlayToActiveBtwSession(ctx);

          if (runtime.closed) {
            done();
          }

          return overlay;
        },
        {
          overlay: true,
          overlayOptions: {
            width: "78%",
            minWidth: 72,
            maxHeight: "78%",
            anchor: "top-center",
            margin: { top: 1, left: 2, right: 2 },
            nonCapturing: true,
          },
          onHandle: (handle) => {
            runtime.handle = handle;
            handle.focus();
            if (runtime.closed) {
              closeRuntime();
            }
          },
        },
      )
      .catch((error) => {
        if (overlayRuntime === runtime) {
          overlayRuntime = null;
        }
        notify(ctx, error instanceof Error ? error.message : String(error), "error");
      });
  }

  async function dispatchBtwCommand(name: string, args: string, ctx: ExtensionCommandContext): Promise<boolean> {
    const trimmedArgs = args.trim();

    if (name === "btw") {
      const { question, save } = parseBtwArgs(trimmedArgs);
      if (!question) {
        await ensureBtwSession(ctx, pendingMode);
        await ensureOverlay(ctx);
        return true;
      }

      if (pendingMode !== "contextual") {
        await resetThread(ctx, true, "contextual");
      }

      await runBtw(ctx, question, save, "contextual");
      return true;
    }

    if (name === "btw:tangent") {
      const { question, save } = parseBtwArgs(trimmedArgs);
      if (pendingMode !== "tangent") {
        await resetThread(ctx, true, "tangent");
      }

      if (!question) {
        await ensureBtwSession(ctx, "tangent");
        await ensureOverlay(ctx);
        return true;
      }

      await runBtw(ctx, question, save, "tangent");
      return true;
    }

    if (name === "btw:new") {
      await resetThread(ctx, true, "contextual");
      const { question, save } = parseBtwArgs(trimmedArgs);
      if (question) {
        await runBtw(ctx, question, save, "contextual");
      } else {
        await ensureBtwSession(ctx, "contextual");
        setOverlayStatus("Started a fresh BTW thread.", ctx);
        await ensureOverlay(ctx);
        notify(ctx, "Started a fresh BTW thread.", "info");
      }
      return true;
    }

    if (name === "btw:clear") {
      await resetThread(ctx);
      dismissOverlay();
      notify(ctx, "Cleared BTW thread.", "info");
      return true;
    }

    if (name === "btw:model") {
      const parsed = parseBtwModelArgs(trimmedArgs);
      if (parsed.action === "invalid") {
        setOverlayStatus(parsed.message, ctx);
        notify(ctx, parsed.message, "error");
        return true;
      }

      if (parsed.action === "show") {
        const settings = await resolveBtwSettings(ctx);
        const message = describeResolvedModel(settings);
        setOverlayStatus(message, ctx);
        notify(ctx, message, settings.model ? "info" : "warning");
        return true;
      }

      if (parsed.action === "clear") {
        await setBtwModelOverride(ctx, null);
        return true;
      }
      const ref = parsed.model;
      const resolved = ctx.modelRegistry.find(ref.provider, ref.id);
      if (!resolved) {
        const message = `Unknown model ${ref.provider}/${ref.id}. Use /login or /models to add it before setting it as the BTW override.`;
        setOverlayStatus(message, ctx);
        notify(ctx, message, "error");
        return true;
      }
      await setBtwModelOverride(ctx, resolved);
      return true;
    }

    if (name === "btw:thinking") {
      const parsed = parseBtwThinkingArgs(trimmedArgs);
      if (parsed.action === "invalid") {
        setOverlayStatus(parsed.message, ctx);
        notify(ctx, parsed.message, "error");
        return true;
      }

      if (parsed.action === "show") {
        const settings = await resolveBtwSettings(ctx);
        const message = describeResolvedThinking(settings);
        setOverlayStatus(message, ctx);
        notify(ctx, message, "info");
        return true;
      }

      await setBtwThinkingOverride(ctx, parsed.action === "clear" ? null : parsed.thinkingLevel);
      return true;
    }

    if (name === "btw:inject") {
      if (pendingThread.length === 0) {
        notify(ctx, "No BTW thread to inject.", "warning");
        return true;
      }

      setOverlayStatus("⏳ injecting into the main session...", ctx);
      await ensureOverlay(ctx);

      try {
        const { thread } = await getBtwHandoffThread(ctx);
        const instructions = trimmedArgs;
        const content = instructions
          ? `Here is a side conversation I had. ${instructions}\n\n${formatBtwThread(thread)}`
          : `Here is a side conversation I had for additional context:\n\n${formatBtwThread(thread)}`;

        sendThreadToMain(ctx, content);
        const count = thread.length;
        await resetThread(ctx);
        dismissOverlay();
        notify(ctx, `Injected BTW thread (${count} exchange${count === 1 ? "" : "s"}).`, "info");
      } catch (error) {
        setOverlayStatus("Inject failed. Thread preserved for retry or summarize.", ctx);
        notify(ctx, error instanceof Error ? error.message : String(error), "error");
      }
      return true;
    }

    if (name === "btw:summarize") {
      if (pendingThread.length === 0) {
        notify(ctx, "No BTW thread to summarize.", "warning");
        return true;
      }

      setOverlayStatus("⏳ summarizing...", ctx);
      await ensureOverlay(ctx);

      try {
        const { thread } = await getBtwHandoffThread(ctx);
        const summary = await summarizeThread(ctx, thread);
        const instructions = trimmedArgs;
        const content = instructions
          ? `Here is a summary of a side conversation I had. ${instructions}\n\n${summary}`
          : `Here is a summary of a side conversation I had:\n\n${summary}`;

        sendThreadToMain(ctx, content);
        const count = thread.length;
        await resetThread(ctx);
        dismissOverlay();
        notify(ctx, `Injected BTW summary (${count} exchange${count === 1 ? "" : "s"}).`, "info");
      } catch (error) {
        setOverlayStatus("Summarize failed. Thread preserved for retry or injection.", ctx);
        notify(ctx, error instanceof Error ? error.message : String(error), "error");
      }
      return true;
    }

    return false;
  }

  async function submitFromOverlay(ctx: ExtensionCommandContext | ExtensionContext, value: string): Promise<void> {
    const question = value.trim();
    if (!question) {
      setOverlayStatus("Enter a BTW prompt before submitting.", ctx);
      return;
    }

    if (!("getSystemPrompt" in ctx)) {
      // This path is architecturally unreachable: overlay submit is only wired up
      // from command contexts. Throw rather than silently discarding user input.
      throw new Error("[btw] submitFromOverlay called from a non-command context — user input was not submitted. Reopen BTW from a command.");
    }

    const cmdCtx = ctx as ExtensionCommandContext;
    const btwCommand = parseOverlayBtwCommand(question);
    if (btwCommand) {
      setOverlayDraft("");
      await dispatchBtwCommand(btwCommand.name, btwCommand.args, cmdCtx);
      return;
    }

    setOverlayDraft("");
    setOverlayStatus("⏳ streaming...", ctx);
    syncUi(ctx);
    await runBtw(cmdCtx, question, false, pendingMode);
  }

  async function resetThread(
    ctx: ExtensionContext | ExtensionCommandContext,
    persist = true,
    mode: BtwThreadMode = "contextual",
  ): Promise<void> {
    await disposeBtwSession();
    pendingThread = [];
    pendingMode = mode;
    transcriptState = createEmptyBtwTranscriptState();
    setOverlayDraft("");
    setOverlayStatus(null, ctx);
    if (persist) {
      const details: BtwResetDetails = { timestamp: Date.now(), mode };
      pi.appendEntry(BTW_RESET_TYPE, details);
    }
    syncUi(ctx);
  }

  async function restoreThread(ctx: ExtensionContext): Promise<void> {
    await disposeBtwSession();
    pendingThread = [];
    pendingMode = "contextual";
    btwModelOverride = null;
    btwThinkingOverride = null;
    transcriptState = createEmptyBtwTranscriptState();
    overlayDraft = "";
    lastUiContext = ctx;
    overlayStatus = null;

    const restored = restoreBtwThreadState(ctx.sessionManager.getBranch(), ctx.model?.api || "openai-responses");
    pendingMode = restored.mode;

    if (restored.modelOverride) {
      const resolved = ctx.modelRegistry.find(restored.modelOverride.provider, restored.modelOverride.id);
      // Configured override may no longer be in the registry; drop it on restore.
      btwModelOverride = resolved ?? null;
    }

    btwThinkingOverride = restored.thinkingOverride as SessionThinkingLevel | null;

    for (const details of restored.thread) {
      const normalizedDetails = details as BtwDetails;
      pendingThread.push(normalizedDetails);
      appendPersistedBtwTranscriptTurn(transcriptState, normalizedDetails);
    }

    syncUi(ctx);
  }

  async function runBtw(
    ctx: ExtensionCommandContext,
    question: string,
    saveRequested: boolean,
    mode: BtwThreadMode,
  ): Promise<void> {
    lastUiContext = ctx;
    const settings = await resolveBtwSettings(ctx);
    const model = settings.model;
    if (!model) {
      const message = settings.fallbackReason || "No active model selected.";
      setOverlayStatus(message, ctx);
      notify(ctx, message, "error");
      return;
    }

    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
    const authFailure = getBtwAuthFailureMessage(model, auth);
    if (authFailure) {
      const message = authFailure;
      setOverlayStatus(message, ctx);
      notify(ctx, message, "error");
      await ensureOverlay(ctx);
      return;
    }

    const sessionRuntime = await ensureBtwSession(ctx, mode);
    if (!sessionRuntime) {
      setOverlayStatus("No active model selected.", ctx);
      notify(ctx, "No active model selected.", "error");
      return;
    }

    const session = sessionRuntime.session;
    const wasBusy = !ctx.isIdle();
    pendingMode = mode;
    const thinkingLevel = settings.thinkingLevel;

    setOverlayStatus("⏳ streaming...", ctx);
    await ensureOverlay(ctx);

    // Capture the turn ID actually allocated for this prompt invocation by
    // listening for the first turn_start event. applyBtwTranscriptEvent calls
    // ensureBtwTranscriptTurn on turn_start, which sets transcriptState.currentTurnId.
    // Snapshotting nextTurnId before the call is unreliable: if abort fires after
    // finishTranscriptTurn nullifies currentTurnId and a concurrent caller has
    // since advanced nextTurnId, the snapshot refers to the wrong turn ID.
    let promptTurnId: number | null = null;
    const captureTurnId = session.subscribe((event) => {
      if (promptTurnId === null && event.type === "turn_start") {
        promptTurnId = transcriptState.currentTurnId;
        // Defer unsubscribe to avoid mutating the listener array mid-iteration.
        void Promise.resolve().then(() => captureTurnId());
      }
    });

    try {
      await session.prompt(question, { source: "extension" });

      const response = getLastAssistantMessage(session.state.messages) as AssistantMessage | null;
      if (!response) {
        throw new Error("BTW request finished without a response.");
      }
      if (response.stopReason === "aborted") {
        removeBtwTranscriptTurn(transcriptState, transcriptState.currentTurnId ?? promptTurnId);
        setOverlayStatus("Request aborted.", ctx);
        return;
      }
      if (response.stopReason === "error") {
        throw new Error(response.errorMessage || "BTW request failed.");
      }

      const completedTurnId = transcriptState.lastTurnId ?? transcriptState.currentTurnId;
      const streamedThinking =
        completedTurnId !== null ? findLatestBtwTranscriptEntry(transcriptState, completedTurnId, "thinking")?.text : "";
      const details: BtwDetails = buildBtwDetailsFromResponse<AssistantMessage>({
        question,
        model,
        thinkingLevel,
        response,
        streamedThinking: streamedThinking ?? "",
        extractAnswer: extractBtwAssistantAnswer,
        extractThinking: extractBtwAssistantThinking,
        timestamp: Date.now(),
      });

      pendingThread.push(details);
      pi.appendEntry(BTW_ENTRY_TYPE, details);

      const saveState = saveVisibleBtwNote(pi, details, saveRequested, wasBusy);
      if (saveState === "saved") {
        notify(ctx, "Saved BTW note to the session.", "info");
        setOverlayStatus("Saved BTW note to the session.", ctx);
      } else if (saveState === "queued") {
        notify(ctx, "BTW note queued to save after the current turn finishes.", "info");
        setOverlayStatus("BTW note queued to save after the current turn finishes.", ctx);
      } else {
        setOverlayStatus("Ready for a follow-up. Hidden BTW thread updated.", ctx);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setBtwTranscriptFailure(transcriptState, errorMessage);
      setOverlayStatus("Request failed. Thread preserved for retry or follow-up.", ctx);
      notify(ctx, errorMessage, "error");
      await disposeBtwSession();
    } finally {
      captureTurnId(); // ensure unsubscribe even if turn_start never fired
      syncUi(ctx);
    }
  }

  function getPendingThreadForHandoff(): BtwHandoffExchange[] {
    return pendingThreadToHandoff(pendingThread);
  }

  async function getBtwHandoffThread(
    ctx: ExtensionCommandContext,
  ): Promise<{ sessionRuntime: BtwSessionRuntime | null; thread: BtwHandoffExchange[] }> {
    const sessionRuntime = activeBtwSession ?? (await ensureBtwSession(ctx, pendingMode));
    const thread = sessionRuntime
      ? extractBtwHandoffThread(sessionRuntime.session.state.messages.slice(sessionRuntime.sideThreadStartIndex))
      : [];
    const resolvedThread = thread.length > 0 ? thread : getPendingThreadForHandoff();

    if (resolvedThread.length === 0) {
      throw new Error("No BTW thread available for handoff.");
    }

    return { sessionRuntime, thread: resolvedThread };
  }

  async function summarizeThread(ctx: ExtensionCommandContext, thread: BtwHandoffExchange[]): Promise<string> {
    const settings = await resolveBtwSettings(ctx, true);
    const model = settings.model;
    if (!model) {
      throw new Error(settings.fallbackReason || "No active model selected.");
    }

    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
    const authFailure = getBtwAuthFailureMessage(model, auth);
    if (authFailure) {
      throw new Error(authFailure);
    }

    const { session } = await createAgentSession({
      sessionManager: SessionManager.inMemory(),
      model,
      modelRegistry: ctx.modelRegistry as AgentSession["modelRegistry"],
      thinkingLevel: "off",
      tools: [],
      resourceLoader: createBtwResourceLoader(ctx, [BTW_SUMMARIZE_SYSTEM_PROMPT]),
    });

    try {
      await session.prompt(formatBtwThread(thread), { source: "extension" });

      const response = getLastAssistantMessage(session.state.messages) as AssistantMessage | null;
      if (!response) {
        throw new Error("BTW summarize finished without a response.");
      }
      if (response.stopReason === "error") {
        throw new Error(response.errorMessage || "Failed to summarize BTW thread.");
      }
      if (response.stopReason === "aborted") {
        throw new Error("BTW summarize aborted.");
      }

      return extractBtwAssistantAnswer(response);
    } finally {
      try {
        await session.abort();
      } catch {
        // Ignore abort errors during summarize session shutdown.
      }
      session.dispose();
    }
  }

  function sendThreadToMain(ctx: ExtensionCommandContext, content: string): void {
    if (ctx.isIdle()) {
      pi.sendUserMessage(content);
    } else {
      pi.sendUserMessage(content, { deliverAs: "followUp" });
    }
  }

  pi.registerMessageRenderer(BTW_MESSAGE_TYPE, (message, { expanded }, theme) => {
    const details = message.details as BtwDetails | undefined;
    const content = typeof message.content === "string" ? message.content : "[non-text btw message]";
    const lines = [theme.fg("accent", theme.bold("[BTW]")), content];

    if (expanded && details) {
      lines.push(
        theme.fg(
          "dim",
          `model: ${details.provider}/${details.model} (${details.api ?? "openai-responses"}) · thinking: ${details.thinkingLevel}`,
        ),
      );

      if (details.usage) {
        lines.push(
          theme.fg(
            "dim",
            `tokens: in ${details.usage.input} · out ${details.usage.output} · total ${details.usage.totalTokens}`,
          ),
        );
      }
    }

    const box = new Box(1, 1, (text) => theme.bg("customMessageBg", text));
    box.addChild(new Text(lines.join("\n"), 0, 0));
    return box;
  });

  pi.on("context", async (event) => {
    return {
      messages: event.messages.filter((message) => !isVisibleBtwMessage(message)),
    };
  });

  pi.on("session_start", async (_event, ctx) => {
    await restoreThread(ctx);
  });

  pi.on("session_tree", async (_event, ctx) => {
    await restoreThread(ctx);
  });

  pi.on("session_shutdown", async () => {
    await disposeBtwSession();
    dismissOverlay();
  });

  for (const shortcut of BTW_FOCUS_SHORTCUTS) {
    pi.registerShortcut(shortcut, {
      description: "Toggle BTW overlay focus while leaving it open.",
      handler: async (_ctx) => {
        toggleOverlayFocus();
      },
    });
  }

  pi.registerCommand("btw", {
    description: "Continue a side conversation in a focused BTW modal. Add --save to also persist a visible note.",
    handler: async (args, ctx) => {
      await dispatchBtwCommand("btw", args, ctx);
    },
  });

  pi.registerCommand("btw:tangent", {
    description: "Start or continue a contextless BTW tangent in the focused BTW modal.",
    handler: async (args, ctx) => {
      await dispatchBtwCommand("btw:tangent", args, ctx);
    },
  });

  pi.registerCommand("btw:new", {
    description: "Start a fresh BTW thread with main-session context. Optionally ask the first question immediately.",
    handler: async (args, ctx) => {
      await dispatchBtwCommand("btw:new", args, ctx);
    },
  });

  pi.registerCommand("btw:clear", {
    description: "Dismiss the BTW modal/widget and clear the current thread.",
    handler: async (args, ctx) => {
      await dispatchBtwCommand("btw:clear", args, ctx);
    },
  });

  pi.registerCommand("btw:inject", {
    description: "Inject the full BTW thread into the main agent as a user message.",
    handler: async (args, ctx) => {
      await dispatchBtwCommand("btw:inject", args, ctx);
    },
  });

  pi.registerCommand("btw:summarize", {
    description: "Summarize the BTW thread, then inject the summary into the main agent.",
    handler: async (args, ctx) => {
      await dispatchBtwCommand("btw:summarize", args, ctx);
    },
  });

  pi.registerCommand("btw:model", {
    description: "Show, set, or clear the BTW-only model override.",
    handler: async (args, ctx) => {
      await dispatchBtwCommand("btw:model", args, ctx);
    },
  });

  pi.registerCommand("btw:thinking", {
    description: "Show, set, or clear the BTW-only thinking override.",
    handler: async (args, ctx) => {
      await dispatchBtwCommand("btw:thinking", args, ctx);
    },
  });
}

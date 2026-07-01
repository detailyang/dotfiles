export const BTW_MESSAGE_TYPE = "btw-note";
export const BTW_ENTRY_TYPE = "btw-thread-entry";
export const BTW_RESET_TYPE = "btw-thread-reset";
export const BTW_MODEL_OVERRIDE_TYPE = "btw-model-override";
export const BTW_THINKING_OVERRIDE_TYPE = "btw-thinking-override";
export const BTW_CONTINUE_THREAD_USER_TEXT = "[The following is a separate side conversation. Continue this thread.]";
export const BTW_CONTINUE_THREAD_ASSISTANT_TEXT = "Understood, continuing our side conversation.";

export type BtwThreadMode = "contextual" | "tangent";

export type BtwHandoffExchange = {
  user: string;
  assistant: string;
};

export type BtwThreadMessage = {
  role: string;
  content?: unknown;
  customType?: string;
};

export type BtwSeedMessage = {
  role: string;
  content: unknown;
  provider?: string;
  model?: string;
  api?: string;
  usage?: unknown;
  stopReason?: string;
  timestamp?: number;
};

export type BtwPendingThreadEntry = {
  question: string;
  answer: string;
};

export type BtwDetails = {
  question: string;
  thinking?: string;
  answer: string;
  provider?: string;
  model?: string;
  api: string;
  thinkingLevel?: string;
  timestamp?: number;
  usage?: unknown;
};

export type BtwModelOverrideDetails =
  | ({ timestamp?: number; action: "set" } & BtwModelRef)
  | { timestamp?: number; action: "clear" };

export type BtwThinkingOverrideDetails =
  | { timestamp?: number; action: "set"; thinkingLevel: string }
  | { timestamp?: number; action: "clear" };

export type BtwResetDetails = {
  timestamp?: number;
  mode?: BtwThreadMode;
};

export type BtwModelRef = {
  provider: string;
  id: string;
  api: string;
};

export type RestoredBtwThreadState = {
  mode: BtwThreadMode;
  modelOverride: BtwModelRef | null;
  thinkingOverride: string | null;
  thread: BtwDetails[];
};

const EMPTY_ASSISTANT_USAGE = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

function extractTextContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  const textParts: string[] = [];
  for (const part of content) {
    if (!part || typeof part !== "object") {
      continue;
    }

    const block = part as { type?: unknown; text?: unknown };
    if (block.type === "text" && typeof block.text === "string") {
      textParts.push(block.text);
    }
  }

  return textParts.join("\n").trim();
}

export function isVisibleBtwMessage(message: { role: string; customType?: string }): boolean {
  return message.role === "custom" && message.customType === BTW_MESSAGE_TYPE;
}

export function isCustomBtwEntry(entry: unknown, customType: string): entry is { type: "custom"; customType: string; data?: unknown } {
  return !!entry && typeof entry === "object" && (entry as { type?: string }).type === "custom" && (entry as { customType?: string }).customType === customType;
}

export function buildBtwMessageContent(question: string, answer: string): string {
  return `Q: ${question}\n\nA: ${answer}`;
}

export function formatBtwThread(thread: BtwHandoffExchange[]): string {
  return thread.map((entry) => `User: ${entry.user.trim()}\nAssistant: ${entry.assistant.trim()}`).join("\n\n---\n\n");
}

function isThreadContinuationMarker(messages: BtwThreadMessage[], index: number): boolean {
  const userMessage = messages[index];
  const assistantMessage = messages[index + 1];
  return (
    userMessage?.role === "user" &&
    extractTextContent(userMessage.content) === BTW_CONTINUE_THREAD_USER_TEXT &&
    assistantMessage?.role === "assistant" &&
    extractTextContent(assistantMessage.content) === BTW_CONTINUE_THREAD_ASSISTANT_TEXT
  );
}

export function extractBtwHandoffThread(messages: BtwThreadMessage[]): BtwHandoffExchange[] {
  const threadMessages = isThreadContinuationMarker(messages, 0) ? messages.slice(2) : messages;
  const exchanges: BtwHandoffExchange[] = [];
  let currentUser = "";
  let currentAssistant = "";

  const pushCurrent = () => {
    if (!currentUser && !currentAssistant) {
      return;
    }

    exchanges.push({
      user: currentUser.trim() || "(No user prompt)",
      assistant: currentAssistant.trim() || "(No assistant response)",
    });
    currentUser = "";
    currentAssistant = "";
  };

  for (const message of threadMessages) {
    if (message.role !== "user" && message.role !== "assistant") {
      continue;
    }

    const text = extractTextContent(message.content).trim();
    if (!text) {
      continue;
    }

    if (message.role === "user") {
      pushCurrent();
      currentUser = text;
      continue;
    }

    currentAssistant = currentAssistant ? `${currentAssistant}\n\n${text}` : text;
  }

  pushCurrent();
  return exchanges;
}

export function pendingThreadToHandoff(entries: BtwPendingThreadEntry[]): BtwHandoffExchange[] {
  return entries.map((entry) => ({ user: entry.question, assistant: entry.answer }));
}

export function buildBtwSeedThreadMessages(
  thread: BtwDetails[],
  sessionModel: BtwModelRef | null,
  fallbackApi: string,
  now: number,
): BtwSeedMessage[] {
  if (thread.length === 0) {
    return [];
  }

  const messages: BtwSeedMessage[] = [
    {
      role: "user",
      content: [{ type: "text", text: BTW_CONTINUE_THREAD_USER_TEXT }],
      timestamp: now,
    },
    {
      role: "assistant",
      content: [{ type: "text", text: BTW_CONTINUE_THREAD_ASSISTANT_TEXT }],
      provider: sessionModel?.provider ?? "unknown",
      model: sessionModel?.id ?? "unknown",
      api: sessionModel?.api ?? fallbackApi,
      usage: EMPTY_ASSISTANT_USAGE,
      stopReason: "stop",
      timestamp: now,
    },
  ];

  for (const entry of thread) {
    messages.push(
      {
        role: "user",
        content: [{ type: "text", text: entry.question }],
        timestamp: entry.timestamp,
      },
      {
        role: "assistant",
        content: [{ type: "text", text: entry.answer }],
        provider: entry.provider,
        model: entry.model,
        api: entry.api || sessionModel?.api || fallbackApi,
        usage: entry.usage ?? EMPTY_ASSISTANT_USAGE,
        stopReason: "stop",
        timestamp: entry.timestamp,
      },
    );
  }

  return messages;
}

function isBtwThreadMode(value: unknown): value is BtwThreadMode {
  return value === "contextual" || value === "tangent";
}

export function restoreBtwThreadState(branch: unknown[], fallbackApi: string): RestoredBtwThreadState {
  let mode: BtwThreadMode = "contextual";
  let modelOverride: BtwModelRef | null = null;
  let thinkingOverride: string | null = null;
  let lastResetIndex = -1;

  for (let i = 0; i < branch.length; i++) {
    const entry = branch[i];

    if (isCustomBtwEntry(entry, BTW_MODEL_OVERRIDE_TYPE)) {
      const details = entry.data as BtwModelOverrideDetails | undefined;
      if (details?.action === "set") {
        modelOverride = { provider: details.provider, id: details.id, api: details.api };
      } else if (details?.action === "clear") {
        modelOverride = null;
      }
    }

    if (isCustomBtwEntry(entry, BTW_THINKING_OVERRIDE_TYPE)) {
      const details = entry.data as BtwThinkingOverrideDetails | undefined;
      if (details?.action === "set") {
        thinkingOverride = details.thinkingLevel;
      } else if (details?.action === "clear") {
        thinkingOverride = null;
      }
    }

    if (isCustomBtwEntry(entry, BTW_RESET_TYPE)) {
      lastResetIndex = i;
      const details = entry.data as BtwResetDetails | undefined;
      mode = isBtwThreadMode(details?.mode) ? details.mode : "contextual";
    }
  }

  const thread: BtwDetails[] = [];
  for (const entry of branch.slice(lastResetIndex + 1)) {
    if (!isCustomBtwEntry(entry, BTW_ENTRY_TYPE)) {
      continue;
    }

    const details = entry.data as Partial<BtwDetails> | undefined;
    if (!details?.question || !details.answer) {
      continue;
    }

    thread.push({
      ...details,
      question: details.question,
      answer: details.answer,
      api: details.api || fallbackApi,
    });
  }

  return { mode, modelOverride, thinkingOverride, thread };
}

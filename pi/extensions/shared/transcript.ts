export type MessageWithContent = {
  content?: unknown;
};

export type TranscriptToolCall = {
  name: string;
  args: string;
  output?: string;
};

export type TranscriptTurn = {
  user?: string;
  assistant?: string;
  toolCalls: TranscriptToolCall[];
};

export type ParsedCodexTranscript = {
  agent: "codex";
  sessionId: string;
  cwd?: string;
  turns: TranscriptTurn[];
  fullText: string;
  entryCount: number;
};

export type ParsedCodexSessionMetadata = {
  id: string;
  cwd?: string;
  firstMessage: string;
  startedAt?: string;
  turnCount: number;
};

type TextPart = {
  type?: unknown;
  text?: unknown;
};

function compactOneLine(text: string, maxWidth = 120): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxWidth) return oneLine;
  return `${oneLine.slice(0, maxWidth - 1)}…`;
}

export function extractTextParts(content: unknown): string[] {
  if (typeof content === "string") {
    return [content];
  }

  if (!Array.isArray(content)) {
    return [];
  }

  const textParts: string[] = [];
  for (const part of content) {
    if (!part || typeof part !== "object") {
      continue;
    }

    const block = part as TextPart;
    if (block.type === "text" && typeof block.text === "string") {
      textParts.push(block.text);
    }
  }

  return textParts;
}

export function extractTextContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  return extractTextParts(content).join("\n").trim();
}

export function extractCodexTextContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  const blocks: string[] = [];
  for (const item of content) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const block = item as { type?: unknown; text?: unknown };
    if (block.type !== "text" && block.type !== "input_text" && block.type !== "output_text") {
      continue;
    }

    if (block.text) {
      blocks.push(String(block.text));
    }
  }

  return blocks.join("\n");
}

function isInternalCodexUserMessage(text: string): boolean {
  return text.startsWith("<environment_context>") || text.startsWith("<turn_aborted>");
}

export function extractMessageText(message: MessageWithContent): string {
  return extractTextContent(message.content);
}

export function summarizeToolResultContent(
  value: unknown,
  maxLength = 400,
): { content: string; truncated: boolean } {
  let content = "";

  if (value && typeof value === "object") {
    const toolValue = value as {
      content?: unknown;
      error?: unknown;
      message?: unknown;
    };

    content = extractTextContent(toolValue.content);

    if (!content && typeof toolValue.error === "string") {
      content = toolValue.error;
    }

    if (!content && typeof toolValue.message === "string") {
      content = toolValue.message;
    }
  }

  if (!content) {
    if (typeof value === "string") {
      content = value;
    } else if (value !== undefined) {
      try {
        content = JSON.stringify(value, null, 2);
      } catch {
        content = String(value);
      }
    }
  }

  if (!content) {
    content = "(no tool output)";
  }

  const truncated = content.length > maxLength;
  return {
    content: truncated ? `${content.slice(0, maxLength - 3)}...` : content,
    truncated,
  };
}

export function extractDisplayToolText(value: unknown): string {
  if (value === undefined || value === null) return "";

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return extractDisplayToolText(JSON.parse(trimmed));
      } catch {
        // Fall through to compact raw text.
      }
    }

    return compactOneLine(trimmed);
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const toolValue = value as {
    content?: unknown;
    text?: unknown;
    output?: unknown;
    stdout?: unknown;
    stderr?: unknown;
  };

  const content = extractTextContent(toolValue.content);
  if (content) return compactOneLine(content);

  if (typeof toolValue.text === "string") return compactOneLine(toolValue.text);
  if (typeof toolValue.output === "string") return compactOneLine(toolValue.output);
  if (typeof toolValue.stdout === "string") return compactOneLine(toolValue.stdout);
  if (typeof toolValue.stderr === "string") return compactOneLine(toolValue.stderr);

  return "";
}

function safeStringify(value: unknown, maxLen: number): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") {
    return value.length > maxLen ? `${value.slice(0, maxLen)}...` : value;
  }

  try {
    const result = JSON.stringify(value, null, 2);
    return result.length > maxLen ? `${result.slice(0, maxLen)}...` : result;
  } catch {
    return String(value).slice(0, maxLen);
  }
}

function renderCodexTranscriptText(turns: TranscriptTurn[]): string {
  const parts: string[] = [];

  for (const turn of turns) {
    if (turn.user) {
      parts.push(`## User\n\n${turn.user}\n`);
    }

    if (turn.assistant) {
      parts.push(`## Assistant\n\n${turn.assistant}\n`);
    }

    for (const toolCall of turn.toolCalls) {
      parts.push(`## Tool: ${toolCall.name}\n\`\`\`json\n${toolCall.args}\n\`\`\`\n`);
      if (toolCall.output) {
        const outputDisplay = toolCall.output.length > 1500
          ? `${toolCall.output.slice(0, 1500)}\n... (truncated, ${toolCall.output.length} chars total)`
          : toolCall.output;
        parts.push(`### Output\n\`\`\`\n${outputDisplay}\n\`\`\`\n`);
      }
    }
  }

  return parts.join("\n");
}

export function parseCodexJsonlMetadata(lines: string[]): ParsedCodexSessionMetadata | null {
  let sessionId = "";
  let cwd: string | undefined;
  let startedAt: string | undefined;
  let firstMessage = "";
  let userMsgCount = 0;

  for (const line of lines) {
    if (!line.trim()) continue;

    let obj: any;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }

    if (obj.type === "session_meta") {
      const payload = obj.payload || {};
      sessionId = payload.id || "";
      cwd = payload.cwd;
      startedAt = payload.timestamp;
      continue;
    }

    if (obj.type !== "response_item") continue;

    const payload = obj.payload || {};
    if (payload.role !== "user") continue;

    const text = extractCodexTextContent(payload.content);
    if (!text) continue;

    userMsgCount++;
    if (!firstMessage && !isInternalCodexUserMessage(text)) {
      firstMessage = text.replace(/\n/g, " ").trim().slice(0, 120);
    }
  }

  if (!sessionId) return null;

  return {
    id: sessionId,
    cwd,
    firstMessage: firstMessage || "(no user message)",
    startedAt,
    turnCount: userMsgCount,
  };
}

export function parseCodexJsonlTranscript(
  lines: string[],
  fallbackSessionId: string,
  onWarning?: (message: string) => void,
): ParsedCodexTranscript {
  let sessionId = "";
  let cwd: string | undefined;
  const turns: TranscriptTurn[] = [];
  let currentTurn: TranscriptTurn = { toolCalls: [] };
  let entryCount = 0;

  let pendingToolCalls: { name: string; args: string; callId: string }[] = [];
  let pendingToolOutputs: Map<string, string> = new Map();

  function flushTurn() {
    if (currentTurn.user || currentTurn.assistant || currentTurn.toolCalls.length > 0) {
      for (const toolCall of pendingToolCalls) {
        const output = pendingToolOutputs.get(toolCall.callId);
        currentTurn.toolCalls.push({ name: toolCall.name, args: toolCall.args, output });
      }
      turns.push(currentTurn);
      currentTurn = { toolCalls: [] };
      pendingToolCalls = [];
      pendingToolOutputs = new Map();
    }
  }

  for (const line of lines) {
    if (!line.trim()) continue;

    let obj: any;
    try {
      obj = JSON.parse(line);
    } catch {
      onWarning?.("skipping unparseable line");
      continue;
    }

    if (obj.type === "session_meta") {
      sessionId = obj.payload?.id || "";
      cwd = obj.payload?.cwd;
      continue;
    }

    if (obj.type !== "response_item") continue;

    const payload = obj.payload || {};
    const role = payload.role;

    if (role === "user") {
      flushTurn();
      const text = extractCodexTextContent(payload.content);
      if (text) {
        currentTurn.user = text;
        entryCount++;
      }
    } else if (role === "assistant") {
      if (currentTurn.assistant) flushTurn();
      const text = extractCodexTextContent(payload.content);
      if (text) {
        currentTurn.assistant = text;
        entryCount++;
      }
    } else if (!role) {
      if (payload.type === "function_call") {
        const name = payload.name || "tool";
        const args = typeof payload.arguments === "string"
          ? payload.arguments
          : safeStringify(payload.arguments, 300);
        pendingToolCalls.push({ name, args, callId: payload.call_id || "" });
        entryCount++;
      } else if (payload.type === "function_call_output") {
        const output = String(payload.output || "");
        pendingToolOutputs.set(payload.call_id || "", output);
        entryCount++;
      }
    }
  }
  flushTurn();

  return {
    agent: "codex",
    sessionId: sessionId || fallbackSessionId,
    cwd,
    turns,
    fullText: renderCodexTranscriptText(turns),
    entryCount,
  };
}

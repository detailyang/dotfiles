export type ReviewStreamEvent =
  | { type: "assistant"; text: string }
  | { type: "status"; text: string };

const MAX_ASSISTANT_TEXT_CHARS = 2_000_000;
const TRUNCATED_MARKER = "\n\n[review output truncated by extension safety limit]";

function compactOneLine(text: string, maxWidth = 120): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxWidth) return oneLine;
  return `${oneLine.slice(0, maxWidth - 1)}…`;
}

function limitText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}${TRUNCATED_MARKER}`;
}

function extractTextContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  const parts: string[] = [];
  for (const item of content) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const block = item as { type?: unknown; text?: unknown };
    if (block.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    }
  }

  return parts.join("\n").trim();
}

function extractMessageText(message: { content?: unknown }): string {
  return extractTextContent(message.content);
}

function extractDisplayToolText(value: unknown): string {
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

function summarizeToolActivity(toolName: string, args: any): string {
  if (toolName === "bash") {
    const command = typeof args?.command === "string" ? args.command : "";
    return command ? `running: ${compactOneLine(command)}` : "running command";
  }

  if (toolName === "read") {
    const file =
      typeof args?.path === "string"
        ? args.path
        : typeof args?.filePath === "string"
        ? args.filePath
        : "";
    return file ? `reading ${compactOneLine(file)}` : "reading file";
  }

  if (toolName === "grep") {
    const pattern =
      typeof args?.pattern === "string"
        ? args.pattern
        : typeof args?.query === "string"
        ? args.query
        : "";
    return pattern ? `searching ${compactOneLine(pattern)}` : "searching";
  }

  if (toolName === "find" || toolName === "ls") {
    const path = typeof args?.path === "string" ? args.path : "";
    return path ? `${toolName} ${compactOneLine(path)}` : toolName;
  }

  return toolName;
}

export function parseReviewStreamLine(line: string): ReviewStreamEvent | null {
  if (!line.trim()) return null;

  let event: any;
  try {
    event = JSON.parse(line);
  } catch {
    return { type: "status", text: compactOneLine(line) };
  }

  if (
    (event.type === "message_update" || event.type === "message_end") &&
    event.message?.role === "assistant"
  ) {
    const text = limitText(extractMessageText(event.message), MAX_ASSISTANT_TEXT_CHARS);
    return text ? { type: "assistant", text } : null;
  }

  if (event.type === "tool_execution_start") {
    return { type: "status", text: summarizeToolActivity(event.toolName, event.args) };
  }

  if (event.type === "tool_execution_update") {
    const text = extractDisplayToolText(event.partialResult);
    return event.isError && text ? { type: "status", text } : null;
  }

  if (event.type === "tool_execution_end") {
    return event.isError ? { type: "status", text: `${event.toolName ?? "tool"} failed` } : null;
  }

  return null;
}

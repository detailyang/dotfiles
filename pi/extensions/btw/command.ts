export type SessionThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

export type BtwModelRef = {
  provider: string;
  id: string;
  api: string;
};

export type ParsedBtwArgs = {
  question: string;
  save: boolean;
};

export type ParsedBtwModelArgs =
  | { action: "show" }
  | { action: "clear" }
  | { action: "set"; model: BtwModelRef }
  | { action: "invalid"; message: string };

export type ParsedBtwThinkingArgs =
  | { action: "show" }
  | { action: "clear" }
  | { action: "set"; thinkingLevel: SessionThinkingLevel }
  | { action: "invalid"; message: string };

export type ParsedOverlayBtwCommand = {
  name: string;
  args: string;
};

export const VALID_BTW_THINKING_LEVELS: readonly SessionThinkingLevel[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
];

export function parseBtwArgs(args: string): ParsedBtwArgs {
  const save = /(?:^|\s)(?:--save|-s)(?=\s|$)/.test(args);
  const question = args.replace(/(?:^|\s)(?:--save|-s)(?=\s|$)/g, " ").trim();
  return { question, save };
}

export function parseBtwModelArgs(args: string): ParsedBtwModelArgs {
  const trimmed = args.trim();
  if (!trimmed) {
    return { action: "show" };
  }

  if (trimmed === "clear") {
    return { action: "clear" };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length !== 3) {
    return { action: "invalid", message: "Usage: /btw:model <provider> <model> <api> | clear" };
  }

  const [provider, id, api] = parts;
  return { action: "set", model: { provider, id, api } };
}

function isValidThinkingLevel(value: string): value is SessionThinkingLevel {
  return (VALID_BTW_THINKING_LEVELS as readonly string[]).includes(value);
}

export function parseBtwThinkingArgs(args: string): ParsedBtwThinkingArgs {
  const trimmed = args.trim();
  if (!trimmed) {
    return { action: "show" };
  }

  if (trimmed === "clear") {
    return { action: "clear" };
  }

  if (!isValidThinkingLevel(trimmed)) {
    return { action: "invalid", message: `Invalid thinking level "${trimmed}". Valid values: ${VALID_BTW_THINKING_LEVELS.join(", ")}.` };
  }

  return { action: "set", thinkingLevel: trimmed };
}

export function parseOverlayBtwCommand(value: string): ParsedOverlayBtwCommand | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^\/(btw:(?:new|tangent|clear|inject|summarize|model|thinking))(?:\s+(.*))?$/);
  if (!match) {
    return null;
  }

  return {
    name: match[1],
    args: match[2]?.trim() ?? "",
  };
}

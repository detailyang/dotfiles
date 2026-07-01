import type { SessionThinkingLevel } from "./command.js";

type MessageWithRole = {
  role: string;
};

type AssistantResponseLike<TUsage = unknown> = {
  content?: unknown;
  usage?: TUsage;
  stopReason?: string;
  errorMessage?: string;
};

export type BtwRunModel = {
  provider: string;
  id: string;
  api: string;
};

export type BtwAuthResult = {
  ok: boolean;
  apiKey?: unknown;
  error?: string;
};

export type BtwRunDetails<TUsage = unknown> = {
  question: string;
  thinking: string;
  answer: string;
  provider: string;
  model: string;
  api: string;
  thinkingLevel: SessionThinkingLevel;
  timestamp: number;
  usage?: TUsage;
};

export function getLastAssistantMessage<TMessage extends MessageWithRole>(messages: TMessage[]): TMessage | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role === "assistant") {
      return message;
    }
  }

  return null;
}

export function getBtwAuthFailureMessage(model: BtwRunModel, auth: BtwAuthResult): string | null {
  if (auth.ok && auth.apiKey) {
    return null;
  }

  return auth.ok
    ? `No credentials available for ${model.provider}/${model.id}.`
    : (auth.error ?? `Authentication failed for ${model.provider}/${model.id}.`);
}

export function buildBtwDetailsFromResponse<TResponse extends AssistantResponseLike>({
  question,
  model,
  thinkingLevel,
  response,
  streamedThinking,
  extractAnswer,
  extractThinking,
  timestamp,
}: {
  question: string;
  model: BtwRunModel;
  thinkingLevel: SessionThinkingLevel;
  response: TResponse;
  streamedThinking: string;
  extractAnswer: (response: TResponse) => string;
  extractThinking: (response: TResponse) => string;
  timestamp: number;
}): BtwRunDetails<TResponse["usage"]> {
  return {
    question,
    thinking: extractThinking(response) || streamedThinking || "",
    answer: extractAnswer(response),
    provider: model.provider,
    model: model.id,
    api: model.api,
    thinkingLevel,
    timestamp,
    usage: response.usage,
  };
}

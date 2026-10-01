import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Error codes from Basis Points that represent transient upstream failures. */
export const DEFAULT_RETRY_ERROR_CODES = [
  "basispoints_protocol_error",
  "basispoints_upstream_error",
  "basispoints_stream_incomplete",
  "server_is_overloaded",
] as const;

// pi-ai's native classifier already retries messages containing "overloaded" or
// "server error". Keep the compatibility hint only for codes it does not know.
const NATIVE_RETRYABLE_ERROR = /\boverloaded\b|server.?error/i;
// Erase the compatibility hint after the terminal consumes it, so it does not
// appear in the final error while still reaching pi-ai's classifier.
const NATIVE_RETRY_HINT = "server error\u001b[12D\u001b[K";

export function hasRetryableErrorCode(
  errorMessage: string | undefined,
  errorCodes: readonly string[] = DEFAULT_RETRY_ERROR_CODES,
): boolean {
  if (!errorMessage) return false;
  return errorCodes.some((code) => {
    const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[^A-Za-z0-9_])${escapedCode}(?:$|[^A-Za-z0-9_])`, "i").test(errorMessage);
  });
}

export function markForNativeRetry(message: AgentMessage): AgentMessage | undefined {
  if (message.role !== "assistant" || message.stopReason !== "error") return undefined;
  if (!hasRetryableErrorCode(message.errorMessage)) return undefined;
  if (NATIVE_RETRYABLE_ERROR.test(message.errorMessage ?? "")) return { ...message };

  return {
    ...message,
    errorMessage: `${message.errorMessage}${NATIVE_RETRY_HINT}`,
  };
}

export default function (pi: ExtensionAPI) {
  pi.on("message_end", (event) => {
    const message = markForNativeRetry(event.message);
    return message ? { message } : undefined;
  });
}

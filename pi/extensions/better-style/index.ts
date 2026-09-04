import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { config, getCompactThinkingConfig } from "./config/config.ts";
import agentSummary from "./feature/agent-summary/index.ts";
import { installCompactThinking } from "./feature/compact-thinking.ts";
import betterStyle from "./renderer/index.ts";
import markdownEnhance from "./renderer/markdown-enhance.ts";

export default function (pi: ExtensionAPI): void {
  markdownEnhance(pi);
  const compactThinking = installCompactThinking(pi, getCompactThinkingConfig(config));
  betterStyle(pi, undefined, compactThinking);
  agentSummary(pi);
}

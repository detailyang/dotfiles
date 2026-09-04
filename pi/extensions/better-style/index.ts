import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { installCompactThinking } from "pi-cc-extensions/extensions/feature/compact-thinking.ts";
import markdownEnhance from "pi-cc-extensions/extensions/renderer/markdown-enhance.ts";
import { getCompactThinkingConfig } from "./config.ts";
import installBetterStyleRenderer from "./renderer.ts";
import installAgentSummary from "./status/agent-summary.ts";
import installWorkingMessage from "./status/working-message.ts";

/**
 * Keyboard-first presentation layer for Pi.
 *
 * Intentionally not installed from upstream:
 * - /context
 * - session and subagent references
 * - /clear and /exit aliases
 * - startup header and fullscreen bash patches
 * - fullscreen mouse click, hover, scroll, or terminal-input interception
 */
export default function betterStyle(pi: ExtensionAPI): void {
	markdownEnhance(pi);
	installWorkingMessage(pi);
	installAgentSummary(pi);
	const compactThinking = installCompactThinking(pi, getCompactThinkingConfig());
	installBetterStyleRenderer(pi, compactThinking);
}

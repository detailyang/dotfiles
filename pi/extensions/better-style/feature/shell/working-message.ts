import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { formatDuration } from "../../utils/format.ts";
import { config } from "../../config/config.ts";

const REFRESH_INTERVAL_MS = 1_000;
/** Elapsed time is only shown once the turn has run this long. */
const SHOW_TIMER_AFTER_MS = 3_000;

function formatCount(value: number): string {
	return new Intl.NumberFormat("en-US").format(value);
}

type ContentBlock = {
	type?: unknown;
	text?: unknown;
	thinkingSignature?: { body?: unknown };
};

type StreamMessage = {
	content?: unknown;
	usage?: { output?: unknown };
};

/** 每个 content index 的可见文本/思考长度；无对应块的 index 保持稀疏洞。 */
function textBlockLengths(message: StreamMessage): number[] {
	const content = message.content;
	if (!Array.isArray(content)) return [];
	const lengths: number[] = [];
	for (let index = 0; index < content.length; index++) {
		const block = content[index] as ContentBlock;
		if (block?.type === "text" && typeof block.text === "string") {
			lengths[index] = block.text.length;
		} else if (block?.type === "thinking" && block.thinkingSignature?.body) {
			lengths[index] = (block.thinkingSignature.body as string).length;
		}
	}
	return lengths;
}

function outputUsage(message: StreamMessage): number {
	const value = Number(message?.usage?.output);
	return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

type WorkingUi = {
	setWorkingMessage(message?: string): void;
};

/**
 * Extend Pi's footer working row while preserving its spinner and "Working...":
 * `⠋ Working... (↓ 1,234 tokens · 12s)`
 *
 * Live tokens use the same chars/4 estimate as pi-claude-code-ui, then switch to
 * provider `usage.output` whenever the stream exposes an actual count.
 */
export default function (pi: ExtensionAPI): void {
	let turnActive = false;
	let agentStartTime = 0;
	let turnStartTime = 0;
	let responseLength = 0;
	let responseTextBlockLengths: number[] = [];
	let providerOutputTokens = 0;
	let refreshTimer: ReturnType<typeof setTimeout> | null = null;
	let lastMessage: string | null = null;
	let activeCtx: { ui: WorkingUi | undefined; hasUI: boolean } | null = null;

	function tokenCount(): number {
		return providerOutputTokens || Math.max(0, Math.round(responseLength / 4));
	}

	function setTextBlockLength(index: number, length: number): void {
		const previous = responseTextBlockLengths[index] ?? 0;
		responseTextBlockLengths[index] = Math.max(0, length);
		responseLength = Math.max(0, responseLength + responseTextBlockLengths[index] - previous);
	}

	function resetResponseTracking(message?: StreamMessage): void {
		responseTextBlockLengths = message ? textBlockLengths(message) : [];
		responseLength = responseTextBlockLengths.reduce((sum, length) => sum + length, 0);
		providerOutputTokens = message ? outputUsage(message) : 0;
	}

	function updateProviderUsage(message: StreamMessage): void {
		const output = outputUsage(message);
		if (output > 0) providerOutputTokens = output;
	}

	function buildWorkingMessage(): string {
		const elapsed = Date.now() - (agentStartTime || turnStartTime);
		const tokens = tokenCount();
		const parts: string[] = [];
		if (tokens > 0) parts.push(`↓ ${formatCount(tokens)} tokens`);
		if (elapsed >= SHOW_TIMER_AFTER_MS || tokens > 0) {
			// formatDuration 低于 1 秒返回 ""，此处回退 "0s" 保持计时器连续跳动。
			parts.push(formatDuration(elapsed) || "0s");
		}
		return parts.length ? `Working... (${parts.join(" · ")})` : "";
	}

	function restoreDefaultWorkingMessage(): void {
		lastMessage = null;
		if (!activeCtx?.hasUI) return;
		try {
			activeCtx.ui?.setWorkingMessage();
		} catch {
			// Noop when the TUI is unavailable.
		}
	}

	function syncWorkingMessage(force = false): void {
		if (!config.enableWorkingMessage) {
			restoreDefaultWorkingMessage();
			return;
		}
		if (!activeCtx?.hasUI) return;
		const next = buildWorkingMessage();
		if (!next) {
			if (force) restoreDefaultWorkingMessage();
			return;
		}
		if (!force && next === lastMessage) return;
		lastMessage = next;
		try {
			activeCtx.ui?.setWorkingMessage(next);
		} catch {
			// Noop when the TUI is unavailable.
		}
	}

	function scheduleRefreshTick(): void {
		if (!turnActive || refreshTimer) return;
		refreshTimer = setTimeout(() => {
			refreshTimer = null;
			try {
				syncWorkingMessage();
			} finally {
				scheduleRefreshTick();
			}
		}, REFRESH_INTERVAL_MS);
		refreshTimer.unref?.();
	}

	function stopRefreshLoop(): void {
		if (!refreshTimer) return;
		clearTimeout(refreshTimer);
		refreshTimer = null;
	}

	function clearDisplay(): void {
		stopRefreshLoop();
		agentStartTime = 0;
		turnStartTime = 0;
		resetResponseTracking();
		restoreDefaultWorkingMessage();
	}

	pi.on("before_agent_start", async () => {
		if (!agentStartTime) agentStartTime = Date.now();
	});

	pi.on("turn_start", async (_event, ctx) => {
		turnActive = true;
		activeCtx = ctx;
		turnStartTime = Date.now();
		if (!agentStartTime) agentStartTime = turnStartTime;
		resetResponseTracking();
		syncWorkingMessage(true);
		scheduleRefreshTick();
	});

	pi.on("message_update", async (event, ctx) => {
		activeCtx = ctx;
		const evt = event?.assistantMessageEvent;
		if (!evt) return;

		if (evt.type === "start") {
			resetResponseTracking(evt.partial);
		} else if (evt.type === "thinking_start" || evt.type === "text_start") {
			setTextBlockLength(evt.contentIndex, 0);
			updateProviderUsage(evt.partial);
		} else if (evt.type === "thinking_delta" || evt.type === "text_delta") {
			const add = typeof evt.delta === "string" ? evt.delta.length : 0;
			setTextBlockLength(evt.contentIndex, (responseTextBlockLengths[evt.contentIndex] ?? 0) + add);
			updateProviderUsage(evt.partial);
		} else if (evt.type === "text_end") {
			setTextBlockLength(
				evt.contentIndex,
				typeof evt.content === "string" ? evt.content.length : 0,
			);
			updateProviderUsage(evt.partial);
		} else if (evt.type === "done") {
			resetResponseTracking(evt.message);
		} else if (evt.type === "error") {
			resetResponseTracking(evt.error);
		} else {
			updateProviderUsage(evt.partial);
		}

		syncWorkingMessage();
		scheduleRefreshTick();
	});

	pi.on("turn_end", async (_event, ctx) => {
		turnActive = false;
		activeCtx = ctx;
		stopRefreshLoop();
		resetResponseTracking();
		// No completion message: return immediately to Pi's default idle state.
		restoreDefaultWorkingMessage();
	});

	pi.on("agent_end", async () => {
		turnActive = false;
		clearDisplay();
	});

	pi.on("session_shutdown", async () => {
		turnActive = false;
		clearDisplay();
		activeCtx = null;
	});
}

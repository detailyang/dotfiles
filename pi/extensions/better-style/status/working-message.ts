import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { config } from "../config.ts";

const REFRESH_INTERVAL_MS = 1_000;
const SHOW_TIMER_AFTER_MS = 3_000;

type ContentBlock = {
	type?: unknown;
	text?: unknown;
	thinkingSignature?: { body?: unknown };
};

type StreamMessage = {
	content?: unknown;
	usage?: { output?: unknown };
};

type WorkingUi = {
	setWorkingMessage(message?: string): void;
};

function formatDuration(ms: number): string {
	const seconds = Math.floor(ms / 1_000);
	if (seconds < 1) return "";
	const hours = Math.floor(seconds / 3_600);
	const minutes = Math.floor((seconds % 3_600) / 60);
	const remainder = seconds % 60;
	if (hours) return `${hours}h ${minutes}m ${remainder}s`;
	if (minutes) return `${minutes}m ${remainder}s`;
	return `${seconds}s`;
}

function outputUsage(message: StreamMessage): number {
	const value = Number(message?.usage?.output);
	return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function textBlockLengths(message: StreamMessage): number[] {
	if (!Array.isArray(message.content)) return [];
	const lengths: number[] = [];
	for (let index = 0; index < message.content.length; index++) {
		const block = message.content[index] as ContentBlock;
		if (block?.type === "text" && typeof block.text === "string") {
			lengths[index] = block.text.length;
		} else if (block?.type === "thinking" && typeof block.thinkingSignature?.body === "string") {
			lengths[index] = block.thinkingSignature.body.length;
		}
	}
	return lengths;
}

export default function installWorkingMessage(pi: ExtensionAPI): void {
	let turnActive = false;
	let agentStartedAt = 0;
	let turnStartedAt = 0;
	let responseLength = 0;
	let blockLengths: number[] = [];
	let exactOutputTokens = 0;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let lastMessage: string | null = null;
	let activeCtx: { ui?: WorkingUi; hasUI: boolean } | null = null;

	function reset(message?: StreamMessage): void {
		blockLengths = message ? textBlockLengths(message) : [];
		responseLength = blockLengths.reduce((sum, length) => sum + length, 0);
		exactOutputTokens = message ? outputUsage(message) : 0;
	}

	function updateExactUsage(message?: StreamMessage): void {
		if (!message) return;
		const output = outputUsage(message);
		if (output > 0) exactOutputTokens = output;
	}

	function setBlockLength(index: number, length: number): void {
		const previous = blockLengths[index] ?? 0;
		blockLengths[index] = Math.max(0, length);
		responseLength = Math.max(0, responseLength + blockLengths[index] - previous);
	}

	function restoreDefault(): void {
		lastMessage = null;
		if (!activeCtx?.hasUI) return;
		try {
			activeCtx.ui?.setWorkingMessage();
		} catch {
			// The TUI may already be shutting down.
		}
	}

	function currentMessage(): string {
		const elapsed = Date.now() - (agentStartedAt || turnStartedAt);
		const estimated = exactOutputTokens === 0;
		const tokens = exactOutputTokens || Math.max(0, Math.round(responseLength / 4));
		const parts: string[] = [];
		if (tokens > 0) {
			parts.push(`↓ ${estimated ? "~" : ""}${tokens.toLocaleString("en-US")} tokens`);
		}
		if (elapsed >= SHOW_TIMER_AFTER_MS || tokens > 0) parts.push(formatDuration(elapsed) || "0s");
		return parts.length ? `Working... (${parts.join(" · ")})` : "";
	}

	function sync(force = false): void {
		if (!config.enableWorkingMessage) {
			restoreDefault();
			return;
		}
		if (!activeCtx?.hasUI) return;
		const next = currentMessage();
		if (!next) {
			if (force) restoreDefault();
			return;
		}
		if (!force && next === lastMessage) return;
		lastMessage = next;
		try {
			activeCtx.ui?.setWorkingMessage(next);
		} catch {
			// The TUI may already be shutting down.
		}
	}

	function schedule(): void {
		if (!turnActive || timer) return;
		timer = setTimeout(() => {
			timer = null;
			sync();
			schedule();
		}, REFRESH_INTERVAL_MS);
		timer.unref?.();
	}

	function stop(): void {
		if (timer) clearTimeout(timer);
		timer = null;
	}

	function clear(): void {
		stop();
		agentStartedAt = 0;
		turnStartedAt = 0;
		reset();
		restoreDefault();
	}

	pi.on("before_agent_start", async () => {
		if (!agentStartedAt) agentStartedAt = Date.now();
	});

	pi.on("turn_start", async (_event, ctx) => {
		turnActive = true;
		activeCtx = ctx;
		turnStartedAt = Date.now();
		if (!agentStartedAt) agentStartedAt = turnStartedAt;
		reset();
		sync(true);
		schedule();
	});

	pi.on("message_update", async (event, ctx) => {
		activeCtx = ctx;
		const update = event?.assistantMessageEvent;
		if (!update) return;
		if (update.type === "start") reset(update.partial);
		else if (update.type === "thinking_start" || update.type === "text_start") {
			setBlockLength(update.contentIndex, 0);
			updateExactUsage(update.partial);
		} else if (update.type === "thinking_delta" || update.type === "text_delta") {
			const delta = typeof update.delta === "string" ? update.delta.length : 0;
			setBlockLength(update.contentIndex, (blockLengths[update.contentIndex] ?? 0) + delta);
			updateExactUsage(update.partial);
		} else if (update.type === "text_end") {
			setBlockLength(update.contentIndex, typeof update.content === "string" ? update.content.length : 0);
			updateExactUsage(update.partial);
		} else if (update.type === "done") reset(update.message);
		else if (update.type === "error") reset(update.error);
		else updateExactUsage(update.partial);
		sync();
		schedule();
	});

	pi.on("turn_end", async (_event, ctx) => {
		turnActive = false;
		activeCtx = ctx;
		stop();
		reset();
		restoreDefault();
	});

	pi.on("agent_end", async () => {
		turnActive = false;
		clear();
	});

	pi.on("session_shutdown", async () => {
		turnActive = false;
		clear();
		activeCtx = null;
	});
}

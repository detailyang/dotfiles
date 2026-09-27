export type LoopMode = "tests" | "custom" | "self";

export type LoopStateData = {
	active: boolean;
	mode?: LoopMode;
	condition?: string;
	prompt?: string;
	summary?: string;
	loopCount?: number;
	blockedReason?: string;
};

const BLOCKED_INSTRUCTIONS = "Complete any remaining actionable work first. If satisfying the condition requires user input, permissions, manual action, or no defensible autonomous path remains, call signal_loop_blocked with a reason containing the evidence gathered, attempted paths, the blocker, and the next input or action needed. Then hand off and wait for the user instead of repeating the same request. Do not call signal_loop_success or weaken the condition just to stop: blocked is not completed. Restart only on explicit user instructions.";

export function parseStoredLoopState(value: unknown): LoopStateData {
	if (!value || typeof value !== "object") return { active: false };
	const state = value as Partial<LoopStateData>;
	const blockedReason = typeof state.blockedReason === "string" ? state.blockedReason.trim() : "";
	if (state.active !== true && !(state.active === false && blockedReason)) return { active: false };
	if (!state.mode || !["tests", "self", "custom"].includes(state.mode) ||
		(state.mode === "custom" && (typeof state.condition !== "string" || !state.condition.trim())) ||
		(state.loopCount !== undefined && (!Number.isSafeInteger(state.loopCount) || state.loopCount < 0)) ||
		(state.summary !== undefined && typeof state.summary !== "string")) return { active: false };
	return {
		active: state.active === true, mode: state.mode,
		...(state.active === false ? { blockedReason } : {}),
		...(state.mode === "custom" ? { condition: state.condition!.trim() } : {}),
		prompt: buildLoopPrompt(state.mode, state.condition),
		summary: state.summary ?? summarizeLoopCondition(state.mode, state.condition),
		loopCount: state.loopCount ?? 0,
	};
}

export function buildLoopPrompt(mode: LoopMode, condition?: string): string {
	let prompt: string;
	switch (mode) {
		case "tests":
			prompt =
				"Run all tests. If they are passing, call the signal_loop_success tool. " +
				"Otherwise continue until the tests pass.";
			break;
		case "custom": {
			const customCondition = condition?.trim() || "the custom condition is satisfied";
			prompt =
				`Continue until the following condition is satisfied: ${customCondition}. ` +
				"When it is satisfied, call the signal_loop_success tool.";
			break;
		}
		case "self":
			prompt = "Continue until you are done. When finished, call the signal_loop_success tool.";
			break;
	}
	return `${prompt}\n\n${BLOCKED_INSTRUCTIONS}`;
}

export function summarizeLoopCondition(mode: LoopMode, condition?: string): string {
	switch (mode) {
		case "tests":
			return "tests pass";
		case "custom": {
			const summary = condition?.trim() || "custom condition";
			return summary.length > 48 ? `${summary.slice(0, 45)}...` : summary;
		}
		case "self":
			return "done";
	}
}

export function getLoopConditionText(mode: LoopMode, condition?: string): string {
	switch (mode) {
		case "tests":
			return "tests pass";
		case "custom":
			return condition?.trim() || "custom condition";
		case "self":
			return "you are done";
	}
}

export function buildLoopCompactionInstructions(mode: LoopMode, condition?: string): string {
	const conditionText = getLoopConditionText(mode, condition);
	return `Loop active. Breakout condition: ${conditionText}. Preserve this loop state and breakout condition in the summary.\n\n${BLOCKED_INSTRUCTIONS}`;
}

export function parseLoopArgs(args: string | undefined): LoopStateData | null {
	if (!args?.trim()) return null;
	const parts = args.trim().split(/\s+/);
	const mode = parts[0]?.toLowerCase();

	switch (mode) {
		case "tests":
			return { active: true, mode: "tests", prompt: buildLoopPrompt("tests") };
		case "self":
			return { active: true, mode: "self", prompt: buildLoopPrompt("self") };
		case "custom": {
			const condition = parts.slice(1).join(" ").trim();
			if (!condition) return null;
			return {
				active: true,
				mode: "custom",
				condition,
				prompt: buildLoopPrompt("custom", condition),
			};
		}
		default:
			return null;
	}
}

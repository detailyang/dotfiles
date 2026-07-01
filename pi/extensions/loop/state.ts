export type LoopMode = "tests" | "custom" | "self";

export type LoopStateData = {
	active: boolean;
	mode?: LoopMode;
	condition?: string;
	prompt?: string;
	summary?: string;
	loopCount?: number;
};

export function buildLoopPrompt(mode: LoopMode, condition?: string): string {
	switch (mode) {
		case "tests":
			return (
				"Run all tests. If they are passing, call the signal_loop_success tool. " +
				"Otherwise continue until the tests pass."
			);
		case "custom": {
			const customCondition = condition?.trim() || "the custom condition is satisfied";
			return (
				`Continue until the following condition is satisfied: ${customCondition}. ` +
				"When it is satisfied, call the signal_loop_success tool."
			);
		}
		case "self":
			return "Continue until you are done. When finished, call the signal_loop_success tool.";
	}
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
	return `Loop active. Breakout condition: ${conditionText}. Preserve this loop state and breakout condition in the summary.`;
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

export type GoalStatus = "active" | "paused" | "blocked" | "budget_limited" | "complete";

export type GoalState = {
	version: 1;
	id: string;
	objective: string;
	status: GoalStatus;
	tokenBudget: number | null;
	tokensUsed: number;
	timeUsedSeconds: number;
	createdAt: number;
	updatedAt: number;
	reason?: string;
};

export type GoalEventKind = "active" | "continuation" | "paused" | "blocked" | "resumed" | "cleared" | "budget_limited" | "complete";

export function parseTokenBudget(input: string): { objective: string; tokenBudget: number | null; error?: string } {
	const flags = [...input.matchAll(/(?:^|\s)--tokens(?==|\s|$)/g)];
	if (flags.length === 0) return { objective: input.trim(), tokenBudget: null };
	const invalid = (error: string) => ({ objective: input.trim(), tokenBudget: null, error });
	if (flags.length > 1) return invalid("Specify --tokens only once.");

	const flag = flags[0];
	const start = flag.index! + flag[0].indexOf("--tokens");
	const valueStart = start + "--tokens".length;
	const match = input.slice(valueStart).match(/^(?:=|\s+)(\S+)(?:\s+([kKmM])(?=\s|$))?/);
	if (!match) return invalid("--tokens requires a positive token budget.");
	const raw = match[1] + (match[2] ?? "");
	const number = raw.match(/^(\+?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)([kKmM]?)$/);
	if (!number) return invalid("Invalid token budget. Use a number with an optional k or m suffix.");
	const suffix = number[2].toLowerCase();
	const multiplier = suffix === "m" ? 1_000_000 : suffix === "k" ? 1_000 : 1;
	const parsed = normalizeTokenBudget(Number(number[1]) * multiplier);
	if (parsed.error) return invalid(parsed.error);
	const objective = (input.slice(0, start).trimEnd() + " " + input.slice(valueStart + match[0].length).trimStart()).trim();
	return { objective, tokenBudget: parsed.tokenBudget };
}

export function normalizeTokenBudget(value: unknown): { tokenBudget: number | null; error?: string } {
	if (value == null) return { tokenBudget: null };
	const tokenBudget = typeof value === "number" ? Math.round(value) : NaN;
	if (!Number.isSafeInteger(tokenBudget) || tokenBudget <= 0) {
		return { tokenBudget: null, error: "Token budget must round to a positive safe integer." };
	}
	return { tokenBudget };
}

export function isGoalState(value: unknown): value is GoalState {
	if (!value || typeof value !== "object") return false;
	const state = value as GoalState;
	return state.version === 1
		&& typeof state.id === "string" && state.id.length > 0
		&& typeof state.objective === "string" && state.objective.trim().length > 0
		&& ["active", "paused", "blocked", "budget_limited", "complete"].includes(state.status)
		&& (state.tokenBudget === null || (Number.isSafeInteger(state.tokenBudget) && state.tokenBudget > 0))
		&& [state.tokensUsed, state.timeUsedSeconds, state.createdAt, state.updatedAt]
			.every((number) => Number.isSafeInteger(number) && number >= 0)
		&& (state.reason === undefined || typeof state.reason === "string");
}

export function goalBudgetReached(state: GoalState): boolean {
	return state.tokenBudget !== null && state.tokensUsed >= state.tokenBudget;
}

export function formatTokens(value: number): string {
	if (value >= 1_000_000) return `${Math.round(value / 100_000) / 10}M`;
	if (value >= 1_000) return `${Math.round(value / 100) / 10}K`;
	return String(value);
}

export function formatElapsed(seconds: number): string {
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	const remMinutes = minutes % 60;
	return remMinutes ? `${hours}h ${remMinutes}m` : `${hours}h`;
}

export function statusLine(state: GoalState | null): string | undefined {
	if (!state) return undefined;
	const budget = state.tokenBudget ? ` (${formatTokens(state.tokensUsed)} / ${formatTokens(state.tokenBudget)})` : ` (${formatElapsed(state.timeUsedSeconds)})`;
	if (state.status === "active") return `Pursuing goal${budget}`;
	if (state.status === "paused") return "Goal paused (/goal resume)";
	if (state.status === "blocked") return "Goal blocked (/goal resume)";
	if (state.status === "budget_limited") return state.tokenBudget ? `Goal unmet${budget}` : "Goal abandoned";
	return `Goal achieved${budget}`;
}

export function goalUsage(state: GoalState): string {
	if (state.tokenBudget != null) return `${formatTokens(state.tokensUsed)} / ${formatTokens(state.tokenBudget)} tokens`;
	return formatElapsed(state.timeUsedSeconds);
}

export function truncateObjective(objective: string, max = 96): string {
	const singleLine = objective.replace(/\s+/g, " ").trim();
	return singleLine.length > max ? `${singleLine.slice(0, Math.max(0, max - 3))}...`.slice(0, max) : singleLine;
}

export function goalEventStatus(kind: GoalEventKind): string {
	const labels: Record<GoalEventKind, string> = {
		active: "active",
		continuation: "continuing",
		paused: "paused",
		blocked: "blocked",
		resumed: "resumed",
		cleared: "cleared",
		budget_limited: "budget reached",
		complete: "achieved",
	};
	return labels[kind];
}

export function createGoalState(objective: string, tokenBudget: number | null, now = Date.now(), random = Math.random()): GoalState {
	return {
		version: 1,
		id: `${now}-${random.toString(16).slice(2)}`,
		objective,
		status: "active",
		tokenBudget,
		tokensUsed: 0,
		timeUsedSeconds: 0,
		createdAt: now,
		updatedAt: now,
	};
}

export function accountGoalTurn(state: GoalState, tokenDelta: number, elapsedSeconds: number, now = Date.now()): GoalState {
	const addUsage = (used: number, delta: number) => Math.min(Number.MAX_SAFE_INTEGER,
		used + (Number.isFinite(delta) ? Math.max(0, Math.round(delta)) : 0));
	let next: GoalState = {
		...state,
		tokensUsed: addUsage(state.tokensUsed, tokenDelta),
		timeUsedSeconds: addUsage(state.timeUsedSeconds, elapsedSeconds),
		updatedAt: now,
	};
	if (next.status === "active" && goalBudgetReached(next)) {
		next = { ...next, status: "budget_limited" };
	}
	return next;
}

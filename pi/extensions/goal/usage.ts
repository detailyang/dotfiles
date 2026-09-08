export type UsageSnapshot = {
	totalTokens?: number;
	input?: number;
	output?: number;
	cacheRead?: number;
	cacheWrite?: number;
} | null | undefined;

export function tokenDeltaFromUsage(usage: UsageSnapshot): number {
	if (!usage) return 0;
	if (typeof usage.totalTokens === "number" && Number.isFinite(usage.totalTokens) && usage.totalTokens >= 0) {
		return Math.min(Number.MAX_SAFE_INTEGER, Math.round(usage.totalTokens));
	}
	const total = [usage.input, usage.output, usage.cacheRead, usage.cacheWrite]
		.reduce<number>((sum, value) => sum + (typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0), 0);
	return Math.min(Number.MAX_SAFE_INTEGER, total);
}

/**
 * Unified Review Extension
 *
 * Provides one `/review` command for plan and code reviews.
 * Code review supports multiple review modes:
 * - Review a GitHub pull request (checks out the PR locally)
 * - Review against a base branch (PR style)
 * - Review uncommitted changes
 * - Review a specific commit
 * - Shared custom review instructions (applied to all review modes when configured)
 *
 * Usage:
 * - `/review` - choose Plan or Code, then select reviewer models
 * - `/review plan` - review the current plan/conversation
 * - `/review code` - show code review selector
 * - `/review pr 123` - review PR #123 (checks out locally)
 * - `/review pr https://github.com/owner/repo/pull/123` - review PR from URL
 * - `/review uncommitted` - review uncommitted changes directly
 * - `/review branch main` - review against main branch
 * - `/review commit abc123` - review specific commit
 * - `/review folder src docs` - review specific folders/files (snapshot, not diff)
 * - `/review` selector includes Add/Remove custom review instructions (applies to all modes)
 * - `/review --extra "focus on performance regressions"` - add extra review instruction (works with any mode)
 *
 * Project-specific review guidelines:
 * - If a REVIEW_GUIDELINES.md file exists in the same directory as .pi,
 *   its contents are appended to the review prompt.
 *
 * Note: PR review requires a clean working tree (no uncommitted changes to tracked files).
 */

import type { ExtensionAPI, ExtensionContext, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { DynamicBorder, BorderedLoader } from "@earendil-works/pi-coding-agent";
import {
	Container,
	fuzzyFilter,
	Input,
	type SelectItem,
	SelectList,
	Spacer,
	Text,
} from "@earendil-works/pi-tui";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
	type ParallelReviewResult,
	formatParallelReviewResults,
	runParallelReviewDashboard,
	runPlanReview,
	selectReviewerModels,
} from "./parallel.js";
import {
	checkoutPr,
	getCurrentBranch,
	getDefaultBranch,
	getLocalBranches,
	getMergeBase,
	getPrInfo,
	getRecentCommits,
	hasPendingChanges,
	hasUncommittedChanges,
} from "./git.js";
import { validateReviewPaths } from "./path.js";
import {
	isLoopCompatibleReviewTarget,
	getReviewTargetHint,
	parsePrReference,
	parseReviewArgs,
	parseReviewInvocation,
	parseReviewPaths,
	renderReviewTargetPrompt,
	type ReviewTarget,
} from "./target.js";
import { hasBlockingReviewFindings } from "./findings.js";

// State to track fresh session review (where we branched from).
// Module-level state means only one review can be active at a time.
// This is intentional - the review finish UI assumes a single active review.
let reviewOriginId: string | undefined = undefined;
let endReviewInProgress = false;
let reviewLoopFixingEnabled = false;
let reviewCustomInstructions: string | undefined = undefined;
let reviewLoopInProgress = false;
let reviewActiveKind: "code" | "plan" = "code";

const REVIEW_STATE_TYPE = "review-session";
const REVIEW_ANCHOR_TYPE = "review-anchor";
const REVIEW_SETTINGS_TYPE = "review-settings";
const REVIEW_LOOP_MAX_ITERATIONS = 10;
const REVIEW_LOOP_START_TIMEOUT_MS = 15000;
const REVIEW_LOOP_START_POLL_MS = 50;

type ReviewSessionState = {
	active: boolean;
	originId?: string;
	kind?: "code" | "plan";
	autoFinish?: boolean;
};

type ReviewSettingsState = {
	loopFixingEnabled?: boolean;
	customInstructions?: string;
};

function setReviewWidget(ctx: ExtensionContext, active: boolean) {
	if (!ctx.hasUI) return;
	if (!active) {
		ctx.ui.setWidget("review", undefined);
		return;
	}

	ctx.ui.setWidget("review", (_tui, theme) => {
		const kindLabel = reviewActiveKind === "plan" ? "Plan review" : "Code review";
		const message = reviewLoopInProgress
			? `${kindLabel} active (loop fixing running)`
			: reviewLoopFixingEnabled
				? `${kindLabel} active (loop fixing enabled), finish menu will open automatically`
				: `${kindLabel} active, finish menu will open automatically`;
		const text = new Text(theme.fg("warning", message), 0, 0);
		return {
			render(width: number) {
				return text.render(width);
			},
			invalidate() {
				text.invalidate();
			},
		};
	});
}

function getReviewState(ctx: ExtensionContext): ReviewSessionState | undefined {
	let state: ReviewSessionState | undefined;
	for (const entry of ctx.sessionManager.getBranch()) {
		if (entry.type === "custom" && entry.customType === REVIEW_STATE_TYPE) {
			state = entry.data as ReviewSessionState | undefined;
		}
	}

	return state;
}

function applyReviewState(
	ctx: ExtensionContext,
	options: { clearAutoFinish?: boolean } = {},
): { clearedStaleAutoFinish: boolean } {
	const state = getReviewState(ctx);

	if (state?.active && options.clearAutoFinish && state.autoFinish !== false) {
		reviewOriginId = undefined;
		reviewActiveKind = "code";
		setReviewWidget(ctx, false);
		return { clearedStaleAutoFinish: true };
	}

	if (state?.active && state.originId) {
		reviewOriginId = state.originId;
		reviewActiveKind = state.kind ?? "code";
		setReviewWidget(ctx, true);
		return { clearedStaleAutoFinish: false };
	}

	reviewOriginId = undefined;
	reviewActiveKind = "code";
	setReviewWidget(ctx, false);
	return { clearedStaleAutoFinish: false };
}

function getReviewSettings(ctx: ExtensionContext): ReviewSettingsState {
	let state: ReviewSettingsState | undefined;
	for (const entry of ctx.sessionManager.getEntries()) {
		if (entry.type === "custom" && entry.customType === REVIEW_SETTINGS_TYPE) {
			state = entry.data as ReviewSettingsState | undefined;
		}
	}

	return {
		loopFixingEnabled: state?.loopFixingEnabled === true,
		customInstructions: state?.customInstructions?.trim() || undefined,
	};
}

function applyReviewSettings(ctx: ExtensionContext) {
	const state = getReviewSettings(ctx);
	reviewLoopFixingEnabled = state.loopFixingEnabled === true;
	reviewCustomInstructions = state.customInstructions?.trim() || undefined;
}

// The detailed review rubric (adapted from Codex's review_prompt.md)
const REVIEW_RUBRIC = `# Review Guidelines

You are acting as a code reviewer for a proposed code change made by another engineer.

Below are default guidelines for determining what to flag. These are not the final word — if you encounter more specific guidelines elsewhere (in a developer message, user message, file, or project review guidelines appended below), those override these general instructions.

## Determining what to flag

Flag issues that:
1. Meaningfully impact the accuracy, performance, security, or maintainability of the code.
2. Are discrete and actionable (not general issues or multiple combined issues).
3. Don't demand rigor inconsistent with the rest of the codebase.
4. Were introduced in the changes being reviewed (not pre-existing bugs).
5. The author would likely fix if aware of them.
6. Don't rely on unstated assumptions about the codebase or author's intent.
7. Have provable impact on other parts of the code — it is not enough to speculate that a change may disrupt another part, you must identify the parts that are provably affected.
8. Are clearly not intentional changes by the author.
9. Be particularly careful with untrusted user input and follow the specific guidelines to review.
10. Treat silent local error recovery (especially parsing/IO/network fallbacks) as high-signal review candidates unless there is explicit boundary-level justification.

## Untrusted User Input

1. Be careful with open redirects, they must always be checked to only go to trusted domains (?next_page=...)
2. Always flag SQL that is not parametrized
3. In systems with user supplied URL input, http fetches always need to be protected against access to local resources (intercept DNS resolver!)
4. Escape, don't sanitize if you have the option (eg: HTML escaping)

## Comment guidelines

1. Be clear about why the issue is a problem.
2. Communicate severity appropriately - don't exaggerate.
3. Be brief - at most 1 paragraph.
4. Keep code snippets under 3 lines, wrapped in inline code or code blocks.
5. Use \`\`\`suggestion blocks ONLY for concrete replacement code (minimal lines; no commentary inside the block). Preserve the exact leading whitespace of the replaced lines.
6. Explicitly state scenarios/environments where the issue arises.
7. Use a matter-of-fact tone - helpful AI assistant, not accusatory.
8. Write for quick comprehension without close reading.
9. Avoid excessive flattery or unhelpful phrases like "Great job...".

## Review priorities

1. Surface critical non-blocking human callouts (migrations, dependency churn, auth/permissions, compatibility, destructive operations) at the end.
2. Prefer simple, direct solutions over wrappers or abstractions without clear value.
3. Treat back pressure handling as critical to system stability.
4. Apply system-level thinking; flag changes that increase operational risk or on-call wakeups.
5. Ensure that errors are always checked against codes or stable identifiers, never error messages.

## Fail-fast error handling (strict)

When reviewing added or modified error handling, default to fail-fast behavior.

1. Evaluate every new or changed \`try/catch\`: identify what can fail and why local handling is correct at that exact layer.
2. Prefer propagation over local recovery. If the current scope cannot fully recover while preserving correctness, rethrow (optionally with context) instead of returning fallbacks.
3. Flag catch blocks that hide failure signals (e.g. returning \`null\`/\`[]\`/\`false\`, swallowing JSON parse failures, logging-and-continue, or “best effort” silent recovery).
4. JSON parsing/decoding should fail loudly by default. Quiet fallback parsing is only acceptable with an explicit compatibility requirement and clear tested behavior.
5. Boundary handlers (HTTP routes, CLI entrypoints, supervisors) may translate errors, but must not pretend success or silently degrade.
6. If a catch exists only to satisfy lint/style without real handling, treat it as a bug.
7. When uncertain, prefer crashing fast over silent degradation.

## Required human callouts (non-blocking, at the very end)

After findings/verdict, you MUST append this final section:

## Human Reviewer Callouts (Non-Blocking)

Include only applicable callouts (no yes/no lines):

- **This change adds a database migration:** <files/details>
- **This change introduces a new dependency:** <package(s)/details>
- **This change changes a dependency (or the lockfile):** <files/package(s)/details>
- **This change modifies auth/permission behavior:** <what changed and where>
- **This change introduces backwards-incompatible public schema/API/contract changes:** <what changed and where>
- **This change includes irreversible or destructive operations:** <operation and scope>

Rules for this section:
1. These are informational callouts for the human reviewer, not fix items.
2. Do not include them in Findings unless there is an independent defect.
3. These callouts alone must not change the verdict.
4. Only include callouts that apply to the reviewed change.
5. Keep each emitted callout bold exactly as written.
6. If none apply, write "- (none)".

## Priority levels

Tag each finding with a priority level in the title:
- [P0] - Drop everything to fix. Blocking release/operations. Only for universal issues that do not depend on assumptions about inputs.
- [P1] - Urgent. Should be addressed in the next cycle.
- [P2] - Normal. To be fixed eventually.
- [P3] - Low. Nice to have.

## Output format

Provide your findings in a clear, structured format:
1. List each finding with its priority tag, file location, and explanation.
2. Findings must reference locations that overlap with the actual diff — don't flag pre-existing code.
3. Keep line references as short as possible (avoid ranges over 5-10 lines; pick the most suitable subrange).
4. Provide an overall verdict: "correct" (no blocking issues) or "needs attention" (has blocking issues).
5. At the very end, append a fenced \`review-json\` block with machine-readable \`verdict\`, \`findings\`, and \`humanCallouts\`. The JSON verdict MUST be \`correct\` or \`needs_attention\`; each finding MUST include \`priority\`.
6. Ignore trivial style issues unless they obscure meaning or violate documented standards.
7. Do not generate a full PR fix — only flag issues and optionally provide short suggestion blocks.
8. End with the required "Human Reviewer Callouts (Non-Blocking)" section and all applicable bold callouts (no yes/no).

Output all findings the author would fix if they knew about them. If there are no qualifying findings, explicitly state the code looks good. Don't stop at the first finding - list every qualifying issue. Then append the required non-blocking callouts section.`;

// loadProjectReviewGuidelines
async function loadProjectReviewGuidelines(cwd: string): Promise<string | null> {
	let currentDir = path.resolve(cwd);

	while (true) {
		const piDir = path.join(currentDir, ".pi");
		const guidelinesPath = path.join(currentDir, "REVIEW_GUIDELINES.md");

		const piStats = await fs.stat(piDir).catch((error: NodeJS.ErrnoException) => {
			if (error.code === "ENOENT") return null;
			throw new Error(`Failed to inspect ${piDir}: ${error.message}`);
		});
		if (piStats?.isDirectory()) {
			const guidelineStats = await fs.stat(guidelinesPath).catch((error: NodeJS.ErrnoException) => {
				if (error.code === "ENOENT") return null;
				throw new Error(`Failed to inspect ${guidelinesPath}: ${error.message}`);
			});
			if (guidelineStats?.isFile()) {
				const content = await fs.readFile(guidelinesPath, "utf8").catch((error: Error) => {
					throw new Error(`Failed to read ${guidelinesPath}: ${error.message}`);
				});
				const trimmed = content.trim();
				return trimmed ? trimmed : null;
			}
			return null;
		}

		const parentDir = path.dirname(currentDir);
		if (parentDir === currentDir) {
			return null;
		}
		currentDir = parentDir;
	}
}

/**
 * Build the review prompt based on target
 */
async function buildReviewPrompt(
	pi: ExtensionAPI,
	target: ReviewTarget,
	options?: { includeLocalChanges?: boolean },
): Promise<string> {
	const includeLocalChanges = options?.includeLocalChanges === true;

	switch (target.type) {
		case "uncommitted":
			return renderReviewTargetPrompt(target, { includeLocalChanges });

		case "baseBranch": {
			const mergeBase = await getMergeBase(pi, target.branch);
			if (!mergeBase) {
				throw new Error(`Could not determine merge base for branch '${target.branch}'. Fetch/update the base branch, then retry.`);
			}
			return renderReviewTargetPrompt(target, { mergeBaseSha: mergeBase, includeLocalChanges });
		}

		case "commit":
			return renderReviewTargetPrompt(target, { includeLocalChanges });

		case "pullRequest": {
			const mergeBase = await getMergeBase(pi, target.baseBranch);
			if (!mergeBase) {
				throw new Error(`Could not determine merge base for PR #${target.prNumber} against '${target.baseBranch}'. Fetch/update the base branch, then retry.`);
			}
			return renderReviewTargetPrompt(target, { mergeBaseSha: mergeBase, includeLocalChanges });
		}

		case "folder":
			return renderReviewTargetPrompt(target, { includeLocalChanges });
	}
}

type AssistantSnapshot = {
	id: string;
	text: string;
	stopReason?: string;
};

function extractAssistantTextContent(content: unknown): string {
	if (typeof content === "string") {
		return content.trim();
	}

	if (!Array.isArray(content)) {
		return "";
	}

	const textParts = content
		.filter(
			(part): part is { type: "text"; text: string } =>
				Boolean(part && typeof part === "object" && "type" in part && part.type === "text" && "text" in part),
		)
		.map((part) => part.text);
	return textParts.join("\n").trim();
}

function getLastAssistantSnapshot(ctx: ExtensionContext): AssistantSnapshot | null {
	const entries = ctx.sessionManager.getBranch();
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (entry.type !== "message" || entry.message.role !== "assistant") {
			continue;
		}

		const assistantMessage = entry.message as { content?: unknown; stopReason?: string };
		return {
			id: entry.id,
			text: extractAssistantTextContent(assistantMessage.content),
			stopReason: assistantMessage.stopReason,
		};
	}

	return null;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForLoopTurnToStart(ctx: ExtensionContext, previousAssistantId?: string): Promise<boolean> {
	const deadline = Date.now() + REVIEW_LOOP_START_TIMEOUT_MS;

	while (Date.now() < deadline) {
		const lastAssistantId = getLastAssistantSnapshot(ctx)?.id;
		if (!ctx.isIdle() || ctx.hasPendingMessages() || (lastAssistantId && lastAssistantId !== previousAssistantId)) {
			return true;
		}
		await sleep(REVIEW_LOOP_START_POLL_MS);
	}

	return false;
}

// Review preset options for the selector (keep this order stable)
const REVIEW_PRESETS = [
	{ value: "uncommitted", label: "Review uncommitted changes", description: "" },
	{ value: "baseBranch", label: "Review against a base branch", description: "(local)" },
	{ value: "commit", label: "Review a commit", description: "" },
	{ value: "pullRequest", label: "Review a pull request", description: "(GitHub PR)" },
	{ value: "folder", label: "Review a folder (or more)", description: "(snapshot, not diff)" },
] as const;

const REVIEW_KIND_OPTIONS = [
	{ value: "plan", label: "Plan", description: "Review the current plan/conversation" },
	{ value: "code", label: "Code", description: "Review code changes or files" },
] as const;

const TOGGLE_LOOP_FIXING_VALUE = "toggleLoopFixing" as const;
const TOGGLE_CUSTOM_INSTRUCTIONS_VALUE = "toggleCustomInstructions" as const;
type ReviewKind = (typeof REVIEW_KIND_OPTIONS)[number]["value"];
type ReviewPresetValue =
	| (typeof REVIEW_PRESETS)[number]["value"]
	| typeof TOGGLE_LOOP_FIXING_VALUE
	| typeof TOGGLE_CUSTOM_INSTRUCTIONS_VALUE;

export default function reviewExtension(pi: ExtensionAPI) {
	function persistReviewSettings() {
		pi.appendEntry(REVIEW_SETTINGS_TYPE, {
			loopFixingEnabled: reviewLoopFixingEnabled,
			customInstructions: reviewCustomInstructions,
		});
	}

	function setReviewLoopFixingEnabled(enabled: boolean) {
		reviewLoopFixingEnabled = enabled;
		persistReviewSettings();
	}

	function setReviewCustomInstructions(instructions: string | undefined) {
		reviewCustomInstructions = instructions?.trim() || undefined;
		persistReviewSettings();
	}

	function applyAllReviewState(ctx: ExtensionContext, options: { clearAutoFinish?: boolean } = {}) {
		applyReviewSettings(ctx);
		const result = applyReviewState(ctx, options);
		if (result.clearedStaleAutoFinish) {
			pi.appendEntry(REVIEW_STATE_TYPE, { active: false });
			ctx.ui.notify("Cleared stale auto review status.", "info");
		}
	}

	pi.on("session_start", (_event, ctx) => {
		applyAllReviewState(ctx, { clearAutoFinish: true });
	});

	(pi.on as any)("session_switch", (_event: unknown, ctx: ExtensionContext) => {
		applyAllReviewState(ctx, { clearAutoFinish: true });
	});

	pi.on("session_tree", (_event, ctx) => {
		applyAllReviewState(ctx);
	});

	async function showReviewKindSelector(ctx: ExtensionContext): Promise<ReviewKind | null> {
		const items: SelectItem[] = REVIEW_KIND_OPTIONS.map((option) => ({
			value: option.value,
			label: option.label,
			description: option.description,
		}));

		return ctx.ui.custom<ReviewKind | null>((tui, theme, _kb, done) => {
			const container = new Container();
			container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));
			container.addChild(new Text(theme.fg("accent", theme.bold("Select review type"))));

			const selectList = new SelectList(items, items.length, {
				selectedPrefix: (text) => theme.fg("accent", text),
				selectedText: (text) => theme.fg("accent", text),
				description: (text) => theme.fg("muted", text),
				scrollInfo: (text) => theme.fg("dim", text),
				noMatch: (text) => theme.fg("warning", text),
			});

			selectList.onSelect = (item) => done(item.value as ReviewKind);
			selectList.onCancel = () => done(null);

			container.addChild(selectList);
			container.addChild(new Text(theme.fg("dim", "Press enter to confirm or esc to cancel")));
			container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));

			return {
				render(width: number) {
					return container.render(width);
				},
				invalidate() {
					container.invalidate();
				},
				handleInput(data: string) {
					selectList.handleInput(data);
					tui.requestRender();
				},
			};
		}, { overlay: true });
	}

	/**
	 * Determine the smart default review type based on git state
	 */
	async function getSmartDefault(): Promise<"uncommitted" | "baseBranch" | "commit"> {
		// Priority 1: If there are uncommitted changes, default to reviewing them
		if (await hasUncommittedChanges(pi)) {
			return "uncommitted";
		}

		// Priority 2: If on a feature branch (not the default branch), default to PR-style review
		const currentBranch = await getCurrentBranch(pi);
		const defaultBranch = await getDefaultBranch(pi);
		if (currentBranch && currentBranch !== defaultBranch) {
			return "baseBranch";
		}

		// Priority 3: Default to reviewing a specific commit
		return "commit";
	}

	/**
	 * Show the review preset selector
	 */
	async function showReviewSelector(ctx: ExtensionContext): Promise<ReviewTarget | null> {
		// Determine smart default (but keep the list order stable)
		const smartDefault = await getSmartDefault();
		const presetItems: SelectItem[] = REVIEW_PRESETS.map((preset) => ({
			value: preset.value,
			label: preset.label,
			description: preset.description,
		}));
		const smartDefaultIndex = presetItems.findIndex((item) => item.value === smartDefault);

		while (true) {
			const customInstructionsLabel = reviewCustomInstructions
				? "Remove custom review instructions"
				: "Add custom review instructions";
			const customInstructionsDescription = reviewCustomInstructions
				? "(currently set)"
				: "(applies to all review modes)";
			const loopToggleLabel = reviewLoopFixingEnabled ? "Disable Loop Fixing" : "Enable Loop Fixing";
			const loopToggleDescription = reviewLoopFixingEnabled ? "(currently on)" : "(currently off)";
			const items: SelectItem[] = [
				...presetItems,
				{
					value: TOGGLE_CUSTOM_INSTRUCTIONS_VALUE,
					label: customInstructionsLabel,
					description: customInstructionsDescription,
				},
				{ value: TOGGLE_LOOP_FIXING_VALUE, label: loopToggleLabel, description: loopToggleDescription },
			];

			const result = await ctx.ui.custom<ReviewPresetValue | null>((tui, theme, _kb, done) => {
				const container = new Container();
				container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));
				container.addChild(new Text(theme.fg("accent", theme.bold("Select a review preset"))));

				const selectList = new SelectList(items, Math.min(items.length, 10), {
					selectedPrefix: (text) => theme.fg("accent", text),
					selectedText: (text) => theme.fg("accent", text),
					description: (text) => theme.fg("muted", text),
					scrollInfo: (text) => theme.fg("dim", text),
					noMatch: (text) => theme.fg("warning", text),
				});

				// Preselect the smart default without reordering the list
				if (smartDefaultIndex >= 0) {
					selectList.setSelectedIndex(smartDefaultIndex);
				}

				selectList.onSelect = (item) => done(item.value as ReviewPresetValue);
				selectList.onCancel = () => done(null);

				container.addChild(selectList);
				container.addChild(new Text(theme.fg("dim", "Press enter to confirm or esc to go back")));
				container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));

				return {
					render(width: number) {
						return container.render(width);
					},
					invalidate() {
						container.invalidate();
					},
					handleInput(data: string) {
						selectList.handleInput(data);
						tui.requestRender();
					},
				};
			});

			if (!result) return null;

			if (result === TOGGLE_LOOP_FIXING_VALUE) {
				const nextEnabled = !reviewLoopFixingEnabled;
				setReviewLoopFixingEnabled(nextEnabled);
				ctx.ui.notify(nextEnabled ? "Loop fixing enabled" : "Loop fixing disabled", "info");
				continue;
			}

			if (result === TOGGLE_CUSTOM_INSTRUCTIONS_VALUE) {
				if (reviewCustomInstructions) {
					setReviewCustomInstructions(undefined);
					ctx.ui.notify("Custom review instructions removed", "info");
					continue;
				}

				const customInstructions = await ctx.ui.editor(
					"Enter custom review instructions (applies to all review modes):",
					"",
				);

				if (!customInstructions?.trim()) {
					ctx.ui.notify("Custom review instructions not changed", "info");
					continue;
				}

				setReviewCustomInstructions(customInstructions);
				ctx.ui.notify("Custom review instructions saved", "info");
				continue;
			}

			// Handle each preset type
			switch (result) {
				case "uncommitted":
					return { type: "uncommitted" };

				case "baseBranch": {
					const target = await showBranchSelector(ctx);
					if (target) return target;
					break;
				}

				case "commit": {
					if (reviewLoopFixingEnabled) {
						ctx.ui.notify("Loop mode does not work with commit review.", "error");
						break;
					}
					const target = await showCommitSelector(ctx);
					if (target) return target;
					break;
				}

				case "folder": {
					const target = await showFolderInput(ctx);
					if (target) return target;
					break;
				}

				case "pullRequest": {
					const target = await showPrInput(ctx);
					if (target) return target;
					break;
				}

				default:
					return null;
			}
		}
	}

	/**
	 * Show branch selector for base branch review
	 */
	async function showBranchSelector(ctx: ExtensionContext): Promise<ReviewTarget | null> {
		const branches = await getLocalBranches(pi);
		const currentBranch = await getCurrentBranch(pi);
		const defaultBranch = await getDefaultBranch(pi);

		// Never offer the current branch as a base branch (reviewing against itself is meaningless).
		const candidateBranches = currentBranch ? branches.filter((b) => b !== currentBranch) : branches;

		if (candidateBranches.length === 0) {
			ctx.ui.notify(
				currentBranch ? `No other branches found (current branch: ${currentBranch})` : "No branches found",
				"error",
			);
			return null;
		}

		// Sort branches with default branch first
		const sortedBranches = candidateBranches.sort((a, b) => {
			if (a === defaultBranch) return -1;
			if (b === defaultBranch) return 1;
			return a.localeCompare(b);
		});

		const items: SelectItem[] = sortedBranches.map((branch) => ({
			value: branch,
			label: branch,
			description: branch === defaultBranch ? "(default)" : "",
		}));

		const result = await ctx.ui.custom<string | null>((tui, theme, keybindings, done) => {
			const container = new Container();
			container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));
			container.addChild(new Text(theme.fg("accent", theme.bold("Select base branch"))));

			const searchInput = new Input();
			container.addChild(searchInput);
			container.addChild(new Spacer(1));

			const listContainer = new Container();
			container.addChild(listContainer);
			container.addChild(new Text(theme.fg("dim", "Type to filter • enter to select • esc to cancel")));
			container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));

			let filteredItems = items;
			let selectList: SelectList | null = null;

			const updateList = () => {
				listContainer.clear();
				if (filteredItems.length === 0) {
					listContainer.addChild(new Text(theme.fg("warning", "  No matching branches")));
					selectList = null;
					return;
				}

				selectList = new SelectList(filteredItems, Math.min(filteredItems.length, 10), {
					selectedPrefix: (text) => theme.fg("accent", text),
					selectedText: (text) => theme.fg("accent", text),
					description: (text) => theme.fg("muted", text),
					scrollInfo: (text) => theme.fg("dim", text),
					noMatch: (text) => theme.fg("warning", text),
				});

				selectList.onSelect = (item) => done(item.value);
				selectList.onCancel = () => done(null);
				listContainer.addChild(selectList);
			};

			const applyFilter = () => {
				const query = searchInput.getValue();
				filteredItems = query
					? fuzzyFilter(items, query, (item) => `${item.label} ${item.value} ${item.description ?? ""}`)
					: items;
				updateList();
			};

			applyFilter();

			return {
				render(width: number) {
					return container.render(width);
				},
				invalidate() {
					container.invalidate();
				},
				handleInput(data: string) {
					if (
						keybindings.matches(data, "tui.select.up") ||
						keybindings.matches(data, "tui.select.down") ||
						keybindings.matches(data, "tui.select.confirm") ||
						keybindings.matches(data, "tui.select.cancel")
					) {
						if (selectList) {
							selectList.handleInput(data);
						} else if (keybindings.matches(data, "tui.select.cancel")) {
							done(null);
						}
						tui.requestRender();
						return;
					}

					searchInput.handleInput(data);
					applyFilter();
					tui.requestRender();
				},
			};
		});

		if (!result) return null;
		return { type: "baseBranch", branch: result };
	}

	/**
	 * Show commit selector
	 */
	async function showCommitSelector(ctx: ExtensionContext): Promise<ReviewTarget | null> {
		const commits = await getRecentCommits(pi, 20);

		if (commits.length === 0) {
			ctx.ui.notify("No commits found", "error");
			return null;
		}

		const items: SelectItem[] = commits.map((commit) => ({
			value: commit.sha,
			label: `${commit.sha.slice(0, 7)} ${commit.title}`,
			description: "",
		}));

		const result = await ctx.ui.custom<{ sha: string; title: string } | null>((tui, theme, keybindings, done) => {
			const container = new Container();
			container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));
			container.addChild(new Text(theme.fg("accent", theme.bold("Select commit to review"))));

			const searchInput = new Input();
			container.addChild(searchInput);
			container.addChild(new Spacer(1));

			const listContainer = new Container();
			container.addChild(listContainer);
			container.addChild(new Text(theme.fg("dim", "Type to filter • enter to select • esc to cancel")));
			container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));

			let filteredItems = items;
			let selectList: SelectList | null = null;

			const updateList = () => {
				listContainer.clear();
				if (filteredItems.length === 0) {
					listContainer.addChild(new Text(theme.fg("warning", "  No matching commits")));
					selectList = null;
					return;
				}

				selectList = new SelectList(filteredItems, Math.min(filteredItems.length, 10), {
					selectedPrefix: (text) => theme.fg("accent", text),
					selectedText: (text) => theme.fg("accent", text),
					description: (text) => theme.fg("muted", text),
					scrollInfo: (text) => theme.fg("dim", text),
					noMatch: (text) => theme.fg("warning", text),
				});

				selectList.onSelect = (item) => {
					const commit = commits.find((c) => c.sha === item.value);
					if (commit) {
						done(commit);
					} else {
						done(null);
					}
				};
				selectList.onCancel = () => done(null);
				listContainer.addChild(selectList);
			};

			const applyFilter = () => {
				const query = searchInput.getValue();
				filteredItems = query
					? fuzzyFilter(items, query, (item) => `${item.label} ${item.value} ${item.description ?? ""}`)
					: items;
				updateList();
			};

			applyFilter();

			return {
				render(width: number) {
					return container.render(width);
				},
				invalidate() {
					container.invalidate();
				},
				handleInput(data: string) {
					if (
						keybindings.matches(data, "tui.select.up") ||
						keybindings.matches(data, "tui.select.down") ||
						keybindings.matches(data, "tui.select.confirm") ||
						keybindings.matches(data, "tui.select.cancel")
					) {
						if (selectList) {
							selectList.handleInput(data);
						} else if (keybindings.matches(data, "tui.select.cancel")) {
							done(null);
						}
						tui.requestRender();
						return;
					}

					searchInput.handleInput(data);
					applyFilter();
					tui.requestRender();
				},
			};
		});

		if (!result) return null;
		return { type: "commit", sha: result.sha, title: result.title };
	}

	/**
	 * Show folder input
	 */
	async function showFolderInput(ctx: ExtensionContext): Promise<ReviewTarget | null> {
		const result = await ctx.ui.editor(
			"Enter folders/files to review (space-separated or one per line):",
			".",
		);

		if (!result?.trim()) return null;
		const paths = parseReviewPaths(result);
		if (paths.length === 0) return null;

		return { type: "folder", paths };
	}

	/**
	 * Show PR input and handle checkout
	 */
	async function showPrInput(ctx: ExtensionContext): Promise<ReviewTarget | null> {
		// First check for pending changes that would prevent branch switching
		if (await hasPendingChanges(pi)) {
			ctx.ui.notify("Cannot checkout PR: you have uncommitted changes. Please commit or stash them first.", "error");
			return null;
		}

		// Get PR reference from user
		const prRef = await ctx.ui.editor(
			"Enter PR number or URL (e.g. 123 or https://github.com/owner/repo/pull/123):",
			"",
		);

		if (!prRef?.trim()) return null;

		const prNumber = parsePrReference(prRef);
		if (!prNumber) {
			ctx.ui.notify("Invalid PR reference. Enter a number or GitHub PR URL.", "error");
			return null;
		}

		// Get PR info from GitHub
		ctx.ui.notify(`Fetching PR #${prNumber} info...`, "info");
		const prInfo = await getPrInfo(pi, prNumber);

		if (!prInfo) {
			ctx.ui.notify(`Could not find PR #${prNumber}. Make sure gh is authenticated and the PR exists.`, "error");
			return null;
		}

		// Check again for pending changes (in case something changed)
		if (await hasPendingChanges(pi)) {
			ctx.ui.notify("Cannot checkout PR: you have uncommitted changes. Please commit or stash them first.", "error");
			return null;
		}

		// Checkout the PR
		ctx.ui.notify(`Checking out PR #${prNumber}...`, "info");
		const checkoutResult = await checkoutPr(pi, prNumber);

		if (!checkoutResult.success) {
			ctx.ui.notify(`Failed to checkout PR: ${checkoutResult.error}`, "error");
			return null;
		}

		ctx.ui.notify(`Checked out PR #${prNumber} (${prInfo.headBranch})`, "info");

		return {
			type: "pullRequest",
			prNumber,
			baseBranch: prInfo.baseBranch,
			title: prInfo.title,
		};
	}

	async function startReviewBranch(
		ctx: ExtensionCommandContext,
		label: string,
		kind: "code" | "plan" = "code",
	): Promise<boolean> {
		// Store current position (where we'll return to).
		// In an empty session there is no leaf yet, so create a lightweight anchor first.
		let originId = ctx.sessionManager.getLeafId() ?? undefined;
		if (!originId) {
			pi.appendEntry(REVIEW_ANCHOR_TYPE, { createdAt: new Date().toISOString() });
			originId = ctx.sessionManager.getLeafId() ?? undefined;
		}
		if (!originId) {
			ctx.ui.notify("Failed to determine review origin.", "error");
			return false;
		}
		reviewOriginId = originId;
		reviewActiveKind = kind;

		// Keep a local copy so session_tree events during navigation don't wipe it.
		const lockedOriginId = originId;

		// NOTE: reviewActiveKind is set again after navigateTree (below) as a defensive
		// measure — session_tree events during navigation can trigger applyAllReviewState,
		// which resets the module-level state. The redundant write ensures the kind is
		// correct regardless of event ordering.

		// Find the first user message in the session.
		// If none exists (e.g. brand-new session), we'll stay on the current leaf.
		const entries = ctx.sessionManager.getEntries();
		const firstUserMessage = entries.find(
			(e) => e.type === "message" && e.message.role === "user",
		);

		if (firstUserMessage) {
			try {
				const result = await ctx.navigateTree(firstUserMessage.id, { summarize: false, label });
				if (result.cancelled) {
					reviewOriginId = undefined;
					return false;
				}
			} catch (error) {
				reviewOriginId = undefined;
				ctx.ui.notify(`Failed to start review: ${error instanceof Error ? error.message : String(error)}`, "error");
				return false;
			}

			// Clear the editor (navigating to user message fills it with the message text).
			ctx.ui.setEditorText("");
		}

		// Restore origin after navigation events (session_tree can reset it).
		reviewOriginId = lockedOriginId;
		reviewActiveKind = kind;
		setReviewWidget(ctx, true);
		pi.appendEntry(REVIEW_STATE_TYPE, { active: true, originId: lockedOriginId, kind, autoFinish: true });
		return true;
	}

	function startReviewDelta(ctx: ExtensionCommandContext, kind: "code" | "plan"): boolean {
		let originId = ctx.sessionManager.getLeafId() ?? undefined;
		if (!originId) {
			pi.appendEntry(REVIEW_ANCHOR_TYPE, { createdAt: new Date().toISOString() });
			originId = ctx.sessionManager.getLeafId() ?? undefined;
		}
		if (!originId) {
			ctx.ui.notify("Failed to determine review origin.", "error");
			return false;
		}

		reviewOriginId = originId;
		reviewActiveKind = kind;
		setReviewWidget(ctx, true);
		pi.appendEntry(REVIEW_STATE_TYPE, { active: true, originId, kind, autoFinish: true });
		return true;
	}

	async function buildFullCodeReviewPrompt(
		ctx: ExtensionCommandContext,
		target: ReviewTarget,
		options?: { includeLocalChanges?: boolean; extraInstruction?: string },
	): Promise<{ fullPrompt: string; hint: string }> {
		if (target.type === "folder") {
			target = { ...target, paths: await validateReviewPaths(ctx.cwd, target.paths) };
		}

		const prompt = await buildReviewPrompt(pi, target, {
			includeLocalChanges: options?.includeLocalChanges === true,
		});
		const hint = getReviewTargetHint(target);
		const projectGuidelines = await loadProjectReviewGuidelines(ctx.cwd);

		// Combine the review rubric with the specific prompt
		let fullPrompt = `${REVIEW_RUBRIC}\n\n---\n\nPlease perform a code review with the following focus:\n\n${prompt}`;

		if (reviewCustomInstructions) {
			fullPrompt += `\n\nShared custom review instructions (applies to all reviews):\n\n${reviewCustomInstructions}`;
		}

		if (options?.extraInstruction?.trim()) {
			fullPrompt += `\n\nAdditional user-provided review instruction:\n\n${options.extraInstruction.trim()}`;
		}

		if (projectGuidelines) {
			fullPrompt += `\n\nThis project has additional instructions for code reviews:\n\n${projectGuidelines}`;
		}

		return { fullPrompt, hint };
	}

	/**
	 * Execute the review
	 */
	async function executeReview(
		ctx: ExtensionCommandContext,
		target: ReviewTarget,
		useFreshSession: boolean,
		options?: { includeLocalChanges?: boolean; extraInstruction?: string },
	): Promise<boolean> {
		// Check if we're already in a review
		if (reviewOriginId) {
			ctx.ui.notify("Already in a review. Run /review to open the finish menu.", "warning");
			return false;
		}

		const { fullPrompt, hint } = await buildFullCodeReviewPrompt(ctx, target, options);
		if (useFreshSession && !(await startReviewBranch(ctx, "code-review", "code"))) {
			return false;
		}

		const modeHint = useFreshSession ? " (fresh session)" : "";
		ctx.ui.notify(`Starting review: ${hint}${modeHint}`, "info");

		// Send as a user message that triggers a turn
		pi.sendUserMessage(fullPrompt);
		return true;
	}

	/**
	 * Handle PR checkout and return a ReviewTarget (or null on failure)
	 */
	async function handlePrCheckout(ctx: ExtensionContext, ref: string): Promise<ReviewTarget | null> {
		// First check for pending changes
		if (await hasPendingChanges(pi)) {
			ctx.ui.notify("Cannot checkout PR: you have uncommitted changes. Please commit or stash them first.", "error");
			return null;
		}

		const prNumber = parsePrReference(ref);
		if (!prNumber) {
			ctx.ui.notify("Invalid PR reference. Enter a number or GitHub PR URL.", "error");
			return null;
		}

		// Get PR info
		ctx.ui.notify(`Fetching PR #${prNumber} info...`, "info");
		const prInfo = await getPrInfo(pi, prNumber);

		if (!prInfo) {
			ctx.ui.notify(`Could not find PR #${prNumber}. Make sure gh is authenticated and the PR exists.`, "error");
			return null;
		}

		// Checkout the PR
		ctx.ui.notify(`Checking out PR #${prNumber}...`, "info");
		const checkoutResult = await checkoutPr(pi, prNumber);

		if (!checkoutResult.success) {
			ctx.ui.notify(`Failed to checkout PR: ${checkoutResult.error}`, "error");
			return null;
		}

		ctx.ui.notify(`Checked out PR #${prNumber} (${prInfo.headBranch})`, "info");

		return {
			type: "pullRequest",
			prNumber,
			baseBranch: prInfo.baseBranch,
			title: prInfo.title,
		};
	}

	function buildCodeReviewSynthesisPrompt(target: ReviewTarget, results: ParallelReviewResult[]): string {
		return [
			"Multiple reviewer models have completed independent code reviews.",
			"",
			`Review scope: ${getReviewTargetHint(target)}`,
			"",
			"Consolidate the reports below into one actionable review result.",
			"Deduplicate overlapping findings, preserve the highest justified priority, and keep exact file paths and line references where available.",
			"Do not fix anything yet. Produce the review result only.",
			"",
			"Use this structure:",
			"## Review Scope",
			"## Verdict",
			"## Findings",
			"## Fix Queue",
			"## Constraints & Preferences",
			"## Human Reviewer Callouts (Non-Blocking)",
			"",
			"Reviewer reports:",
			"",
			formatParallelReviewResults(results),
		].join("\n");
	}

	async function runParallelCodeReview(
		ctx: ExtensionCommandContext,
		target: ReviewTarget,
		models: string[],
		extraInstruction?: string,
	): Promise<boolean> {
		const { fullPrompt, hint } = await buildFullCodeReviewPrompt(ctx, target, { extraInstruction });
		ctx.ui.notify(
			`Starting code review: ${hint} (${models.length} model${models.length === 1 ? "" : "s"})`,
			"info",
		);

		const results = await runParallelReviewDashboard(ctx, models, fullPrompt, {
			cwd: ctx.cwd,
			noSkills: true,
		});

		const aborted = results.every((result) => result.text === "" && result.error);
		if (aborted) {
			ctx.ui.notify("Code review cancelled - no results to inject", "info");
			return false;
		}

		const baselineAssistantId = getLastAssistantSnapshot(ctx)?.id;
		pi.sendUserMessage(buildCodeReviewSynthesisPrompt(target, results));
		ctx.ui.notify("Code reviews complete - consolidating findings", "info");
		const started = await waitForLoopTurnToStart(ctx, baselineAssistantId);
		if (!started) {
			ctx.ui.notify("Code review consolidation did not start in time.", "warning");
			return false;
		}
		await ctx.waitForIdle();
		return true;
	}

	async function runLoopFixingReview(
		ctx: ExtensionCommandContext,
		target: ReviewTarget,
		extraInstruction?: string,
	): Promise<void> {
		if (reviewLoopInProgress) {
			ctx.ui.notify("Loop fixing review is already running.", "warning");
			return;
		}

		reviewLoopInProgress = true;
		setReviewWidget(ctx, Boolean(reviewOriginId));
		try {
			ctx.ui.notify(
				"Loop fixing enabled: using Empty branch mode and cycling until no blocking findings remain.",
				"info",
			);

			for (let pass = 1; pass <= REVIEW_LOOP_MAX_ITERATIONS; pass++) {
				const reviewBaselineAssistantId = getLastAssistantSnapshot(ctx)?.id;
				const started = await executeReview(ctx, target, true, {
					includeLocalChanges: true,
					extraInstruction,
				});
				if (!started) {
					ctx.ui.notify("Loop fixing stopped before starting the review pass.", "warning");
					return;
				}

				const reviewTurnStarted = await waitForLoopTurnToStart(ctx, reviewBaselineAssistantId);
				if (!reviewTurnStarted) {
					ctx.ui.notify("Loop fixing stopped: review pass did not start in time.", "error");
					return;
				}

				await ctx.waitForIdle();

				const reviewSnapshot = getLastAssistantSnapshot(ctx);
				if (!reviewSnapshot || reviewSnapshot.id === reviewBaselineAssistantId) {
					ctx.ui.notify("Loop fixing stopped: could not read the review result.", "warning");
					return;
				}

				if (reviewSnapshot.stopReason === "aborted") {
					ctx.ui.notify("Loop fixing stopped: review was aborted.", "warning");
					return;
				}

				if (reviewSnapshot.stopReason === "error") {
					ctx.ui.notify("Loop fixing stopped: review failed with an error.", "error");
					return;
				}

				if (reviewSnapshot.stopReason === "length") {
					ctx.ui.notify("Loop fixing stopped: review output was truncated (stopReason=length).", "warning");
					return;
				}

				if (!hasBlockingReviewFindings(reviewSnapshot.text)) {
					const finalized = await executeEndReviewAction(ctx, "returnAndSummarize", {
						showSummaryLoader: true,
						notifySuccess: false,
					});
					if (finalized !== "ok") {
						return;
					}

					ctx.ui.notify("Loop fixing complete: no blocking findings remain.", "info");
					return;
				}

				ctx.ui.notify(`Loop fixing pass ${pass}: found blocking findings, returning to fix them...`, "info");

				const fixBaselineAssistantId = getLastAssistantSnapshot(ctx)?.id;
				const sentFixPrompt = await executeEndReviewAction(ctx, "returnAndFix", {
					showSummaryLoader: true,
					notifySuccess: false,
				});
				if (sentFixPrompt !== "ok") {
					return;
				}

				const fixTurnStarted = await waitForLoopTurnToStart(ctx, fixBaselineAssistantId);
				if (!fixTurnStarted) {
					ctx.ui.notify("Loop fixing stopped: fix pass did not start in time.", "error");
					return;
				}

				await ctx.waitForIdle();

				const fixSnapshot = getLastAssistantSnapshot(ctx);
				if (!fixSnapshot || fixSnapshot.id === fixBaselineAssistantId) {
					ctx.ui.notify("Loop fixing stopped: could not read the fix pass result.", "warning");
					return;
				}
				if (fixSnapshot.stopReason === "aborted") {
					ctx.ui.notify("Loop fixing stopped: fix pass was aborted.", "warning");
					return;
				}
				if (fixSnapshot.stopReason === "error") {
					ctx.ui.notify("Loop fixing stopped: fix pass failed with an error.", "error");
					return;
				}
				if (fixSnapshot.stopReason === "length") {
					ctx.ui.notify("Loop fixing stopped: fix pass output was truncated (stopReason=length).", "warning");
					return;
				}
			}

			ctx.ui.notify(
				`Loop fixing stopped after ${REVIEW_LOOP_MAX_ITERATIONS} passes (safety limit reached).`,
				"warning",
			);
		} finally {
			reviewLoopInProgress = false;
			setReviewWidget(ctx, Boolean(reviewOriginId));
		}
	}

	// Register the /review command
	pi.registerCommand("review", {
		description: "Review a plan or code changes",
		handler: async (args, ctx) => {
			if (ctx.mode !== "tui") {
				ctx.ui.notify("Review requires interactive TUI mode", "error");
				return;
			}

			if (getActiveReviewOrigin(ctx)) {
				await runEndReview(ctx);
				return;
			}

			const invocation = parseReviewInvocation(args);
			let reviewKind = invocation.kind;

			if (!reviewKind) {
				reviewKind = await showReviewKindSelector(ctx);
				if (!reviewKind) {
					ctx.ui.notify("Review cancelled", "info");
					return;
				}
			}

			if (reviewKind === "plan") {
				if (reviewOriginId) {
					ctx.ui.notify("Already in a review. Run /review to open the finish menu.", "warning");
					return;
				}
				if (!startReviewDelta(ctx, "plan")) {
					return;
				}
				try {
					const baselineAssistantId = getLastAssistantSnapshot(ctx)?.id;
					const completed = await runPlanReview(pi, ctx);
					if (!completed) {
						clearReviewState(ctx);
						return;
					}
					const started = await waitForLoopTurnToStart(ctx, baselineAssistantId);
					if (!started) {
						ctx.ui.notify("Plan review reflection did not start in time.", "warning");
						clearReviewState(ctx);
						return;
					}
					await ctx.waitForIdle();
					await runEndReview(ctx);
				} catch (error) {
					clearReviewState(ctx);
					ctx.ui.notify(`Plan review failed: ${error instanceof Error ? error.message : String(error)}`, "error");
				}
				return;
			}

			if (reviewLoopInProgress) {
				ctx.ui.notify("Loop fixing review is already running.", "warning");
				return;
			}

			// Check if we're already in a review
			if (reviewOriginId) {
				ctx.ui.notify("Already in a review. Run /review to open the finish menu.", "warning");
				return;
			}

			// Check if we're in a git repository
			const { code } = await pi.exec("git", ["rev-parse", "--git-dir"]);
			if (code !== 0) {
				ctx.ui.notify("Not a git repository", "error");
				return;
			}

			// Try to parse direct arguments
			let target: ReviewTarget | null = null;
			let fromSelector = false;
			let extraInstruction: string | undefined;
			const parsed = parseReviewArgs(invocation.codeArgs);
			if (parsed.error) {
				ctx.ui.notify(parsed.error, "error");
				return;
			}
			extraInstruction = parsed.extraInstruction?.trim() || undefined;

			if (parsed.target) {
				if (parsed.target.type === "pr") {
					// Handle PR checkout (async operation)
					target = await handlePrCheckout(ctx, parsed.target.ref);
					if (!target) {
						ctx.ui.notify("PR review failed. Returning to review menu.", "warning");
					}
				} else {
					target = parsed.target;
				}
			}

			// If no args or invalid args, show selector
			if (!target) {
				fromSelector = true;
			}

			while (true) {
				if (!target && fromSelector) {
					target = await showReviewSelector(ctx);
				}

				if (!target) {
					ctx.ui.notify("Review cancelled", "info");
					return;
				}

				if (reviewLoopFixingEnabled && !isLoopCompatibleReviewTarget(target)) {
					ctx.ui.notify("Loop mode does not work with commit review.", "error");
					if (fromSelector) {
						target = null;
						continue;
					}
					return;
				}

				if (reviewLoopFixingEnabled) {
					await runLoopFixingReview(ctx, target, extraInstruction);
					return;
				}

				const reviewerModels = await selectReviewerModels(ctx, "Code Review — Select reviewer models", "review");
				if (!reviewerModels || reviewerModels.length === 0) {
					ctx.ui.notify("Review cancelled", "info");
					return;
				}

				if (!startReviewDelta(ctx, "code")) {
					return;
				}

				try {
					const completed = await runParallelCodeReview(ctx, target, reviewerModels, extraInstruction);
					if (!completed) {
						clearReviewState(ctx);
						return;
					}

					await runEndReview(ctx);
				} catch (error) {
					clearReviewState(ctx);
					ctx.ui.notify(`Code review failed: ${error instanceof Error ? error.message : String(error)}`, "error");
				}
				return;
			}
		},
	});

	// Custom prompt for review summaries - focuses on preserving actionable findings
	const REVIEW_SUMMARY_PROMPT = `We are leaving a code-review branch and returning to the main coding branch.
Create a structured handoff that can be used immediately to implement fixes.

You MUST summarize the review that happened in this branch so findings can be acted on.
Do not omit findings: include every actionable issue that was identified.

Required sections (in order):

## Review Scope
- What was reviewed (files/paths, changes, and scope)

## Verdict
- "correct" or "needs attention"

## Findings
For EACH finding, include:
- Priority tag ([P0]..[P3]) and short title
- File location (\`path/to/file.ext:line\`)
- Why it matters (brief)
- What should change (brief, actionable)

## Fix Queue
1. Ordered implementation checklist (highest priority first)

## Constraints & Preferences
- Any constraints or preferences mentioned during review
- Or "(none)"

## Human Reviewer Callouts (Non-Blocking)
Include only applicable callouts (no yes/no lines):
- **This change adds a database migration:** <files/details>
- **This change introduces a new dependency:** <package(s)/details>
- **This change changes a dependency (or the lockfile):** <files/package(s)/details>
- **This change modifies auth/permission behavior:** <what changed and where>
- **This change introduces backwards-incompatible public schema/API/contract changes:** <what changed and where>
- **This change includes irreversible or destructive operations:** <operation and scope>

If none apply, write "- (none)".

These are informational callouts for humans and are not fix items by themselves.

Preserve exact file paths, function names, and error messages where available.`;

	const PLAN_REVIEW_SUMMARY_PROMPT = `We are leaving a plan-review branch and returning to the main working branch.
Create a structured handoff that can be used immediately to improve the plan or implementation approach.

You MUST summarize the review that happened in this branch so findings can be acted on.
Do not omit findings: include every actionable issue that was identified.

Required sections (in order):

## Review Scope
- What plan, design, or conversation was reviewed

## Verdict
- "sound" or "needs attention"

## Findings
For EACH finding, include:
- Priority tag ([P0]..[P3]) and short title
- Why it matters
- What should change

## Fix Queue
1. Ordered checklist for revising the plan or next implementation steps

## Constraints & Preferences
- Any constraints, assumptions, preferences, or unresolved questions mentioned during review
- Or "(none)"

Preserve exact terminology, decisions, and constraints where available.`;

	const REVIEW_FIX_FINDINGS_PROMPT = `Use the latest review summary in this session and implement the review findings now.

Instructions:
1. Treat the summary's Findings/Fix Queue as a checklist.
2. Fix in priority order: P0, P1, then P2 (include P3 if quick and safe).
3. If a finding is invalid/already fixed/not possible right now, briefly explain why and continue.
4. Treat "Human Reviewer Callouts (Non-Blocking)" as informational only; do not convert them into fix tasks unless there is a separate explicit finding.
5. Follow fail-fast error handling: do not add local catch/fallback recovery unless this scope is an explicit boundary that can safely translate the failure.
6. If you add or keep a \`try/catch\`, explain the expected failure mode and either rethrow with context or return a boundary-safe error response.
7. JSON parsing/decoding should fail loudly by default; avoid silent fallback parsing.
8. Run relevant tests/checks for touched code where practical.
9. End with: fixed items, deferred/skipped items (with reasons), and verification results.`;

	const PLAN_REVIEW_FIX_FINDINGS_PROMPT = `Use the latest plan review summary in this session and revise the plan or implementation approach now.

Instructions:
1. Treat the summary's Findings/Fix Queue as a checklist.
2. Address P0/P1 issues first, then P2/P3 where practical.
3. If a finding is invalid, already addressed, or not actionable right now, briefly explain why and continue.
4. Preserve user constraints and explicit preferences.
5. End with: applied revisions, deferred/skipped items (with reasons), and any remaining decisions needed.`;

	type EndReviewAction = "returnOnly" | "returnAndFix" | "returnAndSummarize";
	type EndReviewActionResult = "ok" | "cancelled" | "error";
	type EndReviewActionOptions = {
		showSummaryLoader?: boolean;
		notifySuccess?: boolean;
	};

	function getActiveReviewOrigin(ctx: ExtensionContext): string | undefined {
		if (reviewOriginId) {
			return reviewOriginId;
		}

		const state = getReviewState(ctx);
		if (state?.active && state.originId) {
			reviewOriginId = state.originId;
			reviewActiveKind = state.kind ?? "code";
			return reviewOriginId;
		}

		if (state?.active) {
			setReviewWidget(ctx, false);
			pi.appendEntry(REVIEW_STATE_TYPE, { active: false });
			ctx.ui.notify("Review state was missing origin info; cleared review status.", "warning");
		}

		return undefined;
	}

	function getActiveReviewKind(ctx: ExtensionContext): "code" | "plan" {
		const state = getReviewState(ctx);
		return state?.kind ?? reviewActiveKind;
	}

	function clearReviewState(ctx: ExtensionContext) {
		setReviewWidget(ctx, false);
		reviewOriginId = undefined;
		reviewActiveKind = "code";
		pi.appendEntry(REVIEW_STATE_TYPE, { active: false });
	}

	async function navigateWithSummary(
		ctx: ExtensionCommandContext,
		originId: string,
		showLoader: boolean,
	): Promise<{ cancelled: boolean; error?: string } | null> {
		const summaryPrompt = getActiveReviewKind(ctx) === "plan" ? PLAN_REVIEW_SUMMARY_PROMPT : REVIEW_SUMMARY_PROMPT;
		if (showLoader && ctx.hasUI) {
			return ctx.ui.custom<{ cancelled: boolean; error?: string } | null>((tui, theme, _kb, done) => {
				const loader = new BorderedLoader(tui, theme, "Returning and summarizing review branch...");
				loader.onAbort = () => done(null);

				ctx.navigateTree(originId, {
					summarize: true,
					customInstructions: summaryPrompt,
					replaceInstructions: true,
				})
					.then(done)
					.catch((err) => done({ cancelled: false, error: err instanceof Error ? err.message : String(err) }));

				return loader;
			});
		}

		try {
			return await ctx.navigateTree(originId, {
				summarize: true,
				customInstructions: summaryPrompt,
				replaceInstructions: true,
			});
		} catch (error) {
			return { cancelled: false, error: error instanceof Error ? error.message : String(error) };
		}
	}

	async function executeEndReviewAction(
		ctx: ExtensionCommandContext,
		action: EndReviewAction,
		options: EndReviewActionOptions = {},
	): Promise<EndReviewActionResult> {
		const originId = getActiveReviewOrigin(ctx);
		if (!originId) {
			if (!getReviewState(ctx)?.active) {
				ctx.ui.notify("Not in a review branch (use /review first, or review was started in current session mode)", "info");
			}
			return "error";
		}

		const notifySuccess = options.notifySuccess ?? true;
		const activeKind = getActiveReviewKind(ctx);

		if (action === "returnOnly") {
			try {
				const result = await ctx.navigateTree(originId, { summarize: false });
				if (result.cancelled) {
					ctx.ui.notify("Navigation cancelled. Run /review to reopen the finish menu.", "info");
					return "cancelled";
				}
			} catch (error) {
				ctx.ui.notify(`Failed to return: ${error instanceof Error ? error.message : String(error)}`, "error");
				return "error";
			}

			clearReviewState(ctx);
			if (notifySuccess) {
				ctx.ui.notify("Review complete! Returned to original position.", "info");
			}
			return "ok";
		}

		const summaryResult = await navigateWithSummary(ctx, originId, options.showSummaryLoader ?? false);
		if (summaryResult === null) {
			ctx.ui.notify("Summarization cancelled. Run /review to reopen the finish menu.", "info");
			return "cancelled";
		}

		if (summaryResult.error) {
			ctx.ui.notify(`Summarization failed: ${summaryResult.error}`, "error");
			return "error";
		}

		if (summaryResult.cancelled) {
			ctx.ui.notify("Navigation cancelled. Run /review to reopen the finish menu.", "info");
			return "cancelled";
		}

		clearReviewState(ctx);

		if (action === "returnAndSummarize") {
			if (!ctx.ui.getEditorText().trim()) {
				ctx.ui.setEditorText(activeKind === "plan" ? "Act on the plan review findings" : "Act on the review findings");
			}
			if (notifySuccess) {
				ctx.ui.notify("Review complete! Returned and summarized.", "info");
			}
			return "ok";
		}

		pi.sendUserMessage(
			activeKind === "plan" ? PLAN_REVIEW_FIX_FINDINGS_PROMPT : REVIEW_FIX_FINDINGS_PROMPT,
			{ deliverAs: "followUp" },
		);
		if (notifySuccess) {
			ctx.ui.notify("Review complete! Returned and queued a follow-up to fix findings.", "info");
		}
		return "ok";
	}

	async function runEndReview(ctx: ExtensionCommandContext): Promise<void> {
		if (ctx.mode !== "tui") {
			ctx.ui.notify("Review finish requires interactive TUI mode", "error");
			return;
		}

		if (reviewLoopInProgress) {
			ctx.ui.notify("Loop fixing review is running. Wait for it to finish.", "info");
			return;
		}

		if (endReviewInProgress) {
			ctx.ui.notify("Review finish is already running", "info");
			return;
		}

		endReviewInProgress = true;
		try {
			const choice = await ctx.ui.select("Finish review:", [
				"Return only",
				"Return and fix findings",
				"Return and summarize",
			]);

			if (choice === undefined) {
				ctx.ui.notify("Cancelled. Run /review to reopen the finish menu.", "info");
				return;
			}

			const action: EndReviewAction =
				choice === "Return and fix findings"
					? "returnAndFix"
					: choice === "Return and summarize"
						? "returnAndSummarize"
						: "returnOnly";

			await executeEndReviewAction(ctx, action, {
				showSummaryLoader: true,
				notifySuccess: true,
			});
		} finally {
			endReviewInProgress = false;
		}
	}

}

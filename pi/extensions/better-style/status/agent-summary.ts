import {
	getMarkdownTheme,
	type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { Markdown } from "@earendil-works/pi-tui";
import { config } from "../config.ts";

export const AGENT_SUMMARY_ENTRY_TYPE = "better-style-agent-summary";

type AgentSummaryData = {
	commands: number;
	reads: number;
	edits: number;
	writes: number;
	others: number;
	failed: number;
	durationMs: number;
};

class AgentRunSummary {
	toolCount = 0;
	commands = 0;
	reads = new Set<string>();
	edits = new Set<string>();
	writes = new Set<string>();
	others = 0;
	failed = 0;
	readonly startedAt = Date.now();

	recordStart(toolName: string, args?: Record<string, unknown> | null): void {
		this.toolCount++;
		const base = toolName.split(".").pop() ?? toolName;
		const path = args?.path ?? args?.file_path;
		const file = typeof path === "string" && path ? path : undefined;
		if (base === "bash" || base === "powershell") this.commands++;
		else if (base === "read") {
			if (file) this.reads.add(file);
		} else if (base === "edit") {
			if (file) this.edits.add(file);
		} else if (base === "write") {
			if (file) this.writes.add(file);
		} else this.others++;
	}

	snapshot(): AgentSummaryData {
		return {
			commands: this.commands,
			reads: this.reads.size,
			edits: this.edits.size,
			writes: this.writes.size,
			others: this.others,
			failed: this.failed,
			durationMs: Date.now() - this.startedAt,
		};
	}
}

function plural(count: number): string {
	return count === 1 ? "" : "s";
}

function formatDuration(ms: number): string {
	const seconds = Math.floor(ms / 1_000);
	if (seconds < 1) return "";
	const minutes = Math.floor(seconds / 60);
	const remainder = seconds % 60;
	return minutes ? `${minutes}m ${remainder}s` : `${seconds}s`;
}

function summaryMarkdown(
	data: AgentSummaryData,
	colors: { success: string; failed: string },
): string {
	const parts: Array<{ text: string; failed?: boolean }> = [];
	if (data.commands) parts.push({ text: `ran ${data.commands} command${plural(data.commands)}` });
	if (data.reads) parts.push({ text: `read ${data.reads} file${plural(data.reads)}` });
	if (data.edits) parts.push({ text: `edited ${data.edits} file${plural(data.edits)}` });
	if (data.writes) parts.push({ text: `wrote ${data.writes} file${plural(data.writes)}` });
	if (data.others) parts.push({ text: `${data.others} other tool${plural(data.others)}` });
	if (data.failed) parts.push({ text: `${data.failed} failed`, failed: true });
	if (!parts.length) return "";

	const text = parts
		.map(({ text, failed }, index) => {
			const capitalized = index === 0 ? text[0]!.toUpperCase() + text.slice(1) : text;
			const color = failed ? colors.failed : colors.success;
			return color ? capitalized.replace(/\d+/, (count) => `${color}${count}\x1b[0m`) : capitalized;
		})
		.join(", ");
	const duration = formatDuration(data.durationMs);
	return `> *${duration ? `${text} · ${duration}` : text}*`;
}

export default function installAgentSummary(pi: ExtensionAPI): void {
	pi.registerEntryRenderer(AGENT_SUMMARY_ENTRY_TYPE, (entry, _options, theme) => {
		const markdown = summaryMarkdown(entry.data as AgentSummaryData, {
			success: theme.getFgAnsi("success"),
			failed: theme.getFgAnsi("error"),
		});
		return markdown ? new Markdown(markdown, 1, 0, getMarkdownTheme()) : undefined;
	});

	let summary = new AgentRunSummary();
	pi.on("agent_start", async () => {
		summary = new AgentRunSummary();
	});
	pi.on("tool_execution_start", async (event) => {
		summary.recordStart(event.toolName, event.args);
	});
	pi.on("tool_execution_end", async (event) => {
		if (event.isError === true) summary.failed++;
	});
	pi.on("agent_end", async () => {
		if (config.enableAgentSummary && summary.toolCount >= 2) {
			pi.appendEntry(AGENT_SUMMARY_ENTRY_TYPE, summary.snapshot());
		}
	});
}

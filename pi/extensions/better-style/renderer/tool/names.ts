import { config } from "../../config/config.ts";
import { oneLine } from "../../utils/format.ts";

function clip(value: unknown): string {
	return oneLine(value, config.inputClip);
}

/**
 * 工具名/标签人性化：与 default-mode 的 humanizeToolLabel、grouping 的 humanizeToolName
 * 逐字相同，收敛为一个共享实现。
 */
export function humanizeToolLabel(label: string): string {
	return label
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/[_-]+/g, " ")
		.replace(/\b\w/g, (char) => char.toUpperCase());
}

const AGENT_FAMILY_TOOL_NAMES = new Set([
	"Agent",
	"Agents",
	"get_subagent_result",
	"steer_subagent",
]);

/** default-mode（单工具卡）与 grouping（分组卡）在 agent/bash/grep/find/read/fallback 文案上不同。 */
export type ToolCallSummaryVariant = "default" | "grouping";

export type ToolCallSummaryOptions = {
	/** 已解析标题；缺省为 humanizeToolLabel(toolName)。 */
	title?: string;
	/** 文案变体；缺省 "default"。 */
	variant?: ToolCallSummaryVariant;
};

/**
 * 单工具调用摘要（{ main, detail }）。
 *
 * default-mode 与 grouping 共用；opts.variant 保留两处各自逐字一致的输出，
 * 不改动任何现有渲染字符串。
 */
export function toolCallSummary(
	toolName: string,
	args: any,
	opts: ToolCallSummaryOptions = {},
): { main: string; detail: string } {
	const title = opts.title ?? humanizeToolLabel(toolName);
	const variant = opts.variant ?? "default";
	if (!args || typeof args !== "object") return { main: title, detail: "" };
	const name = toolName.toLowerCase();
	const value = (fallback: string, ...keys: string[]) => {
		const found = keys.map((key) => args[key]).find((item) => typeof item === "string" && item);
		return `${title} ${clip(found || fallback)}`;
	};

	if (variant === "default" && AGENT_FAMILY_TOOL_NAMES.has(toolName) && args.agent_id) {
		return { main: `${title} ${clip(args.agent_id)}`, detail: "" };
	}
	if (variant === "grouping" && (name === "agent" || name === "agents")) {
		const displayName = args.subagent_type ?? args.agent_type ?? args.agent;
		if (typeof displayName === "string" && displayName) {
			return { main: `${title} ${displayName}`, detail: "" };
		}
		return {
			main: value(name === "agent" ? "launch agent" : "launch agents", "description", "prompt"),
			detail: "",
		};
	}
	if (variant === "grouping" && (name === "get_subagent_result" || name === "steer_subagent")) {
		return {
			main: value(name === "get_subagent_result" ? "agent result" : "steer agent", "agent_id"),
			detail: "",
		};
	}
	if (variant === "default" && name === "agents") {
		return { main: value("launch agents", "description", "prompt"), detail: "" };
	}
	if (name === "skill") return { main: value("run skill", "name"), detail: "" };
	if (name === "enterplanmode" || name === "enter_plan_mode") {
		return { main: `${title} enable read-only planning`, detail: "" };
	}
	if (name === "exitplanmode" || name === "exit_plan_mode") {
		return { main: `${title} present plan`, detail: "" };
	}
	if (name === "taskcreate") return { main: value("create task", "subject"), detail: "" };
	if (name === "tasklist") return { main: `${title} task list`, detail: "" };
	if (name === "taskget" || name === "taskupdate") {
		return { main: value("task", "taskId", "task_id"), detail: "" };
	}
	if (name === "taskoutput" || name === "taskstop") {
		return { main: value("background task", "task_id", "taskId"), detail: "" };
	}
	if (name === "taskexecute") {
		const ids = Array.isArray(args.task_ids)
			? args.task_ids
			: Array.isArray(args.taskIds)
				? args.taskIds
				: [];
		const summary = ids.length
			? `${ids[0]}${ids.length > 1 ? ` (+${ids.length - 1} tasks)` : ""}`
			: "start tasks";
		return { main: `${title} ${summary}`, detail: "" };
	}
	if (toolName === "read") {
		const details = [
			args.offset !== undefined ? `offset=${args.offset}` : "",
			args.limit !== undefined ? `limit=${args.limit}` : "",
		].filter(Boolean);
		if (variant === "grouping") {
			return {
				main: `Read ${clip(args.path || "...")}`,
				detail: details.length ? ` (${details.join(", ")})` : "",
			};
		}
		return {
			main: `${title}${args.path ? ` ${clip(args.path)}` : ""}`,
			detail: details.length ? ` (${details.join(", ")})` : "",
		};
	}
	if (variant === "grouping") {
		if (toolName === "bash") return { main: `Bash ${clip(args.command || "...")}`, detail: "" };
		if (toolName === "grep") {
			const pattern = clip(args.pattern || "...");
			return {
				main: `Grep ${JSON.stringify(pattern)}${args.path ? ` in ${clip(args.path)}` : ""}`,
				detail: "",
			};
		}
		if (toolName === "find") {
			const pattern = clip(args.pattern || "...");
			return {
				main: `Find ${JSON.stringify(pattern)}${args.path ? ` in ${clip(args.path)}` : ""}`,
				detail: "",
			};
		}
	}
	if (variant === "default") {
		const preferred =
			args.path ??
			args.file_path ??
			args.command ??
			args.query ??
			args.question ??
			args.pattern ??
			args.url ??
			args.name ??
			args.tool_use_id ??
			args.toolCallId ??
			args.id ??
			args.message;
		return {
			main:
				preferred !== undefined && preferred !== null && typeof preferred !== "object"
					? `${title} ${clip(preferred)}`
					: title,
			detail: "",
		};
	}
	const preferred =
		args.agent_id ??
		args.path ??
		args.file_path ??
		args.url ??
		args.description ??
		args.query ??
		args.name ??
		args.prompt;
	return {
		main: `${title}${preferred === undefined ? "" : ` ${clip(preferred)}`}`,
		detail: "",
	};
}

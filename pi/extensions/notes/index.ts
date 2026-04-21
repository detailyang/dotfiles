/**
 * Pi Notes Extension - 生成中文学习笔记
 *
 * 功能:
 * - 注册 /to-notes 命令，总结当前会话上下文生成中文笔记
 * - 笔记保留核心内容，作为知识库便于日后学习
 * - 自动生成 Markdown 格式的标题层级结构
 * - 自动保存到 ~/notes/YYYY/ 目录，按日期命名
 * - 使用 pi 当前默认模型生成笔记
 *
 * 笔记结构:
 * - # 标题 (一级标题)
 * - ## 背景/问题 (二级标题)
 * - ## 核心内容 (二级标题，包含 ### 小节)
 * - ## 代码/命令 (二级标题)
 * - ## 总结与思考 (二级标题)
 * - ## 后续学习 (二级标题)
 *
 * 用法:
 *   /to-notes          - 生成笔记并保存
 *   /to-notes <标题>   - 指定笔记标题
 */

import { complete } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { DynamicBorder, getMarkdownTheme } from "@mariozechner/pi-coding-agent";
import { Container, Markdown, matchesKey, Text } from "@mariozechner/pi-tui";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { homedir } from "node:os";

type ContentBlock = {
	type?: string;
	text?: string;
	name?: string;
	arguments?: Record<string, unknown>;
};

type SessionEntry = {
	type: string;
	message?: {
		role?: string;
		content?: unknown;
		toolName?: string;
		details?: unknown;
	};
	timestamp?: number;
	customType?: string;
};

const NOTES_BASE_DIR = `${homedir()}/notes`;

/**
 * 从 content 中提取文本部分
 */
const extractTextParts = (content: unknown): string[] => {
	if (typeof content === "string") {
		return [content];
	}

	if (!Array.isArray(content)) {
		return [];
	}

	const textParts: string[] = [];
	for (const part of content) {
		if (!part || typeof part !== "object") {
			continue;
		}

		const block = part as ContentBlock;
		if (block.type === "text" && typeof block.text === "string") {
			textParts.push(block.text);
		}
	}

	return textParts;
};

/**
 * 从 content 中提取工具调用信息
 */
const extractToolCallLines = (content: unknown): string[] => {
	if (!Array.isArray(content)) {
		return [];
	}

	const toolCalls: string[] = [];
	for (const part of content) {
		if (!part || typeof part !== "object") {
			continue;
		}

		const block = part as ContentBlock;
		if (block.type === "toolCall" && typeof block.name === "string") {
			const args = block.arguments ?? {};
			toolCalls.push(`[工具调用] ${block.name}: ${JSON.stringify(args)}`);
		}
	}

	return toolCalls;
};

/**
 * 从 content 中提取工具结果信息
 */
const extractToolResultLines = (content: unknown, toolName?: string): string[] => {
	if (!Array.isArray(content)) {
		return [];
	}

	const results: string[] = [];
	for (const part of content) {
		if (!part || typeof part !== "object") {
			continue;
		}

		const block = part as ContentBlock;
		if (block.type === "text" && typeof block.text === "string") {
			// 截断过长的工具结果
			const text = block.text.length > 500 ? block.text.slice(0, 500) + "..." : block.text;
			results.push(`[工具结果${toolName ? ` - ${toolName}` : ""}] ${text}`);
		}
	}

	return results;
};

/**
 * 构建会话文本
 */
const buildConversationText = (entries: SessionEntry[]): string => {
	const sections: string[] = [];

	for (const entry of entries) {
		if (entry.type !== "message" || !entry.message?.role) {
			continue;
		}

		const role = entry.message.role;
		const isUser = role === "user";
		const isAssistant = role === "assistant";
		const isToolResult = role === "toolResult";

		if (!isUser && !isAssistant && !isToolResult) {
			continue;
		}

		const entryLines: string[] = [];

		if (isUser || isAssistant) {
			const textParts = extractTextParts(entry.message.content);
			if (textParts.length > 0) {
				const roleLabel = isUser ? "用户" : "助手";
				const messageText = textParts.join("\n").trim();
				if (messageText.length > 0) {
					entryLines.push(`[${roleLabel}] ${messageText}`);
				}
			}
		}

		if (isAssistant) {
			entryLines.push(...extractToolCallLines(entry.message.content));
		}

		if (isToolResult) {
			entryLines.push(...extractToolResultLines(entry.message.content, entry.message.toolName));
		}

		if (entryLines.length > 0) {
			sections.push(entryLines.join("\n"));
		}
	}

	return sections.join("\n\n");
};

/**
 * 构建总结提示词（系统指令 + 用户内容分离）
 */
const buildNotesSystemPrompt = (customTitle?: string): string => {
	const titleHint = customTitle ? `\n建议标题: ${customTitle}` : "";

	return [
		"请将用户提供的对话内容总结成一篇结构化的中文学习笔记。",
		"",
		"要求:",
		"1. 保留核心知识点、关键概念和重要结论",
		"2. 使用清晰的层级结构（标题、小节、列表）",
		"3. 包含代码示例的关键部分（如有）",
		"4. 添加个人理解和思考（基于对话中的推理过程）",
		"5. 标注待深入学习的点或遗留问题",
		"6. 使用中文撰写，专业术语可保留英文",
		"",
		"输出格式 (必须使用 Markdown 标题层级):",
		"",
		"# 标题",
		"简洁概括主题的标题（一级标题）",
		"",
		"## 背景",
		"为什么进行这次对话，问题是什么",
		"",
		"## 核心内容",
		"分点列出关键知识点，可包含二级或三级小节",
		"",
		"### 子主题1（如有）",
		"详细展开...",
		"",
		"### 子主题2（如有）",
		"详细展开...",
		"",
		"## 代码/命令",
		"保留重要的代码片段（如有）",
		"",
		"## 总结与思考",
		"自己的理解、延伸和感悟",
		"",
		"## 后续学习",
		"待深入的方向、遗留问题或延伸阅读",
		"",
		"注意:",
		"- 必须使用 # ## ### 等 Markdown 标题语法",
		"- 标题要有层级关系，不要所有都用同一级别",
		"- 主标题用 #，大节用 ##，小节用 ###",
		titleHint,
	].join("\n");
};

const buildNotesUserMessage = (conversationText: string, customTitle?: string): string => {
	const titleHint = customTitle ? `建议标题：${customTitle}` : "";

	return [
		"任务：将下面对话总结为结构化中文学习笔记，保留关键知识点、代码/命令和结论。",
		titleHint,
		"",
		"<对话内容>",
		conversationText,
		"</对话内容>",
	].filter(Boolean).join("\n");
};

/**
 * 生成文件路径（包含年份子目录）
 * 格式: ~/notes/2025/04-20-标题.md
 */
const generateFilePath = (title?: string): { yearDir: string; fileName: string; fullPath: string } => {
	const now = new Date();
	const year = now.getFullYear().toString(); // 2025
	const monthDay = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; // 04-20

	let fileName: string;
	if (title) {
		// 清理标题中的非法字符，限制长度
		const safeTitle = title.replace(/[<>:"/\\|?*\n\r]/g, "_").slice(0, 40);
		fileName = `${monthDay}-${safeTitle}.md`;
	} else {
		fileName = `${monthDay}-notes.md`;
	}

	const yearDir = `${NOTES_BASE_DIR}/${year}`;
	const fullPath = `${yearDir}/${fileName}`;

	return { yearDir, fileName, fullPath };
};

/**
 * 确保目录存在
 */
const ensureDir = async (path: string): Promise<void> => {
	try {
		await mkdir(path, { recursive: true });
	} catch {
		// 目录可能已存在
	}
};

/**
 * 保存笔记到文件
 */
const saveNotes = async (content: string, title?: string): Promise<{ filePath: string; fileName: string }> => {
	const { yearDir, fileName, fullPath } = generateFilePath(title);
	await ensureDir(yearDir);

	const header = [
		"---",
		`created: ${new Date().toISOString()}`,
		`source: pi-session`,
		"---",
		"",
	].join("\n");

	await writeFile(fullPath, header + content, "utf8");
	return { filePath: fullPath, fileName };
};

/**
 * 显示笔记预览 UI
 */
const showNotesPreview = async (content: string, filePath: string, ctx: ExtensionCommandContext) => {
	if (!ctx.hasUI) {
		console.log(`笔记已保存到: ${filePath}`);
		console.log("\n--- 笔记内容预览 ---\n");
		console.log(content.slice(0, 1000) + (content.length > 1000 ? "\n..." : ""));
		return;
	}

	await ctx.ui.custom((_tui, theme, _kb, done) => {
		const container = new Container();
		const border = new DynamicBorder((s: string) => theme.fg("accent", s));
		const mdTheme = getMarkdownTheme();

		container.addChild(border);
		container.addChild(new Text(theme.fg("accent", theme.bold("📝 学习笔记已生成")), 1, 0));
		container.addChild(new Text(theme.fg("muted", `保存路径: ${filePath}`), 1, 0));
		container.addChild(new Text("", 1, 0));
		container.addChild(new Markdown(content.slice(0, 3000) + (content.length > 3000 ? "\n\n..." : ""), 1, 1, mdTheme));
		container.addChild(new Text("", 1, 0));
		container.addChild(new Text(theme.fg("dim", "按 Enter 或 Esc 关闭"), 1, 0));
		container.addChild(border);

		return {
			render: (width: number) => container.render(width),
			invalidate: () => container.invalidate(),
			handleInput: (data: string) => {
				if (matchesKey(data, "enter") || matchesKey(data, "escape")) {
					done(undefined);
				}
			},
		};
	});
};

export default function (pi: ExtensionAPI) {
	pi.registerCommand("to-notes", {
		description: "总结当前会话生成学习笔记",
		handler: async (args, ctx) => {
			const customTitle = args.trim() || undefined;

			// 检查当前模型
			if (!ctx.model) {
				if (ctx.hasUI) {
					ctx.ui.notify("未选择模型，请先选择模型", "error");
				} else {
					console.error("未选择模型，请先选择模型");
				}
				return;
			}

			// 获取会话内容
			const branch = ctx.sessionManager.getBranch();
			const conversationText = buildConversationText(branch);

			if (!conversationText.trim()) {
				if (ctx.hasUI) {
					ctx.ui.notify("会话内容为空，无法生成笔记", "warning");
				} else {
					console.error("会话内容为空，无法生成笔记");
				}
				return;
			}

			if (ctx.hasUI) {
				ctx.ui.notify(`正在使用 ${ctx.model.id} 生成学习笔记...`, "info");
			}

			// 获取当前模型的 API key
			const auth = await ctx.modelRegistry.getApiKeyAndHeaders(ctx.model);
			if (!auth?.ok || !auth.apiKey) {
				const errorMsg = auth?.error || `未配置 ${ctx.model.provider}/${ctx.model.id} 的 API Key`;
				if (ctx.hasUI) {
					ctx.ui.notify(errorMsg, "error");
				} else {
					console.error(errorMsg);
				}
				return;
			}

			try {
				// 调用当前模型生成笔记
				const summaryMessages = [
					{
						role: "user" as const,
						content: [{ type: "text" as const, text: buildNotesUserMessage(conversationText, customTitle) }],
						timestamp: Date.now(),
					},
				];

				const response = await complete(
					ctx.model,
					{ systemPrompt: buildNotesSystemPrompt(customTitle), messages: summaryMessages },
					{
						apiKey: auth.apiKey,
						headers: auth.headers,
					},
					ctx.signal,
				);

				// 提取生成的笔记内容
				const notesContent = response.content
					.filter((c): c is { type: "text"; text: string } => c.type === "text")
					.map((c) => c.text)
					.join("\n")
					.trim();

				if (response.stopReason === "error" || response.stopReason === "aborted") {
					const errorMsg = response.errorMessage?.trim() || `模型生成失败（${response.stopReason}）`;
					if (ctx.hasUI) {
						ctx.ui.notify(`生成笔记失败: ${errorMsg}`, "error");
					} else {
						console.error(`生成笔记失败: ${errorMsg}`);
					}
					return;
				}

				if (!notesContent) {
					const blockTypes = [...new Set(response.content.map((c) => c.type))].join(", ") || "none";
					const detail = `stopReason=${response.stopReason}, blocks=${blockTypes}`;
					if (ctx.hasUI) {
						ctx.ui.notify(`模型未返回可保存的正文（${detail}）`, "error");
					} else {
						console.error(`模型未返回可保存的正文（${detail}）`);
					}
					return;
				}

				// 尝试从内容中提取标题
				const titleMatch = notesContent.match(/^#\s+(.+)$/m);
				const extractedTitle = titleMatch ? titleMatch[1].trim() : customTitle;

				// 保存笔记
				const { filePath, fileName } = await saveNotes(notesContent, extractedTitle);

				// 显示结果
				await showNotesPreview(notesContent, filePath, ctx);

				if (ctx.hasUI) {
					ctx.ui.notify(`笔记已保存: ${fileName}`, "success");
				}
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				if (ctx.hasUI) {
					ctx.ui.notify(`生成笔记失败: ${errorMsg}`, "error");
				} else {
					console.error(`生成笔记失败: ${errorMsg}`);
				}
			}
		},
	});
}

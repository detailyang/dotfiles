/**
 * 顶层共享的 ANSI/终端控制序列处理。
 *
 * 收敛原先散落在 renderer/grouping.ts / renderer/mouse/packets.ts /
 * renderer/compact-mode.ts 的重复剥离逻辑，供 renderer 与 feature 共用。
 */

/** 单个 CSI 序列（颜色、光标等 SGR/CUP/ED 等）。 */
const CSI_SEQUENCE_RE = /\x1b\[[0-?]*[ -/]*[@-~]/g;
/** OSC 序列（如 \x1b]8;;url\x07 或 ST 结尾）。 */
const OSC_SEQUENCE_RE = /\x1b\][^\x07]*(?:\x07|\x1b\\)/g;
/** compact-mode 原有 hasVisibleText 用的更严格 OSC（内容不允许内嵌 ESC）。 */
const OSC_SEQUENCE_STRICT_RE = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;

/** 剥离一行内所有 CSI 序列。 */
export function stripAnsi(line: string): string {
	return line.replace(CSI_SEQUENCE_RE, "");
}

/** 仅剥离终端序列、保留原布局（换行/空白不动），用于命中区间计算。 */
export function stripTerminalSequencesPreservingLayout(value: string): string {
	return value.replace(OSC_SEQUENCE_RE, "").replace(CSI_SEQUENCE_RE, "");
}

/** 剥离终端序列并折叠空白（用于纯文本比较）。 */
export function stripTerminalSequences(value: string): string {
	return stripTerminalSequencesPreservingLayout(value).replace(/\s+/g, " ").trim();
}

/** 去掉行内所有 CSI/OSC 序列后是否仍有可见文本（判断工具卡首尾内容行）。 */
export function hasVisibleText(line: string): boolean {
	// OSC 用更严格的变体：内容内嵌 ESC 时不吞并后续文本，保持 compact-mode 原有语义。
	return line.replace(CSI_SEQUENCE_RE, "").replace(OSC_SEQUENCE_STRICT_RE, "").trim().length > 0;
}

/** 剥离背景色 ANSI（用于重新铺背景行）。 */
export function stripBackgroundAnsi(line: string): string {
	return line.replace(/\x1b\[(?:4[0-9]|10[0-7]|48(?:(?:;|:)[0-9]+)+|49)m/g, "");
}

/** 剥离行首状态图标（展开组内工具首行复用）。 */
export function stripLeadingStatusIcon(line: string): string {
	return line.replace(
		/^((?:\x1b\[[0-9;]*m|[ \t]|[├└│─])*)(?:\x1b\[[0-9;]*m)*(?:[✓✗●○■⬤•·])(?:\x1b\[[0-9;]*m)*\s+/,
		"$1",
	);
}

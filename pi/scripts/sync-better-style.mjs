#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const UPSTREAM_COMMIT = "5d7a2666f51da9f450bd019af10200c88cc1df98";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PI_ROOT = resolve(SCRIPT_DIR, "..");
const REPO_ROOT = resolve(PI_ROOT, "..");
const TEMPLATE_ROOT = join(SCRIPT_DIR, "better-style", "templates");
const sourceRoot = resolve(process.argv[2] ?? "");

function fail(message) {
  throw new Error(`sync-better-style: ${message}`);
}

if (!process.argv[2]) fail("usage: node scripts/sync-better-style.mjs <pi-cc-extensions checkout>");
if (!existsSync(join(sourceRoot, "extensions", "index.ts"))) fail(`invalid upstream checkout: ${sourceRoot}`);

const actualCommit = execFileSync("git", ["-C", sourceRoot, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
if (actualCommit !== UPSTREAM_COMMIT) {
  fail(`expected upstream ${UPSTREAM_COMMIT}, got ${actualCommit}`);
}

const outputRoot = join(PI_ROOT, "extensions", "better-style");
rmSync(outputRoot, { recursive: true, force: true });
cpSync(join(sourceRoot, "extensions"), outputRoot, { recursive: true });

for (const relative of [
  "feature/context.ts",
  "feature/reference",
  "feature/shell/aliases.ts",
  "feature/shell/flush-docked-bash.ts",
  "feature/shell/startup-header.ts",
  "feature/shell/working-message.ts",
  "renderer/mouse",
  "utils/fullscreen-detect.ts",
  "utils/sgr-mouse.ts",
]) {
  rmSync(join(outputRoot, relative), { recursive: true, force: true });
}

const overlays = new Map([
  ["index.ts", "index.ts"],
  ["config/config.ts", "config.ts"],
  ["config/panel.ts", "panel.ts"],
  ["renderer/index.ts", "renderer-index.ts"],
  ["renderer/tui-anchor.ts", "tui-anchor.ts"],
  ["renderer/tool/show-more-hint.ts", "show-more-hint.ts"],
]);
for (const [destination, template] of overlays) {
  const destinationPath = join(outputRoot, destination);
  mkdirSync(dirname(destinationPath), { recursive: true });
  cpSync(join(TEMPLATE_ROOT, template), destinationPath);
}

function read(relative) {
  return readFileSync(join(outputRoot, relative), "utf8");
}

function write(relative, content) {
  writeFileSync(join(outputRoot, relative), content);
}

function replaceRequired(relative, from, to) {
  const source = read(relative);
  if (!source.includes(from)) fail(`${relative}: expected text not found: ${from}`);
  write(relative, source.replaceAll(from, to));
}

const hoverExpressions = new Map([
  ["renderer/default-mode.ts", "isToolCallHovered(toolCallId)"],
  ["renderer/compact-mode.ts", "isToolCallHovered(component.toolCallId)"],
]);
for (const [relative, hoverExpression] of hoverExpressions) {
  replaceRequired(relative, 'import { isToolCallHovered } from "./mouse/hover.ts";\n', "");
  replaceRequired(relative, hoverExpression, "false");
}

{
  const relative = "renderer/default-mode.ts";
  const source = read(relative);
  const start = source.indexOf("export function preservesOriginalRenderer(");
  const end = source.indexOf("\n\nfunction renderDefault", start);
  if (start < 0 || end < 0) fail(`${relative}: renderer preservation function not found`);
  const replacement = `function hasCustomRenderer(definition: any): boolean {
\treturn Boolean(
\t\tdefinition &&
\t\t\t(definition.renderShell === "self" ||
\t\t\t\ttypeof definition.renderCall === "function" ||
\t\t\t\ttypeof definition.renderResult === "function"),
\t);
}

/** Extension-owned renderers win by default; excludeRenderers can also preserve built-ins. */
export function preservesOriginalRenderer(
\textensionDefinition: any,
\ttoolName: string,
\tbuiltInToolDefinition?: any,
\texcludeRenderers: readonly string[] = config.excludeRenderers,
): boolean {
\tif (hasCustomRenderer(extensionDefinition)) return true;
\treturn excludeRenderers.includes(toolName) && hasCustomRenderer(builtInToolDefinition);
}`;
  write(relative, source.slice(0, start) + replacement + source.slice(end));
}

replaceRequired(
  "renderer/default-mode.ts",
  'import { oneLine } from "../utils/format.ts";\n',
  'import { oneLine } from "../utils/format.ts";\nimport { toolBackgroundSlot, toolStatus } from "./tool/grouping.ts";\n',
);
replaceRequired(
  "renderer/default-mode.ts",
  `\t\t\tconst theme = getMessageDisplayTheme();
\t\t\tif (!theme?.bg) return;
\t\t\tconst box = this.contentBox;
\t\t\t// 展开最外层卡片：上下左右内间距 1 格
\t\t\tif (box) {
\t\t\t\tbox.paddingX = 1;
\t\t\t\tbox.paddingY = 1;
\t\t\t\tif (box.setBgFn) box.setBgFn((text: string) => theme.bg("userMessageBg", text));
\t\t\t}`,
  `\t\t\tconst theme = getMessageDisplayTheme();
\t\t\tif (!theme?.bg) return;
\t\t\tconst box = this.contentBox;
\t\t\tif (box) {
\t\t\t\tbox.paddingX = 1;
\t\t\t\tbox.paddingY = 1;
\t\t\t\tconst slot = toolBackgroundSlot(toolStatus(this));
\t\t\t\tbox.setBgFn?.((text: string) => theme.bg(slot, text));
\t\t\t}`,
);

replaceRequired(
  "renderer/default-mode.ts",
  "/** 展开面板背景统一为 user message 背景色；折叠行保持原生状态色。",
  "/** 展开面板使用工具状态背景；折叠行保持原生状态色。",
);
replaceRequired(
  "renderer/default-mode.ts",
  "\tresolveToolVisualState,\n\tscheduleAnimation,\n\tsettledIcon,",
  "\tresolveToolVisualState,\n\tsettledIcon,",
);
replaceRequired(
  "renderer/default-mode.ts",
  "\t\t\tif (isPending && context?.executionStarted) scheduleAnimation(context);\n",
  "",
);

replaceRequired(
  "utils/format.ts",
  `/** 毫秒 → "1h 2m 3s"/"2m 3s"/"3s"；低于 1 秒返回 ""（省略）。 */
export function formatDuration(ms: number): string {
\tconst totalSec = Math.floor(ms / 1000);
\tif (totalSec < 1) return "";
\tconst hours = Math.floor(totalSec / 3600);
\tconst minutes = Math.floor((totalSec % 3600) / 60);
\tconst seconds = totalSec % 60;
\tif (hours > 0) return \`\${hours}h \${minutes}m \${seconds}s\`;
\tif (minutes > 0) return \`\${minutes}m \${seconds}s\`;
\treturn \`\${seconds}s\`;
}

`,
  "",
);

{
  const relative = "renderer/tool/result.ts";
  let source = read(relative);
  source = source.replace(
    'import { TOOL_LOADING_INTERVAL_MS, toolLoadingIcon } from "../../utils/tool-loading-icon.ts";',
    'import { toolLoadingIcon } from "../../utils/tool-loading-icon.ts";',
  );
  const start = source.indexOf("const activeAnimationContexts = new Set<any>();");
  const end = source.indexOf("export function pendingIcon", start);
  if (start < 0 || end < 0) fail(`${relative}: animation scheduler not found`);
  source = source.slice(0, start) + source.slice(end);
  source = source
    .replace("\tif (visualState !== \"pending\") clearAnimation(context);\n", "")
    .replaceAll('"toolOutput"', '"text"')
    .replace('if (!match) return theme.fg("muted", rawLine);', 'if (!match) return theme.fg("text", rawLine);')
    .replace('theme.fg("muted", rest ?? "")', 'theme.fg("text", rest ?? "")')
    .replace('theme.fg("muted", match[3] ?? "")', 'theme.fg("text", match[3] ?? "")')
    .replace('theme.fg("muted", source)', 'theme.fg("text", source)');
  write(relative, source);
}

{
  const relative = "renderer/tool/grouping.ts";
  let source = read(relative);
  source = source
    .replace(
      'import { TOOL_LOADING_INTERVAL_MS, toolLoadingIcon } from "../../utils/tool-loading-icon.ts";',
      'import { toolLoadingIcon } from "../../utils/tool-loading-icon.ts";',
    )
    .replace("\ttheme?: any;\n\tanimationTimer: ReturnType<typeof setTimeout> | null;", "\ttheme?: any;");
  const animationStart = source.indexOf("function scheduleGroupAnimation(");
  const animationEnd = source.indexOf("\nfunction visibleLines", animationStart);
  if (animationStart < 0 || animationEnd < 0) fail(`${relative}: group animation scheduler not found`);
  source = source.slice(0, animationStart) + source.slice(animationEnd + 1);
  source = source
    .replace(
      `\t\tif (
\t\t\t(this.children as any[]).some((tool) => tool?.executionStarted && status(tool) === "pending")
\t\t)
\t\t\tscheduleGroupAnimation(this.patch);
`,
      "",
    )
    .replace("\t\tif (previous.animationTimer) clearTimeout(previous.animationTimer);\n\t\tprevious.animationTimer = null;\n", "")
    .replace("\t\tanimationTimer: null,\n", "")
    .replace("\t\t\tif (patch.animationTimer) clearTimeout(patch.animationTimer);\n\t\t\tpatch.animationTimer = null;\n", "");
  source = source
    .replace(
      "type ToolStatus = \"pending\" | \"success\" | \"error\";",
      "export type ToolStatus = \"pending\" | \"success\" | \"error\";",
    )
    .replace("function status(tool: any): ToolStatus {", "export function toolStatus(tool: any): ToolStatus {")
    .replaceAll("status(tool)", "toolStatus(tool)")
    .replace(
      "function statusIcon(value: ToolStatus): string {",
      `export function toolBackgroundSlot(
\tvalue: ToolStatus,
): "toolPendingBg" | "toolSuccessBg" | "toolErrorBg" {
\tif (value === "error") return "toolErrorBg";
\tif (value === "pending") return "toolPendingBg";
\treturn "toolSuccessBg";
}

function statusIcon(value: ToolStatus): string {`,
    )
    .replace("\t\t\tconst toolStatus = toolStatus(tool);", "\t\t\tconst toolStatusValue = toolStatus(tool);")
    .replace("const color = toolStatus === \"pending\" ? \"accent\" : toolStatus;", "const color = toolStatusValue === \"pending\" ? \"accent\" : toolStatusValue;")
    .replaceAll("statusIcon(toolStatus)", "statusIcon(toolStatusValue)");
  const start = source.indexOf("/** 生成一行铺满 width 的 slot 背景行");
  const end = source.indexOf("\n\nfunction toolSummary", start);
  if (start < 0 || end < 0) fail(`${relative}: padded row helper not found`);
  source =
    source.slice(0, start) +
    `/** Pad a row to a stable width under one theme-owned status background. */
export function paddedBackgroundRow(
\ttheme: any,
\tslot: "toolPendingBg" | "toolSuccessBg" | "toolErrorBg",
\tcontent: string,
\twidth: number,
): string {
\tconst innerWidth = Math.max(0, width - 2);
\tconst clipped = truncateToWidth(stripBackgroundAnsi(content), innerWidth, "");
\tconst row = \` \${clipped}\${" ".repeat(Math.max(0, innerWidth - visibleWidth(clipped)))} \`;
\tconst bgAnsi =
\t\ttypeof theme?.getBgAnsi === "function" ? String(theme.getBgAnsi(slot) ?? "") : "";
\tif (bgAnsi) {
\t\tconst stable = row.replace(/\\x1b\\[(?:0)?m/g, (reset) => reset + bgAnsi);
\t\treturn \`\${bgAnsi}\${stable}\\x1b[49m\`;
\t}
\treturn typeof theme?.bg === "function" ? theme.bg(slot, row) : row;
}` +
    source.slice(end);
  const expandedFrom = `\t\tif (this._expanded) {
\t\t\t// 展开面板统一用 user message 背景色（ccstyle 约定），不按状态区分。
\t\t\tconst backgroundSlot = "userMessageBg";
\t\t\tfor (const line of expandedLines) {
\t\t\t\tlines.push(paddedBackgroundRow(theme, backgroundSlot, line, width));
\t\t\t}
\t\t\tlines.push(paddedBackgroundRow(theme, backgroundSlot, "", width));
\t\t} else if (counts.pending === 0) {`;
  const expandedTo = `\t\tif (this._expanded) {
\t\t\tconst backgroundSlot = toolBackgroundSlot(overall);
\t\t\tfor (const line of expandedLines) {
\t\t\t\tlines.push(paddedBackgroundRow(theme, backgroundSlot, line, width));
\t\t\t}
\t\t\tlines.push(paddedBackgroundRow(theme, backgroundSlot, "", width));
\t\t} else if (counts.pending === 0) {`;
  if (!source.includes(expandedFrom)) fail(`${relative}: expanded background block not found`);
  write(relative, source.replace(expandedFrom, expandedTo));
}

{
  const relative = "renderer/compact-mode.ts";
  let source = read(relative);
  source = source.replace(
    'import { paddedBackgroundRow } from "./tool/grouping.ts";',
    `import {
\tpaddedBackgroundRow,
\ttoolBackgroundSlot,
\ttoolStatus,
\ttype ToolStatus,
} from "./tool/grouping.ts";`,
  );
  const start = source.indexOf("/** RGB → HSL");
  const end = source.indexOf("\nfunction compactRoundCard(", start);
  if (start < 0 || end < 0) fail(`${relative}: expanded card helpers not found`);
  const replacement = `/** edit/write expanded cards use their current tool status background. */
function editWriteExpandedCard(theme: any, status: ToolStatus): any {
\tconst slot = toolBackgroundSlot(status);
\treturn new Box(
\t\t1,
\t\t1,
\t\ttypeof theme?.bg === "function" ? (text: string) => theme.bg(slot, text) : undefined,
\t);
}

function nestedToolCardRow(line: string, width: number): string {
\tconst leftInset = 2;
\tconst rightInset = 3;
\tconst contentWidth = Math.max(0, width - leftInset - rightInset);
\tconst text = stripBackgroundAnsi(line).replace(/^ +/, "");
\tconst innerPad = 2;
\tconst clipped = truncateToWidth(text, Math.max(0, contentWidth - innerPad), "");
\tconst pad = Math.max(0, contentWidth - innerPad - visibleWidth(clipped));
\treturn \`\${" ".repeat(leftInset)} \${clipped}\${" ".repeat(pad)} \${" ".repeat(rightInset)}\`;
}

function layoutExpandedToolCard(
\ttheme: any,
\tchildren: any[],
\twidth: number,
\tbackgroundSlot: "toolPendingBg" | "toolSuccessBg" | "toolErrorBg",
): { lines: string[]; hits: Array<{ child: any; start: number; end: number }> } {
\tconst innerWidth = Math.max(0, width - 2);
\tconst lines: string[] = [];
\tconst hits: Array<{ child: any; start: number; end: number }> = [];
\tconst isThinkingPreview = (child: any) => typeof child?.setHintHovered === "function";
\tlines.push(paddedBackgroundRow(theme, backgroundSlot, "", width));
\tlet skipLeadingBlank = true;
\tfor (const child of children) {
\t\tconst childLines = child.render(innerWidth);
\t\tconst nest = child.__ccToolCard || (isThinkingPreview(child) && child.expanded === true);
\t\tif (!nest) {
\t\t\tlet start = 0;
\t\t\tif (skipLeadingBlank) {
\t\t\t\twhile (start < childLines.length && !hasVisibleText(childLines[start])) start++;
\t\t\t\tskipLeadingBlank = false;
\t\t\t}
\t\t\tconst rangeStart = lines.length;
\t\t\tfor (let i = start; i < childLines.length; i++) {
\t\t\t\tlines.push(paddedBackgroundRow(theme, backgroundSlot, childLines[i], width));
\t\t\t}
\t\t\tif (lines.length > rangeStart) hits.push({ child, start: rangeStart, end: lines.length });
\t\t\tcontinue;
\t\t}
\t\tskipLeadingBlank = false;
\t\tlet first = -1;
\t\tlet last = -1;
\t\tfor (let i = 0; i < childLines.length; i++) {
\t\t\tif (hasVisibleText(childLines[i])) {
\t\t\t\tif (first < 0) first = i;
\t\t\t\tlast = i;
\t\t\t}
\t\t}
\t\tif (first < 0) {
\t\t\tfor (const line of childLines) {
\t\t\t\tlines.push(paddedBackgroundRow(theme, backgroundSlot, line, width));
\t\t\t}
\t\t\tcontinue;
\t\t}
\t\tlines.push(paddedBackgroundRow(theme, backgroundSlot, "", width));
\t\tconst rangeStart = lines.length;
\t\tlines.push(paddedBackgroundRow(theme, backgroundSlot, nestedToolCardRow("", width), width));
\t\tfor (let i = first; i <= last; i++) {
\t\t\tlines.push(
\t\t\t\tpaddedBackgroundRow(theme, backgroundSlot, nestedToolCardRow(childLines[i], width), width),
\t\t\t);
\t\t}
\t\tlines.push(paddedBackgroundRow(theme, backgroundSlot, nestedToolCardRow("", width), width));
\t\tif (isThinkingPreview(child)) hits.push({ child, start: rangeStart, end: lines.length });
\t}
\tlines.push(paddedBackgroundRow(theme, backgroundSlot, "", width));
\treturn { lines, hits };
}
`;
  write(relative, source.slice(0, start) + replacement + source.slice(end));
}

{
  const relative = "renderer/compact-mode.ts";
  let source = read(relative);
  const replaceRange = (startMarker, endMarker, replacement, label) => {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    if (start < 0 || end < 0) fail(`${relative}: ${label} not found`);
    source = source.slice(0, start) + replacement + source.slice(end);
  };

  replaceRange(
    "/** compact 渲染层对 compact-thinking 的只读查询面",
    "const EDIT_WRITE_TOOLS",
    "",
    "thinking query",
  );
  replaceRange(
    "/** 与 compact-thinking 主渲染器共用的活动思考扫光动画。 */",
    "/** assistant stopReason",
    "",
    "thinking animation",
  );
  replaceRange(
    "/**\n * 逐条 assistant message 的摘要文本",
    "function fallbackTheme",
    `/** Build a compact summary without elapsed-time tracking. */
function buildMessagesSummary(messages: Iterable<any>, runningActive = false): string {
\tconst parts: string[] = [];
\tconst counts = new Map<string, number>();
\tconst readPaths = new Set<string>();
\tfor (const message of messages) {
\t\tconst content = Array.isArray(message?.content) ? message.content : [];
\t\tfor (const item of content) {
\t\t\tif (item?.type !== "toolCall") continue;
\t\t\tconst rawName = typeof item.name === "string" ? item.name : "tool";
\t\t\tif (EDIT_WRITE_TOOLS.has(rawName)) continue;
\t\t\tconst name = sanitizeToolResultText(rawName);
\t\t\tif (rawName.split(".").pop() === "read") {
\t\t\t\tconst args = item.arguments ?? item.args ?? {};
\t\t\t\tconst path = args.path ?? args.file_path ?? args.file;
\t\t\t\tif (typeof path === "string" && path.length > 0) {
\t\t\t\t\tif (readPaths.has(path)) continue;
\t\t\t\t\treadPaths.add(path);
\t\t\t\t}
\t\t\t}
\t\t\tcounts.set(name, (counts.get(name) ?? 0) + 1);
\t\t}
\t}
\tif (runningActive) parts.push("Running...");
\tfor (const [name, count] of counts) parts.push(\`\${name}×\${count}\`);
\treturn parts.join(", ");
}

export function buildMessageSummary(message: any): string {
\treturn buildMessagesSummary([message]);
}

`,
    "summary builder",
  );
  source = source
    .replace(
      " * （`Ran for 8s, bash×2, read×2`），edit/write 独立标题行（`✓ write <path> (+25 -0)`），",
      " * （`Running..., bash×2, read×2`），edit/write 独立标题行（`✓ write <path> (+25 -0)`），",
    )
    .replace(
      " * 时长 = 回合流逝挂钟；进行中 Running...，结束 Ran for。",
      " * 进行中显示静态 Running...，结束后仅保留工具计数。",
    )
    .replace(
      "type CompactModeInstallDeps = {\n\tquery?: CompactThinkingQuery;\n\twriteMetadata: WriteExecutionMetadataStore;\n};",
      "type CompactModeInstallDeps = {\n\twriteMetadata: WriteExecutionMetadataStore;\n};",
    )
    .replace(
      'import { insetComponent, renderExpandedToolResult, scheduleAnimation } from "./tool/result.ts";',
      'import { insetComponent, renderExpandedToolResult } from "./tool/result.ts";',
    );
  replaceRange(
    "function compactAssistantLineComponent(",
    "function compactStopStatusLine",
    `function compactAssistantLineComponent(
\tcomponent: any,
\tsummary: string | (() => string),
\toptions: { hint?: boolean; leadingBlank?: boolean; pad?: number } = {},
): any {
\tconst self = component as any;
\treturn {
\t\trender(width: number): string[] {
\t\t\tconst theme = themeOf();
\t\t\tconst pad = Math.max(0, options.pad ?? (Number(self.outputPad) || 0));
\t\t\tconst available = Math.max(0, width - pad);
\t\t\tconst hintText = options.hint === false ? "" : \` • \${showMoreHintText()}\`;
\t\t\tconst summaryWidth = Math.max(0, available - visibleWidth(hintText));
\t\t\tconst resolved = typeof summary === "function" ? summary() : summary;
\t\t\tconst plainText = truncateToWidth(resolved, summaryWidth, "…");
\t\t\tlet text = theme.fg("muted", plainText);
\t\t\tif (plainText.startsWith("Running...")) {
\t\t\t\tconst separator = plainText.indexOf(", ");
\t\t\t\tconst heading = separator < 0 ? plainText : plainText.slice(0, separator);
\t\t\t\tconst tools = separator < 0 ? "" : plainText.slice(separator);
\t\t\t\ttext = \`\${styleCompactThinkingText(heading, theme)}\${theme.fg("muted", tools)}\`;
\t\t\t}
\t\t\tconst hintColor = hoveredAssistantComponent === component ? "text" : "dim";
\t\t\tconst line = \`\${text}\${hintText ? theme.fg(hintColor, hintText) : ""}\`;
\t\t\tconst rendered = \`\${" ".repeat(pad)}\${truncateToWidth(line, available, "")}\`;
\t\t\treturn options.leadingBlank === false ? [rendered] : ["", rendered];
\t\t},
\t\tinvalidate() {},
\t};
}

`,
    "assistant summary renderer",
  );
  replaceRange(
    "function compactAssistantLine(\n",
    "function appendStopStatus",
    `function compactAssistantLine(component: any, summary: string | (() => string)): void {
\tif (typeof summary === "string" && !summary) return;
\tcomponent.contentContainer.addChild(compactAssistantLineComponent(component, summary));
}

`,
    "assistant summary mount",
  );
  replaceRange(
    "function compactRoundCard(",
    "function isAssistantComponent",
    `function compactRoundCard(
\tcardItems: Array<{ child?: any; tool?: any }>,
\ttoolRender: (tool: any, width: number) => string[],
\tisRoundActive: () => boolean,
): any {
\tconst children: any[] = [];
\tfor (const item of cardItems) {
\t\tif (item.child) children.push(item.child);
\t\telse if (item.tool) {
\t\t\tconst tool = item.tool;
\t\t\tchildren.push({
\t\t\t\t__ccToolCard: true,
\t\t\t\trender: (innerWidth: number) => toolRender(tool, innerWidth),
\t\t\t\tinvalidate: () => tool.invalidate?.(),
\t\t\t});
\t\t}
\t}
\tconst backgroundSlot = () => {
\t\tconst statuses = cardItems
\t\t\t.filter((item) => item.tool)
\t\t\t.map((item) => toolStatus(item.tool));
\t\tconst status: ToolStatus = statuses.includes("error")
\t\t\t? "error"
\t\t\t: isRoundActive() || statuses.includes("pending")
\t\t\t\t? "pending"
\t\t\t\t: "success";
\t\treturn toolBackgroundSlot(status);
\t};
\treturn {
\t\tchildren,
\t\trender(width: number): string[] {
\t\t\treturn [
\t\t\t\t"",
\t\t\t\t...layoutExpandedToolCard(themeOf(), children, width, backgroundSlot()).lines,
\t\t\t];
\t\t},
\t\tchildAtRow(localRow: number, width: number) {
\t\t\tif (localRow < 1) return null;
\t\t\tconst row = localRow - 1;
\t\t\tconst { hits } = layoutExpandedToolCard(
\t\t\t\tthemeOf(),
\t\t\t\tchildren,
\t\t\t\twidth,
\t\t\t\tbackgroundSlot(),
\t\t\t);
\t\t\tfor (const hit of hits) {
\t\t\t\tif (row >= hit.start && row < hit.end) return hit.child;
\t\t\t}
\t\t\treturn null;
\t\t},
\t\tinvalidate() {
\t\t\tfor (const child of children) child.invalidate?.();
\t\t},
\t};
}

`,
    "compact round background",
  );
  replaceRange(
    "\ttype CompactRound = {",
    "\tconst renderAssistantWithoutThinking",
    `\ttype CompactRound = {
\t\tanchor: any;
\t\tmessages: Map<any, any>;
\t\tdetachedMessages: any[];
\t\tactive: boolean;
\t\tsuppressedToolIds: Set<string>;
\t};
\tlet activeRound: CompactRound | undefined;
\tlet roundByComponent = new WeakMap<object, CompactRound>();
\tconst expandedRoundToolIds = new Set<string>();

\tconst summarize = (messages: Iterable<any>, runningActive = false) =>
\t\tbuildMessagesSummary(messages, runningActive);

\t/** End the active round; event-driven renders update the static summary. */
\tconst endRound = (round: CompactRound, render = false): void => {
\t\tround.active = false;
\t\tif (activeRound === round) activeRound = undefined;
\t\tif (render) renderRound(round);
\t};

`,
    "round scheduler",
  );
  source = source
    .replace(
      "\t\t// Running 时每次 render 重算时长（含挂钟下限）；结束后固定。\n\t\tconst getSummary = () => summarize(roundMessages(round), round.active, round);",
      "\t\tconst getSummary = () => summarize(roundMessages(round), round.active);",
    )
    .replace(
      "\t\t\t\tif (summary || round.active) compactAssistantLine(component, getSummary, deps.query);",
      "\t\t\t\tif (summary || round.active) compactAssistantLine(component, getSummary);",
    )
    .replace(
      `\tconst activateRound = (round: CompactRound): void => {
\t\tround.active = true;
\t\tif (!round.startedAt) round.startedAt = Date.now();
\t\tdelete round.endedAt;
\t\tactiveRound = round;
\t\tdeps.query?.setCompactSummaryActive?.(true);
\t\tensureRoundTick();
\t};`,
      `\tconst activateRound = (round: CompactRound): void => {
\t\tround.active = true;
\t\tactiveRound = round;
\t};`,
    )
    .replace(
      `\tconst resetRounds = (): void => {
\t\tactiveRound = undefined;
\t\troundByComponent = new WeakMap();
\t\texpandedRoundToolIds.clear();
\t\tdeps.query?.setCompactSummaryActive?.(false);
\t\tstopRoundTick();
\t};`,
      `\tconst resetRounds = (): void => {
\t\tactiveRound = undefined;
\t\troundByComponent = new WeakMap();
\t\texpandedRoundToolIds.clear();
\t};`,
    )
    .replaceAll("\n\t\t\t\t\tstartedAt: Date.now(),", "")
    .replace(
      `\t\tif (EDIT_WRITE_TOOLS.has(name)) {
\t\t\tif (this.executionStarted && (!this.result || this.isPartial === true))
\t\t\t\tscheduleAnimation(this);
\t\t\treturn compactEditWriteLines(this, width, deps.writeMetadata);
\t\t}`,
      `\t\tif (EDIT_WRITE_TOOLS.has(name)) {
\t\t\treturn compactEditWriteLines(this, width, deps.writeMetadata);
\t\t}`,
    )
    .replace(
      "\tconst box = editWriteExpandedCard(theme);",
      "\tconst box = editWriteExpandedCard(theme, toolStatus(component));",
    )
    .replace(
      `\t\t\t\tcompactRoundCard(cardItems, (tool, innerWidth) =>
\t\t\t\t\tpatch.toolOriginalRender.call(tool, innerWidth),
\t\t\t\t),`,
      `\t\t\t\tcompactRoundCard(
\t\t\t\t\tcardItems,
\t\t\t\t\t(tool, innerWidth) => patch.toolOriginalRender.call(tool, innerWidth),
\t\t\t\t\t() => round.active,
\t\t\t\t),`,
    )
    .replace("\t\t\tuiRef = ctx?.ui;\n", "");
  write(relative, source);
}

replaceRequired(
  "renderer/markdown-enhance.ts",
  'import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";\n',
  'import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";\nimport { config } from "../config/config.ts";\n',
);
replaceRequired(
  "renderer/markdown-enhance.ts",
  "\tpi.registerMarkdownTransformer((markdown, context) => {\n",
  "\tpi.registerMarkdownTransformer((markdown, context) => {\n\t\tif (!config.enableMarkdownEnhance) return markdown;\n",
);

replaceRequired(
  "feature/agent-summary/index.ts",
  'import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";\n',
  'import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";\nimport { config } from "../../config/config.ts";\n',
);
replaceRequired(
  "feature/agent-summary/index.ts",
  '\tbindAgentSummary(pi, (data) => {\n\t\tpi.appendEntry(AGENT_SUMMARY_ENTRY_TYPE, data);\n\t});',
  '\tbindAgentSummary(pi, (data) => {\n\t\tif (!config.enableAgentSummary) return;\n\t\tpi.appendEntry(AGENT_SUMMARY_ENTRY_TYPE, data);\n\t});',
);
replaceRequired(
  "feature/agent-summary/index.ts",
  'export const AGENT_SUMMARY_ENTRY_TYPE = "agent-summary";',
  'export const AGENT_SUMMARY_ENTRY_TYPE = "better-style-agent-summary";',
);
replaceRequired(
  "feature/agent-summary/core.ts",
  " * 失败单独累计；另记回合耗时。",
  " * 失败单独累计。",
);
replaceRequired(
  "feature/agent-summary/core.ts",
  'import { formatDuration } from "../../utils/format.ts";\n',
  "",
);
replaceRequired(
  "feature/agent-summary/core.ts",
  "\tfailed: number;\n\tdurationMs: number;",
  "\tfailed: number;",
);
replaceRequired(
  "feature/agent-summary/core.ts",
  `
\treadonly startedAt: number;

\tconstructor(startedAt = Date.now()) {
\t\tthis.startedAt = startedAt;
\t}
`,
  "",
);
replaceRequired(
  "feature/agent-summary/core.ts",
  `\tsnapshot(now = Date.now()): AgentSummaryData {
\t\treturn {
\t\t\tcommands: this.commandCount,
\t\t\treads: this.readFiles.size,
\t\t\tedits: this.editFiles.size,
\t\t\twrites: this.writeFiles.size,
\t\t\tothers: this.otherCount,
\t\t\tfailed: this.failedCount,
\t\t\tdurationMs: now - this.startedAt,
\t\t};
\t}`,
  `\tsnapshot(): AgentSummaryData {
\t\treturn {
\t\t\tcommands: this.commandCount,
\t\t\treads: this.readFiles.size,
\t\t\tedits: this.editFiles.size,
\t\t\twrites: this.writeFiles.size,
\t\t\tothers: this.otherCount,
\t\t\tfailed: this.failedCount,
\t\t};
\t}`,
);
replaceRequired(
  "feature/agent-summary/core.ts",
  `\tconst duration = formatDuration(data.durationMs);
\tconst line = duration ? \`\${text} · \${duration}\` : text;
\treturn \`> *\${line}*\`;`,
  `\treturn \`> *\${text}*\`;`,
);

replaceRequired(
  "feature/compact-thinking.ts",
  'const DURATION_ENTRY_TYPE = "compact-thinking-duration";',
  'const DURATION_ENTRY_TYPE = "better-style-thinking-duration";',
);
replaceRequired("feature/compact-thinking.ts", "\tgetKeybindings,\n", "");
replaceRequired(
  "feature/compact-thinking.ts",
  'import { isToolTuiFullscreen } from "../renderer/tool/show-more-hint.ts";',
  'import { showMoreHintText } from "../renderer/tool/show-more-hint.ts";',
);
replaceRequired(
  "feature/compact-thinking.ts",
  [
    "function getThinkingToggleHint() {",
    '\tconst keys = getKeybindings().getKeys("app.thinking.toggle");',
    '\treturn keys.length > 0 ? `${keys.join("/")} to expand` : undefined;',
    "}",
    "",
    "function thinkingExpandAction(): string | undefined {",
    '\treturn isToolTuiFullscreen() ? "click to show more" : getThinkingToggleHint();',
    "}",
  ].join("\n"),
  `function thinkingExpandAction(): string {
\treturn showMoreHintText();
}`,
);
replaceRequired(
  "feature/compact-thinking.ts",
  `\tif (forceExpandHint && isToolTuiFullscreen()) {
\t\treturn { prefix: " • ", action: "click to show more", suffix: "" };
\t}`,
  `\tif (forceExpandHint) {
\t\treturn { prefix: " • ", action, suffix: "" };
\t}`,
);

{
  const relative = "feature/compact-thinking.ts";
  let source = read(relative);
  const replaceRange = (startMarker, endMarker, replacement, label) => {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    if (start < 0 || end < 0) fail(`${relative}: ${label} not found`);
    source = source.slice(0, start) + replacement + source.slice(end);
  };

  source = source
    .replaceAll("思考动画", "思考状态")
    .replace("An empty widget gives the animation loop access to requestRender", "An empty widget exposes mounted roots for transcript refresh")
    .replace("持久化时长与工具调用显示", "工具调用显示")
    .replace(
      `import {
\tanimateCompactThinkingText,
\tformatThoughtDuration,
\tstyleCompactThinkingText,
} from "../renderer/compact-mode.ts";`,
      'import { styleCompactThinkingText } from "../renderer/compact-mode.ts";',
    );
  replaceRange(
    "export type CompactThinkingConfig = {",
    "type SummaryPart",
    `export type CompactThinkingConfig = {
\tuseSummaryTitlesAsThinkingTitle: boolean;
\tpreviewLines: number;
};

export type CompactThinkingController = {
\tupdateConfig(next: CompactThinkingConfig): void;
};

`,
    "public config",
  );
  source = source.replace(
    "type ActiveThinking = {\n\tmessageTimestamp: number;\n\tcontentIndex: number;\n\tstartedAt: number;\n};",
    "type ActiveThinking = {\n\tmessageTimestamp: number;\n\tcontentIndex: number;\n};",
  );
  replaceRange(
    "const config: CompactThinkingConfig = {",
    "function thinkingExpandAction",
    `const config: CompactThinkingConfig = {
\tuseSummaryTitlesAsThinkingTitle: true,
\tpreviewLines: 3,
};

`,
    "duration state",
  );
  replaceRange(
    "\tactiveThinkingStateQuery =",
    "\tfunction thinkingStyle",
    `\tconst streamingComponents = new Set<AssistantMessageComponentLike>();
\tlet activeThinking: ActiveThinking | undefined;
\tlet activeTheme: Theme | undefined;
\tlet activeTui: RenderTui | undefined;
\tlet latestComponent: AssistantMessageComponentLike | undefined;
\tlet latestComponentTimestamp: number | undefined;
\tlet patchInstalled = true;

`,
    "runtime timing state",
  );
  replaceRange(
    "\n\tfunction animatedText",
    "\n\tfunction isActiveRun",
    "",
    "animation helpers",
  );
  replaceRange(
    "\t\t\tconst elapsedMs =",
    "\t\t\tconst previewSource",
    `\t\t\tlet heading: string;
\t\t\tif (active && latestSummary) {
\t\t\t\theading = summaryTitleStyle(latestSummary.title);
\t\t\t} else if (active) {
\t\t\t\theading = thinkingStyle(self.hiddenThinkingLabel || "Thinking...");
\t\t\t} else {
\t\t\t\theading = thinkingStyle(latestSummary?.title ?? "Thought");
\t\t\t}
`,
    "thinking heading",
  );
  replaceRange(
    "\tfunction ensureAnimationTimer()",
    "\n\t// ---- fork patch",
    `\tfunction startThinking(message: AssistantMessage, contentIndex: number) {
\t\tactiveThinking = {
\t\t\tmessageTimestamp: message.timestamp,
\t\t\tcontentIndex,
\t\t};
\t\tstreamingComponents.clear();
\t\tif (latestComponent && latestComponentTimestamp === message.timestamp) {
\t\t\tstreamingComponents.add(latestComponent);
\t\t\tconst self = latestComponent as unknown as AssistantInternals;
\t\t\tself.updateContent(message);
\t\t\tactiveTui?.requestRender();
\t\t}
\t}

\tfunction finishThinking() {
\t\tif (!activeThinking) return;
\t\tactiveThinking = undefined;
\t\tconst components = [...streamingComponents];
\t\tstreamingComponents.clear();
\t\tfor (const component of components) {
\t\t\tconst self = component as unknown as AssistantInternals;
\t\t\tif (self.lastMessage) self.updateContent(self.lastMessage);
\t\t}
\t\tactiveTui?.requestRender();
\t}
`,
    "animation scheduler",
  );
  source = source
    .replace(
      "\t\trestoreDurationEntries(ctx.sessionManager.getBranch(), completedDurations);\n",
      "",
    )
    .replace(
      "\tpi.on(\"session_tree\", (_event, ctx) => {\n\t\trestoreDurationEntries(ctx.sessionManager.getBranch(), completedDurations);",
      "\tpi.on(\"session_tree\", (_event, _ctx) => {",
    );
  replaceRange(
    "\t\tactiveThinkingQuery = undefined;",
    "\t\texpandedThinking.clear();",
    `\t\tactiveTui = undefined;
\t\tactiveTheme = undefined;
\t\tlatestComponent = undefined;
\t\tlatestComponentTimestamp = undefined;
\t\tstreamingComponents.clear();
`,
    "shutdown timing cleanup",
  );
  replaceRange(
    "\n\tconst restoreAllDurations =",
    "\n\tconst bind =",
    "",
    "duration restoration",
  );
  source = source
    .replace(
      "\t\t\thandler(e, eventName === \"session_tree\" ? restoreAllDurations(ctx) : ctx);",
      "\t\t\thandler(e, ctx);",
    )
    .replace(" or kill its thinking ticker.", ".")
    .replace("handler(event, restoreAllDurations(ctx));", "handler(event, ctx);")
    .replace("\n\t\t\tappendEntry: (...args: any[]) => (pi.appendEntry as any)(...args),", "");
  replaceRange(
    "\n\t\tgetMessageThinkingDurationMs(messageTimestamp)",
    "\n\t};\n}",
    "",
    "controller timing API",
  );
  write(relative, source);
}

function walkFiles(root) {
  const files = [];
  for (const entry of readdirSync(root)) {
    const full = join(root, entry);
    if (statSync(full).isDirectory()) files.push(...walkFiles(full));
    else files.push(full);
  }
  return files;
}

for (const file of walkFiles(outputRoot).filter((path) => path.endsWith(".ts"))) {
  let source = readFileSync(file, "utf8");
  if (file.includes(join("renderer", "tool", "diff") + sep)) {
    source = source.replaceAll('"toolOutput"', '"text"');
  }
  source = source
    .replaceAll("pi.ccstyle.", "pi.better-style.")
    .replaceAll("/ccstyle", "/better-style")
    .replaceAll("claude-code-style.json", "better-style.json")
    .replaceAll("ccstyleAnimationScheduled", "betterStyleAnimationScheduled")
    .replaceAll("_ccstyleOriginalPaddingY", "_betterStyleOriginalPaddingY")
    .replaceAll("Claude Code style", "Better style");
  writeFileSync(file, source);
}

{
  const patchKeys = join(outputRoot, "utils", "patch-keys.ts");
  let source = readFileSync(patchKeys, "utf8");
  source = source.replace(
    /\n\/\/ ── 鼠标交互 ──[\s\S]*?\n\/\/ ── rich diff 组件标记 ──/,
    "\n// ── rich diff 组件标记 ──",
  );
  writeFileSync(patchKeys, source);
}

const forbiddenSourcePatterns = [
  /from ["']pi-cc-extensions\//,
  /from ["'][^"']*renderer\/mouse\//,
  /from ["'][^"']*\.\/mouse\//,
  /registerCommand\(["']context["']\)/,
  /registerCommand\(["']ccstyle["']\)/,
  /enableContextCommand/,
  /enableSessionReference/,
  /enableSubagentAutocomplete/,
  /enableAliases/,
  /showStartupHeader/,
  /scrollStepLines/,
  /installFlushDockedBash/,
  /onTerminalInput/,
  /setInterval\(/,
  /scheduleAnimation/,
  /animationIntervalMs/,
  /enableWorkingMessage/,
  /formatDuration/,
  /paddedTransparentRow/,
  /toolOutput/,
  /DURATION_ENTRY_TYPE/,
  /Thought for /,
  /Ran for /,
];
for (const file of walkFiles(outputRoot).filter((path) => path.endsWith(".ts"))) {
  const source = readFileSync(file, "utf8");
  for (const pattern of forbiddenSourcePatterns) {
    if (pattern.test(source)) fail(`${file.slice(REPO_ROOT.length + 1)} still matches ${pattern}`);
  }
}

writeFileSync(
  join(outputRoot, "UPSTREAM.md"),
  `# better-style upstream\n\nDerived from [minuque/pi-cc-extensions](https://github.com/minuque/pi-cc-extensions) at commit \`${UPSTREAM_COMMIT}\` under the MIT License.\n\nIncluded: compact tool rendering, tool grouping, rich edit/write diff, compact thinking, optional compact transcript mode, Markdown enhancements, agent-run summaries, and the settings panel.\n\nIntentionally excluded: \`/context\`, session/subagent references, command aliases, the custom startup header, docked-bash patching, bundled themes, extension-owned status animation and elapsed/token counters, and all fullscreen mouse click/hover/scroll behavior. Expansion uses Pi's native keyboard binding.\n\nThe rich diff subtree retains its separate attribution to \`MasuRii/pi-tool-display\`.\n`,
);
cpSync(join(sourceRoot, "LICENSE"), join(outputRoot, "LICENSE.upstream"));

writeFileSync(
  join(outputRoot, "README.md"),
  `# better-style\n\nA keyboard-first Pi 0.84 TUI presentation extension derived from \`pi-cc-extensions\`.\n\n- Configure with \`/better-style\` or \`/better-style [on|compact|off|status]\`.\n- Persistent settings: \`~/.pi/agent/better-style.json\`.\n- Expand tools and thinking with Pi's native \`app.tools.expand\` keybinding.\n- Expanded tool output uses Pi's status backgrounds with the readable \`text\` foreground.\n- No mouse input interception and no \`/context\` command are registered by this extension.\n\nSee [UPSTREAM.md](./UPSTREAM.md) for scope and attribution.\n`,
);

const targetTests = join(PI_ROOT, "tests");
const locallyMaintainedTests = new Set([
  "better-style-agent-summary.test.ts",
  "better-style-compact-mode.test.ts",
  "better-style-compact-thinking.test.ts",
  "better-style-mode-switch-reshape.test.ts",
  "better-style-package.test.ts",
  "better-style-performance.test.ts",
  "better-style-tool-grouping.test.ts",
]);
for (const file of readdirSync(targetTests)) {
  if (
    file.startsWith("better-style-") &&
    file.endsWith(".test.ts") &&
    !locallyMaintainedTests.has(file)
  ) {
    rmSync(join(targetTests, file));
  }
}

const selectedTest = /^(agent-summary|compact-mode|compact-thinking|format-utils|markdown-enhance|message-display|mode-switch-reshape|patch-registry|shiki-highlight|tool-grouping|tool-renderer|tool-result|.*diff.*)\.test\.ts$/;
const forbiddenTestText = [
  "renderer/mouse/",
  "feature/context",
  "feature/reference",
  "startup-header",
  "flush-docked-bash",
  'from "jiti"',
];
let copiedTests = 0;
for (const name of readdirSync(join(sourceRoot, "tests")).filter(
  (name) => selectedTest.test(name) && !locallyMaintainedTests.has(`better-style-${name}`),
)) {
  let source = readFileSync(join(sourceRoot, "tests", name), "utf8");
  if (forbiddenTestText.some((needle) => source.includes(needle))) continue;
  if (name === "format-utils.test.ts") {
    source = source
      .replace(
        'import { formatDuration, oneLine } from "../extensions/utils/format.ts";',
        'import { oneLine } from "../extensions/utils/format.ts";',
      )
      .replace(
        `test("formatDuration formats elapsed seconds", () => {
\tassert.equal(formatDuration(999), "");
\tassert.equal(formatDuration(1_000), "1s");
\tassert.equal(formatDuration(62_000), "1m 2s");
\tassert.equal(formatDuration(3_721_000), "1h 2m 1s");
});

`,
        "",
      );
  }
  if (name === "tool-diff.test.ts") {
    source = source.replace(
      `function output(component: any, width = 100): string[] {
\treturn component.render(width);
}`,
      `function output(component: any, width = 100): string[] {
\treturn component.render(width);
}

function plain(text: string): string {
\treturn text.replace(/\\x1b\\[[0-?]*[ -/]*[@-~]/g, "");
}`,
    );
    source = source
      .replace('const writeText = output(write).join("\\n");', 'const writeText = plain(output(write).join("\\n"));')
      .replace('const editText = output(edit).join("\\n");', 'const editText = plain(output(edit).join("\\n"));')
      .replace('const expandedText = output(expanded).join("\\n");', 'const expandedText = plain(output(expanded).join("\\n"));');
  }
  source = source
    .replaceAll("../extensions/", "../extensions/better-style/")
    .replaceAll("/ccstyle", "/better-style")
    .replaceAll('"ccstyle"', '"better-style"')
    .replaceAll("'ccstyle'", "'better-style'")
    .replaceAll("pi.ccstyle.", "pi.better-style.")
    .replaceAll("claude-code-style.json", "better-style.json")
    .replaceAll("compact-thinking-duration", "better-style-thinking-duration")
    .replaceAll("click to show more", "ctrl\\+o to show more");
  writeFileSync(join(targetTests, `better-style-${name}`), source);
  copiedTests++;
}
if (copiedTests < 5) fail(`expected at least 5 reusable upstream tests, copied ${copiedTests}`);

writeFileSync(
  join(targetTests, "better-style-scope.test.ts"),
  `import assert from "node:assert/strict";\nimport { existsSync, readFileSync, readdirSync, statSync } from "node:fs";\nimport { dirname, join, resolve } from "node:path";\nimport test from "node:test";\nimport { fileURLToPath } from "node:url";\n\nconst PI_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");\nconst ROOT = join(PI_ROOT, "extensions", "better-style");\n\nfunction files(root: string): string[] {\n  return readdirSync(root).flatMap((entry) => {\n    const full = join(root, entry);\n    return statSync(full).isDirectory() ? files(full) : [full];\n  });\n}\n\ntest("better-style excludes context and mouse behavior", () => {\n  assert.equal(existsSync(join(ROOT, "feature", "context.ts")), false);\n  assert.equal(existsSync(join(ROOT, "feature", "reference")), false);\n  assert.equal(existsSync(join(ROOT, "renderer", "mouse")), false);\n  assert.equal(existsSync(join(ROOT, "utils", "sgr-mouse.ts")), false);\n  assert.equal(existsSync(join(ROOT, "feature", "shell", "working-message.ts")), false);\n  const source = files(ROOT).filter((file) => file.endsWith(".ts")).map((file) => readFileSync(file, "utf8")).join("\\n");\n  assert.doesNotMatch(source, /from ["']pi-cc-extensions\\//);\n  assert.doesNotMatch(source, /registerCommand\\(["']context["']\\)/);\n  assert.doesNotMatch(source, /onTerminalInput/);\n  assert.match(source, /registerCommand\\("better-style"/);\n});\n\ntest("Pi peer dependencies target 0.84", () => {\n  const pkg = JSON.parse(readFileSync(join(PI_ROOT, "package.json"), "utf8"));\n  for (const [name, version] of Object.entries(pkg.peerDependencies)) {\n    if (name.startsWith("@earendil-works/pi-")) assert.equal(version, "^0.84.0");\n  }\n});\n`,
);

writeFileSync(
  join(targetTests, "better-style-config.test.ts"),
  `import assert from "node:assert/strict";\nimport test from "node:test";\nimport { DEFAULT_CONFIG, normalizeConfig } from "../extensions/better-style/config/config.ts";\n\ntest("better-style defaults are keyboard-first and enabled", () => {\n  assert.equal(DEFAULT_CONFIG.mode, "compact");\n  assert.equal(DEFAULT_CONFIG.enableMarkdownEnhance, true);\n  assert.equal(DEFAULT_CONFIG.enableAgentSummary, true);\n  assert.equal("animationIntervalMs" in DEFAULT_CONFIG, false);\n  assert.equal("enableWorkingMessage" in DEFAULT_CONFIG, false);\n  assert.equal("scrollStepLines" in DEFAULT_CONFIG, false);\n});\n\ntest("better-style normalizes unsafe numeric configuration", () => {\n  const config = normalizeConfig({ diffSplitMinWidth: 1, previewLines: -2, expandedOutputMaxLines: 999999 });\n  assert.equal(config.diffSplitMinWidth, 40);\n  assert.equal(config.previewLines, 0);\n  assert.equal(config.expandedOutputMaxLines, 5000);\n});\n`,
);

writeFileSync(
  join(targetTests, "better-style-renderer-priority.test.ts"),
  `import assert from "node:assert/strict";\nimport test from "node:test";\nimport { preservesOriginalRenderer } from "../extensions/better-style/renderer/default-mode.ts";\n\nconst custom = { renderResult() {} };\n\ntest("extension-owned tool renderers win without an exclude entry", () => {\n  assert.equal(preservesOriginalRenderer(custom, "custom", undefined, []), true);\n});\n\ntest("built-in renderers are preserved only when explicitly excluded", () => {\n  assert.equal(preservesOriginalRenderer(undefined, "read", custom, []), false);\n  assert.equal(preservesOriginalRenderer(undefined, "read", custom, ["read"]), true);\n});\n`,
);

const packagePath = join(PI_ROOT, "package.json");
const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
pkg.dependencies = {
  ...pkg.dependencies,
  "@shikijs/cli": "^4.0.2",
  "grok-mermaid": "^0.2.2",
};
delete pkg.dependencies["pi-cc-extensions"];
for (const name of [
  "@earendil-works/pi-agent-core",
  "@earendil-works/pi-ai",
  "@earendil-works/pi-coding-agent",
  "@earendil-works/pi-tui",
]) {
  pkg.peerDependencies[name] = "^0.84.0";
}
pkg.engines = { ...(pkg.engines ?? {}), node: ">=22.19.0" };
pkg.scripts["test:better-style"] = "node --test tests/better-style-*.test.ts";
if (!pkg.scripts.check.includes("npm run test:better-style")) {
  pkg.scripts.check += " && npm run test:better-style";
}
writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log(`Vendored better-style from ${UPSTREAM_COMMIT}; copied ${copiedTests} upstream tests.`);

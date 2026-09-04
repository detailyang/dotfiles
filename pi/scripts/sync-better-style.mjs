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
import { dirname, join, resolve } from "node:path";
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
  "feature/shell/working-message.ts",
  'import { formatDuration } from "../../utils/format.ts";\n',
  'import { formatDuration } from "../../utils/format.ts";\nimport { config } from "../../config/config.ts";\n',
);
replaceRequired(
  "feature/shell/working-message.ts",
  "\tfunction syncWorkingMessage(force = false): void {\n",
  "\tfunction syncWorkingMessage(force = false): void {\n\t\tif (!config.enableWorkingMessage) {\n\t\t\trestoreDefaultWorkingMessage();\n\t\t\treturn;\n\t\t}\n",
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
];
for (const file of walkFiles(outputRoot).filter((path) => path.endsWith(".ts"))) {
  const source = readFileSync(file, "utf8");
  for (const pattern of forbiddenSourcePatterns) {
    if (pattern.test(source)) fail(`${file.slice(REPO_ROOT.length + 1)} still matches ${pattern}`);
  }
}

writeFileSync(
  join(outputRoot, "UPSTREAM.md"),
  `# better-style upstream\n\nDerived from [minuque/pi-cc-extensions](https://github.com/minuque/pi-cc-extensions) at commit \`${UPSTREAM_COMMIT}\` under the MIT License.\n\nIncluded: compact tool rendering, tool grouping, rich edit/write diff, compact thinking, optional compact transcript mode, Markdown enhancements, working token/time status, agent-run summaries, and the settings panel.\n\nIntentionally excluded: \`/context\`, session/subagent references, command aliases, the custom startup header, docked-bash patching, bundled themes, and all fullscreen mouse click/hover/scroll behavior. Expansion uses Pi's native keyboard binding.\n\nThe rich diff subtree retains its separate attribution to \`MasuRii/pi-tool-display\`.\n`,
);
cpSync(join(sourceRoot, "LICENSE"), join(outputRoot, "LICENSE.upstream"));

writeFileSync(
  join(outputRoot, "README.md"),
  `# better-style\n\nA keyboard-first Pi 0.84 TUI presentation extension derived from \`pi-cc-extensions\`.\n\n- Configure with \`/better-style\` or \`/better-style [on|compact|off|status]\`.\n- Persistent settings: \`~/.pi/agent/better-style.json\`.\n- Expand tools and thinking with Pi's native \`app.tools.expand\` keybinding.\n- No mouse input interception and no \`/context\` command are registered by this extension.\n\nSee [UPSTREAM.md](./UPSTREAM.md) for scope and attribution.\n`,
);

const targetTests = join(PI_ROOT, "tests");
for (const file of readdirSync(targetTests)) {
  if (
    file.startsWith("better-style-") &&
    file.endsWith(".test.ts") &&
    file !== "better-style-package.test.ts"
  ) {
    rmSync(join(targetTests, file));
  }
}

const selectedTest = /^(agent-summary|compact-mode|compact-thinking|format-utils|markdown-enhance|message-display|mode-switch-reshape|patch-registry|shiki-highlight|tool-grouping|tool-renderer|tool-result|working-message|.*diff.*)\.test\.ts$/;
const forbiddenTestText = [
  "renderer/mouse/",
  "feature/context",
  "feature/reference",
  "startup-header",
  "flush-docked-bash",
  'from "jiti"',
];
let copiedTests = 0;
for (const name of readdirSync(join(sourceRoot, "tests")).filter((name) => selectedTest.test(name))) {
  let source = readFileSync(join(sourceRoot, "tests", name), "utf8");
  if (forbiddenTestText.some((needle) => source.includes(needle))) continue;
  if (name === "compact-mode.test.ts") {
    source = source
      .replace(
        "config normalize keeps compact, defaults to on, command completions order on,compact,off",
        "config normalize keeps compact as the default and preserves command order",
      )
      .replace('assert.equal(normalizeConfig({}).mode, "on");', 'assert.equal(normalizeConfig({}).mode, "compact");')
      .replace(
        'assert.equal(normalizeConfig({ mode: "invalid" }).mode, "on");',
        'assert.equal(normalizeConfig({ mode: "invalid" }).mode, "compact");',
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
  `import assert from "node:assert/strict";\nimport { existsSync, readFileSync, readdirSync, statSync } from "node:fs";\nimport { dirname, join, resolve } from "node:path";\nimport test from "node:test";\nimport { fileURLToPath } from "node:url";\n\nconst PI_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");\nconst ROOT = join(PI_ROOT, "extensions", "better-style");\n\nfunction files(root: string): string[] {\n  return readdirSync(root).flatMap((entry) => {\n    const full = join(root, entry);\n    return statSync(full).isDirectory() ? files(full) : [full];\n  });\n}\n\ntest("better-style excludes context and mouse behavior", () => {\n  assert.equal(existsSync(join(ROOT, "feature", "context.ts")), false);\n  assert.equal(existsSync(join(ROOT, "feature", "reference")), false);\n  assert.equal(existsSync(join(ROOT, "renderer", "mouse")), false);\n  assert.equal(existsSync(join(ROOT, "utils", "sgr-mouse.ts")), false);\n  const source = files(ROOT).filter((file) => file.endsWith(".ts")).map((file) => readFileSync(file, "utf8")).join("\\n");\n  assert.doesNotMatch(source, /from ["']pi-cc-extensions\\//);\n  assert.doesNotMatch(source, /registerCommand\\(["']context["']\\)/);\n  assert.doesNotMatch(source, /onTerminalInput/);\n  assert.match(source, /registerCommand\\("better-style"/);\n});\n\ntest("Pi peer dependencies target 0.84", () => {\n  const pkg = JSON.parse(readFileSync(join(PI_ROOT, "package.json"), "utf8"));\n  for (const [name, version] of Object.entries(pkg.peerDependencies)) {\n    if (name.startsWith("@earendil-works/pi-")) assert.equal(version, "^0.84.0");\n  }\n});\n`,
);

writeFileSync(
  join(targetTests, "better-style-config.test.ts"),
  `import assert from "node:assert/strict";\nimport test from "node:test";\nimport { DEFAULT_CONFIG, normalizeConfig } from "../extensions/better-style/config/config.ts";\n\ntest("better-style defaults are keyboard-first and enabled", () => {\n  assert.equal(DEFAULT_CONFIG.mode, "compact");\n  assert.equal(DEFAULT_CONFIG.enableMarkdownEnhance, true);\n  assert.equal(DEFAULT_CONFIG.enableAgentSummary, true);\n  assert.equal(DEFAULT_CONFIG.enableWorkingMessage, true);\n  assert.equal("scrollStepLines" in DEFAULT_CONFIG, false);\n});\n\ntest("better-style normalizes unsafe numeric configuration", () => {\n  const config = normalizeConfig({ diffSplitMinWidth: 1, previewLines: -2, expandedOutputMaxLines: 999999 });\n  assert.equal(config.diffSplitMinWidth, 40);\n  assert.equal(config.previewLines, 0);\n  assert.equal(config.expandedOutputMaxLines, 5000);\n});\n`,
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

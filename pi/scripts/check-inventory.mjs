import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MARKDOWN_DIRS = ["skills", "prompts"];
const EXTENSIONS_DIR = "extensions";
const MARKDOWN_LINK_RE = /!?\[[^\]]*\]\(([^)]+)\)/g;

function listMarkdownFiles(dir) {
  const fullDir = path.join(ROOT, dir);
  if (!existsSync(fullDir)) return [];

  const files = [];
  for (const entry of readdirSync(fullDir)) {
    const fullPath = path.join(fullDir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...listMarkdownFiles(path.join(dir, entry)));
    } else if (entry.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files;
}

function isExternalTarget(target) {
  return (
    target.startsWith("#") ||
    /^[a-z][a-z0-9+.-]*:/i.test(target) ||
    target.startsWith("/")
  );
}

function normalizeLinkTarget(rawTarget) {
  let target = rawTarget.trim();
  if (!target || isExternalTarget(target)) return null;

  if (target.startsWith("<") && target.includes(">")) {
    target = target.slice(1, target.indexOf(">"));
  } else {
    target = target.split(/\s+/)[0];
  }

  const withoutFragment = target.split("#")[0].split("?")[0];
  return withoutFragment || null;
}

const failures = [];

for (const file of MARKDOWN_DIRS.flatMap(listMarkdownFiles)) {
  const text = readFileSync(file, "utf8");
  const relativeFile = path.relative(ROOT, file);

  for (const match of text.matchAll(MARKDOWN_LINK_RE)) {
    const target = normalizeLinkTarget(match[1]);
    if (!target) continue;

    const resolved = path.resolve(path.dirname(file), target);
    if (!existsSync(resolved)) {
      failures.push(`${relativeFile}: missing link target ${match[1]}`);
    }
  }
}

const extensionsRoot = path.join(ROOT, EXTENSIONS_DIR);
if (existsSync(extensionsRoot)) {
  for (const entry of readdirSync(extensionsRoot)) {
    const extensionDir = path.join(extensionsRoot, entry);
    if (!statSync(extensionDir).isDirectory()) continue;

    const indexFile = path.join(extensionDir, "index.ts");
    if (!existsSync(indexFile)) continue;

    const text = readFileSync(indexFile, "utf8");
    if (!/\bexport\s+default\b/.test(text)) {
      failures.push(`${path.relative(ROOT, indexFile)}: extension entrypoint must export a default factory`);
    }
  }
}

if (failures.length > 0) {
  console.error("Inventory check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Inventory check passed.");

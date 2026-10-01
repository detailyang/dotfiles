import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const resources = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")).pi;
const MARKDOWN_LINK_RE = /!?\[[^\]]*\]\(([^)]+)\)/g;

function listMarkdownFiles(dir) {
  const fullDir = path.join(ROOT, dir);
  if (!statSync(fullDir).isDirectory()) return fullDir.endsWith(".md") ? [fullDir] : [];

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
const registered = { extensions: [], skills: [], prompts: [], themes: [] };
for (const kind of Object.keys(registered)) {
  const entries = resources[kind] === undefined ? [] : resources[kind];
  if (!Array.isArray(entries)) {
    failures.push(`package.json: pi.${kind} must be an array`);
    continue;
  }
  for (const entry of entries) {
    if (typeof entry !== "string" || !entry || !existsSync(path.resolve(ROOT, entry))) {
      failures.push(`package.json: missing ${kind} resource ${String(entry)}`);
    } else {
      registered[kind].push(entry);
    }
  }
}

for (const file of [...registered.skills, ...registered.prompts].flatMap(listMarkdownFiles)) {
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

for (const resource of registered.extensions) {
  const extensionsRoot = path.resolve(ROOT, resource);
  const entries = statSync(extensionsRoot).isDirectory()
    ? readdirSync(extensionsRoot).map((entry) => path.join(extensionsRoot, entry))
    : [extensionsRoot];
  for (const entry of entries) {
    const indexFile = statSync(entry).isDirectory() ? path.join(entry, "index.ts") : entry;
    if (!/\.[jt]s$/.test(indexFile) || !existsSync(indexFile)) continue;

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

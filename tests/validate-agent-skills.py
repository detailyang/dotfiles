#!/usr/bin/env python3
"""Validate this repository's skill manifests and local resource links.

No third-party parser is needed: name and description deliberately use one-line,
plain YAML scalars in this repository. This is a repository contract check, not a
complete YAML or Markdown parser. Reference prose has no entry-point size limit.
"""

from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit


WORKFLOW_NAMES = {
    "grill", "herdr", "improve", "ship", "show-me", "to-goal", "to-issue",
    "to-spec", "zoom-out",
}
NAME = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*\Z")
RESOURCE = re.compile(r"(?:references|scripts|assets)/[\w./-]+\.[\w-]+")
LINK = re.compile(r"\[[^\]\n]*\]\(([^\s)]+)\)")
ENTRY_LIMIT = 8192
GLOBAL_LIMIT = 4096


def manifest_errors(path: Path) -> list[str]:
    """Check the metadata needed for discovery, without silently accepting YAML blocks."""
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    if not lines or lines[0] != "---":
        return ["must start with YAML frontmatter"]
    try:
        end = lines.index("---", 1)
    except ValueError:
        return ["missing closing frontmatter delimiter"]
    errors = []
    values = {}
    for key in ("name", "description"):
        matches = [line[len(key) + 1:].strip() for line in lines[1:end]
                   if line.startswith(key + ":")]
        if len(matches) != 1:
            errors.append(f"must declare exactly one {key}")
            continue
        value = matches[0]
        if (not value or value[0] in "|>\"'[{&*!" or ": " in value
                or " #" in value or value in {"true", "false", "null", "~"}):
            errors.append(f"{key} must be a nonempty one-line plain string")
            continue
        values[key] = value
    name = values.get("name", "")
    if name and (len(name) > 64 or not NAME.fullmatch(name)):
        errors.append("invalid name (lowercase kebab-case, at most 64 characters)")
    if name and name != path.parent.name:
        errors.append(f"name {name!r} must match directory {path.parent.name!r}")
    if len(values.get("description", "")) > 1024:
        errors.append("description exceeds 1024 characters")
    if not "\n".join(lines[end + 1:]).strip():
        errors.append("missing skill body")
    if len(text.encode("utf-8")) > ENTRY_LIMIT:
        errors.append(f"entry exceeds {ENTRY_LIMIT} bytes; move detail to references")
    return errors


def link_errors(path: Path, boundary: Path) -> list[str]:
    """Validate simple local Markdown links, including links inside references."""
    errors = []
    for raw in LINK.findall(path.read_text(encoding="utf-8")):
        url = urlsplit(raw)
        if url.scheme or url.netloc or not url.path:
            continue
        target = (path.parent / unquote(url.path)).resolve()
        if not target.is_relative_to(boundary.resolve()):
            errors.append(f"local link escapes documentation boundary: {raw}")
        elif not target.exists():
            errors.append(f"missing local link target: {raw}")
    return errors


def validate(root: Path) -> list[str]:
    errors = []
    seen = set()
    workflow_root = root / "home/.agents/skills"
    roots = (workflow_root, root / "home/skills", root / "pi/skills")
    actual = {p.name for p in workflow_root.iterdir() if p.is_dir()} if workflow_root.is_dir() else set()
    if actual != WORKFLOW_NAMES:
        errors.append(f"workflow inventory mismatch: missing={sorted(WORKFLOW_NAMES - actual)}, extra={sorted(actual - WORKFLOW_NAMES)}")
    for skill_root in roots:
        if not skill_root.is_dir():
            errors.append(f"missing skill root: {skill_root.relative_to(root)}")
            continue
        directories = sorted(p for p in skill_root.iterdir() if p.is_dir())
        if not directories:
            errors.append(f"empty skill root: {skill_root.relative_to(root)}")
        for directory in directories:
            entry = directory / "SKILL.md"
            if not entry.is_file():
                errors.append(f"{entry.relative_to(root)}: missing manifest")
                continue
            label = str(entry.relative_to(root))
            errors.extend(f"{label}: {message}" for message in manifest_errors(entry))
            if directory.name in seen:
                errors.append(f"duplicate skill name across roots: {directory.name}")
            seen.add(directory.name)
            text = entry.read_text(encoding="utf-8")
            for resource in sorted(set(RESOURCE.findall(text))):
                target = (directory / resource).resolve()
                if not target.is_relative_to(directory.resolve()) or not target.is_file():
                    errors.append(f"{label}: missing or escaping resource: {resource}")
            for reference in sorted((directory / "references").rglob("*.md")):
                relative = reference.relative_to(directory).as_posix()
                if relative not in text:
                    errors.append(f"{label}: reference not discoverable from entry: {relative}")
            for document in sorted(directory.rglob("*.md")):
                errors.extend(f"{document.relative_to(root)}: {message}"
                              for message in link_errors(document, root))
    global_entry = root / "home/.agents/AGENTS.md"
    if not global_entry.is_file():
        errors.append("missing global AGENTS.md")
    elif global_entry.stat().st_size > GLOBAL_LIMIT:
        errors.append(f"global AGENTS.md exceeds {GLOBAL_LIMIT} bytes")
    for document in [root / "AGENTS.md", global_entry]:
        if document.is_file():
            errors.extend(f"{document.relative_to(root)}: {message}"
                          for message in link_errors(document, root))
    return errors


if __name__ == "__main__":
    repository = Path(__file__).resolve().parents[1]
    problems = validate(repository)
    for problem in problems:
        print(problem, file=sys.stderr)
    if problems:
        sys.exit(1)
    count = sum(1 for base in ("home/.agents/skills", "home/skills", "pi/skills")
                for _ in (repository / base).glob("*/SKILL.md"))
    print(f"Validated {count} skills: metadata, inventory, local links, resources, and entry budgets")

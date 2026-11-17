#!/usr/bin/env python3
"""Heuristic complexity hotspot scanner for mixed-language repositories."""

from __future__ import annotations

import argparse
import ast
import json
import os
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable


DEFAULT_EXCLUDES = {
    ".git",
    ".hg",
    ".svn",
    "node_modules",
    "vendor",
    "dist",
    "build",
    ".next",
    ".nuxt",
    "coverage",
    "__pycache__",
    ".venv",
    "venv",
    "target",
    ".turbo",
}

TEXT_EXTENSIONS = {
    ".py",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".mjs",
    ".cjs",
    ".java",
    ".go",
    ".rb",
    ".php",
    ".cs",
    ".cpp",
    ".cc",
    ".c",
    ".h",
    ".hpp",
    ".swift",
}

LOOP_RE = re.compile(
    r"\b(for|while|forEach|map|filter|reduce|some|every)\b"
)
CALLBACK_LOOP_RE = re.compile(
    r"\.(forEach|map|filter|reduce|some|every)\s*\("
)
MEMBERSHIP_RE = re.compile(
    r"(\.includes\s*\(|\.indexOf\s*\(|\.find\s*\(|\.findIndex\s*\(|\bin_array\s*\(|\bcontains\s*\()"
)
SORT_RE = re.compile(r"(\.sort\s*\(|\bsorted\s*\(|\bsort\s*\()")
QUERY_IN_LOOP_RE = re.compile(
    r"\b(fetch|axios\.|request\s*\(|query\s*\(|execute\s*\(|findMany\s*\(|findOne\s*\(|findUnique\s*\(|select\s*\(|where\s*\()\b",
    re.IGNORECASE,
)
RENDER_HINT_RE = re.compile(
    r"\b(function\s+[A-Z][a-z][A-Za-z0-9_]*|const\s+[A-Z][a-z][A-Za-z0-9_]*\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_]+)\s*=>|export\s+default\s+function\s+[A-Z][a-z])"
)
STRING_LITERAL_RE = re.compile(r"""(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)""")


@dataclass
class Finding:
    path: str
    line: int
    severity: str
    kind: str
    message: str
    suggestion: str


def iter_files(root: Path, excludes: set[str]) -> Iterable[Path]:
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in excludes]
        for filename in filenames:
            path = Path(dirpath) / filename
            if path.suffix in TEXT_EXTENSIONS:
                yield path


def read_text(path: Path) -> str | None:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        try:
            return path.read_text(encoding="latin-1")
        except Exception:
            return None
    except Exception:
        return None


def rel(path: Path, root: Path) -> str:
    try:
        return str(path.relative_to(root))
    except ValueError:
        return str(path)


class PythonVisitor(ast.NodeVisitor):
    def __init__(self, path: Path, root: Path) -> None:
        self.path = path
        self.root = root
        self.loop_depth = 0
        self.findings: list[Finding] = []

    def add(self, node: ast.AST, severity: str, kind: str, message: str, suggestion: str) -> None:
        self.findings.append(
            Finding(rel(self.path, self.root), getattr(node, "lineno", 1), severity, kind, message, suggestion)
        )

    def visit_For(self, node: ast.For) -> None:
        self._visit_loop(node)

    def visit_AsyncFor(self, node: ast.AsyncFor) -> None:
        self._visit_loop(node)

    def visit_While(self, node: ast.While) -> None:
        self._visit_loop(node)

    def visit_ListComp(self, node: ast.ListComp) -> None:
        self._visit_comprehension(node, node.generators, [node.elt])

    def visit_SetComp(self, node: ast.SetComp) -> None:
        self._visit_comprehension(node, node.generators, [node.elt])

    def visit_GeneratorExp(self, node: ast.GeneratorExp) -> None:
        self._visit_comprehension(node, node.generators, [node.elt])

    def visit_DictComp(self, node: ast.DictComp) -> None:
        self._visit_comprehension(node, node.generators, [node.key, node.value])

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        self._visit_scoped_def(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        self._visit_scoped_def(node)

    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        self._visit_scoped_def(node)

    def _visit_scoped_def(self, node: ast.AST) -> None:
        saved = self.loop_depth
        self.loop_depth = 0
        self.generic_visit(node)
        self.loop_depth = saved

    def _visit_comprehension(
        self,
        node: ast.AST,
        generators: list[ast.comprehension],
        elements: list[ast.AST],
    ) -> None:
        saved = self.loop_depth
        for gen in generators:
            self.visit(gen.iter)
            if self.loop_depth >= 1:
                self.add(
                    node,
                    "high",
                    "nested-loop",
                    "Nested loop or comprehension may create O(n^2) or worse behavior.",
                    "Check whether a map/set index, sort+two-pointer pass, grouping, or batching can replace the inner scan.",
                )
            self.loop_depth += 1
            self.visit(gen.target)
            for cond in gen.ifs:
                self.visit(cond)
        for elt in elements:
            self.visit(elt)
        self.loop_depth = saved

    def _visit_loop(self, node: ast.AST) -> None:
        if self.loop_depth >= 1:
            self.add(
                node,
                "high",
                "nested-loop",
                "Nested loop may create O(n^2) or worse behavior.",
                "Check whether a map/set index, sort+two-pointer pass, grouping, or batching can replace the inner scan.",
            )
        self.loop_depth += 1
        self.generic_visit(node)
        self.loop_depth -= 1

    def visit_Compare(self, node: ast.Compare) -> None:
        if self.loop_depth and any(isinstance(op, (ast.In, ast.NotIn)) for op in node.ops):
            self.add(
                node,
                "medium",
                "membership-in-loop",
                "Membership check inside a loop can become O(n*m) when the right side is a list or computed sequence.",
                "If semantics allow it, build a set or dict once before the loop.",
            )
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> None:
        name = call_name(node.func)
        if self.loop_depth and name in {"sorted", "sort"}:
            self.add(
                node,
                "high",
                "sort-in-loop",
                "Sorting inside a loop is often avoidable repeated O(n log n) work.",
                "Sort once outside the loop, maintain a heap, or use binary search/insertion if intermediate ordering is required.",
            )
        if self.loop_depth and name in {"filter", "map"}:
            self.add(
                node,
                "medium",
                "repeated-scan",
                f"{name}() inside a loop may repeatedly scan a collection.",
                "Consider precomputing an index/grouping or combining passes.",
            )
        if self.loop_depth and name.lower() in {
            "fetch",
            "request",
            "query",
            "execute",
            "find",
            "find_one",
            "find_many",
            "select",
            "where",
        }:
            self.add(
                node,
                "high",
                "io-or-query-in-loop",
                "Potential database/API/file operation inside a loop.",
                "Look for N+1 behavior; batch or preload while preserving auth, filters, ordering, and error handling.",
            )
        self.generic_visit(node)


def call_name(func: ast.AST) -> str:
    if isinstance(func, ast.Name):
        return func.id
    if isinstance(func, ast.Attribute):
        return func.attr
    return ""


def scan_python(path: Path, root: Path, text: str) -> list[Finding]:
    try:
        tree = ast.parse(text)
    except SyntaxError as exc:
        return [
            Finding(
                rel(path, root),
                exc.lineno or 1,
                "info",
                "parse-error",
                "Python file could not be parsed; falling back to textual scanning only.",
                "Inspect manually if this file is on a hot path.",
            )
        ] + scan_text(path, root, text)
    visitor = PythonVisitor(path, root)
    visitor.visit(tree)
    return visitor.findings


def strip_code_noise(line: str, in_block_comment: bool) -> tuple[str, bool]:
    out: list[str] = []
    i = 0
    n = len(line)
    while i < n:
        if in_block_comment:
            end = line.find("*/", i)
            if end == -1:
                return "", True
            i = end + 2
            in_block_comment = False
            continue
        if line.startswith("/*", i):
            in_block_comment = True
            i += 2
            continue
        if line.startswith("//", i):
            break
        out.append(line[i])
        i += 1
    cleaned = STRING_LITERAL_RE.sub('""', "".join(out))
    if "#" in cleaned:
        cleaned = cleaned.split("#", 1)[0]
    return cleaned.strip(), in_block_comment


def scan_text(path: Path, root: Path, text: str) -> list[Finding]:
    findings: list[Finding] = []
    lines = text.splitlines()
    loop_stack: list[tuple[int, int]] = []
    in_block_comment = False
    function_component_ranges = component_ranges(lines) if path.suffix in {".jsx", ".tsx"} else set()

    for idx, line in enumerate(lines, start=1):
        stripped, in_block_comment = strip_code_noise(line, in_block_comment)
        if not stripped:
            continue
        expanded = line.expandtabs(4)
        indent = len(expanded) - len(expanded.lstrip(" "))
        loop_stack = [(level, lno) for level, lno in loop_stack if level < indent]
        was_in_loop = bool(loop_stack)
        has_inline_callback = bool(CALLBACK_LOOP_RE.search(stripped)) and ("=>" in stripped or "function" in stripped)

        if LOOP_RE.search(stripped):
            if was_in_loop or len(CALLBACK_LOOP_RE.findall(stripped)) >= 2:
                findings.append(
                    Finding(
                        rel(path, root),
                        idx,
                        "high",
                        "nested-or-callback-loop",
                        "Loop or array iteration appears inside another loop/callback.",
                        "Check whether indexing, grouping, batching, or a single-pass algorithm can remove repeated scans.",
                    )
                )
            loop_stack.append((indent, idx))

        in_effective_loop = was_in_loop or has_inline_callback

        if in_effective_loop and MEMBERSHIP_RE.search(stripped):
            findings.append(
                Finding(
                    rel(path, root),
                    idx,
                    "medium",
                    "membership-in-loop",
                    "Membership/search operation appears inside iterative code.",
                    "Consider a Set/Map or precomputed lookup if equality and ordering semantics allow it.",
                )
            )

        if in_effective_loop and SORT_RE.search(stripped):
            findings.append(
                Finding(
                    rel(path, root),
                    idx,
                    "high",
                    "sort-in-loop",
                    "Sort appears inside iterative code.",
                    "Move sorting out of the loop or use a heap/binary-search strategy if intermediate order is needed.",
                )
            )

        if in_effective_loop and QUERY_IN_LOOP_RE.search(stripped):
            findings.append(
                Finding(
                    rel(path, root),
                    idx,
                    "high",
                    "io-or-query-in-loop",
                    "Potential database/API/file operation inside a loop.",
                    "Look for N+1 behavior; batch or preload while preserving auth, filters, ordering, and error handling.",
                )
            )

        if idx in function_component_ranges and any(token in stripped for token in [".filter(", ".map(", ".sort(", ".reduce("]):
            findings.append(
                Finding(
                    rel(path, root),
                    idx,
                    "medium",
                    "render-derived-work",
                    "Collection transform appears in a likely UI component render path.",
                    "For large collections, consider memoized selectors, server-side derivation, or virtualization.",
                )
            )

    return findings


def component_ranges(lines: list[str]) -> set[int]:
    active_until = 0
    interesting: set[int] = set()
    brace_balance = 0
    in_component = False

    for idx, line in enumerate(lines, start=1):
        if RENDER_HINT_RE.search(line):
            in_component = True
            active_until = idx + 120
            brace_balance = 0
        if in_component:
            interesting.add(idx)
            brace_balance += line.count("{") - line.count("}")
            if idx > active_until or (idx > active_until - 110 and brace_balance <= 0 and "}" in line):
                in_component = False
    return interesting


def dedupe(findings: list[Finding]) -> list[Finding]:
    seen: set[tuple[str, int, str]] = set()
    result: list[Finding] = []
    for finding in findings:
        key = (finding.path, finding.line, finding.kind)
        if key not in seen:
            seen.add(key)
            result.append(finding)
    return result


def severity_rank(finding: Finding) -> tuple[int, str, int]:
    order = {"high": 0, "medium": 1, "info": 2}
    return (order.get(finding.severity, 3), finding.path, finding.line)


def render_markdown(findings: list[Finding]) -> str:
    if not findings:
        return "No obvious complexity hotspots found by heuristic scanning.\n"
    lines = ["# Complexity Hotspots", ""]
    for finding in findings:
        lines.extend(
            [
                f"## {finding.severity.upper()} {finding.kind}",
                f"- Location: `{finding.path}:{finding.line}`",
                f"- Finding: {finding.message}",
                f"- Suggestion: {finding.suggestion}",
                "",
            ]
        )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Scan a repository for likely complexity hotspots.")
    parser.add_argument("root", nargs="?", default=".", help="Repository or directory to scan.")
    parser.add_argument("--format", choices=["markdown", "json"], default="markdown")
    parser.add_argument("--exclude", action="append", default=[], help="Additional directory name to exclude.")
    parser.add_argument("--max-findings", type=int, default=80)
    args = parser.parse_args()

    root = Path(args.root).resolve()
    excludes = DEFAULT_EXCLUDES | set(args.exclude)
    findings: list[Finding] = []

    for path in iter_files(root, excludes):
        text = read_text(path)
        if text is None:
            continue
        if path.suffix == ".py":
            findings.extend(scan_python(path, root, text))
        else:
            findings.extend(scan_text(path, root, text))

    findings = sorted(dedupe(findings), key=severity_rank)[: args.max_findings]
    if args.format == "json":
        print(json.dumps([asdict(f) for f in findings], indent=2))
    else:
        print(render_markdown(findings))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

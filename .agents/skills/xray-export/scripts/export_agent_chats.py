#!/usr/bin/env python3

import argparse
import json
import os
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Optional, Tuple, List


HOME = Path.home()
DEFAULT_AGENTS = ["codex", "claudecode", "opencode", "pi"]
ENV_AGENT_HINTS = {
    "codex": ["CODEX_THREAD_ID", "CODEX_SANDBOX", "CODEX_CI"],
    "claudecode": ["CLAUDECODE", "CLAUDE_SESSION_ID", "CLAUDE_PROJECT_DIR"],
    "opencode": ["OPENCODE_SESSION_ID", "OPENCODE_DIR", "OPENCODE"],
    "pi": ["PI_SESSION_ID", "PI_AGENT", "PI_CWD"],
}


@dataclass
class ExportRecord:
    agent: str
    session_id: str
    title: str
    source: str
    cwd: Optional[str]
    started_at: Optional[str]
    selected_by: str
    markdown: str


@dataclass
class DetectionResult:
    mode: str
    agents: List[str]
    reason: str


def iso_from_ms(value: Any) -> Optional[str]:
    try:
        return datetime.fromtimestamp(int(value) / 1000, tz=timezone.utc).isoformat()
    except Exception:
        return None


def ensure_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False)


def extract_text_blocks(content: Any) -> str:
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    blocks: list[str] = []
    for item in content:
        if not isinstance(item, dict):
            continue
        item_type = item.get("type")
        if item_type in {"text", "input_text", "output_text"}:
            text = item.get("text", "")
            if text:
                blocks.append(text)
        elif item_type == "tool_use":
            name = item.get("name") or item.get("tool_name") or "tool"
            blocks.append(f"[tool_use] {name}")
        elif item_type == "tool_result":
            name = item.get("name") or item.get("tool_name") or "tool"
            blocks.append(f"[tool_result] {name}")
    return "\n\n".join(blocks).strip()


def md_header(record: ExportRecord) -> str:
    lines = [
        f"# {record.agent} session export",
        "",
        f"- session_id: `{record.session_id}`",
        f"- title: {record.title or '(untitled)'}",
        f"- source: `{record.source}`",
        f"- cwd: `{record.cwd or 'unknown'}`",
        f"- started_at: `{record.started_at or 'unknown'}`",
        f"- selected_by: `{record.selected_by}`",
        "",
        "---",
        "",
    ]
    return "\n".join(lines)


def write_record(outdir: Path, record: ExportRecord) -> Path:
    path = outdir / f"{record.agent}-{record.session_id}.md"
    path.write_text(md_header(record) + record.markdown.rstrip() + "\n", encoding="utf-8")
    return path


def find_candidate_cwd(target_cwd: Optional[str], value: Optional[str]) -> bool:
    if not target_cwd or not value:
        return False
    return os.path.realpath(value) == os.path.realpath(target_cwd)


def detect_agent_from_env() -> Optional[str]:
    upper_env = {key.upper(): value for key, value in os.environ.items()}
    for agent, keys in ENV_AGENT_HINTS.items():
        if any(key.upper() in upper_env for key in keys):
            return agent
    return None


def export_codex(target_cwd: Optional[str], allow_fallback: bool = False) -> Optional[ExportRecord]:
    sessions_root = HOME / ".codex" / "sessions"
    files = sorted(sessions_root.rglob("*.jsonl"))
    best_exact = None
    best_fallback = None

    for path in files:
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except Exception:
            continue
        session_id = ""
        cwd = None
        started_at = None
        parts: list[str] = []
        for line in lines:
            try:
                obj = json.loads(line)
            except Exception:
                continue
            obj_type = obj.get("type")
            payload = obj.get("payload", {})
            if obj_type == "session_meta":
                session_id = payload.get("id", session_id)
                cwd = payload.get("cwd", cwd)
                started_at = payload.get("timestamp", started_at)
            elif obj_type == "response_item" and payload.get("type") == "message":
                role = payload.get("role", "unknown")
                if role not in {"user", "assistant"}:
                    continue
                text = extract_text_blocks(payload.get("content"))
                if text:
                    parts.append(f"## {role}\n\n{text}\n")
            elif obj_type == "event_msg":
                if payload.get("type") == "agent_reasoning_section_break":
                    text = payload.get("section", "")
                    if text:
                        parts.append(f"## note\n\n{ensure_text(text)}\n")
        if not session_id or not parts:
            continue
        record = ExportRecord(
            agent="codex",
            session_id=session_id,
            title=Path(path).stem,
            source=str(path),
            cwd=cwd,
            started_at=started_at,
            selected_by="cwd-match" if find_candidate_cwd(target_cwd, cwd) else "latest-fallback",
            markdown="\n".join(parts),
        )
        if find_candidate_cwd(target_cwd, cwd):
            best_exact = record
        best_fallback = record
    return best_exact or (best_fallback if allow_fallback else None)


def export_pi(target_cwd: Optional[str], allow_fallback: bool = False) -> Optional[ExportRecord]:
    root = HOME / ".pi" / "agent" / "sessions"
    files = sorted(root.rglob("*.jsonl"))
    best_exact = None
    best_fallback = None

    for path in files:
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except Exception:
            continue
        session_id = ""
        cwd = None
        started_at = None
        parts: list[str] = []
        for line in lines:
            try:
                obj = json.loads(line)
            except Exception:
                continue
            obj_type = obj.get("type")
            if obj_type == "session":
                session_id = obj.get("id", session_id)
                cwd = obj.get("cwd", cwd)
                started_at = obj.get("timestamp", started_at)
            elif obj_type == "message":
                message = obj.get("message", {})
                role = message.get("role", "unknown")
                text = extract_text_blocks(message.get("content"))
                error = message.get("errorMessage")
                if error:
                    text = (text + "\n\n" if text else "") + f"[error] {error}"
                if text:
                    parts.append(f"## {role}\n\n{text}\n")
        if not session_id or not parts:
            continue
        record = ExportRecord(
            agent="pi",
            session_id=session_id,
            title=Path(path).stem,
            source=str(path),
            cwd=cwd,
            started_at=started_at,
            selected_by="cwd-match" if find_candidate_cwd(target_cwd, cwd) else "latest-fallback",
            markdown="\n".join(parts),
        )
        if find_candidate_cwd(target_cwd, cwd):
            best_exact = record
        best_fallback = record
    return best_exact or (best_fallback if allow_fallback else None)


def export_claudecode(target_cwd: Optional[str], allow_fallback: bool = False) -> Optional[ExportRecord]:
    project_root = HOME / ".claude" / "projects"
    transcript_root = HOME / ".claude" / "transcripts"
    best_exact = None
    best_fallback = None

    project_files = sorted(project_root.rglob("*.jsonl")) if project_root.exists() else []
    transcript_files = sorted(transcript_root.glob("*.jsonl")) if transcript_root.exists() else []

    for path in project_files + transcript_files:
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except Exception:
            continue
        session_id = path.stem
        cwd = None
        started_at = None
        parts: list[str] = []
        if "/.claude/projects/" in str(path):
            encoded = path.parent.name
            cwd = encoded.replace("-", "/").replace("//", "/")
            if not cwd.startswith("/"):
                cwd = "/" + cwd.lstrip("/")
        for line in lines:
            try:
                obj = json.loads(line)
            except Exception:
                continue
            obj_type = obj.get("type")
            ts = obj.get("timestamp")
            if started_at is None and ts:
                started_at = ts
            if obj_type in {"user", "assistant"}:
                text = ensure_text(obj.get("content"))
                if text:
                    parts.append(f"## {obj_type}\n\n{text}\n")
            elif obj_type == "tool_use":
                name = obj.get("tool_name", "tool")
                tool_input = ensure_text(obj.get("tool_input"))
                parts.append(f"## tool_use\n\n`{name}`\n\n```json\n{tool_input}\n```\n")
            elif obj_type == "tool_result":
                name = obj.get("tool_name", "tool")
                tool_output = ensure_text(obj.get("tool_output"))
                parts.append(f"## tool_result\n\n`{name}`\n\n```json\n{tool_output}\n```\n")
        if not parts:
            continue
        record = ExportRecord(
            agent="claudecode",
            session_id=session_id,
            title=path.stem,
            source=str(path),
            cwd=cwd,
            started_at=started_at,
            selected_by="cwd-match" if find_candidate_cwd(target_cwd, cwd) else "latest-fallback",
            markdown="\n".join(parts),
        )
        if find_candidate_cwd(target_cwd, cwd):
            best_exact = record
        best_fallback = record
    return best_exact or (best_fallback if allow_fallback else None)


def export_opencode(target_cwd: Optional[str], allow_fallback: bool = False) -> Optional[ExportRecord]:
    db_path = HOME / ".local" / "share" / "opencode" / "opencode.db"
    if not db_path.exists():
        return None

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            """
            select id, title, directory, time_created, time_updated
            from session
            order by time_updated desc
            """
        ).fetchall()
        best_exact = None
        best_fallback = None
        for row in rows:
            session_id = row["id"]
            cwd = row["directory"]
            started_at = iso_from_ms(row["time_created"])
            selected_by = "cwd-match" if find_candidate_cwd(target_cwd, cwd) else "latest-fallback"

            message_rows = conn.execute(
                """
                select id, data, time_created
                from message
                where session_id = ?
                order by time_created asc
                """,
                (session_id,),
            ).fetchall()
            parts: list[str] = []
            for message_row in message_rows:
                try:
                    data = json.loads(message_row["data"])
                except Exception:
                    continue
                role = data.get("role", "unknown")
                text = extract_text_blocks(data.get("content"))
                if not text:
                    text = ensure_text(data)
                if text:
                    parts.append(f"## {role}\n\n{text}\n")

            if not parts:
                part_rows = conn.execute(
                    """
                    select data, time_created
                    from part
                    where session_id = ?
                    order by time_created asc
                    """,
                    (session_id,),
                ).fetchall()
                for part_row in part_rows:
                    parts.append(f"## part\n\n```json\n{part_row['data']}\n```\n")

            if not parts:
                continue

            record = ExportRecord(
                agent="opencode",
                session_id=session_id,
                title=row["title"] or session_id,
                source=str(db_path),
                cwd=cwd,
                started_at=started_at,
                selected_by=selected_by,
                markdown="\n".join(parts),
            )
            if selected_by == "cwd-match":
                best_exact = record
            best_fallback = record
        return best_exact or (best_fallback if allow_fallback else None)
    finally:
        conn.close()


def export_agents(agents: Iterable[str], target_cwd: Optional[str], allow_fallback: bool) -> Tuple[List[ExportRecord], List[str]]:
    exporters = {
        "codex": lambda cwd: export_codex(cwd, allow_fallback=allow_fallback),
        "claudecode": lambda cwd: export_claudecode(cwd, allow_fallback=allow_fallback),
        "opencode": lambda cwd: export_opencode(cwd, allow_fallback=allow_fallback),
        "pi": lambda cwd: export_pi(cwd, allow_fallback=allow_fallback),
    }
    records: list[ExportRecord] = []
    missing: list[str] = []
    for agent in agents:
        exporter = exporters[agent]
        record = exporter(target_cwd)
        if record is None:
            missing.append(agent)
            continue
        records.append(record)
    return records, missing


def infer_agent_by_cwd(target_cwd: Optional[str]) -> Optional[str]:
    if not target_cwd:
        return None
    inferred: List[str] = []
    for agent in DEFAULT_AGENTS:
        records, _ = export_agents([agent], target_cwd, allow_fallback=False)
        if records:
            inferred.append(agent)
    if len(inferred) == 1:
        return inferred[0]
    return None


def infer_agents_by_cwd(target_cwd: Optional[str]) -> List[str]:
    if not target_cwd:
        return []
    inferred: List[str] = []
    for agent in DEFAULT_AGENTS:
        records, _ = export_agents([agent], target_cwd, allow_fallback=False)
        if records:
            inferred.append(agent)
    return inferred


def write_index(outdir: Path, records: List[ExportRecord], missing: List[str], detection: DetectionResult) -> None:
    lines = [
        "# Agent chat export",
        "",
        f"- generated_at: `{datetime.now(tz=timezone.utc).isoformat()}`",
        f"- exports: `{len(records)}`",
        f"- detection_mode: `{detection.mode}`",
        f"- detection_reason: `{detection.reason}`",
        f"- detected_agents: `{', '.join(detection.agents) if detection.agents else 'unknown'}`",
        "",
    ]
    if records:
        lines.append("## Exported")
        lines.append("")
        for record in records:
            filename = f"{record.agent}-{record.session_id}.md"
            lines.append(f"- `{record.agent}`: [{filename}]({filename})")
            lines.append(f"  source=`{record.source}` cwd=`{record.cwd or 'unknown'}` selected_by=`{record.selected_by}`")
        lines.append("")
    if missing:
        lines.append("## Missing")
        lines.append("")
        for agent in missing:
            lines.append(f"- `{agent}`")
        lines.append("")
    (outdir / "index.md").write_text("\n".join(lines), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export local coding agent chats to markdown.")
    parser.add_argument("--cwd", help="Prefer sessions whose cwd matches this path.")
    parser.add_argument("--outdir", help="Output directory.")
    parser.add_argument("--agent", action="append", choices=DEFAULT_AGENTS, dest="agents")
    parser.add_argument(
        "--current-agent",
        choices=["auto"] + DEFAULT_AGENTS,
        default="auto",
        help="Detect the current agent automatically or force a specific one.",
    )
    parser.add_argument("--all-agents", action="store_true", help="Export all supported agents instead of only codex.")
    parser.add_argument("--allow-fallback", action="store_true", help="If no exact cwd match exists, fall back to the latest session.")
    parser.add_argument("--latest", type=int, default=1, help="Reserved for future use. Currently only 1 is supported.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    detection = DetectionResult(mode="unknown", agents=[], reason="no detection attempted")
    if args.agents:
        agents = args.agents
        detection = DetectionResult(mode="explicit-agent", agents=agents, reason="user provided --agent")
    elif args.all_agents:
        agents = DEFAULT_AGENTS
        detection = DetectionResult(mode="all-agents", agents=agents, reason="user enabled --all-agents")
    else:
        detected_agent = None
        if args.current_agent != "auto":
            detected_agent = args.current_agent
            detection = DetectionResult(mode="forced-current-agent", agents=[detected_agent], reason="user provided --current-agent")
        else:
            detected_agent = detect_agent_from_env()
            if detected_agent is None:
                target_cwd_for_infer = os.path.realpath(args.cwd) if args.cwd else None
                detected_agent = infer_agent_by_cwd(target_cwd_for_infer)
            else:
                detection = DetectionResult(mode="env", agents=[detected_agent], reason="matched stable environment markers")
        if detected_agent:
            agents = [detected_agent]
            if detection.mode == "unknown":
                detection = DetectionResult(mode="cwd-single-match", agents=[detected_agent], reason="exact cwd matched exactly one agent")
        else:
            inferred_agents = infer_agents_by_cwd(os.path.realpath(args.cwd) if args.cwd else None)
            if inferred_agents:
                agents = inferred_agents
                detection = DetectionResult(mode="cwd-ambiguous", agents=agents, reason="exact cwd matched multiple agents")
            else:
                agents = DEFAULT_AGENTS
                detection = DetectionResult(mode="fallback-all", agents=agents, reason="no env marker and no cwd match")
    target_cwd = os.path.realpath(args.cwd) if args.cwd else None
    date_part = datetime.now().strftime("%Y-%m-%d")
    outdir = Path(args.outdir) if args.outdir else Path.cwd() / "exports" / "current-session" / date_part
    outdir.mkdir(parents=True, exist_ok=True)

    records, missing = export_agents(agents, target_cwd, allow_fallback=args.allow_fallback)
    written_paths = [write_record(outdir, record) for record in records]
    write_index(outdir, records, missing, detection)

    if len(written_paths) == 1 and len(agents) == 1:
        print(str(written_paths[0]))
    else:
        print(str(outdir))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

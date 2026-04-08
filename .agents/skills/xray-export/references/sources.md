# Sources

当前 skill 假定以下本地数据源存在：

- `~/.codex/sessions/**/*.jsonl`
- `~/.claude/transcripts/*.jsonl`
- `~/.claude/projects/**/*.jsonl`
- `~/.pi/agent/sessions/**/*.jsonl`
- `~/.local/share/opencode/opencode.db`

导出目标是 Markdown 可读归档，不是底层事件的无损备份。

已知限制：

- `claudecode` 的 transcript 不总是显式保存 `cwd`，因此会优先尝试项目归档，再回退到 transcript
- `opencode` 依赖本地 SQLite 表结构；如果版本升级导致字段变化，脚本需要调整
- `codex` 与 `pi` 更适合按 `cwd` 过滤，因为原始会话里有明显的目录字段

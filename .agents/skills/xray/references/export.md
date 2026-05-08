# Export Mode

适用场景：用户要求导出当前 coding agent 的当前会话、保存当前对话为 Markdown，或明确要求扩展到 `codex`、`claudecode`、`opencode`、`pi` / 多 agent 会话归档。

目标是生成可读 Markdown 归档，不是底层事件的无损备份。

## 默认策略

1. 默认先自动检测当前 agent
2. 检测顺序是：显式参数 > 环境变量 > 当前 `cwd` 命中推断
3. 默认按当前 `cwd` 精确匹配
4. 在命中多个会话时，取最新一条
5. 只有用户明确要求时，才导出其他 agent 或启用回退逻辑
6. 输出到用户指定目录；未指定时输出到当前目录下的 `exports/current-session/<date>/`

## 执行方式

优先运行脚本：

```bash
python3 scripts/export_agent_chats.py --cwd "$PWD"
```

如果当前工作目录不是 `xray` skill 根目录，用脚本的绝对路径：

```bash
python3 /Users/didi/art/github/dotfiles/.agents/skills/xray/scripts/export_agent_chats.py --cwd "$PWD"
```

常用参数：

- `--cwd /abs/path/to/project`
- `--outdir ./exports/current-session/2026-04-08`
- `--current-agent auto`
- `--all-agents`
- `--allow-fallback`
- `--agent codex --agent claudecode`

## 数据源

- `codex`: `~/.codex/sessions/**/*.jsonl`
- `claudecode`: `~/.claude/transcripts/*.jsonl`，必要时补查 `~/.claude/projects/**`
- `pi`: `~/.pi/agent/sessions/**/*.jsonl`
- `opencode`: `~/.local/share/opencode/opencode.db`

## 边界规则

- 不要假设所有 agent 都存在
- 默认不要扫描无关 agent
- 不要因为某一类 agent 缺失就整体失败
- 遇到解析失败的会话时，在 `index.md` 或终端结果里明确记录失败原因
- Markdown 以可读性优先，不追求完整复刻底层事件
- 自动检测失败时，不要伪装成“知道当前 agent”，应降级为按 `cwd` 在四类 agent 中推断

## 输出要求

- 默认只输出一个 Markdown 文件
- 多 agent 模式下生成 `index.md` 汇总导出结果
- Markdown 中保留：
  - agent 名称
  - session id
  - 原始来源路径
  - 工作目录或命中的筛选依据
  - 时间戳
  - 用户 / assistant 对话正文
  - 关键工具调用摘要

## 结果交付

完成后给用户：

- 输出文件或输出目录
- 检测到的当前 agent
- 命中的 session id
- 是否使用了回退逻辑
- 如果用户启用了多 agent，再汇报哪些 agent 没有命中

## 已知限制

- `claudecode` 的 transcript 不总是显式保存 `cwd`，因此会优先尝试项目归档，再回退到 transcript
- `opencode` 依赖本地 SQLite 表结构；如果版本升级导致字段变化，脚本需要调整
- `codex` 与 `pi` 更适合按 `cwd` 过滤，因为原始会话里有明显的目录字段

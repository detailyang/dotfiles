---
name: feedly-daily
description: 每日自动化阅读 Feedly Today 文章、标记已读、生成中文总结报告。当用户说"打开 Feedly 看新闻"、"帮我看今天的 Feedly"、"获取 Feedly 文章"、"标记 Feedly 已读"、"生成今日阅读报告"、"总结今天的技术新闻"时使用此 skill。
---

# Feedly Daily

自动化完成每日 Feedly 阅读流程：打开 Today 页面 → 提取文章链接 → 标记已读 → 生成 Markdown 报告。

## 工作流程

每次执行按以下顺序操作：

1. 用 `agent-browser open https://feedly.com/i/my/me` 打开 Feedly Today 页面
2. 用 JS eval 提取最多 20 篇文章链接（排除 feedly.com 自身链接）
3. 点击 "Mark as read" 按钮（ref 从 snapshot 中查找）
4. 将文章写入报告文件 `~/feedly/YYYY-MM-DD-{4位随机数}.md`

**一次性完成，不循环**：Feedly 标记已读后会刷新并加载新文章，忽略这些新文章，不再提取第二批。每天只处理最初加载的最多 20 篇。

## 提取文章的 JS

通过 heredoc 执行，避免引号转义问题：

```bash
cat <<'JS' | agent-browser eval --stdin
const result = [];
let count = 0;
document.querySelectorAll('article').forEach(article => {
  if (count >= 20) return;
  const titleLink = article.querySelector('a[href^="https://"]:not([href*="feedly.com"])');
  const sourceLink = article.querySelector('a[href*="/subscription/"]');
  if (titleLink && !result.find(a => a.url === titleLink.href)) {
    result.push({
      index: ++count,
      title: titleLink.textContent.trim().substring(0, 100),
      url: titleLink.href,
      source: sourceLink?.textContent?.trim() || ''
    });
  }
});
JSON.stringify(result);
JS
```

## 报告格式

报告保存到 `~/feedly/YYYY-MM-DD-{4位随机数}.md`（每次生成新文件，不覆盖已有文件）：

```markdown
# Feedly Daily - YYYY-MM-DD

## 文章列表

1. [标题](url) — 来源
2. ...

## 中文摘要

### 1. [标题](url)
一两句话总结文章核心内容。

### 2. [标题](url)
...

---
生成时间：HH:MM
```

摘要部分：逐篇用 `agent-browser open <url>` 打开，再用 `agent-browser snapshot` 提取正文并用中文概括要点。如果内容获取失败（登录墙、paywall、Cloudflare 验证），跳过并标注"内容不可访问"。

## 边界情况

- **文章不足 20 篇**：直接用现有数量生成报告，不报错；标记已读后新加载的文章留待明天处理
- **登录过期**：页面跳转到登录页时，提示用户重新登录，不继续执行
- **Mark as read 找不到**：snapshot 后搜索 "Mark as read" 对应的 ref，找不到则跳过标记步骤并告知用户

## 脚本方式

```bash
~/.agents/skills/feedly-daily/feedly-daily.sh [--mark-read] [--limit N]
```

- `--mark-read`：提取后自动标记已读
- `--limit N`：限制提取文章数（默认 20）

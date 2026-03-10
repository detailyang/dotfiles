---
name: news
description: 每日阅读工作流 - 依次展示 HN 10条和 Feedly 10条未读文章，用户选择后 AI 分析原文，自动标记已读
allowed-tools:
  - Bash(python3 scripts/fetch_hn.py)
  - Bash(agent-browser *)
  - WebFetch
---

# News Reader - 每日阅读工作流

## 触发

```
/news
```

## 工作流程

### 第一步：获取 HN Top 10

```bash
python3 scripts/fetch_hn.py
```

输出格式：
```json
[
  {"title": "文章标题", "url": "https://...", "score": 123, "comments": 45}
]
```

展示给用户，格式：
```
1. [标题] (score: N, comments: N)
2. [标题] (score: N, comments: N)
...
```

### 第二步：用户选择 HN 文章

用户输入感兴趣的序号 (如 `1,3,5` 或 `1-3`)

### 第三步：AI 分析 HN 文章

对每篇选择的文章，使用 WebFetch 获取原文内容，然后总结要点。

### 第四步：获取 Feedly 未读

使用 `--auto-connect` 连接你已有的 Chrome (复用登录态)：

```bash
# 连接到已有 Chrome
agent-browser --auto-connect open "https://feedly.com/i/my/me"
agent-browser wait --load networkidle

# 获取页面快照
agent-browser snapshot -i

# 使用 eval 提取未读文章并自动标记已读
agent-browser eval --stdin <<'EOF'
(function(){
  const items = document.querySelectorAll('.entry--unread, .previewable-entity');
  const results = [];
  for(let i=0; i<Math.min(10, items.length); i++){
    const el = items[i];
    const title = el.querySelector('.title')?.textContent?.trim();
    const link = el.querySelector('a')?.href;
    if(title && link) {
      results.push({title, url: link});
      // 尝试标记已读
      const markBtn = el.querySelector('[data-original-title="Mark as read"]');
      if(markBtn) markBtn.click();
    }
  }
  return JSON.stringify(results);
})()
EOF
```

**首次使用**：需先开启 Chrome 远程调试（复用你的 Chrome 配置）：
```bash
open -a "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir="$HOME/Library/Application Support/Google/Chrome"
```

### 第五步：展示 Feedly 文章

格式：
```
1. [中文标题]
2. [中文标题]
...
```

### 第六步：用户选择 Feedly 文章

用户输入感兴趣的序号

### 第七步：AI 分析 Feedly 文章

使用 WebFetch 获取原文并总结。

## 输出格式

每个阶段的展示格式：

**HN:**
```
=== HackerNews Top 10 ===

1. [Title](url) — 一句话总结 (score: N, comments: N)
2. [Title](url) — 一句话总结 (score: N, comments: N)
...

请输入要分析的文章序号 (如 1,3,5 或 1-3):
```

**Feedly:**
```
=== Feedly 未读 (前10条) ===

1. [中文标题]
2. [中文标题]
...

请输入要分析的文章序号 (如 1,3,5 或 1-3):
```

## 依赖

- Python 3
- agent-browser CLI
- WebFetch (xray-url)
- Chrome 开启远程调试: `open -a "Google Chrome" --args --remote-debugging-port=9222`
- Feedly 已登录 (复用你的 Chrome 登录态)

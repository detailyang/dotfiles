# News Skill Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建 `news` skill，合并 HN 和 Feedly 阅读工作流，自动标记已读

**Architecture:** 新建 `news` skill 目录，复用 `hn` 的 fetch_hn.py，新建 fetch_feedly.py 使用浏览器自动化抓取和标记

**Tech Stack:** Python, agent-browser (Playwright), OpenCode Skills

---

## File Structure

```
.claude/skills/news/
├── SKILL.md              # Skill 定义
└── scripts/
    ├── fetch_hn.py       # 软链接到 ../hn/scripts/fetch_hn.py
    └── fetch_feedly.py   # 新建，浏览器自动化
```

---

## Chunk 1: 创建 Skill 目录结构

**Files:**
- Create: `.claude/skills/news/`
- Create: `.claude/skills/news/scripts/`

- [ ] **Step 1: 创建 news skill 目录**

```bash
mkdir -p .claude/skills/news/scripts
```

- [ ] **Step 2: 验证目录创建成功**

Run: `ls -la .claude/skills/news/`
Expected: 显示 news 和 scripts 目录

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/news/
git commit -m "feat: create news skill directory structure"
```

---

## Chunk 2: 复用 fetch_hn.py

**Files:**
- Create: `.claude/skills/news/scripts/fetch_hn.py` (软链接)

- [ ] **Step 1: 创建软链接**

```bash
ln -s ../../hn/scripts/fetch_hn.py .claude/skills/news/scripts/fetch_hn.py
```

- [ ] **Step 2: 验证软链接**

Run: `ls -la .claude/skills/news/scripts/fetch_hn.py`
Expected: 指向 ../../hn/scripts/fetch_hn.py

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/news/scripts/fetch_hn.py
git commit -m "feat: link fetch_hn.py to news skill"
```

---

## Chunk 3: 实现 fetch_feedly.py

**Files:**
- Create: `.claude/skills/news/scripts/fetch_feedly.py`

- [ ] **Step 1: 创建 fetch_feedly.py 基础框架**

```python
#!/usr/bin/env python3
"""Fetch Feedly unread articles with browser automation."""
import json
import sys

def main():
    # Output format matching fetch_hn.py
    articles = []
    print(json.dumps(articles, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 实现浏览器自动化逻辑**

需要使用 agent-browser skill 的 Python API (如果可用) 或 subprocess 调用

主要逻辑:
1. 启动浏览器打开 feedly.com
2. 等待登录 (如果未登录)
3. 获取前 10 条未读文章
4. 对每条点击 "Mark as read"
5. 输出 JSON

```python
#!/usr/bin/env python3
"""Fetch Feedly unread articles with browser automation."""
import json
import subprocess
import sys

def run_browser_script():
    """使用 Playwright 执行浏览器自动化"""
    script = """
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // 打开 feedly
  await page.goto('https://feedly.com/i/my/me');
  
  // 等待登录或加载完成
  await page.waitForLoadState('networkidle');
  
  // 获取未读文章 (前 10 条)
  const articles = await page.evaluate(() => {
    const items = document.querySelectorAll('.entry--unread, .previewable-entity');
    const results = [];
    
    for (let i = 0; i < Math.min(10, items.length); i++) {
      const item = items[i];
      const title = item.querySelector('.title')?.textContent?.trim() || '';
      const link = item.querySelector('a')?.href || '';
      
      if (title && link) {
        results.push({
          title: title,
          url: link,
          source: 'feedly'
        });
        
        // 标记已读 - 找到三 dot 菜单并点击 Mark as read
        const menuButton = item.querySelector('[data-original-title="Mark as read"]');
        if (menuButton) {
          menuButton.click();
        }
      }
    }
    return results;
  });
  
  console.log(JSON.stringify(articles, null, 2));
  await browser.close();
})();
"""
    return script

def main():
    result = subprocess.run(
        ['node', '-e', run_browser_script()],
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        print(json.dumps([{"error": result.stderr}], ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
    
    print(result.stdout)

if __name__ == "__main__":
    main()
```

- [ ] **Step 3: 测试 fetch_feedly.py**

Run: `python3 .claude/skills/news/scripts/fetch_feedly.py`
Expected: 输出 JSON 数组或错误信息

注意: 首次运行需要登录 feedly，可能需要手动授权

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/news/scripts/fetch_feedly.py
git commit -m "feat: add fetch_feedly.py with browser automation"
```

---

## Chunk 4: 创建 news SKILL.md

**Files:**
- Create: `.claude/skills/news/SKILL.md`

- [ ] **Step 1: 创建 SKILL.md**

```yaml
---
name: news
description: 每日阅读工作流 - 依次展示 HN 10条和 Feedly 10条未读文章，用户选择后 AI 分析原文
---

# News Reader - 每日阅读工作流

## Workflow

1. 运行 fetch_hn.py → 展示 10 条 HN
2. 用户选择感兴趣的 N 篇
3. AI 使用 xray-url 分析每篇原文
4. 运行 fetch_feedly.py → 展示 10 条 Feedly 未读
5. 用户选择感兴趣的 N 篇
6. AI 使用 xray-url 分析每篇原文

## Commands

### 触发 Skill
```
/news
```

## 实现细节

- HN: 使用 fetch_hn.py 获取 Top 10
- Feedly: 使用 fetch_feedly.py (浏览器自动化) 获取未读前 10 并自动标记已读

## 依赖

- node + playwright (feedly 浏览器自动化)
- xray-url skill (分析文章)
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/news/SKILL.md
git commit -m "feat: add news SKILL.md"
```

---

## Chunk 5: 测试完整工作流

**Files:**
- Test: `.claude/skills/news/`

- [ ] **Step 1: 测试 /news 命令触发**

Run: 使用 OpenCode 触发 /news
Expected: 展示 10 条 HN

- [ ] **Step 2: 测试文章选择和分析**

选择 1-2 篇测试 AI 分析
Expected: xray-url skill 分析原文

- [ ] **Step 3: 测试 Feedly 抓取**

触发 Feedly 部分
Expected: 浏览器打开 feedly，获取 10 条未读，自动标记已读

- [ ] **Step 4: 最终 Commit**

```bash
git add .
git commit -m "feat: complete news skill with hn and feedly integration"
```

---

## 验证清单

- [ ] news skill 目录结构正确
- [ ] fetch_hn.py 软链接可用
- [ ] fetch_feedly.py 可以抓取 feedly
- [ ] 自动标记已读功能正常
- [ ] SKILL.md 格式正确
- [ ] 完整工作流可执行

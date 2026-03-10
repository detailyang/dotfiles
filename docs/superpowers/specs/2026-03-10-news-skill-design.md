# News Skill 设计规格

**日期**: 2026-03-10  
**目标**: 创建 `news` skill，统一管理 HN 和 Feedly 阅读工作流

## 概述

创建 `news` skill，合并现有 hn skill 功能，并新增 Feedly 自动化抓取。每天依次展示 HN 10 条和 Feedly 10 条未读文章，用户选择后 AI 分析原文。

## 工作流程

```
1. /news 触发
2. 运行 fetch_hn.py → 展示 10 条 HN (中文标题)
3. 用户选择感兴趣的 N 篇
4. AI 使用 xray-url 分析每篇原文
5. 运行 fetch_feedly.py (浏览器自动化)
   - 打开 https://feedly.com/i/my/me
   - 获取未读文章列表 (前 10 条)
   - 自动点击 "Mark as read" 标记已读
6. 展示 10 条 Feedly (中文标题)
7. 用户选择感兴趣的 N 篇
8. AI 使用 xray-url 分析每篇原文
```

## 文件结构

```
.claude/skills/news/
  SKILL.md              # Skill 定义
  scripts/
    fetch_hn.py          # 复用 .claude/skills/hn/scripts/fetch_hn.py (软链接或复制)
    fetch_feedly.py      # 新建，浏览器自动化抓取
```

## fetch_feedly.py 规格

### 输入
- 无命令行参数
- 依赖环境变量或配置文件存储 feedly 登录态

### 输出
```json
[
  {
    "title": "文章标题 (中文)",
    "url": "https://...",
    "source": "feedly",
    "timestamp": "2026-03-10T10:00:00Z"
  }
]
```

### 浏览器自动化流程 (agent-browser)

1. 打开 `https://feedly.com/i/my/me`
2. 等待页面加载完成
3. 滚动到文章列表顶部
4. 获取前 10 条未读文章的标题和 URL
5. 对每篇文章执行 "Mark as read"：
   - 悬停在文章元素上
   - 找到并点击 "Mark as read" 按钮 (三 dot 菜单)
6. 关闭浏览器

### 依赖
- agent-browser skill
- Python playwright 或直接用 agent-browser 的 Python API

## 关键设计决策

1. **自动标记已读**: 每次抓取后立即标记，避免重复展示
2. **中文标题**: Feedly 本身支持，直接传递；HN 需要处理英文标题
3. **状态管理**: 不存储已读状态，依赖 Feedly 侧标记
4. **HN 处理**: 复用现有 fetch_hn.py，标题可能需要翻译或保留英文

## 后续可扩展

- 添加更多 RSS 源 (Inoreader, etc.)
- 支持自定义源配置
- 添加 reading list 导出功能

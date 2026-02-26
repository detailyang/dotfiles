---
name: xray-youtube
description: Use when extracting core insights from YouTube videos, especially long-form content, multi-topic videos, or complex technical presentations where manual note-taking would be inefficient
user_invocable: true
---

# Xray-YouTube: 视频内容 X 光机

你是 **视频内容深层解析员**，一名拥有极高结构化思维的"内容审稿人"。

## 核心定位

你的任务不是"转录"视频，而是"解构"视频。穿透视频内容的迷雾，还原创作者最底层的逻辑模型和核心观点。

与论文不同，视频有**时间线、视觉元素、演讲结构**三大特征，需要针对性提取策略。

## 执行步骤

### 步骤 1：视频接收与分析

接收用户提供的 YouTube 视频（URL 或视频 ID）。

判断视频类型：
- **技术教程** (Tutorial)
- **访谈/讲座** (Interview/Lecture)
- **纪录片** (Documentary)
- **产品评测** (Review)
- **Vlog/娱乐** (Vlog/Entertainment)

**如果是 Vlog/娱乐类**：给出低价值警告，询问用户是否继续。

### 步骤 2：时间线解构（核心算法）

#### 2.1 识别视频结构
- 开场（Hook）- 通常在 0-2 分钟
- 主体（Body）- 核心内容
- 结尾（Conclusion）- 总结/行动号召

#### 2.2 标记关键时间节点
- 转折点（话题切换）
- 高潮（核心演示/论证）
- 停顿/强调时刻（演讲者故意放慢/重复的内容通常很重要）

#### 2.3 提取时间戳
为每个重要片段记录时间戳，格式：`MM:SS`

### 步骤 3：多模态提取

#### 3.1 音频提取
- 核心论点
- 关键数据/统计
- 引用/金句
- 行动建议

#### 3.2 视觉提取
- 关键图表（截图或描述）
- 代码演示（记录代码片段）
- 产品界面（描述关键功能）
- 数据可视化（提取关键数字）

#### 3.3 结构提取
- 章节划分
- 逻辑递进关系
- 论证链条

### 步骤 4：批判性评估

#### 4.1 准确性检查
- 是否有夸大宣传？
- 数据是否有来源？
- 结论是否有过渡推断？

#### 4.2 隐形假设识别
- 作者假设观众已知什么？
- 成功的前提条件是什么？
- 有没有忽略边界情况？

#### 4.3 时效性评估
- 内容是否可能过时？
- 技术版本是否已更新？
- 建议是否仍适用？

### 步骤 5：生成 Markdown 报告

使用 Write 工具，按以下模板生成 Markdown 文件。要求：
- 文字精确、简练、清晰
- 使用自然段落，不使用表格
- 时间戳使用 MM:SS 格式
- 如果是中文视频，使用中文输出

```markdown
# xray-{简短标题}

**Date**: {YYYY-MM-DD}  
**Source**: {YouTube URL}  
**Channel**: {频道名}  
**Duration**: {视频时长}  
**Tags**: #watch #xray #youtube

---

## ONE-LINER

{用一句话概括视频的核心价值主张}

---

## VIDEO PROFILE

- **类型**: {技术教程/访谈/纪录片/产品评测/讲座/Vlog}
- **信息密度**: {高/中/低}
- **观看建议**: {值得深度笔记/快速浏览/只听音频/跳过}

---

## CORE INSIGHTS

### 核心观点

1. {观点1} ({MM:SS})
2. {观点2} ({MM:SS})

### 关键数据/事实

- {数据1} ({MM:SS})
- {数据2} ({MM:SS})

### 金句/引用

> "{原话}" ({MM:SS})

---

## ACTIONABLE TAKEAWAYS

### 立即可做的

- [ ] {行动1}
- [ ] {行动2}

### 需要深挖的

- {待研究点1}
- {待研究点2}

---

## TIMELINE BREAKDOWN

| 时间 | 内容 | 重要性 |
|------|------|--------|
| 00:00 | 开场 | ☆☆☆ |
| {MM:SS} | {关键节点} | ★★★ |
| {MM:SS} | {转折/高潮} | ★★★ |

---

## VISUAL SNAPSHOTS

### 关键图表

- {MM:SS} - {图表描述}

### 代码/演示

- {MM:SS} - {代码片段或功能描述}

### 产品界面

- {MM:SS} - {界面描述}

---

## CRITICAL ASSESSMENT

### 准确性

{是否有夸大或错误？}

### 隐形假设

- {假设1}
- {假设2}

### 可能的偏见

- {偏见1}

### 时效性警告

- {是否有过时内容？}

---

## RELATED RESOURCES

### 视频中提到的资源

- {资源名称} - {链接或描述}

### 延伸阅读/观看

- {建议1}
- {建议2}
```

### 步骤 6：保存与打开

1. 生成时间戳：使用 Bash 执行 `date +%Y%m%dT%H%M%S` 获取当前时间
2. 文件名格式（denote 规范）：`{时间戳}--xray-{简短标题}__watch.md`
   - 简短标题：取视频标题前 3-5 个关键词，小写，用连字符连接
   - 示例：`20260207T171500--xray-kubernetes-tutorial__watch.md`
3. 保存路径：`~/Documents/notes/{文件名}`
4. 使用 Bash 执行：`open ~/Documents/notes/{文件名}`

---

## 技术限制与应对策略

### 已知问题

YouTube 有严格的反爬机制，直接获取视频内容会遇到以下问题：

1. **WebFetch 超时** - YouTube 页面加载大量 JavaScript，直接抓取经常超时
2. **反爬限制** - YouTube 会检测和阻止自动化工具访问
3. **动态内容** - 视频描述、评论等内容通过 JS 动态加载

### 推荐解决方案

采用 **混合策略**：

#### 方案 A：yt-dlp（强烈推荐）

**yt-dlp** 是 youtube-dl 的活跃分支，专门用于下载 YouTube 视频和提取元数据，是获取音视频内容的最佳工具。

**安装**：
```bash
# macOS
brew install yt-dlp

# 其他系统
pip install yt-dlp
```

**常用命令**：

1. **获取完整视频信息（JSON）**：
   ```bash
   yt-dlp --dump-json --skip-download "URL"
   ```
   - 返回：标题、作者、时长、描述、标签、章节、缩略图等完整元数据
   - 用于：了解视频结构和基本信息

2. **提取字幕/文字稿**：
   ```bash
   # 列出可用字幕
   yt-dlp --list-subs "URL"
   
   # 下载手动上传的字幕
   yt-dlp --write-subs --sub-langs en,zh-CN --skip-download "URL"
   
   # 下载自动生成的字幕（如果没有手动字幕）
   yt-dlp --write-auto-subs --sub-langs en,zh-CN --skip-download "URL"
   
   # 提取纯文本（去掉时间戳）
   yt-dlp --write-auto-subs --sub-langs en --convert-subs srt --skip-download "URL"
   ```

3. **获取缩略图和元数据文件**：
   ```bash
   yt-dlp --write-thumbnail --write-info-json --skip-download -o "%(title)s.%(ext)s" "URL"
   ```

4. **提取音频（用于离线收听）**：
   ```bash
   yt-dlp -x --audio-format mp3 --audio-quality 0 -o "%(title)s.%(ext)s" "URL"
   ```

5. **通过代理使用**（如果需要）：
   ```bash
   yt-dlp --proxy http://127.0.0.1:7890 --dump-json --skip-download "URL"
   ```

**优点**：
- 稳定可靠，持续更新维护
- 可以获取完整的视频元数据（包括章节信息）
- 支持多种字幕格式（SRT、VTT、JSON）
- 可以提取自动生成的字幕（即使视频没有手动字幕）

**注意事项**：
- 首次使用可能需要下载 ffmpeg（用于音频提取）
- 某些地区可能需要代理
- 自动字幕的准确性取决于视频质量和语音识别

#### 方案 B：oEmbed API + 网络搜索（备选）

1. **获取视频基本信息**：
   ```bash
   curl -s "https://www.youtube.com/oembed?url={YOUTUBE_URL}&format=json"
   ```
   - 返回：标题、作者、缩略图、嵌入代码
   - 优点：稳定、快速、不会被阻止

2. **补充内容细节**：
   - 使用 WebSearch 搜索视频标题 + 演讲者/频道名
   - 查找相关的博客文章、新闻稿、会议摘要
   - 往往能找到比视频更结构化的内容总结

#### 方案 C：使用代理（如果用户提供了）

如果用户提供了代理地址（如 `HTTPS_PROXY=http://127.0.0.1:7890`）：

1. 告知用户正在使用代理获取内容
2. 通过环境变量使用代理：
   ```bash
   HTTPS_PROXY=http://127.0.0.1:7890 curl ...
   ```

#### 方案 D：询问替代方案

如果以上方法都失败：

1. 询问用户是否有视频的文字稿/幻灯片
2. 建议用户手动提供视频的关键时间戳
3. 对于技术视频，搜索 GitHub/官方文档中对应的代码仓库

### 故障排查清单

如果无法获取视频内容，按以下顺序尝试：

- [ ] **首选方案**：使用 yt-dlp 获取视频元数据和字幕
  ```bash
  yt-dlp --dump-json --skip-download "URL"
  yt-dlp --write-auto-subs --skip-download "URL"
  ```
- [ ] 尝试使用 YouTube oEmbed API 获取基本信息
- [ ] 使用 WebSearch 搜索视频标题 + "summary" / "notes" / "key points"
- [ ] 搜索演讲者/频道发布的博客文章或官方文档
- [ ] 询问用户是否使用代理，如果有则配置使用
- [ ] 询问用户是否有其他信息源（如字幕文件、PPT等）

---

## 视频类型处理指南

### 技术教程 (Tutorial)
**提取重点**:
- 前置条件/环境要求
- 关键步骤（带时间戳）
- 配置参数
- 常见坑/错误处理
- 代码片段

**输出重点**: ACTIONABLE TAKEAWAYS 和 VISUAL SNAPSHOTS

### 访谈/讲座 (Interview/Lecture)
**提取重点**:
- 每位嘉宾的核心观点
- 观点冲突/共识点
- 金句/引用
- 转折时刻

**输出重点**: CORE INSIGHTS 中的金句和 TIMELINE BREAKDOWN

### 纪录片 (Documentary)
**提取重点**:
- 叙事主线
- 关键事件（时间+地点）
- 数据/统计
- 专家观点

**输出重点**: TIMELINE BREAKDOWN 和 CRITICAL ASSESSMENT

### 产品评测 (Review)
**提取重点**:
- 评分/结论
- 优点列表
- 缺点列表
- 适用人群
- 竞品对比

**输出重点**: CRITICAL ASSESSMENT（识别偏见）和 ACTIONABLE TAKEAWAYS

### Vlog/娱乐 (Vlog/Entertainment)
**处理策略**:
1. 给出低价值警告：
   > "这是一个 Vlog/娱乐视频，信息密度较低。主要内容可能是个人经历/情绪表达，而非可执行的知识。是否仍要提取摘要？"

2. 如果用户确认继续：
   - 提取情绪/氛围描述
   - 记录关键事件（如果有）
   - 给出观看建议（跳过/只听音频）

---

## 输出质量标准

- **结构化**: 使用清晰的标题和列表，不写长段落
- **时间戳**: 所有关键观点必须标注视频时间
- **批判性**: 必须指出至少一个隐形假设或潜在偏见
- **可执行**: 提取具体的行动建议，而非泛泛而谈
- **视觉化**: 描述关键视觉元素（图表、代码、界面）

---

## 常见陷阱与避免

### ❌ 不要做的
- 逐字转录视频内容
- 记录所有提到的细节（信息过载）
- 忽视视觉元素（只看字幕）
- 不做批判性评估（全盘接受）

### ✅ 应该做的
- 提取"如果只看 5 分钟应该看哪里"
- 标注"这个部分可以跳过"
- 区分事实和观点
- 指出作者的商业利益（如果是评测类）

---

## 示例输出片段

### CORE INSIGHTS 示例

```markdown
### 核心观点

1. 微服务架构不是银弹，只有在团队规模>50人时才值得考虑 (08:32)
2. 单体架构在快速迭代阶段有绝对优势，过早拆分是技术债务 (15:45)

### 关键数据/事实

- Netflix 在 2015 年有超过 500 个微服务 (22:10)
- 微服务迁移的平均成本：每个服务 $50K-$100K (28:00)

### 金句/引用

> "Don't even consider microservices unless you have a system that's too complex to manage as a monolith." 
> — Martin Fowler (35:20)
```

### CRITICAL ASSESSMENT 示例

```markdown
### 准确性

演讲中提到的 2015 年数据已过时，当前云原生技术已大幅降低迁移成本

### 隐形假设

- 演讲者假设听众有分布式系统基础（新手可能跟不上）
- 假设业务已经有一定的技术债务（如果是全新项目，建议不同）

### 可能的偏见

- 演讲者是 AWS 布道师，可能倾向于推荐云原生方案
- 案例主要来自大型科技公司，对中小企业参考性有限
```

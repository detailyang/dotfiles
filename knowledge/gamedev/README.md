# 游戏开发

[返回知识库](../README.md)

单人做游戏时，agent 能接手的环节分三段看：先把企划、规格和进度定下来，再把引擎与资产管线接上，
最后才是画面、动作、性能这些具体产出。按这个顺序排索引，比按热度排更容易在需要时找到东西。

这里只收「制作流程上的工具与参考」。渲染器、GPU 与 VFX 底层的问题去[图形与渲染](../rendering/README.md)。
清单本身是二手整理（见文末核对说明），各仓库的实际能力以它们的 README 为准。

## 1. 企划与进度

| 仓库 | 什么时候查 |
| --- | --- |
| [eremes81/game-design-ai-practice](https://github.com/eremes81/game-design-ai-practice) | 韩文原书《게임 기획 실무에서 바로 쓰는 AI·클로드 코드 활용법》的配套仓库，网页版免费。查战斗、平衡、关卡的 Claude Code 用法，按章节取用示例代码。CC BY-NC-SA 4.0，不可商用。 |
| [dudwns0921/claude-gamedev-kit](https://github.com/dudwns0921/claude-gamedev-kit) | Claude Code 插件，按 goal → spec → design → plan → build 的循环推进，一个 dashboard 看多个项目走到哪一步。想先定流程再写代码时用。 |
| [OpenDCAI/GameFactory-3A](https://github.com/OpenDCAI/GameFactory-3A) | 需求进，图像 / 3D / 动作 / 音频和 UE5、Unity、Godot、three.js 代码出。评估「整条生成链路」而不是单个环节时看。 |

## 2. 引擎与 DCC 的 agent 技能

| 仓库 | 什么时候查 |
| --- | --- |
| [Unity-Technologies/skills](https://github.com/Unity-Technologies/skills) | Unity 官方技能集，覆盖建工程、构建、包管理。Unity Companion License，与 Unity 项目绑定。 |
| [EL4CTEO/blender-skills](https://github.com/EL4CTEO/blender-skills) | 28 个 Blender 技能，建模、UV、PBR、烘焙、绑定、动画、导出、QA 各一个入口。按管线环节挑单个技能装，不必整包。 |
| [scenario-labs/skills](https://github.com/scenario-labs/skills) | Scenario MCP 出图 / 视频 / 音频 / 3D，另带 Blender、Maya、ZBrush、Unreal、Unity 的专家技能。查「先算价再生成」和跨引擎资产一致性时用。 |

## 3. three.js 网页游戏

| 仓库 | 什么时候查 |
| --- | --- |
| [majidmanzarpour/threejs-game-skills](https://github.com/majidmanzarpour/threejs-game-skills) | 玩法、画面、UI、QA、可选资产生成分成不同技能，喊 `threejs-game-director` 会分工。做一个能玩的浏览器游戏并逐项验收时用。 |
| [MengTo/Skills](https://github.com/MengTo/Skills) | 设计向技能合集，含战斗动画、怪物系统、关卡编写、playtest。只要其中一个能力时单挑出来装。 |
| [lovisdotio/video-to-game](https://github.com/lovisdotio/video-to-game) | 给一段 10–15 秒玩法视频，逐帧分析后用 fal 生成资产并写出 Three.js 成品，仓库自带 31 个例子（1,013 次 fal 调用）。参考「视频即规格」的流程；要自己的 fal key 和预算。 |
| [viettranx/3dviz-pro-max](https://github.com/viettranx/3dviz-pro-max) | 一句话创意 → 可漫游的 Three.js / Blender 场景，Claude Code 与 Codex 插件，223 recipes、37 个可运行 study。做场景原型时按 recipe 找。 |

## 4. 特效、示例与性能

| 仓库 | 什么时候查 |
| --- | --- |
| [achrefelouafi/LinearAbiltyCastingThreeJS](https://github.com/achrefelouafi/LinearAbiltyCastingThreeJS) | 用着色器直接写的 LOL 式技能射击沙盒。想读技能特效的着色器与被控效果怎么组织时看。 |
| [boona13/mykonos-island-voxels](https://github.com/boona13/mykonos-island-voxels) | 14×14 网格上点击堆叠方块的等轴小镇建造器，vanilla ES modules、无打包器。参考建造交互、网格坐标换算与缓存缩放。 |
| [gykim80/andrew_game_perf](https://github.com/gykim80/andrew_game_perf) | 把 AI 写的游戏代码里的 10 种帧率下降模式列成表并给修复建议（Three.js、PixiJS、Phaser、React/Zustand）。接手别人的代码先做体检时用。 |

## 5. 2D 精灵与像素画

| 仓库 | 什么时候查 |
| --- | --- |
| [aldegad/sprite-gen](https://github.com/aldegad/sprite-gen) | 用一张基准图生成同姿势的透明帧与精灵表，component-row 流水线做状态行、去边、切帧与运行时图集。做角色动作集时用。 |
| [handsupmin/mono-pix](https://github.com/handsupmin/mono-pix) | 浏览器里把 AI 生成的「假像素画」修成真像素网格，处理模糊边缘和错位格子，免安装。 |

## 6. 3D 动作与动画

| 仓库 | 什么时候查 |
| --- | --- |
| [MaxLiu22/Motion2MixamoRig](https://github.com/MaxLiu22/Motion2MixamoRig) | 单人动作视频或单张照片 → Mixamo 角色重定向，输出可直接进 Blender / Unity 的 `.glb` 与预览。另带 Blender 扩展，不用写代码。 |
| [Friedrich-M/UniMate](https://github.com/Friedrich-M/UniMate) | SIGGRAPH Asia 2026，文本驱动任意骨架（人、四足、鸟、鱼、蛇、刚体关节物），不按骨架重训；`rig_preprocess` 可吃自己的 GLB / glTF / FBX。 |
| [alchaincyf/3d-vibe-coding-handbook](https://github.com/alchaincyf/3d-vibe-coding-handbook) | 386 页中文手册与 demo 源码：图生 3D、减面、绑定、动画的问题集。按症状找章节比顺序读更省时间。 |

## 来源与核对

清单来自用户提供的 18 项整理，原始出处（作者、发布渠道、日期）未记录，可能是二手汇总。

2026-11-18 经 GitHub API 与各仓库 README / 许可证原文核对：确认仓库存在、属主、许可证与最近推送时间，
并抽查了文中的数字（28 个 Blender 技能、386 页、14×14 网格、10 种帧率模式、1,013 次 fal 调用、223 recipes），
与各自 README 一致。没有安装、运行或复现任何工具的产出、成本与性能。

## 适用边界

- 前置条件（据各 README）：blender-skills 要 Blender 5.2 LTS 以上（在 5.3 上验证）；Motion2MixamoRig 的
  Blender 扩展要 4.2 以上，作者只在 Apple Silicon macOS 上测过，项目自称 experimental（0.1.8 是 CLI 流水线）；
  video-to-game 每次都走 fal，要自己的 key 与费用；UniMate 是论文实现，需拉 HuggingFace 权重与 GPU 环境，
  不是装完就能点。Unity、Scenario、Claude Code 各自需要对应客户端或账号。
- 许可证：eremes81 的仓库是 CC BY-NC-SA 4.0（署名、非商用、相同方式共享）；Unity-Technologies/skills 用
  Unity Companion License；mono-pix 与 3d-vibe-coding-handbook 仓库内没有 LICENSE 文件（mono-pix 的 README
  徽章写 MIT，但 GitHub 元数据为空），复用代码前先自行确认；其余为 MIT 或 Apache-2.0。
- 未核实的原始清单说法：blender-skills「可以语音指令」、eremes81 作者「24 年经验」——两份 README 都没写。
- Unity 仓库的描述和 README 里有「Unity workflows」这种残缺写法，属文案瑕疵，不影响判断归属，但用前仍以 README 为准。

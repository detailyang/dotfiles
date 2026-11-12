# 图形与渲染

[返回知识库](../README.md)

看 3D / VFX 工具链时分开两件事：场景怎么用代码组织，渲染器把哪些部分暴露成可编程接口。

## 资料索引

| 层次 | 资料 | 为什么收藏 / 什么时候查 |
| --- | --- | --- |
| Agent 渲染引擎 | [vork — Headless 3D and VFX engine for agents](https://github.com/voyager-so/vork) | agent 直接写场景代码、渲染回看的工作流；查 Slang 程序钩子、Vulkan / Metal 渲染抽象和场景 JSON schema 时用。 |

2026-11-11 收录，只核对了仓库首页、README 与 LICENSE，未安装、未渲染，性能数字未复现。
许可证是 source-available 的 vork Preview License，不是开源：预览期可免费商用，但不能转售修改版，
也不能做成别人提交场景的托管渲染服务。产出物归使用者。

## 适用边界

- Mac 只支持 Apple Silicon + macOS 26，Intel Mac 不支持；渲染需要 NVIDIA + Vulkan ray query，
  或在 Linux 上走 Mesa lavapipe 的 CPU 路径（很慢）。没有合适 GPU 时只能用 `vork init` / `vork help` 写场景。
- 仓库自称比 EEVEE 快 1.1–2.3×，百万鸟群约 8–11×（单卡 L4）；原文写明这是耗时对比、不是等质量对比。
- 场景内容与渲染质量分属不同 profile（`std/previs` / `std/draft` / `std/final` / `std/path`），
  改采样数不补回被省略的光传输；提交镜头前先看 `vork help limits`。

安装、`vork help` 与场景示例回原文看，这里不复制命令。

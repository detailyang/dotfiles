---
name: gpu-optimization
description: 解释 GPU/CUDA 概念并形成有证据的优化假设。用于 SM、warp、内存层次、算术强度或 roofline 问题；端到端采样与 NCU 指标分析分别使用对应专项技能。
license: CC-BY-4.0
metadata:
  source: https://modal.com/gpu-glossary
---

# GPU 概念与优化

先判断用户是在问概念、解释现有数据，还是要求实际改动。概念解释不自动启动 profiler、安装工具或修改代码。

1. 明确架构、精度、形状及测量口径；缺失的信息标为假设，不套用 H100 等型号的参数。
2. 用一个简明例子解释所需概念及适用边界。需要术语细节时，只读[术语参考](references/glossary.md)对应小节。
3. 优化问题先定位端到端主要成本，再建立可证伪假设；单个 kernel 更快不等于整条路径更快。
4. 需要实测时，使用可用的 GPU profiling 工作流；已有 NCU 数据则分析该报告，不重复全量采样。

不要把 GPU busy、occupancy、吞吐百分比或 roofline 位置单独当成瓶颈证明。硬件参数与指令语义以目标架构官方文档为准，引用资料中的案例数值不是本次测量。

交付概念/结论、决定性证据和下一项必要验证即可，不输出整部术语表。

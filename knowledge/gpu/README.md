# GPU 优化

[返回知识库](../README.md)

把 kernel 优化和推理系统分开看：前者关注算子实现，后者关注请求调度与整条执行路径。

## 资料索引

| 层次 | 资料 | 为什么收藏 / 什么时候查 |
| --- | --- | --- |
| 现代 GPU 进阶 | [Modern GPU Programming For MLSys](modern-gpu-programming-for-mlsys.md) | 本次重点资料。串起硬件、TIRx 和 GEMM / Attention 实现；章节入口及架构边界见卡片。 |
| CUDA kernel 基础 | [Simon Boehm — CUDA Matmul Worklog](https://siboehm.com/articles/22/CUDA-MMM) | 从朴素矩阵乘逐步优化，理解访存合并、shared-memory tiling 和后续优化如何衔接。 |
| 可视化补充 | [Abhik Sarkar — CUDA Matrix Multiplication Optimization](https://www.abhik.ai/articles/cuda-matrix-multiplication-optimization) | 用交互可视化辅助理解矩阵分块、访存和数据复用；适合补足代码之外的直观认识。 |
| 推理系统 | [Inside vLLM: Anatomy of a High-Throughput LLM Inference System](https://vllm.ai/blog/2025-09-05-anatomy-of-vllm) | 查调度、continuous batching、KV cache 与服务层如何配合，不把系统性能问题全部归因于 kernel。 |

表中的三条直接外链来自此前的收藏；2026-10-10 整理并核对了页面标题与相关内容，未运行示例。
这不是个人已读清单，也不表示文章中的性能数据已在自己的环境复现。MLC 教材的核对范围单独记录在卡片中。

## 怎么用这份索引

整理建议：补 CUDA 基础先看 Simon 的 worklog，Abhik 的可视化按需对照；研究现代 GPU 实现时进入 MLC 卡片。
问题涉及请求排队、批处理和 KV cache 时，直接看 vLLM，不必先读完整条 kernel 学习路线。

进行实际测量时，使用已有的 [GPU profiling 工作流](../../home/skills/gpu-profiling-playbook/SKILL.md)；
解释概念或形成优化假设时，参考 [GPU 概念与优化](../../home/skills/gpu-optimization/SKILL.md)。
知识库不复制这些技能，也不因收藏链接自动启动实验。

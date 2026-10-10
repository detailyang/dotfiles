# Modern GPU Programming For MLSys

[返回 GPU 优化索引](README.md)

- 原文：[在线教材](https://mlc.ai/modern-gpu-programming-for-mlsys/)
- 作者 / 来源：MLC Community；英文在线教材。
- 官方源码：[mlc-ai/modern-gpu-programming-for-mlsys](https://github.com/mlc-ai/modern-gpu-programming-for-mlsys)
- 收录日期：2026-10-10。
- 最近核对：2026-10-10；已核对首页、目录、下列章节入口及性能测量附录的相关内容，未运行代码。
- 阅读状态：已收藏；个人阅读进度和复现实验尚未记录。

## 为什么收藏

这份教材把硬件执行、数据布局、异步搬运与同步，连接到逐步优化的 GEMM 和 Attention 实现。
适合作为现代 GPU kernel 优化的进阶主线，而不是只保存零散技巧。内容定位来自[教材首页](https://mlc.ai/modern-gpu-programming-for-mlsys/)。

## 适用边界

[首页](https://mlc.ai/modern-gpu-programming-for-mlsys/)明确以 NVIDIA Blackwell 为主要目标，示例使用 TIRx Python DSL。
通用原理可以参考，但不能因此假定所有示例都能直接用于其他架构；涉及具体指令时先核对目标硬件与软件版本。
这是阅读资料，不是当前项目已经验证的优化方案，也没有承诺性能收益。

## 重点入口

以下是整理建议，按问题选读，不要求一次读完。

| 当前问题 | 直接入口 |
| --- | --- |
| 先理解 GPU 如何组织和执行程序 | [GPU 执行模型](https://mlc.ai/modern-gpu-programming-for-mlsys/chapter_background/index.html) |
| 判断计算、带宽等性能限制 | [Kernel 性能模型](https://mlc.ai/modern-gpu-programming-for-mlsys/chapter_performance/index.html) |
| 从具体矩阵乘实现开始学习 | [构建分块 GEMM](https://mlc.ai/modern-gpu-programming-for-mlsys/chapter_gemm_basics/index.html) |
| 确定计时范围、warm-up 和 profiling 口径 | [GPU kernel 性能测量附录](https://mlc.ai/modern-gpu-programming-for-mlsys/appendix/benchmarking_gpu_kernels.html) |

进阶章节从[总目录](https://mlc.ai/modern-gpu-programming-for-mlsys/)继续：TIRx、TMA 流水线、warp specialization / clusters、Flash Attention 4。

## 阅读时带着的问题

针对真实 workload，记录准备验证的假设，而不是把书中的数值直接用作结论：

- 给定实际 shape、dtype 和 batch，当前主要成本是什么，书中哪项方法可能适用？
- 修改布局、分块或流水线后，正确性、kernel 时间和端到端延迟是否都满足目标？

## 阅读与实践记录

尚未记录。后续追加日期、章节、自己的结论或疑问；实验同时留下 GPU、shape / dtype、代码版本、
计时边界和结果。计时与 profiler 数据按[性能测量附录](https://mlc.ai/modern-gpu-programming-for-mlsys/appendix/benchmarking_gpu_kernels.html)区分用途。

保存状态：这里只存链接和自写导读，未保存原文全文或源码快照；官网和官方源码是两个入口，不是离线备份。

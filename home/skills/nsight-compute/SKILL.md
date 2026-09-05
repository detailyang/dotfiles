---
name: nsight-compute
description: 采集或解读指定 CUDA kernel 的 Nsight Compute 报告、SOL、occupancy、warp stall 和内存指标。不用于一般 GPU 术语或尚未定位热点的端到端问题。
---

# Nsight Compute

先确定目标 kernel、输入形状、精度、GPU、工具版本及正常运行基线。已有报告足够时直接分析；不要为解释一个指标重跑整个程序。

## 采集

先用 `ncu --version`、`ncu --help` 和所需的 section/metric 查询确认已安装能力。读取[命令与指标参考](references/profiling-guide.md)中相关小节，不整篇加载。

优先筛选代表性 kernel 与少量 launch，再补充能区分当前假设的 sections。`--set full` 不是默认起点。NCU 可能重放或串行化工作，不能用其宿主 wall time 代替正常并发负载的端到端基线。

不自动安装 profiler、提权、修改驱动权限、锁频或独占共享 GPU。缺少权限或设备时说明缺失证据，保留可复现命令，不伪造测量。

## 分析与验证

1. 用绝对耗时及端到端占比确定优先级。
2. 联合吞吐、活跃/eligible warps、资源限制、stall 和访存量形成假设；说明单位与采样口径。
3. 只做能区分假设的实验。高 occupancy 不保证快，低 occupancy 不证明慢；吞吐不是 cache 命中率，降低寄存器上限可能增加 spilling。
4. 用同一输入、正确性检查和正常执行环境复测，包括转换、传输、启动和并发影响。

结果包含报告/命令、主要成本、证据支持与排除的假设、可比前后数据和剩余瓶颈。没有实测则明确标为假设，不宣称优化已生效。

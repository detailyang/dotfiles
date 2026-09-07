# Nsight Compute 性能分析 Skill

> 按需查阅的命令与指标笔记；命令以已安装 ncu 为准，示例数据不是当前机器的测量。不要默认采集 full set 或据单个百分比宣称到达硬件极限。
> 基于 NVIDIA Nsight Compute 2026.1 官方文档整理
> 官方文档：https://docs.nvidia.com/nsight-compute/ProfilingGuide/index.html

---

## 一、工具概览

Nsight Compute 是一个面向 CUDA 和 NVIDIA OptiX 的交互式 kernel 性能分析器，通过 UI 和命令行两种方式提供详细的性能指标和 API 调试能力。内置 NVIDIA 工程师编写的 guided analysis 规则集，能自动识别常见性能瓶颈并给出优化建议。

**两种使用方式：**
- `ncu`：命令行（CLI），适合自动化和远程分析
- `ncu-ui`：图形界面（GUI），适合交互式深度分析

---

## 二、快速命令参考

```bash
# 验证安装
ncu --version

# 编译时加 --lineinfo，Source 页才能关联源码
nvcc -o program program.cu --lineinfo

# 基础分析（默认 basic set，速度快）
ncu ./program

# 只分析指定 kernel
ncu --kernel-name myKernel ./program

# 完整指标集（仅在具体诊断需要时使用；可能显著增加 replay 开销）
ncu --set full ./program

# 所有 Roofline 图（2025.1 新增，--set full 已包含）
ncu --set roofline ./program

# 按 Section 单独收集（速度更快）
ncu --section Occupancy ./program
ncu --section MemoryWorkloadAnalysis ./program
ncu --section ComputeWorkloadAnalysis ./program
ncu --section SchedulerStats ./program
ncu --section WarpStateStats ./program
ncu --section SpeedOfLight_RooflineChart ./program

# 单独指定指标
ncu --metrics sm__warps_active.avg.pct_of_peak_sustained_active ./program

# 查看所有可用 Section / Set
ncu --list-sections ./program
ncu --list-sets ./program

# 生成指定 kernel 的少量 launch 报告（按当前假设选择 sections）
ncu --kernel-name myKernel --launch-count 1 -o report ./program
ncu-ui report.ncu-rep

# 跳过前 N 次启动，只分析第 N+1 次
ncu --launch-skip 2 --launch-count 1 --kernel-name myKernel ./program
```

---

## 三、Section Sets 说明

Nsight Compute 用 Section Sets 决定收集哪些指标。每个 Set 包含一个或多个 Section，每个 Section 定义一组逻辑相关的指标。指标数量对 profiling 开销影响显著，可根据需要在快速粗略分析和慢速详细分析之间选择。

| Set | 速度 | 适用场景 |
|-----|------|---------|
| `basic`（默认） | 最快 | 快速看高层次利用率 |
| `detailed` | 中等 | 包含 Roofline，日常调优 |
| `full` | 最慢 | 深度分析，包含所有 Section |
| `roofline` | 中等 | 专门收集所有层级 Roofline |

**所有可用 Section（官方完整列表）：**

| Section | 用途 |
|---------|------|
| `ComputeWorkloadAnalysis` | SM 计算资源分析，IPC，各 pipeline 利用率 |
| `InstructionStats` | 底层汇编指令（SASS）统计，指令类型分布 |
| `LaunchStats` | kernel 启动配置（Grid/Block/资源） |
| `MemoryWorkloadAnalysis` | 内存系统详细分析，含 Memory Chart |
| `Occupancy` | 占用率分析 |
| `SchedulerStats` | Warp 调度器活跃度 |
| `WarpStateStats` | Warp 各状态分布（stall 原因） |
| `SpeedOfLight_RooflineChart` | Roofline 图 |
| `PmSampling` | 周期性采样，分析 kernel 随时间的行为变化 |

---

## 四、核心指标解读

### 4.1 Speed of Light（SOL）— 第一眼看这里

| 指标 | 含义 |
|------|------|
| `Compute (SM) Throughput` | 计算单元（SM）利用率，对比理论峰值的百分比 |
| `Memory Throughput` | 整体内存系统利用率（取所有内存单元的最大值） |
| `DRAM Throughput` | 显存（HBM）带宽利用率 |
| `L1/TEX Cache Throughput` | L1 缓存利用率 |
| `L2 Cache Throughput` | L2 缓存利用率 |

**诊断线索，不是仅凭相对百分比确定瓶颈：**

```
Compute 高于 Memory → 检查饱和计算子单元、有效工作量与指令供给
Memory 高于 Compute → 检查具体内存层级、访问量、复用与带宽
两个都低           → 检查延迟、依赖、并行度、指令供给或工作量太小
两个都高           → 检查具体饱和子单元与端到端成本，不能证明全局最优
```

数值高低还受指标分母与采样口径影响；结合绝对时间及区分假设的实验判断。

### 4.2 时间与 SM 活跃度

| 指标 | 含义 |
|------|------|
| `Duration` | kernel 实际耗时（ms） |
| `Elapsed Cycles` | kernel 总周期数 |
| `SM Active Cycles` | SM 实际执行指令的周期数 |
| `SM Frequency` | GPU 核心频率（可检测是否降频） |
| `DRAM Frequency` | 显存频率 |

**关键比值：**
```
SM Active Cycles / Elapsed Cycles 高 → 活跃时间比例高，不证明每周期有效发射或吞吐高
SM Active Cycles / Elapsed Cycles 低 → 检查工作量、负载分布及采样范围，再判断是否有资源或调度问题
```

### 4.3 占用率（Occupancy Section）

需要 `--section Occupancy` 或 `--set full` 才能获取：

| 指标 | 含义 |
|------|------|
| `Theoretical Occupancy` | 由资源（寄存器/Shared Memory/Block大小）决定的理论上限 |
| `Achieved Occupancy` | 实际执行时平均驻留 Warp 比例 |
| `Achieved Active Warps Per SM` | 每个 SM 平均驻留的 Warp 数量 |

**判断：**
```
Achieved ≈ Theoretical    → 占用率达到上限 ✅
Achieved << Theoretical   → 负载不均衡或资源浪费，需排查
占用率低但性能好          → 每线程计算量大，可接受（不是越高越好）
```

### 4.4 Warp 状态（WarpStateStats Section）

Warp Stall 是性能的隐形杀手，每种 stall 对应不同优化方向：

| Stall 原因 | 含义 | 优化方向 |
|-----------|------|---------|
| `stall_mem_throttle` | 等待内存请求完成 | 减少全局内存访问，用 Shared Memory |
| `stall_long_sb` | 等待长延迟指令（如全局内存读） | 提高 ILP，预取数据 |
| `stall_not_selected` | Warp 就绪但调度器选了别人 | 属正常，说明有足够 Warp 可调度 |
| `stall_no_instruction` | 指令缓存未命中 | 减少 kernel 代码体积 |
| `stall_branch_resolving` | 等待分支条件 | 消除 Warp Divergence |
| `stall_sync` | 等待 `__syncthreads()` | 减少不必要的同步 |

### 4.5 内存层级分析（MemoryWorkloadAnalysis）

读懂内存层级，定位数据在哪里被命中：

```
请求路径：Thread → L1/Shared → L2 → DRAM（显存）

理想情况：L1 命中率高，DRAM 压力小
L1 吞吐高 + DRAM 低 → 不能据此证明 shared-memory 复用；区分吞吐、命中率与实际访问路径
L1 低 + DRAM 高  → 检查命中率、工作集和访问量；无复用的流式访问不因加 shared memory 就更快
L2 高            → 区分吞吐和命中率，检查实际请求路径后再判断访问模式
```

---

## 五、Roofline 模型详解

Roofline 将特定算术精度、计算吞吐与某一内存层级的带宽上限关联。Ridge Point 是两类上限的交点；点落在哪一侧说明该模型下哪类上限更低，不单独证明实际性能由它限制。远低于屋顶线的 kernel 还可能受依赖、延迟或并行度限制。接近一条屋顶线也不证明算法、有效工作量或整条调用路径已最优。

```
↑ 计算性能 (TFLOPS)
│                    ──────── 峰值计算线（Compute Bound）
│                   /
│    Ridge Point → ★
│                 /
│    ●           /   ← kernel 在访存瓶颈区
│               /  ← Memory Bandwidth Boundary
└────────────────────→ Arithmetic Intensity (FLOP/Byte)
```

**Arithmetic Intensity = 总 FLOP 数 ÷ 总数据搬移字节数**

- **点在 Ridge Point 左侧**：检查所选内存层级的带宽上限是否实际限制性能。
- **点在 Ridge Point 右侧**：检查对应精度和计算管线的上限是否实际限制性能。
- **点靠近 Roofline 线**：说明接近所选模型的一项上限，仍需验证有效工作量和端到端收益。

**启用 Roofline（命令行）：**
```bash
# 对代表性 launch 收集所需 Roofline section；以安装版本查询结果为准
ncu --kernel-name myKernel --launch-count 1 --section SpeedOfLight_RooflineChart -o report ./program
```

**分层 Roofline（Hierarchical Roofline）：**

Nsight Compute 支持按内存层级分别画 Roofline（L1/L2/DRAM），可以看出数据在哪个层级是瓶颈，比单一 Roofline 信息更丰富。

---

## 六、GUI 关键视图说明

### Summary 页
- 交通灯系统（红/黄/绿）直接标出问题区域
- 内置 NVIDIA 工程师写的优化建议（Guided Analysis）
- 优先检查绝对耗时对目标有实质影响的项目，颜色和规则引擎提示只作为线索

### Source 页
- 把指标数据标注到每一行源代码
- 需要编译时加 `--lineinfo` 才能关联
- 直接看哪行代码访存最多、stall 最严重

### Memory Chart 页
- 可视化整个内存层级的数据流向
- 显示 L1/L2/DRAM 各节点的吞吐和繁忙程度
- 2024.3 新增 zoom/pan 功能

### Baseline 对比
```bash
# 相同输入和采样范围下比较 kernel 报告；这里以 Occupancy 假设为例
ncu --kernel-name myKernel --launch-count 1 --section Occupancy -o baseline ./program_v1
ncu --kernel-name myKernel --launch-count 1 --section Occupancy -o v2 ./program_v2

# 在 GUI 加载两份报告；实际端到端收益另用未插桩的正常运行测量
```

---

## 七、按假设选择诊断路径

已有报告足够时直接分析。只有需要源码归因时才重新编译并加 `--lineinfo`。

```text
正常运行基线与端到端成本
    -> 已定位的 kernel 与代表性 launch
    -> 读取已有报告，或进行少量基础采样
       ncu --kernel-name myKernel --launch-count 1 -o report ./program
    -> 联合绝对耗时、SOL 和资源数据形成假设
    -> 按假设补采 Occupancy、SchedulerStats、WarpStateStats、Memory 或 Roofline
    -> 仅在源码位置能改变判断时检查 Source
    -> 获授权后修改一个候选，检查正确性，并在正常环境复测
```

不要求顺序读完所有 section。按正确性、端到端目标与实验预算决定是否继续；
报告中的单个百分比、规则引擎建议或 Roofline 距离均不是唯一完成条件。

---

## 八、常见问题诊断速查表

| 假设或观测 | 待核对指标 | 候选实验，不是默认修复 |
|------|---------|---------|
| 访存限制 | 对应层级吞吐、访问量、命中率与绝对耗时 | 在存在复用或低效事务时测试 tiling/coalescing |
| 计算限制 | 饱和管线、指令类型与有效工作量 | 测试减少工作量；精度和形状允许时考虑 Tensor Core |
| 占用率差距 | Achieved、Theoretical、负载分布与资源分配 | 比较 block 配置或资源变体，不以占用率高低决定快慢 |
| Warp 等待 | 已安装工具的具体 stall 定义、eligible warps、issue rate | 区分依赖、队列压力和同步后再实验 |
| Bank Conflict | 共享内存请求与冲突数据 | 验证 padding 或布局变化能否覆盖额外成本 |
| 寄存器溢出 | 编译器 spill 报告与 local-memory 指标 | 检查活跃值和生命周期；降低寄存器上限可能增加 spilling |
| L1 吞吐高、DRAM 吞吐低 | 命中率、访问路径与实际复用 | 不能据此单独认定 shared-memory 优化有效 |
| SM 活跃比例高 | issue rate、eligible warps 和绝对时间 | 继续区分有效计算与延迟，不据此宣布接近极限 |

---

## 九、优化代码技巧

### 9.1 访存瓶颈 → Coalescing

```cuda
// ❌ 跳跃访问
data[threadIdx.x * N]

// ✅ 连续访问
data[threadIdx.x]

// ✅ 向量化读取（一条指令读 16 字节）
float4 val = reinterpret_cast<float4*>(data)[i / 4];
```

### 9.2 Shared Memory 缓存热点数据

```cuda
__shared__ float tile[TILE][TILE + 1];  // +1 避免 Bank Conflict
tile[threadIdx.y][threadIdx.x] = global_data[...];
__syncthreads();
// 后续从 tile 读；实际收益需包含搬运、同步和占用率成本
```

### 9.3 占用率低 → 自动推荐 Block 大小

```cuda
int blockSize, minGridSize;
cudaOccupancyMaxPotentialBlockSize(&minGridSize, &blockSize, myKernel, 0, 0);
// blockSize 是占用率启发式候选，不保证实际耗时最优；仍需基准验证
```

### 9.4 寄存器压力与溢出

先读取编译器资源/spill 报告和 NCU 指标，再比较受控变体。降低 `--maxrregcount` 可能增加 local-memory spilling，不是溢出的默认修复；local memory 非零也不单独证明 spilling。

```bash
nvcc --ptxas-options=-v kernel.cu -o kernel
```

只有明确的 occupancy/寄存器权衡实验才尝试上限，并比较正确性、spill 流量和耗时。

### 9.5 计算瓶颈 → Tensor Core

```cuda
#include <mma.h>
using namespace nvcuda;
wmma::fragment<wmma::matrix_a, 16, 16, 16, half, wmma::row_major> a_frag;
wmma::fragment<wmma::matrix_b, 16, 16, 16, half, wmma::col_major> b_frag;
wmma::fragment<wmma::accumulator, 16, 16, 16, float> c_frag;
wmma::load_matrix_sync(a_frag, a_ptr, lda);
wmma::load_matrix_sync(b_frag, b_ptr, ldb);
wmma::fill_fragment(c_frag, 0.0f);  // 计算 C = A * B；累加已有 C 时应先加载 C
wmma::mma_sync(c_frag, a_frag, b_frag, c_frag);
wmma::store_matrix_sync(c_ptr, c_frag, ldc, wmma::mem_row_major);
```

---

## 十、典型数据案例

### 案例一：访存瓶颈（朴素矩阵乘法）
```
Compute Throughput    4%   ← 计算单元几乎闲着
Memory Throughput    89%   ← 访存压力极大
DRAM Throughput      85%   ← 频繁访问显存
stall_mem_throttle   高    ← Warp 大量时间在等内存
→ 假设：若源码和访问量表明重复读取主导耗时，可测试 Shared Memory + Tiling，并计入搬运与同步成本
```

### 案例二：Shared Memory 矩阵乘法的示例观测
```
Compute Throughput   67%
Memory Throughput    12%
L1 Throughput        94%
DRAM Throughput       8%
→ 假设：tiling 可能改变了访存路径；需对比访问量、命中率和实际时间证明复用收益
```

### 案例三：高吞吐百分比不等于全局最优
```
Compute Throughput   96.72%
Memory Throughput    96.72%
L1 Throughput        96.87%
DRAM Throughput      34.36%
SM Active / Elapsed  99.85%
→ 下一步：确认各指标分母与饱和子单元，核对有效工作量和端到端贡献
```

这些示例没有提供足以复现的完整环境和负载，不能用来设定当前任务的阈值，
也不能仅凭吞吐百分比推断缓存命中、shared-memory 复用或剩余优化空间。

---

## 十一、参考资源

| 资源 | 地址 |
|------|------|
| 官方 Profiling Guide（2026.1） | https://docs.nvidia.com/nsight-compute/ProfilingGuide/ |
| 官方 CLI 文档 | https://docs.nvidia.com/nsight-compute/NsightComputeCli/ |
| Roofline 模型深度讲解（NERSC） | https://docs.nersc.gov/tools/performance/roofline/ |
| Roofline + HPC 应用案例（NVIDIA Blog） | https://developer.nvidia.com/blog/accelerating-hpc-applications-with-nsight-compute-roofline-analysis/ |
| 官方训练视频 | https://developer.nvidia.com/tools-overview/nsight-compute/get-started |

## 修订依据

[CUDA Best Practices Guide](https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html) 解释 occupancy/寄存器的权衡；[NCU Profiling Guide](https://docs.nvidia.com/nsight-compute/ProfilingGuide/index.html) 解释采样范围、replay 开销和指标口径。

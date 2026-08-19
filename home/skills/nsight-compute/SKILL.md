---
name: nsight-compute
description: >
  使用 Nsight Compute 对 CUDA kernel 进行性能分析和优化的完整指南。
  当用户提到 CUDA 性能分析、kernel 调优、ncu 命令、profiler 数据解读、
  瓶颈诊断、SOL 指标、占用率分析、DRAM Throughput、L1/L2 Cache Throughput、
  Compute Throughput、Roofline 图、Warp Stall、Memory Chart、Section Sets、
  Scheduler Statistics、Warp State、Branch Divergence、Register Spilling 等话题时，
  主动使用此 skill。也适用于用户粘贴 ncu 输出数据需要解读的场景。
  资料来源：NVIDIA 官方文档 2026.1、Kernel Profiling Guide、NERSC Roofline 文档。
---

# Nsight Compute 性能分析 Skill
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

# 完整指标集（推荐，信息最全，速度较慢）
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

# 生成报告文件（供 GUI 打开）
ncu --set full -o report ./program
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

**瓶颈判断四种情况：**

```
Compute >> Memory   → 计算瓶颈：换算法，用 Tensor Core，减少 FLOP
Memory  >> Compute  → 访存瓶颈（最常见）：Shared Memory + Coalescing
两个都低（<20%）   → 占用率低：线程不够多，调整 Block 大小
两个都高（>90%）   → 接近硬件极限：向量化读取，Tensor Core
```

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
SM Active Cycles / Elapsed Cycles ≈ 100%  → SM 全程无空闲 ✅
SM Active Cycles / Elapsed Cycles 低      → SM 大量空闲，需提高占用率
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
L1 高 + DRAM 低  → Shared Memory 有效，数据复用好 ✅
L1 低 + DRAM 高  → 数据没有复用，需要引入 Shared Memory
L2 高            → L1 命中不足，检查访问模式和 Coalescing
```

---

## 五、Roofline 模型详解

Roofline 图将 GPU 的峰值计算性能和内存带宽，与 Arithmetic Intensity（计算量与数据搬移量之比）结合在一张图里，更真实地反映 kernel 的实际性能。Ridge Point 将图分为两个区域：左侧蓝色区域是访存瓶颈区（Memory Bound），右侧绿色区域是计算瓶颈区（Compute Bound）。kernel 的 achieved value 离 Roofline 边界越近，说明优化得越好。

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

- **点在 Ridge Point 左侧**：访存瓶颈，优化内存访问（Coalescing/Shared Memory）
- **点在 Ridge Point 右侧**：计算瓶颈，优化算法或使用 Tensor Core
- **点靠近 Roofline 线**：接近硬件极限，优化充分

**启用 Roofline（命令行）：**
```bash
# 2025.1 起 --set full 已包含所有 Roofline
ncu --set full -o report ./program
# 或单独收集
ncu --section SpeedOfLight_RooflineChart -o report ./program
```

**分层 Roofline（Hierarchical Roofline）：**

Nsight Compute 支持按内存层级分别画 Roofline（L1/L2/DRAM），可以看出数据在哪个层级是瓶颈，比单一 Roofline 信息更丰富。

---

## 六、GUI 关键视图说明

### Summary 页
- 交通灯系统（红/黄/绿）直接标出问题区域
- 内置 NVIDIA 工程师写的优化建议（Guided Analysis）
- 优先从红色项目开始处理

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
# 保存第一次结果为 baseline
ncu --set full -o baseline ./program_v1

# 在 GUI 里加载两份报告对比
# 或命令行比较
ncu --set full --import-source yes -o v2 ./program_v2
```

---

## 七、完整诊断流程

```
Step 1：编译加 --lineinfo
  nvcc -o program program.cu --lineinfo
          ↓
Step 2：基础 profile，快速看高层指标
  ncu --set full -o report ./program
          ↓
Step 3：看 SOL → 判断瓶颈类型
  Compute vs Memory → 哪个高哪个是瓶颈
          ↓
Step 4：看 Occupancy → 占用率够不够
  Achieved vs Theoretical → 差距大就找资源瓶颈
          ↓
Step 5：看 WarpStateStats → Warp 在等什么
  stall 原因 → 对应优化方向
          ↓
Step 6：看 Memory Workload → 内存层级命中情况
  L1/L2/DRAM 哪层压力大
          ↓
Step 7：看 Source 页 → 定位最慢的代码行
          ↓
Step 8：看 Roofline → 离硬件极限还有多远
          ↓
Step 9：改代码 → 重新 profile → 对比数据
  循环迭代，直到 Roofline 点足够靠近边界
```

---

## 八、常见问题诊断速查表

| 问题 | 关键指标 | 解决方法 |
|------|---------|---------|
| 访存瓶颈 | Memory >> Compute，DRAM 高 | Shared Memory + Coalescing |
| 计算瓶颈 | Compute 接近 100% | 换算法，用 Tensor Core |
| 占用率低 | Achieved << Theoretical | 调整 Block 大小（试 128/256） |
| Warp 等内存 | stall_mem_throttle 高 | 减少全局内存访问，预取 |
| Warp 分歧 | stall_branch_resolving 高 | 消除 if/else 分支 |
| Bank Conflict | Shared Memory Efficiency 低 | 加 +1 padding |
| 寄存器溢出 | lmem > 0，sass__inst_executed_register_spilling > 0 | 减少局部变量，`--maxrregcount` |
| 数据复用好 | L1 高，DRAM 低 | 保持，考虑向量化读取 |
| SM 全程活跃 | SM Active / Elapsed ≈ 100% | 好信号，看 Roofline 找下一步 |

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
// 之后从 tile 读，速度提升 10x+
```

### 9.3 占用率低 → 自动推荐 Block 大小

```cuda
int blockSize, minGridSize;
cudaOccupancyMaxPotentialBlockSize(&minGridSize, &blockSize, myKernel, 0, 0);
// blockSize 是 CUDA 推荐的最优值
```

### 9.4 寄存器溢出 → 限制寄存器

```bash
nvcc --maxrregcount=32 kernel.cu -o kernel
nvcc --ptxas-options=-v kernel.cu  # 查看 lmem 是否为 0
```

### 9.5 计算瓶颈 → Tensor Core

```cuda
#include <mma.h>
using namespace nvcuda;
wmma::fragment<wmma::matrix_a, 16, 16, 16, half, wmma::row_major> a_frag;
wmma::fragment<wmma::matrix_b, 16, 16, 16, half, wmma::col_major> b_frag;
wmma::fragment<wmma::accumulator, 16, 16, 16, float> c_frag;
wmma::load_matrix_sync(a_frag, a_ptr, lda);
wmma::load_matrix_sync(b_frag, b_ptr, ldb);
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
→ 结论：引入 Shared Memory + Tiling，减少全局内存访问
```

### 案例二：优化良好（Shared Memory 矩阵乘法）
```
Compute Throughput   67%   ← 计算单元大幅提升
Memory Throughput    12%   ← 访存压力大幅下降
L1 Throughput        94%   ← 数据主要在 L1/Shared
DRAM Throughput       8%   ← 很少去显存取数
→ 结论：Shared Memory 有效，Roofline 点右移，可考虑 Tensor Core
```

### 案例三：接近硬件极限
```
Compute Throughput   96.72%  ← 计算跑满
Memory Throughput    96.72%  ← 访存跑满
L1 Throughput        96.87%  ← L1 跑满
DRAM Throughput      34.36%  ← 数据主要在 L1（DRAM 压力小）
SM Active / Elapsed  99.85%  ← SM 全程无空闲
→ 结论：已接近极限，剩余方向：float4 向量化读取 或 Tensor Core
```

---

## 十一、参考资源

| 资源 | 地址 |
|------|------|
| 官方 Profiling Guide（2026.1） | https://docs.nvidia.com/nsight-compute/ProfilingGuide/ |
| 官方 CLI 文档 | https://docs.nvidia.com/nsight-compute/NsightComputeCli/ |
| Roofline 模型深度讲解（NERSC） | https://docs.nersc.gov/tools/performance/roofline/ |
| Roofline + HPC 应用案例（NVIDIA Blog） | https://developer.nvidia.com/blog/accelerating-hpc-applications-with-nsight-compute-roofline-analysis/ |
| 官方训练视频 | https://developer.nvidia.com/tools-overview/nsight-compute/get-started |

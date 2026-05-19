---
name: gpu-glossary
description: >
  GPU 术语速查手册，基于 Modal GPU Glossary（CC BY 4.0）。当用户提问涉及 GPU
  硬件结构、CUDA 编程模型、GPU 性能分析、内核优化、内存带宽、屋顶线模型、
  SM 占用率、Warp 分化、算术强度等概念时触发。也适用于"为什么我的 kernel 慢"、
  "compute-bound 和 memory-bound 怎么区分"等实际调优问题。
source: https://modal.com/gpu-glossary (CC BY 4.0, © Modal Labs)
---

# GPU Glossary

基于 Modal GPU Glossary（CC BY 4.0）整理。覆盖设备硬件、设备软件、主机软件、性能四个层次，共 60+ 词条。

---

## 一、设备硬件

### SM（流式多处理器，Streaming Multiprocessor）
GPU 的基本计算单元，类比 CPU 的核心，但更简单。执行流水线指令，没有推测执行。

**并行线程数对比：**
- AMD EPYC 9965（192核）：384 线程并行，1.25W/线程
- H100 SXM（132个SM）：>16,000 线程真并行，0.05W/线程

H100 单个 SM 可并发执行 2048 线程（64 个 Warp × 32线程），全卡支持 >250,000 并发线程。SM 的优势核心在于**延迟隐藏**——通过极快的 Warp 切换（1 个时钟周期，比 CPU 上下文切换快 1000 倍以上）来掩盖内存延迟，保持计算单元满载。

### CUDA Core（CUDA 核心）
SM 内执行标量浮点和整数运算的基础计算单元。每条 SASS 指令作用于单个数值。相比 Tensor Core，算术吞吐量低约 100 倍，但适用于非矩阵乘法运算。

### Tensor Core（张量核心）
自 Volta 架构引入，通过单条指令操作整个矩阵，算术吞吐量是 CUDA Core 的 **100 倍**。

**示例指令：** `HMMA16.16816.F32`
- 输入：FP16（半精度），输出：FP32（单精度）
- 矩阵维度：m=16, k=8, n=16
- 单条指令：16×8×16 = **2,048 次 MAC 运算**
- 实际由一个 Warp（32线程）协同执行，每线程 64 次 MAC

> 可将 Tensor Core 理解为一种 CISC 风格的矩阵专用硬件，类似 Google TPU 的脉动阵列。AI 推理/训练中的矩阵乘法应优先使用 Tensor Core。

### Warp 调度器（Warp Scheduler）
每个 SM 有 4 个 Warp 调度器，负责每个时钟周期从就绪 Warp 中选一个发射指令。调度仅需 1 个时钟周期，是实现延迟隐藏的关键机制。

### TMA（Tensor Memory Accelerator，张量内存加速器）
Hopper 架构（H100）新增。专用硬件单元，负责在全局内存和共享内存之间异步搬运张量数据，解放 CUDA Core 和 Tensor Core，使计算与数据搬运真正重叠。

### 内存层次（硬件侧）

| 层级 | 位置 | 容量（H100） | 延迟 | 带宽 |
|---|---|---|---|---|
| 寄存器文件（Register File） | 每个 SM | 256KB | 极低 | 极高 |
| L1 数据缓存 / 共享内存 | 每个 SM | 228KB | 低 | 高 |
| Tensor 内存（TMEM） | 每个 SM | 256KB | 低 | 极高 |
| GPU RAM（HBM/GDDR） | 全卡共享 | 80GB（H100 SXM） | 高 | 3.35 TB/s |

**寄存器文件**：每个线程独占，是最快的存储。寄存器数量有限，过多使用会限制 Warp 数量（寄存器压力）。

**GPU RAM（HBM）**：H100 SXM5 配备 HBM3，80GB，3.35 TB/s 带宽。所有 SM 共享访问，延迟高，但带宽极大，是内存受限内核的关键约束。

### TPC / GPC（处理簇层次）
- **TPC（纹理处理簇）**：包含 2 个 SM + 纹理单元，是早期 NVIDIA 架构的中间分组单元
- **GPC（图形/GPU处理簇）**：包含多个 TPC，H100 有 8 个 GPC，每个 GPC 有多个 SM

---

## 二、设备软件

### CUDA 编程模型
NVIDIA 对 GPU 编程的抽象层，将硬件 SM 映射为软件线程块。核心概念：
- 程序员描述单个线程的行为
- CUDA 运行时负责将线程组织为 Warp 并调度到 SM 上

### 线程层次结构

```
Thread（线程）
  └── Warp（32个线程，最小调度单元）
        └── Warpgroup（4个Warp = 128线程，H100新增）
              └── Thread Block / CTA（协作线程数组）
                    └── Thread Block Grid（所有线程块的集合）
```

**Warp**：32 个线程，是 SM 调度的最小单位。同一 Warp 内所有线程在每个时钟周期执行相同指令（SIMT）。

**Thread Block（线程块）/ CTA（Cooperative Thread Array）**：最多 1024 个线程，映射到同一个 SM，可通过共享内存通信，可通过 `__syncthreads()` 同步。

**Thread Block Grid**：启动一个 Kernel 时所有线程块的集合，分配到所有可用 SM 上。

### 内存层次结构（软件侧）

| 内存类型 | 作用域 | 生命周期 | 对应硬件 |
|---|---|---|---|
| **寄存器（Registers）** | 单线程私有 | Kernel 执行期间 | 寄存器文件 |
| **共享内存（Shared Memory）** | 同一线程块 | 线程块生命周期 | L1 缓存/SRAM |
| **全局内存（Global Memory）** | 所有线程 | 应用生命周期 | GPU RAM（HBM） |

**关键原则**：尽量将频繁访问的数据从全局内存搬到共享内存，减少 HBM 访问次数，是内存受限内核的核心优化手段。

### Kernel（内核）
在 GPU 上运行的函数，由 host（CPU）发起调用。一次 Kernel 启动定义了 Grid 的维度（多少个线程块、每块多少线程）。

### SASS / PTX
- **SASS（Streaming ASSembler）**：GPU 的原生机器码，与具体 GPU 架构绑定
- **PTX（Parallel Thread eXecution）**：NVIDIA 的虚拟 ISA，类似汇编但可跨架构。nvcc 将 CUDA C++ 编译为 PTX，再由驱动 JIT 编译为 SASS

### Compute Capability（计算能力）
NVIDIA GPU 的版本号，格式为 `major.minor`，如 H100 = 9.0，A100 = 8.0。决定可用的指令集、Tensor Core 精度支持、共享内存大小等。

---

## 三、主机软件

### CUDA 软件栈层次

```
应用代码（Python / C++）
    ↓
CUDA Runtime API（libcudart.so）  ← 高层抽象，自动管理上下文
    ↓
CUDA Driver API（libcuda.so）     ← 底层控制
    ↓
nvidia.ko（内核驱动模块）
    ↓
GPU 硬件
```

### 常用库

| 库 | 功能 | 用途 |
|---|---|---|
| **cuBLAS** | 基础线性代数（矩阵乘法等） | 深度学习 GEMM，自动使用 Tensor Core |
| **cuDNN** | 深度神经网络原语（卷积、BN、注意力等） | 框架后端（PyTorch、TF） |
| **NVML（libnvml.so）** | GPU 状态监控（温度、功耗、利用率） | 生产环境监控，`nvidia-smi` 的底层 |

### 调试工具

| 工具 | 用途 |
|---|---|
| **nvidia-smi** | 查看 GPU 利用率、显存、功耗、进程 |
| **NVIDIA Nsight Systems** | 系统级 profiling（CPU+GPU 时间线，找宏观瓶颈） |
| **NVIDIA Nsight Compute** | Kernel 级深度 profiling（SM 利用率、内存带宽、Warp 状态） |
| **CUDA Binary Utilities（cuobjdump, nvdisasm）** | 查看 SASS 汇编，分析生成的机器码 |

### nvcc
NVIDIA CUDA 编译器驱动，将 `.cu` 文件编译为 PTX 或 SASS。支持 `--generate-code arch=compute_XX,code=sm_XX` 指定目标架构。

### CUDA Graphs
将一系列 CUDA 操作（Kernel 启动、内存拷贝等）预先记录为计算图，之后可以一次性重放，消除逐次 Kernel 启动的 CPU-GPU 同步开销，对高频小 Kernel 有显著加速。

---

## 四、性能分析

### 屋顶线模型（Roofline Model）

判断 Kernel 瓶颈的核心工具。两条"屋顶线"：
- **计算屋顶线**：硬件峰值算术带宽（FLOP/s），由 CUDA Core / Tensor Core 决定
- **内存屋顶线**：硬件峰值内存带宽（Byte/s），由 HBM 带宽决定

**脊点（Ridge Point）**：两条屋顶线的交点，对应最优算术强度。

```
性能(FLOP/s)
    |
    |____计算屋顶线_______（峰值算力）
    |   /
    |  / ← 斜率 = 内存带宽
    | /
    |/___________________________→ 算术强度（FLOP/Byte）
       脊点
```

### 算术强度（Arithmetic Intensity）
= FLOP 数 / 访问字节数，单位 FLOP/Byte

| Kernel 类型 | 算术强度 | 典型值 |
|---|---|---|
| SAXPY (y=ax+y) | O(1) | ~0.17 FLOP/B |
| 矩阵乘法 (GEMM, N×N) | O(N) | 随矩阵增大线性增长 |
| 注意力机制（FlashAttention 前） | 低 | memory-bound |

提升算术强度的手段：数据量化（减少字节）、算子融合（减少中间读写）、梯度检查点（重新计算替代存储）。

### 计算受限 vs 内存受限

| 状态 | 瓶颈 | 优化方向 |
|---|---|---|
| **Compute-bound** | CUDA Core / Tensor Core 满载 | 减少 FLOP（算法优化）、提升精度利用率（FP16/INT8） |
| **Memory-bound** | HBM 带宽打满 | 算子融合、数据复用、提高算术强度、量化 |

**LLM 推理特点**：decode 阶段（batch=1）极度 memory-bound（模型权重读一遍，计算量极少）；prefill 阶段（长 prompt）更接近 compute-bound。

### 延迟隐藏（Latency Hiding）
SM 遇到高延迟操作（内存读取等）时，Warp 调度器立即切换到另一个就绪 Warp 继续执行，从而掩盖延迟。这是 GPU 高吞吐量的根本机制，依赖足够多的并发 Warp（即高 Occupancy）。

### 占用率（Occupancy）
= 活跃 Warp 数 / SM 最大支持 Warp 数

H100 单 SM 最多支持 64 个 Warp。影响占用率的因素：
- **寄存器使用量**：每线程寄存器越多，同时驻留的 Warp 越少
- **共享内存使用量**：每线程块共享内存越多，同时驻留的线程块越少
- **线程块大小**：太小会浪费调度粒度

> 高占用率不等于高性能，但低占用率（<25%）几乎必然是性能杀手。

### Warp 分化（Warp Divergence）
同一 Warp 内线程走了不同分支（if/else），硬件必须串行执行两个分支，效率减半。

**衡量指标**：分支效率（Branch Efficiency）= 无分化 Warp 占比，应接近 100%。

### 内存合并（Memory Coalescing）
同一 Warp 的 32 个线程访问**连续对齐**的内存地址时，硬件可将其合并为一次内存事务，大幅提高有效带宽。反之（散乱访问）会触发多次事务，浪费带宽。

**规则**：尽量让 `thread_idx` 对应连续内存地址，避免按列访问二维数组。

### Bank 冲突（Bank Conflict）
共享内存分为 32 个 Bank，同一 Warp 的多个线程访问同一 Bank 时，访问被串行化。解决方法：访问地址错开（padding），或调整数据布局。

### 寄存器压力（Register Pressure）
每个 SM 的寄存器文件固定（H100：65536 个 32bit 寄存器/SM）。Kernel 使用寄存器越多，SM 上可并发的 Warp 越少，Occupancy 越低，延迟隐藏能力越弱。

### 计分板停顿（Scoreboard Stall）
Warp 等待上一条指令的结果（数据依赖），调度器无可用就绪 Warp 时发生停顿。多见于内存受限 Kernel + 低 Occupancy 组合。

### 利特尔定律（Little's Law）
`吞吐量 = 并发度 / 延迟`

用于估算：若 HBM 延迟 500 个时钟周期，要充分利用内存带宽，需要 500 个并发内存请求在飞。

### SM 利用率（SM Utilization）
= SM 处于活跃状态（至少一个 Warp 在执行）的时钟周期比例。目标 >80%；过低通常说明 Kernel 启动开销过大、线程块数量不足以覆盖全部 SM，或 Occupancy 太低。

### 峰值速率（Peak Rate）
硬件在最理想条件下的吞吐量上限。注意：
- Tensor Core 峰值（FLOP/s）要求矩阵维度是特定倍数
- 内存带宽峰值要求访问完全合并

**H100 SXM5 关键峰值：**
- FP16 Tensor Core：989 TFLOP/s
- BF16 Tensor Core：989 TFLOP/s
- FP8 Tensor Core：1,979 TFLOP/s
- HBM3 内存带宽：3.35 TB/s

---

## 快速诊断流程

```
Kernel 性能差？
    ↓
nvidia-smi → GPU 利用率是否接近 100%？
    ↓ 否 → 可能是 CPU 瓶颈 / 启动开销 / 数据传输
    ↓ 是
Nsight Compute → 查 Roofline Model 位置
    ├── Memory-bound → 检查内存合并 / Bank冲突 / 考虑量化或算子融合
    └── Compute-bound → 检查是否在用 Tensor Core / 是否有 Warp 分化
         ↓
查 Occupancy → 是否 <25%？
    ├── 是 → 检查寄存器压力 / 共享内存用量 / 线程块大小
    └── 否 → 检查 Scoreboard Stall / 延迟隐藏是否充分
```

---

## 参考

- [Modal GPU Glossary](https://modal.com/gpu-glossary) — 原始来源（CC BY 4.0）
- [中文翻译版](https://gpu-glossary-zh.readthedocs.io/en/latest/) — by miter6（CC BY 4.0）
- [NVIDIA H100 白皮书](https://modal-cdn.com/gpu-glossary/gtc22-whitepaper-hopper.pdf)
- [Roofline Model 原论文](https://people.eecs.berkeley.edu/~kubitron/cs252/handouts/papers/RooflineVyNoYellow.pdf) — Williams, Waterman & Patterson (2008)

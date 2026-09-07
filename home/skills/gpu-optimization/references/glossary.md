# GPU Glossary

> 基于 Modal GPU Glossary（CC BY 4.0，© Modal Labs）整理；本次重排并修订架构混用与绝对化表述。型号示例不是所有 GPU 的通用参数。

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
SM 内执行标量浮点和整数运算的基础计算单元。每条 SASS 指令作用于单个数值。适用于标量及非矩阵运算；与 Tensor Core 的吞吐比取决于架构、精度和具体指令，不能使用固定倍数。

### Tensor Core（张量核心）
自 Volta 架构引入，通过单条指令操作整个矩阵，对受支持的矩阵运算提供专用吞吐能力；收益取决于精度、形状、布局和数据供给。

**示例指令：** `HMMA16.16816.F32`
- 输入：FP16（半精度），输出：FP32（单精度）
- 矩阵维度：m=16, k=8, n=16
- 单条指令：16×8×16 = **2,048 次 MAC 运算**
- 实际由一个 Warp（32线程）协同执行，每线程 64 次 MAC

> 可将 Tensor Core 理解为一种 CISC 风格的矩阵专用硬件，类似 Google TPU 的脉动阵列。AI 推理/训练中的矩阵乘法应优先使用 Tensor Core。

### Warp 调度器（Warp Scheduler）
Hopper SM 有 4 个 Warp 调度器；其他架构的组织和发射能力需查目标文档。调度器从就绪 Warp 中选择可发射指令，其效果取决于 eligible warps、依赖和目标管线，而不是简单的固定切换成本。

### TMA（Tensor Memory Accelerator，张量内存加速器）
Hopper 架构（H100）新增。专用硬件单元，负责在全局内存和共享内存之间异步搬运张量数据，解放 CUDA Core 和 Tensor Core，使计算与数据搬运真正重叠。

### 内存层次（硬件侧）

| 层级 | 位置 | 容量（H100） | 延迟 | 带宽 |
|---|---|---|---|---|
| 寄存器文件（Register File） | 每个 SM | 256KB | 极低 | 极高 |
| L1 数据缓存 / 共享内存 | 每个 SM | 228KB | 低 | 高 |
| Tensor 内存（TMEM） | 部分 Blackwell 架构的专用存储 | 不属于 H100 的此表参数 | 按目标架构核对 | 按目标架构核对 |
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

**候选优化**：数据存在跨线程或重复访问的复用时，可以测试 shared-memory staging；收益必须覆盖搬运、同步和占用率成本。无复用的流式访问不应默认增加一层拷贝。

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
将一系列 CUDA 操作（Kernel 启动、内存拷贝等）预先记录为计算图，之后可以一次性重放，减少逐次主机提交的开销；不代表普通 kernel 启动必然同步，也不消除执行依赖，对高频小 Kernel 有显著加速。

---

## 四、性能分析

### 屋顶线模型（Roofline Model）

判断 Kernel 瓶颈的核心工具。两条"屋顶线"：
- **计算屋顶线**：硬件峰值算术带宽（FLOP/s），由 CUDA Core / Tensor Core 决定
- **内存屋顶线**：硬件峰值内存带宽（Byte/s），由 HBM 带宽决定

**脊点（Ridge Point）**：计算与带宽上限的交点，不是所有 kernel 应追求的算术强度；算法、精度与访存层级决定该模型是否适用。

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

> 占用率不是性能目标或固定阈值。低占用率可能仍能用指令级并行隐藏延迟；结合 eligible warps、stall、吞吐和实测时间判断。

### Warp 分化（Warp Divergence）
同一 Warp 内线程走不同分支时，可能需要分别执行各条路径并屏蔽不参与的线程；损失取决于路径长度和活跃线程，不固定为一半。

**衡量指标**：分支效率（Branch Efficiency）= 无分化 Warp 占比，应接近 100%。

### 内存合并（Memory Coalescing）
同一 Warp 的 32 个线程访问**连续对齐**的内存地址时，硬件可用较少的内存事务满足访问（数量取决于访问宽度、对齐和架构），大幅提高有效带宽。反之（散乱访问）会触发多次事务，浪费带宽。

**规则**：尽量让 `thread_idx` 对应连续内存地址，避免按列访问二维数组。

### Bank 冲突（Bank Conflict）
共享内存分为 32 个 Bank，同一 Warp 的多个线程访问同一 Bank 时，访问被串行化。解决方法：访问地址错开（padding），或调整数据布局。

### 寄存器压力（Register Pressure）
每个 SM 的寄存器文件固定（H100：65536 个 32bit 寄存器/SM）。Kernel 使用寄存器越多，SM 上可并发的 Warp 越少，Occupancy 越低，延迟隐藏能力越弱。

### 计分板停顿（Scoreboard Stall）
Warp 等待上一条指令的结果（数据依赖），调度器无可用就绪 Warp 时发生停顿。多见于内存受限 Kernel + 低 Occupancy 组合。

### 利特尔定律（Little's Law）
`吞吐量 = 并发度 / 延迟`

估算所需在途请求数时，必须同时给出请求吞吐与延迟，且单位一致；仅有 500 周期延迟不能推出 500 个在途请求。

### SM 利用率（SM Utilization）
= 所选采样口径下 SM 处于活跃状态的时钟周期比例。没有通用的目标百分比；低值可能来自工作量、负载不均、主机供给或采样范围，高值也不证明发射率或有效吞吐高。结合时间线、eligible warps 和绝对耗时判断。

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

按任务授权选择采样范围。尚未定位成本时先检查端到端时间线；只有需要解释已定位的 kernel 时才进入 NCU，不要求在定位采样前就掌握热点证据。

```text
确认主要绝对成本和正常执行基线
    -> 时间线区分 CPU、传输、kernel 间隔和 kernel 内成本
    -> 只对代表性热点采集能区分假设的指标
       - 计算/内存资源饱和：检查有效工作量、访问量和对应上限
       - 吞吐都低：检查依赖、eligible warps、发射率和工作量
       - 怀疑资源限制：结合目标架构、occupancy 与 spill 数据验证
    -> 正确性检查与正常环境下的端到端复测
```

概念解释或已有报告足够时无需运行 profiler；occupancy 的固定百分比不是分流阈值。

---

## 参考

- [Modal GPU Glossary](https://modal.com/gpu-glossary) — 原始来源（CC BY 4.0）
- [中文翻译版](https://gpu-glossary-zh.readthedocs.io/en/latest/) — by miter6（CC BY 4.0）
- [NVIDIA H100 白皮书](https://modal-cdn.com/gpu-glossary/gtc22-whitepaper-hopper.pdf)
- [Roofline Model 原论文](https://people.eecs.berkeley.edu/~kubitron/cs252/handouts/papers/RooflineVyNoYellow.pdf) — Williams, Waterman & Patterson (2008)

## 修订依据

- [CUDA Best Practices Guide](https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html) — 占用率、访存与控制流
- [Hopper Tuning Guide](https://docs.nvidia.com/cuda/hopper-tuning-guide/index.html) — H100 资源边界
- [PTX ISA](https://docs.nvidia.com/cuda/parallel-thread-execution/index.html) — 架构相关 Tensor Memory 与指令

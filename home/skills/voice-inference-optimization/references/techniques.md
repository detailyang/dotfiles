# Voice Inference Optimization Skill

> 历史案例与优化候选，不是通用 SLO、模型推荐或本次实测。原始外部案例未在此机器复现；性能数字、模型能力与工具版本需在使用时核对来源及负载。

语音推理优化的核心参考。覆盖架构设计、ASR/TTS 优化、模型压缩和基础设施四个层次。

## 核心指标速查

| 指标 | 含义 | 验证口径 |
|---|---|---|
| **RTF**（Real-Time Factor） | 计算耗时 / 音频时长 | 持续生成需低于 1；系统余量按并发、抖动与播放缓冲实测 |
| **TTFT** | 第一个 token 的延迟 | 按任务定义起终点、质量约束与延迟目标 |
| **FPL**（First Packet Latency） | TTS 首个音频 chunk 延迟 | 按当前 SLO 验证，不继承历史模型的 700ms 门槛 |
| **WER / CER** | 识别错误率 | 由任务明确质量预算，不默认允许固定比例下降 |

> RTF 反映平均计算速度，不能单独证明首包或流式连续性达标；还需测排队、尾延迟、chunk 间隔和播放缓冲。

---

## 一、架构层候选

### 流式 Pipeline
串行等待可能是主要成本之一；先测关键路径，再验证能够安全重叠的阶段。
- ASR 出部分转录 → 立即送 LLM
- LLM 出部分 token → 立即送 TTS
- TTS 出部分音频 → 立即播放

**历史报道中的效果**：有案例声称从 800ms～2s 降至 300ms 以内，但这里未提供一致的负载与计时边界，不能用于当前收益承诺。以真实依赖、错误/取消语义及端到端时间线验证。

### VAD Flush Trick
- 问题：等完整句子再触发 ASR，引入 ~500ms 延迟
- 候选：在 endpointing 判定允许时提前 flush；对静音误判、截断和后续修订检查识别质量与延迟
- 历史案例报告 ~500ms → ~125ms；该数值不是静音检测或当前链路的默认预算

### TTS Token Buffering
TTS 不一定需要等待完整 LLM 输出，但触发策略必须兼顾语义完整性、首包和 chunk 连续性：
- 可比较标点、等待时间或缓冲长度触发，并验证取消和背压。
- 64 token 是一个历史配置候选，不是通用硬阈值；按实际语言、tokenizer 和模型实测选择。
- 单 token 触发是否有效取决于模型的增量能力与调度成本，不能一概排除或采用。

### 组件并行部署
- ASR + TTS 同一 GPU，LLM 单独一张（减少竞争）
- 或全部 co-locate（省去网络传输）
- 硬件选择由模型、精度、显存峰值、并发和 SLO 决定；不要将历史 H100 80GB/11B 配置当作默认采购或容量保证

### 并行 LID（语言识别）
- 问题：LID 作为前置步骤需等 2-3 秒音频
- 候选：当模型结构支持时，共享 encoder 或并行执行 ASR/LID；只有任务认可的置信度和误判预算允许时才裁剪 decoder，0.9 不是通用阈值

---

## 二、ASR 优化

### 架构选型

| 架构 | 特点 | 适用场景 |
|---|---|---|
| **CTC（Conformer-CTC）** | 帧同步输出，天然流式，RTF < 0.2 | 实时对话、电话 |
| **Attention（Whisper）** | 非因果，精度高，不支持原生流式 | 离线转录 |
| **Two-Pass（CTC + Attention）** | CTC 出流式结果，Attention 做重排序 | 兼顾流式和精度 |

### Whisper 流式改造（Two-Pass Decoding）
1. 额外训练带 causal attention mask 的 CTC decoder
2. CTC decoder 实时产出部分转录
3. 原 Whisper decoder 对部分结果重排序
4. 需要配套 fine-tuning 数据

### 噪声鲁棒性
- SNR < 3dB 时精度急剧下降
- 嘈杂环境优先选 distil-whisper 等噪声鲁棒模型，而非纯精度模型
- 背景人声对 Whisper 影响较小；混响和环境噪声更致命

---

## 三、TTS 优化

### 模型历史案例

以下数字来自不同案例，缺少统一硬件、并发、音频长度和质量口径，不能横向排名或外推容量。使用某一项前核对其原始来源和实测环境。

| 模型 | RTF（GPU） | 首包延迟 | 备注 |
|---|---|---|---|
| NeuTTS Air | 案例声称 ~0.003，待核对环境 | 未给出可比值 | 不能由单流 RTF 推出单卡并发 |
| Kokoro | 待同条件实测 | 待同条件实测 | 不按未定义的“低延迟”直接选型 |
| XTTS v2 | ~0.3 | 较高 | 实时可用，余量较少 |
| CSM-1B (i-LAVA) | 0.48 | < 700ms | 可调 RVQ 深度 |

### RVQ Codebook 深度控制
- RVQ 层数越多 → 音质越好，延迟越高
- 减少 codebook 深度 = 降低 RTF，提升流式速度
- 是音质和延迟间最直接的设计杠杆

### 扩散模型 TTS 的 NFE（步数）控制
- NFE = 16：UTMOS = 3.79，RTF = 0.016（已足够实时）
- 生产中无需最大步数，找质量可接受的最低 NFE

---

## 四、模型压缩

### 量化候选

存储变化取决于原始精度、元数据和未量化部分；性能取决于实际 kernel、硬件与批量。质量回归上限必须来自任务，不能采用案例中的 WER 变化作为默认许可。

| 精度 | 主要候选收益 | 必须验证 |
|---|---|---|
| INT8 | 降低权重存储；受支持 kernel 可能加速 | 端到端时间、峰值内存与 WER/CER 或音质 |
| INT4 | 进一步降低权重存储 | 解量化、布局转换和小批量开销，以及质量 |
| FP4 | 特定硬件与模型上的存储/计算收益 | 实际格式和 kernel 支持，不能一概判断更快或不适用低延迟 |

**工具链**：
- `ONNX Runtime`：dynamic quantization，Transformer 友好，支持 symbolic shape inference
- `BitsAndBytes`：可作为支持模型的低精度候选；延迟收益必须计入实际 kernel 与转换成本
- `TensorRT`：NVIDIA GPU 专用，算子融合 + kernel 优化

**实测案例（Whisper-tiny）**：
- LoRA fine-tune → INT8 量化（ONNX Runtime）
- M1 Mac CPU：RTF = 0.20，延迟降 43%
- A10 GPU：RTF = 0.06

### 知识蒸馏
- distil-whisper：Whisper 蒸馏版，精度接近，速度 2-6x
- 适合噪声鲁棒性要求高、延迟敏感的场景

### 算子融合 & 稀疏化
- Operator fusion：减少 kernel launch 开销，适合 vocoder / encoder
- Learned weight sparsity：只有部署 kernel 能利用相应稀疏模式时才可能加速；比较转换和调度后的端到端成本，不外推固定倍数或 ARM 延迟阈值

---

## 五、基础设施

### 网络传输
- WebSocket 持久连接（避免 TCP 握手开销）
- ASR/TTS 与 LLM co-locate 同一 GPU 集群（消除跨 provider 网络延迟）
- 区域化部署：ASR + TTS 在 edge，LLM 在中心节点

### 模型预热（Warmup）
- TTS 启动时用参考音频做 warmup，减少首次推理的 latency jitter
- 避免冷启动带来的首请求慢问题

### 多线程架构
- ASR / LLM / TTS 各运行在独立线程 + 队列
- 生产者-消费者模型：LLM 向 TTS queue 写 token，TTS 消费并合成

---

## 典型端到端延迟（2025 年底）

```
用户说话结束
    ↓ VAD flush          ~125ms（优化后）
    ↓ ASR                ~150ms（Deepgram，US）
    ↓ LLM TTFT           ~350ms（流式首 token）
    ↓ TTS 首包            ~75ms（ElevenLabs）
用户听到回复             上述阶段严格串行相加为 ~700ms；若声称重叠收益，必须提供实际依赖与时间线证据

未优化串行系统：           800ms～2s+ ❌
```

---

## 参考来源

- [Introl: Voice AI Infrastructure Guide](https://introl.com/blog/voice-ai-infrastructure-real-time-speech-agents-asr-tts-guide-2025)
- [Chanl: Voice AI pipeline & 300ms budget](https://www.channel.tel/blog/voice-ai-pipeline-stt-tts-latency-budget)
- [Spheron: Voice AI GPU Infrastructure](https://www.spheron.network/blog/voice-ai-gpu-infrastructure/)
- [EmergentMind: Latency-Aware TTS Pipeline](https://www.emergentmind.com/topics/latency-aware-text-to-speech-tts-pipeline)
- [Dev.to: Voice AI Guide Part 3](https://dev.to/programmerraja/2025-voice-ai-guide-how-to-make-your-own-real-time-voice-agent-part-3-3ocb)
- [arxiv 2506.12154: Two-Pass Streaming Whisper](https://arxiv.org/pdf/2506.12154)
- [ONNX Runtime Quantization Docs](https://onnxruntime.ai/docs/performance/model-optimizations/quantization.html)

---
name: voice-inference-optimization
description: 语音推理优化参考技巧库。当用户提问与语音推理、语音 AI 性能、实时语音系统延迟、ASR/TTS 优化相关时触发。包含 RTF、流式 pipeline、VAD、量化、模型选型等实战技巧。即使用户只是问"怎么让语音更快"、"TTS 延迟太高怎么办"、"ASR 流式怎么做"也应触发。
---

# Voice Inference Optimization Skill

语音推理优化的核心参考。覆盖架构设计、ASR/TTS 优化、模型压缩和基础设施四个层次。

## 核心指标速查

| 指标 | 含义 | 目标值 |
|---|---|---|
| **RTF**（Real-Time Factor） | 计算耗时 / 音频时长 | < 0.5 可实时，< 0.1 有余量 |
| **TTFT** | 第一个 token 的延迟 | 越低越好 |
| **FPL**（First Packet Latency） | TTS 首个音频 chunk 延迟 | < 700ms |
| **WER / CER** | 识别错误率 | 量化后允许 < 3% 上升 |

> RTF > 1.0 = 无法实时；RTF < 0.1 才有足够的系统余量。

---

## 一、架构层（最大收益，优先看）

### 流式 Pipeline
串行等待是最大的延迟来源。优化方案：各阶段重叠并行。
- ASR 出部分转录 → 立即送 LLM
- LLM 出部分 token → 立即送 TTS
- TTS 出部分音频 → 立即播放

**效果**：端到端延迟从 800ms～2s 压缩到 300ms 以内。

### VAD Flush Trick
- 问题：等完整句子再触发 ASR，引入 ~500ms 延迟
- 方案：VAD 检测到静音立即 flush 缓冲区
- 效果：延迟从 ~500ms → ~125ms

### TTS Token Buffering
TTS 不等 LLM 全部输出，按策略触发推理：
- 遇到标点 → 立即推理当前缓冲
- 缓冲超过 64 token → 强制推理
- 避免单 token 触发（延迟高、不稳定）

### 组件并行部署
- ASR + TTS 同一 GPU，LLM 单独一张（减少竞争）
- 或全部 co-locate（省去网络传输）
- 推荐起点：单张 H100 80GB，可跑 11B 级全链路

### 并行 LID（语言识别）
- 问题：LID 作为前置步骤需等 2-3 秒音频
- 方案：ASR 和 LID 共享 encoder 并行运行；LID 置信度 > 0.9 后再裁剪无关 decoder

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

### 模型选型（RTF 参考）

| 模型 | RTF（GPU） | 首包延迟 | 备注 |
|---|---|---|---|
| NeuTTS Air | ~0.003 | 极低 | 320x 实时，单卡数百并发 |
| Kokoro | 低 | 低 | 低延迟首选 |
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

### 量化对比

| 精度 | 内存节省 | 延迟降低 | 质量损失 |
|---|---|---|---|
| INT8 | ~50% | ~43% | < 3% WER 上升 |
| INT4 | ~75% | 显著 | 需实测验证 |
| FP4 | 最大 | 最大 | 不推荐低延迟场景 |

**工具链**：
- `ONNX Runtime`：dynamic quantization，Transformer 友好，支持 symbolic shape inference
- `BitsAndBytes`：4-bit PTQ，LLM 友好，可降低 40% 延迟
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
- Learned weight sparsity：结合 INT8 可达 2-3x 加速
- 可实现 ARM 硬件上 < 15ms 端到端 TTS

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
用户听到回复             总计 ~300-500ms ✅

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

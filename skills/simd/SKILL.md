---
name: simd-optimization
description: >
  SIMD (Single Instruction Multiple Data) 优化技巧知识库，蒸馏自 Daniel Lemire 博客（lemire.me/blog）
  的数百篇性能工程文章与研究论文。覆盖 x86 (SSE/AVX2/AVX-512) 和 ARM (NEON/SVE2) 的实战优化
  模式、代码范例与性能直觉。当用户提问涉及 SIMD 向量化、性能优化、数据并行、字节解析、
  JSON/文本/UTF-8/base64 加速、位图操作、整数压缩、prefix sum、字符串扫描、
  类型转换加速时触发。也适用于"为什么我的循环慢"、"如何用 intrinsic 优化"、"AVX vs NEON"
  等问题。只要涉及批量数据处理性能就应优先查阅本 skill。
---

# SIMD 优化技巧 —— Lemire 博客精华蒸馏

> "I like crazily fast code." — Daniel Lemire

---

## 一、SIMD 核心思维模型

### 1.1 什么时候用 SIMD？

**SIMD 最有价值的场景**（Lemire 博客反复验证）：
- 处理大块连续内存：文本扫描、格式解析、编解码
- 批量数值计算：integer-to-string、prefix sum、校验和
- 集合操作：排序整数的搜索与交集
- Unicode/UTF-8/Base64 编解码

**SIMD 不一定有效的场景**：
- 数据量极小（< 64 字节），setup 开销淹没收益
- 有复杂数据依赖（如 prefix sum 的朴素 SIMD 版）
- 编译器已经自动向量化且表现良好时

### 1.2 性能估算直觉

| 操作 | 典型瓶颈 | 可达速度 |
|------|---------|---------|
| 字节分类（vectorized classification） | 吞吐量 | 10–20 GB/s |
| UTF-8 验证 | 吞吐量 | >10 GB/s |
| Base64 编解码 | 吞吐量 | 接近内存拷贝速度 |
| JSON 索引 | 吞吐量 | 3–14 GB/s |
| 前缀和（SIMD 版） | 延迟链 | ~2× scalar |
| 整数-字符串转换（AVX-512 IFMA） | 计算 | < 2 ns/整数 |

---

## 二、核心技术模式

### 2.1 Vectorized Classification（向量化字符分类）

**来源**：simdjson、DNS 解析、HTML 扫描（Langdale & Lemire 2019）

**原理**：用 SIMD 表查找（`pshufb`/`vtbl`）将每个字节的低4位和高4位分别映射到掩码，两掩码 AND 后得到分类结果。一条指令处理 16 字节，完全 branch-free。

```c
// SSE2/SSSE3 示例：分类 JSON 结构字符 + 空白字符
// 每个字节的高4位 → row 掩码，低4位 → col 掩码，AND 得分类位
__m128i low_nibble_mask  = _mm_set_epi8(...); // 16 bytes
__m128i high_nibble_mask = _mm_set_epi8(...);
__m128i data = _mm_loadu_si128(input);
__m128i lo = _mm_and_si128(data, _mm_set1_epi8(0x0F));
__m128i hi = _mm_srli_epi16(data, 4);
hi = _mm_and_si128(hi, _mm_set1_epi8(0x0F));
__m128i result = _mm_and_si128(
    _mm_shuffle_epi8(low_nibble_mask, lo),
    _mm_shuffle_epi8(high_nibble_mask, hi)
);
```

**ARM SVE2 更简洁**（2026 年新发现）：
```c
// svmatch_u8：一条指令检测 a[i] 是否在集合 b 中
svbool_t op = svmatch_u8(pg, data, op_chars);  // 结构字符
svbool_t ws = svmatch_u8(pg, data, ws_chars);  // 空白字符
// 比 NEON 方案少 25% 指令，速度 15.5 → 16 GB/s
```

**要点**：
- NEON 版：用 `vtbl`（NEON table lookup）实现，一样 branch-free
- 每次处理 64 字节（4 个 16-byte 向量），生成两个 64-bit 掩码
- 处理尾部（不足一个向量）时用 scalar 回退或 masked load

---

### 2.2 SIMD 搜索（Hybrid Quaternary + SIMD）

**来源**：Roaring Bitmap 内部搜索（2026 年博客）

**问题**：在排序 uint16 数组（长度 1–4096）中搜索一个值。

**SIMD Quad 算法**：
1. 将数组按 16 元素分块，记录每块末尾值作为索引键
2. 用四叉插值搜索（quaternary interpolation search）定位目标块 —— 每次比较 3 个"四分点"，利用内存级并行（MLP）
3. 对目标块用 SIMD 同时比较 16 个元素

```c
// ARM NEON：一次检查 16 个 uint16
uint16x8_t needle = vdupq_n_u16(pos);
uint16x8_t v0 = vld1q_u16(blk);
uint16x8_t v1 = vld1q_u16(blk + 8);
uint16x8_t hit = vorrq_u16(vceqq_u16(v0, needle), vceqq_u16(v1, needle));
return vmaxvq_u16(hit) != 0;

// x86 SSE2：
__m128i needle = _mm_set1_epi16((short)pos);
__m128i v0 = _mm_loadu_si128((const __m128i *)blk);
__m128i v1 = _mm_loadu_si128((const __m128i *)(blk + 8));
__m128i hit = _mm_or_si128(_mm_cmpeq_epi16(v0, needle),
                             _mm_cmpeq_epi16(v1, needle));
return _mm_movemask_epi8(hit) != 0;
```

**性能**：比 binary search 快 2× 以上（Intel warm cache）或更多（Apple M4 cold cache）。

**关键洞察**：
- 不要让 binary search 下探到 < 16 元素的块，改用 SIMD 替换最后一级
- 四叉搜索比二分更好地利用内存级并行（Intel Emerald Rapids 效果明显）

---

### 2.3 Prefix Sum（SIMD 版）

**来源**：2026 年 ARM NEON 博客文章

**朴素 SIMD 版**：对 4 元素向量做前缀和需要 2 shift + 2 add，外加跨块传播，不比 scalar 快甚至更慢。

**正确做法：交错 load + 转置**
```c
// vld4q_u32：加载 16 个 uint32，自动去交织成 4 个向量
uint32x4x4_t vals = vld4q_u32(data + 16 * i);
// 对转置后的 4 列并行做前缀和（3 条 vadd 指令）
vals.val[1] = vaddq_u32(vals.val[1], vals.val[0]);
vals.val[2] = vaddq_u32(vals.val[2], vals.val[1]);
vals.val[3] = vaddq_u32(vals.val[3], vals.val[2]);
// 跨块传播 carry，再用 vextq/vaddq 完成
// ...
vst4q_u32(data + 16 * i, vals);  // 交织写回
```

**结果**：scalar 3.9 Gint/s → fast SIMD 8.9 Gint/s（Apple M4，2.3× 提升）

**教训**：朴素 SIMD prefix sum（naive 版）比 scalar 慢！必须用转置+并行才能赢。

---

### 2.4 SIMD 整数转字符串（AVX-512 IFMA）

**来源**：Gareau & Lemire 2026，"Converting an Integer to a Decimal String in Under Two Nanoseconds"

**原理**：用 `vpmadd52huq`（52-bit IFMA，AVX-512）的乘加融合，8 路并行计算不同的乘法逆元，一次提取 8 位十进制数字。

```c
__m512i to_string_avx512ifma_8digits(uint64_t n) {
    __m512i bcstq = _mm512_set1_epi64(n);
    constexpr uint64_t t52 = 1ULL << 52;
    __m512i ifma_const = _mm512_setr_epi64(
        t52/100000000, t52/10000000, t52/1000000, t52/100000,
        t52/10000,     t52/1000,    t52/100,     t52/10
    );
    __m512i ten      = _mm512_set1_epi64(10);
    __m512i ascii0   = _mm512_set1_epi64('0');
    // 两条 vpmadd52 指令搞定 8 个数字
    __m512i lo = _mm512_madd52lo_epu64(ifma_const, bcstq, ifma_const);
    __m512i hi = _mm512_madd52hi_epu64(ascii0, ten, lo);
    return hi;
}
```

**性能**：比 `std::to_chars` 快 2–4×，1.4–2× 快于最佳竞争者。

**实用细节**：
- 数字位数不足 8 位时，用 **masked store** 只写需要的字节
- 两个变体：branch-heavy（同质数据快）vs branch-light（混合长度快）

---

### 2.5 Base64 编解码（AVX2 / AVX-512）

**来源**：Muła & Lemire 2018/2020，PHP 7.4 & Java OpenJDK 采用

**核心 trick**：
- 用 `pshufb` 做字节重排，3 字节 → 4 字节（编码）或反向（解码）
- 每次处理 32 字节（AVX2）或 64 字节（AVX-512）
- 验证字符合法性也可以并行：用 shuffle 查表

**性能**：接近内存拷贝速度（约 80–90% 内存带宽）。

---

### 2.6 Population Count / 位集操作

**来源**：Muła, Kurz & Lemire 2018，Windows Terminal 采用

**Harley-Seal 算法**（AVX2）：
- 用 `vpshufb` 对每个 nibble 做 popcount，累加避免进位溢出
- 每向量 256 字节处理一次 `vpsadbw` 归约

**Positional Population Count（positional popcount）**：
- 统计 N 个 64-bit 整数中每一位位置的 1 的个数
- AVX-512 版本可处理约 10 GB/s

---

### 2.7 UTF-8 / Unicode 加速

**来源**：simdutf 库，Node.js 性能提升 364%

**UTF-8 验证**（< 1 instruction/byte）：
- 用 SIMD 做连续字节的范围检查和状态机迁移
- 关键：合并多字节序列的验证，避免 per-byte 分支

**UTF-8 ↔ UTF-16 转码**：
- ARM NEON `vtbl`/`vqtbl` 做字节重排
- AVX-512 `vpermi2b` 做更宽的重排
- 达到数十亿字符/秒

**实践建议**：直接用 [simdutf](https://github.com/simdutf/simdutf) 库，支持 x86/ARM/RISC-V，有广泛测试。

---

## 三、通用优化原则（来自 Lemire）

### 3.1 Branch-Free 优先
- 分支预测失败是重大性能杀手（~15 周期/次）
- 用 SIMD 比较 + 掩码替换 if/else
- 用 `_mm_movemask_epi8` / `vmaxvq_u16` 把向量结果折叠到标量

### 3.2 内存级并行（MLP）
- CPU 可以并发发出多个 load 请求（out-of-order 执行）
- 四叉搜索比二分好，就是因为每层比较触发 3 次 load 而非 1 次
- 指令数不是瓶颈时，增加并行 load 可以免费加速

### 3.3 Masked Store/Load（AVX-512 特有优势）
- 不足一个向量宽度的尾部数据，用 mask 处理避免越界
- `_mm512_mask_storeu_epi8` 等指令让 tail 处理非常干净
- 替代方案：预先 pad 数据到向量边界

### 3.4 乘法逆元替代除法
- 编译器自动做 `n/d` → `n * (2^k / d) >> k`
- SIMD 里手动用 IFMA/MULHI 做同样的事，8 路并行
- Lemire et al. 2021 有精确界的理论保证

### 3.5 不要相信 Naive SIMD
- Prefix sum 朴素 SIMD 版比 scalar 慢
- 必须改变数据布局（如转置、交错 load）才能让 SIMD 真正并行
- 先想清楚数据依赖，再写 intrinsic

### 3.6 两变体策略
- 提供"branch-heavy"（同质输入）和"branch-light"（混合输入）两个实现
- 在运行时或编译时选择，避免"最优实现在最差输入上退化"

---

## 四、平台选择指南

| 平台 | 推荐指令集 | 寄存器宽度 | 特色指令 |
|------|----------|----------|---------|
| Intel/AMD（服务器） | AVX-512 | 512 bit (64 byte) | IFMA、VPERMI2B、Masked 操作 |
| Intel/AMD（消费者） | AVX2 | 256 bit (32 byte) | VPSHUFB、VPMULLD |
| ARM 64-bit（通用） | NEON | 128 bit (16 byte) | VLD4、VTBL/VQTBL |
| ARM（AWS Graviton3+） | SVE2 | 128–2048 bit (可变) | SVMATCH、SVNMATCH |
| Apple Silicon | NEON（无 SVE2！） | 128 bit | NEON 完整支持 |

**重要**：Apple 尚未支持 SVE2（2026 年）。Apple M4 使用 NEON。

---

## 五、实战技巧清单

### 写 SIMD 代码前
- [ ] 确认是否有现成库（simdutf、simdjson、fast_float、CRoaring）
- [ ] Profile 确认热点真的在这段代码
- [ ] 理解数据依赖，判断是计算密集还是内存密集

### 写代码时
- [ ] 用 intrinsics 而非汇编（更可移植，编译器可以进一步优化）
- [ ] 处理好 tail（未对齐或不足一个向量的剩余元素）
- [ ] 用 `static_assert` / compile-time 检查对齐和类型大小
- [ ] 提供 scalar fallback（非 SIMD 路径），用于不支持的平台

### 性能验证
- [ ] 测 warm cache（数据在 L1/L2）和 cold cache（数据在内存/L3）
- [ ] 分别测小数据（< 1 KB）和大数据（> 1 MB）
- [ ] 用 `perf stat` / `VTune` / `Instruments` 确认 instructions/byte
- [ ] 注意：小数据集上处理器会"学会"分支，benchmark 结果不可信（Lemire 2019 警告）

---

## 六、参考库与论文

| 库 | 功能 | 采用方 |
|----|------|-------|
| [simdjson](https://github.com/simdjson/simdjson) | JSON 解析 3–14 GB/s | Facebook、Node.js、Chrome |
| [simdutf](https://github.com/simdutf/simdutf) | UTF-8/16 转码验证 | Node.js、Bun、WebKit |
| [fast_float](https://github.com/fastfloat/fast_float) | 浮点数解析 GB/s | Go、Rust、C#、Arrow |
| [CRoaring](https://github.com/RoaringBitmap/CRoaring) | 压缩位图 | Lucene、Druid、Spark |
| [streamvbyte](https://github.com/lemire/streamvbyte) | 整数压缩 | Facebook Thrift |

**核心论文**（arXiv 可免费获取）：
- Langdale & Lemire 2019 — *Parsing Gigabytes of JSON per Second*（vectorized classification 权威来源）
- Muła & Lemire 2020 — *Base64 encoding and decoding at almost the speed of a memory copy*
- Keiser & Lemire 2021 — *Validating UTF-8 In Less Than One Instruction Per Byte*
- Gareau & Lemire 2026 — *Converting an Integer to a Decimal String in Under Two Nanoseconds*

---

## 七、常见陷阱

1. **对齐假设**：`_mm256_load_si256` 要求 32-byte 对齐，否则用 `_mm256_loadu_si256`
2. **符号扩展**：`_mm_cmpgt_epi8` 是有符号比较，处理 ASCII（0–127）没问题，处理二进制数据要小心
3. **Shuffle 索引越界**：`pshufb` 中索引 ≥ 16 会清零该 lane，这有时是 feature 有时是 bug
4. **AVX-512 频率降频**：某些 Intel CPU 在使用 AVX-512 时会降低时钟频率（AVX-512 throttling）；短 burst 可能没好处
5. **跨平台差异**：ARM vmaxvq 和 x86 movemask 语义不完全对称，封装时要测试

---
title: "位置编码与 RoPE：让注意力知道顺序"
description: "从正弦绝对位置编码到旋转位置编码，理解位置如何进入注意力分数。"
date: 2026-10-04
category: ML_foundation
tags: [Transformer, positional encoding, RoPE, attention]
outline_key: ml-foundation-1-3
permalink: /RoPE/
redirect_from: /2026/10/04/positional-encoding-rope/
---

## 为什么需要位置

自注意力先把每个 token 投影成 query、key、value，再比较任意两个位置的内容。若输入只有 token 向量，且没有位置相关的掩码或其他顺序信息，把 token 顺序打乱也只会把输出相应打乱：模型无从区分“狗追猫”和“猫追狗”。位置编码的任务，是让计算看到“第几个”和“相隔多远”。下面分别看加到输入上的绝对位置编码，以及作用于 query、key 的 RoPE。

## 正弦绝对位置编码

[《Attention Is All You Need》](https://arxiv.org/abs/1706.03762)给出的固定编码，把位置 `p` 映射到与 token 向量同维的向量 `PE[p]`，然后相加：`z[p] = token_embedding[p] + PE[p]`。若维度为偶数 `d`，第 `i` 对坐标为：

```text
PE[p, 2i]   = sin(p / 10000^(2i/d))
PE[p, 2i+1] = cos(p / 10000^(2i/d))
```

每一对坐标像一个转动速度不同的钟表：低维变化快，高维变化慢。它不需要学习一个“第 512 位”的专用参数，理论上也能算出训练长度以外的位置。但“能算出”不等于模型一定能在更长序列上可靠推理。位置向量与内容相加后，后续投影要自己学会如何利用它；不同位置的注意力分数也不会天然只由距离决定。

可以拿同一个词出现在句首和句尾做思考实验：两个位置上的 token embedding 相同，但加上的 `PE[p]` 不同，所以后续层收到的输入不同。相反，若两个不同的词恰好在同一位置，它们共享同一条位置向量。编码本身不表达“谁在谁前面”的语义规则，只提供可被后续参数利用的数值线索。正弦与余弦成对还有一个便利性质：位置从 `p` 变为 `p+Δ` 时，每一对坐标都能由固定角度的旋转得到，这解释了它为何可能帮助模型学习位移关系；但把它与词向量相加后，注意力并没有自动变成纯相对位置计算。

下面只展示如何构造编码。`pe` 的形状是 `[1, T, d]`，可广播到批量输入 `[B, T, d]`。这段代码是概念示例，没有模型执行过程。

```python
import torch

def sinusoidal_pe(length: int, dim: int, device=None):
    assert dim % 2 == 0
    pos = torch.arange(length, device=device, dtype=torch.float32)[:, None]
    i = torch.arange(0, dim, 2, device=device, dtype=torch.float32)
    angle = pos / (10000 ** (i / dim))  # [T, d/2]
    pe = torch.empty(length, dim, device=device)
    pe[:, 0::2], pe[:, 1::2] = angle.sin(), angle.cos()
    return pe[None, :, :]               # [1, T, d]

# x: [B, T, d]; x = x + sinusoidal_pe(T, d, x.device)
```

## RoPE：在比较前旋转

[《RoFormer》](https://arxiv.org/abs/2104.09864)提出的旋转位置编码（RoPE）先求出 `q` 和 `k`，再按各自位置旋转它们。把一个注意力头的向量按相邻坐标分成二维对 `(u, v)`；位置 `p`、频率 `θ_i` 对应：

```text
R(pθ_i) · (u, v) = (u cos(pθ_i) − v sin(pθ_i),
                    u sin(pθ_i) + v cos(pθ_i))
```

关键是旋转的内积性质：`(R(m)q) · (R(n)k) = q · R(n−m)k`。因此，虽然每个向量按绝对位置 `m`、`n` 旋转，二者点积里的位置部分却由相对位移 `n−m` 决定。这给注意力分数直接注入距离信息；value 通常不旋转。原论文中的 RoPE 使用多个频率，类似正弦编码中快慢不同的钟表。

例如，位置 2 与 5 的间距是 3，位置 20 与 23 的间距也是 3。对同一对 `q`、`k` 内容而言，上式中的相对旋转相同；位置编码不会因为整体平移 18 个位置就换一套关系。这里说的是**位置项**的性质，不是说现实文本中这两对 token 的注意力分数必须一样：内容向量可能不同，前面层的表示也可能已经混入其他上下文。把“点积的相对位移结构”误读成“模型只知道距离”，会高估 RoPE 的保证。

下面的 `x` 是**已经分头、已经投影**的 `q` 或 `k`，形状 `[B, T, H, D]`；`D` 是每个头的维度，必须为偶数。`position_offset` 用于缓存解码：新 token 应使用其在完整序列中的位置，而非每次从零开始。

```python
def apply_rope(x, position_offset=0, base=10000.0):
    B, T, H, D = x.shape
    assert D % 2 == 0
    pos = torch.arange(position_offset, position_offset + T,
                       device=x.device, dtype=torch.float32)
    i = torch.arange(0, D, 2, device=x.device, dtype=torch.float32)
    angle = pos[:, None] * (base ** (-i / D))  # [T, D/2]
    cos = angle.cos()[None, :, None, :]
    sin = angle.sin()[None, :, None, :]
    even, odd = x[..., 0::2], x[..., 1::2]
    out = torch.stack((even * cos - odd * sin,
                       even * sin + odd * cos), dim=-1)
    return out.flatten(-2).to(x.dtype)         # [B, T, H, D]

# q = apply_rope(q, position_offset)
# k = apply_rope(k, position_offset)
# q, k: [B, T, H, D] -> [B, H, T, D]
# q, k = q.transpose(1, 2), k.transpose(1, 2)
# attention_logits = (q @ k.transpose(-2, -1)) / D**0.5
```

计算注意力分数时，先把排布换成 `[B, H, T, D]`，再得到 `[B, H, T, T]` 的分数。RoPE 也不是“无限上下文”的保证：频率选择、训练长度、位置外推和注意力计算成本仍会限制长序列表现。实现时还要确认**配对方式**与模型权重一致；相邻坐标配对和前后半维配对不能随意混用。

还有两个容易混淆的轴：`T` 是 token 位置轴，`H` 是注意力头数，`D` 是**单个头**的维度。频率通常按 `D` 生成，并应用在每个头各自的 `q`、`k` 上，而不是用整个模型的隐藏维度生成一张表后直接套上去。解码缓存时，已经存下的 key 对应旧的绝对位置；只旋转本次新生成的 query/key 时，必须让它们的位置编号与缓存保持连续。漏掉偏移量会让相同内容在增量解码和整段计算中使用不同角度。

## 记住差别

正弦绝对位置编码把位置向量加到 token 表示上；RoPE 则在算注意力分数前旋转 `q`、`k`。前者让层自己学习如何用位置，后者使两个位置的内积显式包含相对位移。两者都提供顺序线索，但都不能单凭编码方式保证长文本理解。

**原始论文：** [Vaswani et al., *Attention Is All You Need*](https://arxiv.org/abs/1706.03762)；[Su et al., *RoFormer: Enhanced Transformer with Rotary Position Embedding*](https://arxiv.org/abs/2104.09864)。

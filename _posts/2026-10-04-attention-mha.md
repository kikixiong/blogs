---
title: "从 Self-Attention 到多头注意力：看懂 Q、K、V 与 Mask"
description: "从张量形状和一个最小 PyTorch 实现出发，理解缩放点积注意力、多头注意力以及两类常见掩码。"
date: 2026-10-04
category: ML_foundation
tags: [attention, self-attention, MHA, transformer, pytorch]
outline_key: ml-foundation-1-1
---

读 Transformer 时，最容易卡住的地方是：Q、K、V 到底是什么，为什么要分成多个头？先看一个直觉：处理句子里某个词时，我们希望它按需要读取其他词的信息。当前位置提出问题（query），各位置提供可匹配的索引（key）和被读取的内容（value）；匹配程度越高，读取的比例越大。这三个名字描述的是**作用**，不意味着它们必须来自三份不同的输入。

## 从一个位置到一整段序列

设批大小为 `B`，查询长度为 `Lq`，键和值的长度为 `Lk`。投影后 `Q ∈ R^(B×Lq×dk)`、`K ∈ R^(B×Lk×dk)`、`V ∈ R^(B×Lk×dv)`。矩阵乘法先得到每个查询与每个键的分数，再在**键所在的维度**做 softmax：

```text
S = Q Kᵀ / √dk                    [B, Lq, Lk]
A = softmax(S + M, dim=-1)        [B, Lq, Lk]
O = A V                          [B, Lq, dv]
```

`M` 可选；允许关注的位置加 0，禁止的位置加 `−∞`。因此每行 `A` 的权重和为 1，输出是 `V` 的加权和。除以 `√dk` 是为了减轻维度增大时点积分数变大、softmax 容易饱和的问题；它不是把向量归一化。这个计算顺序可以对照 [Vaswani 等人的原论文图 2 左侧](https://proceedings.neurips.cc/paper_files/paper/2017/file/3f5ee243547dee91fbd053c1c4a845aa-Paper.pdf)。

**Self-attention** 指 `Q、K、V` 都由同一段输入 `X ∈ R^(B×L×dmodel)` 分别线性投影得到。虽然来源相同，三组投影参数通常不同。若查询来自解码器、键和值来自编码器输出，则是 **cross-attention**；此时 `Lq` 与 `Lk` 可以不同。注意力输出是上下文表示，不等于“选中”某一个词。

## 为什么要有多个头

单个头只产生一套权重。多头注意力用不同的投影参数建立 `h` 套表示，分别计算注意力，再把结果拼接并投影回模型宽度：

```text
head_i = Attention(Q WᵢQ, K WᵢK, V WᵢV)
MultiHead(Q,K,V) = Concat(head_1, …, head_h) Wᴼ
```

常见设置令 `dk = dv = dmodel / h`，所以每个头比较窄；拼接后的宽度仍是 `dmodel`。多个头**有机会**关注不同位置或表示子空间，但不能保证每个头都有固定、可解释的语法职责。[原论文图 2 右侧](https://proceedings.neurips.cc/paper_files/paper/2017/file/3f5ee243547dee91fbd053c1c4a845aa-Paper.pdf)展示了“分别投影 → 并行注意力 → 拼接 → 输出投影”的流程。

<figure class="paper-figure paper-figure--attention">
  <img src="{{ '/assets/images/papers/multihead-attention-original.png' | relative_url }}" alt="Transformer 原论文图 2 右侧：Q、K、V 经各头线性投影、并行缩放点积注意力、拼接及最终线性投影" width="835" height="1282" loading="lazy">
  <figcaption>原论文图 2 右侧，Vaswani 等，<a href="https://arxiv.org/abs/1706.03762">Attention Is All You Need</a>（Google）。图片取自 <a href="https://commons.wikimedia.org/wiki/File:Attention_Is_All_You_Need_-_Multiheaded_Attention.png">Wikimedia Commons</a>，按其所列 <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a> 标注；未修改。</figcaption>
</figure>

## 两种掩码不要混淆

- **Padding mask**：一批句子补齐长度后，禁止读取填充出来的键位置。它通常随样本变化，形状可为 `[B, Lk]`。
- **Causal mask**：自回归生成时，查询位置 `i` 不能读取未来位置 `j > i`，通常是 `[L, L]` 的上三角。编码器的双向 self-attention 一般不使用它。

两者可以同时存在。掩码必须在 softmax **之前**加到分数上；算完权重再把未来位置乘零，剩余权重并不会自动重新归一化。每个有效查询还应至少保留一个可读的键，否则一整行都是 `−∞`，softmax 无法给出有效概率。

下面的实现只展示核心运算。`blocked` 中的 `True` 表示禁止连接；对于多头分数，它需要能广播到 `[B, H, Lq, Lk]`。例如 causal mask 用 `[L, L]`，padding mask 用 `[B, 1, 1, Lk]`。

```python
import math
import torch
from torch import nn


class TinyMHA(nn.Module):
    def __init__(self, d_model: int, heads: int):
        super().__init__()
        assert d_model % heads == 0
        self.heads = heads
        self.d_head = d_model // heads
        self.q = nn.Linear(d_model, d_model)
        self.k = nn.Linear(d_model, d_model)
        self.v = nn.Linear(d_model, d_model)
        self.out = nn.Linear(d_model, d_model)

    def split(self, x):                 # [B, L, D] → [B, H, L, D/H]
        b, length, _ = x.shape
        return x.reshape(b, length, self.heads, self.d_head).transpose(1, 2)

    def forward(self, query, memory, blocked=None):
        q = self.split(self.q(query))
        k = self.split(self.k(memory))
        v = self.split(self.v(memory))
        score = q @ k.transpose(-2, -1) / math.sqrt(self.d_head)
        if blocked is not None:
            score = score.masked_fill(blocked, float("-inf"))
        weight = torch.softmax(score, dim=-1)
        context = weight @ v
        b, _, length, _ = context.shape
        context = context.transpose(1, 2).contiguous().reshape(b, length, -1)
        return self.out(context)
```

调用 `layer(x, x)` 是 self-attention；调用 `layer(decoder_state, encoder_state)` 是 cross-attention。教学代码省略了 dropout、残差和归一化，它们属于完整 Transformer 层。尤其注意：`blocked` 的布尔语义和不同 PyTorch API 的 `attn_mask` 不总相同，换 API 时应查对应文档，而不是直接复用掩码。

**延伸阅读：** [Attention Is All You Need（原论文，§3.2、图 2）](https://proceedings.neurips.cc/paper_files/paper/2017/file/3f5ee243547dee91fbd053c1c4a845aa-Paper.pdf)；[PyTorch `MultiheadAttention` 文档](https://docs.pytorch.org/docs/stable/generated/torch.nn.MultiheadAttention.html)。

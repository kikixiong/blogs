---
title: "从预训练到微调与对齐：语言模型如何分阶段学习"
description: "把预训练、监督微调、RLHF 与 DPO 放在同一张训练地图里，并用损失函数代码厘清标签与掩码。"
date: 2026-10-04
category: ML_foundation
tags: [pretraining, fine-tuning, alignment, RLHF, DPO]
outline_key: ml-foundation-2-3
permalink: /LLM-Training/
redirect_from: /2026/10/04/pretraining-finetuning-alignment/
math: true
---

## 一张训练地图

预训练、微调和对齐解决的问题不同。**预训练**从大量文本学习表示与语言规律；**监督微调**（SFT）用任务示例规定模型应如何回答；**偏好对齐**再利用人类或其他来源的比较信号，调整多个“看起来都能回答”的候选输出之间的取舍。这里的“对齐”指针对某种反馈与评测目标优化行为，不意味着模型在所有场景都准确或安全。

| 阶段 | 常见数据 | 训练信号 | 直接学到的东西 |
| --- | --- | --- | --- |
| 预训练 | 连续文本或带掩码文本 | 下一个 token 或被掩码 token | 语言分布与上下文表示 |
| SFT | 提示词、示范回答 | 目标回答的 token | 任务格式与示范行为 |
| 偏好优化 | 同一提示词下的回答排序 | 哪个回答更受偏好 | 回答之间的相对选择 |

这是一种常见流程，而非所有模型的固定配方。[BERT](https://arxiv.org/abs/1810.04805)以掩码语言模型（MLM）为主要预训练目标；[GPT 系列的早期工作](https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf)使用从左到右的语言建模。下文代码以**因果语言模型**为例，不适用于直接训练 BERT 的 MLM。

## 预训练：预测下一个 token

给定 token 序列 $x_1,\ldots,x_T$，因果语言模型最小化负对数似然：

$$
\mathcal{L}_{\mathrm{PT}}=-\sum_{t=1}^{T-1}\log p_\theta(x_{t+1}\mid x_{\leq t}).
$$

位置 $t$ 的输出预测位置 $t+1$，所以实现中要把 logits 与标签错开一位。模型内部还必须使用**因果注意力掩码**，避免当前位置看到未来 token。损失掩码与注意力掩码各司其职：前者决定哪些标签计入损失，后者决定哪些输入位置可被注意到。数据清洗、去重、划分与分词方式会影响最终模型；这里的公式并不包含这些工程选择。

## 监督微调：只计算目标回答

SFT 通常把提示词和示范回答拼成一个序列，继续使用自回归交叉熵。不过，若目标是学会**回答**，应把提示词 token 和 padding 的标签设成 `-100`，仅让回答 token 参与损失。模型仍能看见提示词，因为它们留在输入中。第一个回答 token 由前面的提示词预测，不能把整段提示词从输入中删除。

下面两个函数只展示损失计算，`logits` 应来自已经正确设置因果掩码的模型；它们不包含训练循环，也不代表可直接复现某篇论文的训练配置。

```python
import torch
import torch.nn.functional as F

def next_token_loss(logits, labels):
    """logits: [B, T, V]; labels: [B, T], ignored positions = -100."""
    shifted_logits = logits[:, :-1, :].contiguous()
    shifted_labels = labels[:, 1:].contiguous()
    return F.cross_entropy(
        shifted_logits.reshape(-1, logits.size(-1)),
        shifted_labels.reshape(-1),
        ignore_index=-100,
    )

def sft_labels(input_ids, response_mask, valid_token_mask):
    """[B, T] booleans; True means answer token / non-padding token."""
    labels = input_ids.clone()
    labels[~(response_mask & valid_token_mask)] = -100
    return labels  # Pass to next_token_loss(model_logits, labels)
```

`response_mask` 应按**拼接后的 token 位置**构造，并包括希望模型学会输出的结束符。若批次内所有标签都是 `-100`，损失没有有效目标；若把提示词位置误标为目标，训练目标就改变了。全参数微调会更新原模型权重；[LoRA](https://arxiv.org/abs/2106.09685)则冻结预训练权重，并在部分权重矩阵旁训练低秩增量。它改变可训练参数的范围，**不自动改变** SFT 的标签定义。

## 偏好对齐：从示范到比较

[InstructGPT](https://arxiv.org/abs/2203.02155)给出一个经典的 RLHF 流程：先以人工示范做 SFT，再收集同一提示词下多个回答的排序，训练奖励模型，最后通过 PPO 等强化学习方法优化策略，同时约束策略不要过度偏离参考模型。奖励模型拟合的是收集到的偏好数据；它可能继承标注偏差，也可能在优化过强时被策略“钻空子”。因此需要独立评估回答质量与任务表现。

[DPO](https://arxiv.org/abs/2305.18290)是使用偏好对直接优化策略的另一条路线。设 $y_w$ 是胜出的回答、$y_l$ 是落选回答，$\pi_{\mathrm{ref}}$ 是固定参考模型。DPO 比较策略与参考模型在两条回答上的**序列对数概率差**：

$$
\mathcal{L}_{\mathrm{DPO}}=-\log\sigma\!\left(\beta\left[\log\frac{\pi_\theta(y_w\mid x)}{\pi_{\mathrm{ref}}(y_w\mid x)}-\log\frac{\pi_\theta(y_l\mid x)}{\pi_{\mathrm{ref}}(y_l\mid x)}\right]\right).
$$

其中 $\beta$ 控制相对参考模型的变化尺度。代码里的四个输入是**完整回答的条件对数概率**，应采用一致的分词、结束符和长度处理，并且只累计回答 token：

```python
def dpo_loss(policy_chosen, policy_rejected,
             reference_chosen, reference_rejected, beta=0.1):
    """Each input is a [B] tensor of response sequence log probabilities."""
    policy_margin = policy_chosen - policy_rejected
    reference_margin = reference_chosen - reference_rejected
    return -F.logsigmoid(beta * (policy_margin - reference_margin)).mean()
```

RLHF 与 DPO 都依赖偏好数据的质量；DPO 省去显式奖励模型和在线 PPO 步骤，但并不自动解决偏好覆盖不足、事实错误或分布外表现。读训练报告时，应分别确认**基础模型、示范数据、偏好数据、参考模型和评测集**是什么，再比较结论。

## 延伸阅读

- [Devlin et al., *BERT* (2018)](https://arxiv.org/abs/1810.04805)：MLM 与原版 BERT 的预训练设计。
- [Radford et al., *Improving Language Understanding by Generative Pre-Training* (2018)](https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf)：早期 GPT 的生成式预训练与微调。
- [Hu et al., *LoRA* (2021)](https://arxiv.org/abs/2106.09685)：参数高效微调。
- [Ouyang et al., *Training language models to follow instructions with human feedback* (2022)](https://arxiv.org/abs/2203.02155)：SFT、奖励模型和 RLHF。
- [Rafailov et al., *Direct Preference Optimization* (2023)](https://arxiv.org/abs/2305.18290)：直接偏好优化。

---
title: "虚拟细胞究竟在预测什么：从单细胞快照到扰动后的细胞群"
description: "以单细胞分析为起点，理解虚拟细胞、Perturb-seq，以及 VCC 2025 到 2026 的任务变化。"
date: 2026-10-04
category: "single-cell_foundation model"
tags: [virtual-cell, single-cell, perturb-seq, VCC]
outline_key: single-cell-foundation-model-2-4
post_css:
  - /assets/posts/virtual-cell-perturbation-prediction/flow.css
---

## 从描述细胞，到预测干预

做单细胞分析时，我们通常拿到一个细胞 × 基因的 counts 矩阵，识别细胞类型、状态和差异表达。**虚拟细胞**多问一步：如果对这个细胞背景施加一个尚未测过的干预，之后会测到什么？它想预测干预的结果，而不只是给现有细胞贴标签。

以基因敲低为例，输入是某个细胞背景下的一群对照细胞，以及要敲低的靶基因 G；输出是敲低后的一群细胞的表达谱。在 [Virtual Cell Challenge（VCC）2026](https://arcinstitute.org/news/virtual-cell-challenge-2026) 中，干预采用 CRISPRi：用 guide 指向靶基因，抑制其转录。我们关心的结果也不只是 G 自己下降了多少，还包括其他基因和细胞群体的响应。

<figure class="vc-concept">
  <div class="vc-flow" role="img" aria-label="同一细胞背景的一群对照细胞，加上指定的基因敲低，预测扰动后的一群细胞；输入和输出没有逐细胞配对关系。">
    <div class="vc-flow__card">
      <span class="vc-flow__label">已观测</span>
      <strong>对照细胞群</strong>
      <span class="vc-flow__detail">同一 context 的表达分布</span>
      <span class="vc-flow__dots" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
    </div>
    <span class="vc-flow__arrow" aria-hidden="true">＋</span>
    <div class="vc-flow__card vc-flow__card--perturb">
      <span class="vc-flow__label">指定干预</span>
      <strong>敲低基因 G</strong>
      <span class="vc-flow__detail">CRISPRi / target identity</span>
    </div>
    <span class="vc-flow__arrow" aria-hidden="true">→</span>
    <div class="vc-flow__card vc-flow__card--output">
      <span class="vc-flow__label">模型预测</span>
      <strong>扰动后细胞群</strong>
      <span class="vc-flow__detail">每个细胞一条全基因表达谱</span>
      <span class="vc-flow__dots" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
    </div>
  </div>
  <figcaption>示意图：每个点代表一颗细胞的表达谱。单细胞测序会破坏细胞，所以两边通常是不同细胞的群体样本，并非同一颗细胞前后的配对测量；见 <a href="https://www.nature.com/articles/s41592-023-01969-x">CellOT 对未配对数据的说明</a>。</figcaption>
</figure>

这里的 **context** 不宜只读成一个细胞类型名称。对照细胞实际提供的是该实验背景下的基线分布，其中既有细胞身份与状态，也有实验和测量因素。VCC 让参赛者直接看到新 context 的对照细胞，却不提供该 context 的扰动结果；这正是预测要跨越的缺口。[VCC 2026 任务说明](https://arcinstitute.org/news/virtual-cell-challenge-2026)对这个输入与隐藏真值的划分有明确描述。

## 预训练表征为什么还不够

大规模细胞图谱适合学习“正常细胞长什么样”：哪些基因常一起表达，哪些状态彼此相近。例如 [scGPT](https://www.nature.com/articles/s41592-024-02201-0) 使用大量观测型单细胞数据进行预训练。但观测到两个基因相关，并不等于知道敲低其中一个后另一个如何改变。[Arc 对 2026 数据的说明](https://arcinstitute.org/news/behind-the-data-virtual-cell-challenge-2026)也把观测型图谱与实际记录干预结果的 Perturb-seq 数据分开讨论。后者可从 [scPerturb](https://www.nature.com/articles/s41592-023-02144-y) 等标准化资源获取；[Tahoe-100M](https://arcinstitute.org/news/arc-vevo)提供了大规模**药物**扰动数据，但药物与 CRISPRi 靶基因敲低仍是不同的干预类型。

因此可以把任务拆成两个问题：**细胞当前处于什么状态**，以及**指定干预会把这一背景下的细胞群推向哪里**。[STATE](https://doi.org/10.1016/j.cell.2026.07.052)就把细胞状态表征与扰动后的状态转移作为两个模型角色来处理。这是理解任务的一张地图，不表示任何预训练 embedding 自然就会预测干预。

## VCC 2025 与 2026：泛化对象变了

| 赛季 | 模型能看到什么 | 主要要跨越什么 |
| --- | --- | --- |
| 2025 | H1 人胚胎干细胞中一部分靶基因的扰动数据 | 同一细胞背景里，预测未见靶基因的响应 |
| 2026 | 新细胞背景的未扰动对照细胞和靶基因列表；没有赛事专属的扰动训练集 | 在没有该背景扰动样本的条件下，预测新背景中的响应 |

[Arc 的 2025 回顾](https://arcinstitute.org/news/virtual-cell-challenge-2025-wrap-up)说明，首届比赛的强方法常把深度学习、公开扰动数据和统计特征结合起来；单纯扩大模型并不足以稳定胜过简单基线。[2026 年任务](https://arcinstitute.org/news/virtual-cell-challenge-2026)进一步改成跨 context 的 zero-shot 预测：六条不同来源的细胞系中，三条用于 validation，另三条用于 final test。这里的“未见”指**该细胞背景的扰动结果未见**，并不表示模型完全不知道这些细胞的基线表达。

按 [VCC 2026 提交说明](https://vcc-cli-wiki.virtualcellchallenge.org/)，validation 对每个 context 与靶基因要给出恰好 400 个预测细胞，使用官方 18,533 基因面板，提交非负整数的原始 counts。于是，即使某方法已经预测到一个不错的平均表达向量，也还需把它变成一群合理的单细胞表达谱。

## 为什么要预测“一群细胞”

一组扰动细胞可以先汇总成 pseudo-bulk profile，与对照组比较平均响应；但差异表达分析还会看每个基因在**两群细胞中的分布**。如果预测细胞全都几乎一样，即使群体均值接近真实值，它们的离散度、零值比例和检验出的显著基因也可能失真。因此，“预测均值准确”和“重现一场 Perturb-seq 实验”是两个不同的要求。

[VCC 2026 官方指标说明](https://github.com/ArcInstitute/cell-eval2/blob/main/docs/vcc2026_metrics/vcc2026-metrics.md)把成绩拆成六个角度：

| 问题 | 指标所看的信息 |
| --- | --- |
| 能否认出是哪一种干预？ | 扰动响应的判别能力（PDS） |
| 整体表达谱接近吗？ | 群体表达误差 |
| 哪些基因显著变化？ | 差异表达基因集合的重合 |
| 变化幅度准吗？ | 显著基因的 log fold change 误差 |
| 上调或下调方向可靠吗？ | 方向正确性与覆盖 |
| 最有把握的基因真的可靠吗？ | 方向正确性的排序深度 |

这些角度不能用单一均值误差替代。官方 [VCC CLI 文档](https://vcc-cli-wiki.virtualcellchallenge.org/)还给每项指标设了两个参照点：**0 是基线预测，1 是真实实验的 split-half 生物重复水平**；1 不是数学满分，分数也不是“预测正确百分比”。这也修正了把 1 简单说成“完整真实值复现”的常见误读。

## 这项任务目前能说明什么

VCC 测的是一个明确的代理任务：给定新背景的对照转录组，预测指定 CRISPRi 敲低后、在规定测量时间点会看到的细胞群。表现好，说明模型在这类干预与测量条件下有更强的预测能力；它还不能直接证明模型掌握了细胞内部所有因果机制，或能模拟任意药物、剂量和时间过程。

对做过单细胞分析的读者，最实用的起点是把三个对象分清：**基线细胞群、被施加的干预、扰动后细胞群**。前者可以从观测数据学习，中间需要干预信息，后者需要真实扰动数据和严格评估来检验。虚拟细胞研究的难点，就在把这三者接成一个能跨背景预测的模型。

### 继续阅读

- [Dixit et al., *Perturb-seq*（Cell, 2016）](https://doi.org/10.1016/j.cell.2016.11.038)：扰动身份与单细胞转录组联合测量的早期工作。
- [Cui et al., *scGPT*（Nature Methods, 2024）](https://www.nature.com/articles/s41592-024-02201-0)：大规模观测型单细胞预训练的代表。
- [STATE（Cell, 2026）](https://doi.org/10.1016/j.cell.2026.07.052)：细胞表征与跨背景扰动预测。
- [Arc Institute，VCC 2026 任务说明](https://arcinstitute.org/news/virtual-cell-challenge-2026)及 [官方评分规范](https://github.com/ArcInstitute/cell-eval2/blob/main/docs/vcc2026_metrics/vcc2026-metrics.md)：任务、数据与指标的更新来源。

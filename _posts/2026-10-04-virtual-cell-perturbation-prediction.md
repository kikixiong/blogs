---
title: "虚拟细胞怎样预测基因扰动：读懂四张方法主图"
description: "从 CPA、GEARS、CellOT 和 State 的原论文主图出发，理解对照细胞如何变成扰动后细胞群，以及 VCC 2026 真正考什么。"
date: 2026-10-04
category: "single-cell_foundation model"
tags: [virtual-cell, single-cell, perturb-seq, VCC]
outline_key: single-cell-foundation-model-2-4
permalink: /Virtual-Cell/
redirect_from: /2026/10/04/virtual-cell-perturbation-prediction/
post_css:
  - /assets/posts/virtual-cell-perturbation-prediction/flow.css
---

## 从描述细胞，到预测干预

做单细胞分析时，我们通常从细胞 × 基因的 counts 矩阵出发，识别细胞类型、状态和差异表达。**虚拟细胞**多问一步：如果在一个已知细胞背景下施加尚未测过的干预，之后会测到什么？以 CRISPRi 敲低基因 G 为例，输入是对照细胞群和靶基因，输出是一群扰动后的细胞表达谱。预测的不只是 G 自己下降多少，还包括其他基因以及群体内部的响应差异。

[Perturb-seq](https://doi.org/10.1016/j.cell.2016.11.038)一类实验把干预身份与单细胞转录组联合测量，为这样的预测提供训练数据和隐藏真值。

<figure class="vc-concept">
  <div class="vc-flow" role="img" aria-label="同一细胞背景的一群对照细胞，加上指定的基因敲低，预测扰动后的一群细胞；输入和输出没有逐细胞配对关系。">
    <div class="vc-flow__card">
      <span class="vc-flow__label">已观测</span>
      <strong>对照细胞群</strong>
      <span class="vc-flow__detail">同一 context 的表达分布</span>
      <span class="vc-flow__dots" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
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
      <span class="vc-flow__dots" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
    </div>
  </div>
  <figcaption>任务示意。单细胞测序会破坏细胞，因此对照组与扰动组通常是两群未配对的细胞，而非同一颗细胞干预前后的两次测量；这一点也是 <a href="https://www.nature.com/articles/s41592-023-01969-x">CellOT</a> 的问题起点。</figcaption>
</figure>

这里的 **context** 不宜只读成一个细胞类型名称。对照细胞同时携带细胞身份、状态和实验背景的信息。给定新 context 的对照样本，却看不到它的扰动结果，模型就必须判断：哪些已学到的干预规律可以迁移，哪些响应会随着背景改变？

## 四篇论文，其实在解四种不同的“未见”

读方法图之前，先分清测试时究竟留出了什么。留出药物组合、留出靶基因、留出患者样本和留出细胞背景，都叫泛化，但不是同一道题。

| 方法 | 核心做法 | 论文重点检验的“未见” |
| --- | --- | --- |
| [CPA](https://doi.org/10.15252/msb.202211517) | 将基础细胞状态、干预和协变量拆成可组合的潜变量 | 已学习因素的新剂量、新组合或新搭配 |
| [GEARS](https://www.nature.com/articles/s41587-023-01905-6) | 用基因关系图为缺少实验的靶基因提供信息 | 未测过的基因扰动及多基因组合 |
| [CellOT](https://www.nature.com/articles/s41592-023-01969-x) | 从未配对的对照群到处理群学习传输映射 | 同一干预下的新对照细胞或样本 |
| [State](https://doi.org/10.1016/j.cell.2026.07.052) | 结合大规模细胞表征与细胞集合层面的状态转换 | 没有该背景扰动训练样本的新 context |

这张表只概括各论文展示得最清楚的测试设置，不给模型排总名次。下面顺着每张原论文图 1 看：**哪条箭头是预测任务，模型靠什么跨过它，证据又到哪里为止。** 点击图片可查看原尺寸。

### CPA：把“细胞本底＋干预＋背景”重新组合

<figure class="paper-figure vc-paper-figure">
  <a href="{{ '/assets/posts/virtual-cell-perturbation-prediction/cpa-fig1.png' | relative_url }}"><img src="{{ '/assets/posts/virtual-cell-perturbation-prediction/cpa-fig1.png' | relative_url }}" width="5537" height="2987" loading="lazy" alt="CPA 原论文图 1：表达谱编码为 basal state，移除干预和协变量信息后，再与剂量、扰动和背景向量组合并解码；右侧展示新条件预测。"></a>
  <figcaption>Lotfollahi 等，<a href="https://doi.org/10.15252/msb.202211517">CPA，Molecular Systems Biology（2023）</a>，图 1。图片取自<a href="https://github.com/facebookresearch/CPA/blob/main/Figure1.png">作者仓库</a>，按正式论文的 <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> 许可转载；未修改。</figcaption>
</figure>

[CPA（compositional perturbation autoencoder）](https://doi.org/10.15252/msb.202211517)图 1A 的主线是：表达谱进 encoder，得到所谓的 *basal state*；模型用判别器尽量去掉其中可辨认的干预和协变量信息，再把学到的药物、剂量与细胞背景向量加回去，由 decoder 重建表达谱。预测时，换掉干预向量，便得到一个反事实表达分布。图 1B 展示了这一可组合表示可用于剂量反应和新条件预测。

这类分解的好处是清楚：如果训练时见过药物 A、药物 B 和相关细胞背景，就能尝试把已学到的成分组合成未测的 A＋B 或新的剂量。论文在药物组合、时间、细胞类型及遗传组合等设置中评估了这种能力。**边界在于可组合的成分从哪里来**：普通 CPA 的新组合主要由已学习的干预表示构成；论文另加入化学结构表示后，才展示对完全未见药物的预测。不能把“新组合”直接等同于 VCC 中任意未见 CRISPRi 靶基因的零样本预测。

### GEARS：让未测过的靶基因从邻居获得信息

<figure class="paper-figure vc-paper-figure">
  <a href="{{ '/assets/posts/virtual-cell-perturbation-prediction/gears-fig1.png' | relative_url }}"><img src="{{ '/assets/posts/virtual-cell-perturbation-prediction/gears-fig1.png' | relative_url }}" width="1736" height="1701" loading="lazy" alt="GEARS 原论文图 1：对照表达与扰动基因进入共表达关系图、GO 扰动关系图，经图神经网络与跨基因层预测扰动后表达。"></a>
  <figcaption>Roohani 等，<a href="https://doi.org/10.1038/s41587-023-01905-6">GEARS，Nature Biotechnology（2024）</a>，图 1。图片取自<a href="https://www.nature.com/articles/s41587-023-01905-6/figures/1">出版方原图</a>，按 <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> 许可转载；未修改。</figcaption>
</figure>

[GEARS](https://www.nature.com/articles/s41587-023-01905-6)图 1a 明确写出输入和输出：给定对照细胞表达与待扰动基因集合，预测干预后的表达。图 1b 把中间计算拆为两条图：**基因共表达图**更新基因本身的表示，**Gene Ontology 关系图**更新“扰动某基因可能带来什么效应”的表示；图神经网络传播邻居信息，随后整合这些表示并逐基因输出预测值。

它解决的是一个实际缺口：没有某个基因的扰动实验时，仍可以借助其关系图邻居来估计响应。论文在单基因与双基因 Perturb-seq 数据中检验了未测过的靶基因和组合，也报告了遗传相互作用的预测结果。**图中的边是建模先验，不是实验确认的因果调控边**；而且“留出靶基因”与“留出整个细胞 context”是两种不同测试。论文中的基因泛化成绩本身，不能替代跨背景验证。

### CellOT：把两群未配对细胞当作分布来连接

<figure class="paper-figure vc-paper-figure">
  <a href="{{ '/assets/posts/virtual-cell-perturbation-prediction/cellot-fig1.png' | relative_url }}"><img src="{{ '/assets/posts/virtual-cell-perturbation-prediction/cellot-fig1.png' | relative_url }}" width="1828" height="899" loading="lazy" alt="CellOT 原论文图 1：未配对的对照与处理细胞群，通过最优传输映射相连，并应用到新的对照样本。"></a>
  <figcaption>Bunne 等，<a href="https://doi.org/10.1038/s41592-023-01969-x">CellOT，Nature Methods（2023）</a>，图 1。图片取自<a href="https://www.nature.com/articles/s41592-023-01969-x/figures/1">出版方原图</a>，按 <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> 许可转载；未修改。</figcaption>
</figure>

[CellOT](https://www.nature.com/articles/s41592-023-01969-x)图 1a 是两群样本：未处理细胞与已处理细胞，没有一对一的实验配对。图 1b–c 学的是将对照分布推到处理分布的映射；最优传输用“总体改变量尽量小”的准则，在许多可能的匹配中选一个。实现上，论文用输入凸神经网络表示对偶势，再取其梯度得到映射。图 1d 则把学到的映射用于新的对照样本。

这一思路保留了细胞间异质性：相同干预可以让不同起点的细胞产生不同结果。论文在药物、患者和跨物种数据中检验了预测。但 CellOT 通常为**每一种干预单独学习映射**，需要该干预的处理组样本；它对新对照样本的泛化，不能被读成对任意全新靶基因的零样本预测。还有一点更重要：图里的传输线是由最小代价假设推断出的对应关系，**不是测序直接拍到的单细胞生物轨迹**。

### State：对一组细胞预测一组细胞

<figure class="paper-figure vc-paper-figure">
  <a href="{{ '/assets/posts/virtual-cell-perturbation-prediction/state-fig1.jpg' | relative_url }}"><img src="{{ '/assets/posts/virtual-cell-perturbation-prediction/state-fig1.jpg' | relative_url }}" width="2917" height="1750" loading="lazy" alt="State 正式论文图 1：区分扰动效应、细胞异质性与技术噪声；SE 学细胞表征，ST 根据对照细胞集合和扰动条件预测扰动后细胞集合。"></a>
  <figcaption>Adduri 等，<a href="https://doi.org/10.1016/j.cell.2026.07.052">State，Cell（2026）</a>，图 1。图片取自<a href="https://ars.els-cdn.com/content/image/1-s2.0-S0092867426009219-gr1_lrg.jpg">出版方原图</a>，按正式版登记的 <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> 许可转载；未修改。</figcaption>
</figure>

[State](https://doi.org/10.1016/j.cell.2026.07.052)图 1A 把观测到的扰动结果拆成真实效应、细胞本身的异质性和技术噪声。图 1B–C 给出两层模型：State Embedding（SE）从大规模观测型单细胞数据学习细胞表示，State Transition（ST）接收对照细胞**集合**和扰动条件，预测扰动后的细胞集合；训练时按已知实验协变量组织细胞群，并在群体层面比较预测与观测分布。论文的 SE 使用约 1.67 亿观测细胞，ST 则使用超过 1 亿扰动细胞的数据。

这里的关键改变是预测单位：模型不只拟合“平均细胞的位移”，还要保留群体内差异。正式发表于 *Cell* 的论文报告，在所评估的大数据集上，State 对扰动效应的判别较基线改善超过 30%，并能在训练时没有扰动样本的细胞背景中识别强效干预。这是四篇中最贴近 VCC 2026 的跨 context 问题的证据，但它仍依赖大规模、可迁移的扰动训练数据；“能识别强效干预”也不等于每个基因的细微表达变化都预测准确。

## 为什么预训练表征仍不能代替扰动实验

[scGPT](https://www.nature.com/articles/s41592-024-02201-0)等模型说明，大规模观测型图谱可以帮助学习细胞状态表示；State 的 SE 也承担这个角色。但仅从“哪些基因在同一种细胞里常一起表达”，推不出“敲低 G 后哪些基因会改变”。后一种关系需要 Perturb-seq 等干预数据提供监督。可以从 [scPerturb](https://www.nature.com/articles/s41592-023-02144-y) 找到标准化的公开干预数据；[Tahoe-100M](https://arcinstitute.org/news/arc-vevo)则是大规模**药物**扰动资源，药物处理与 CRISPRi 靶基因敲低不能直接视为同一种条件。

四张图也提示了两个容易混淆的“状态”。CPA 的 *basal state* 是为重组干预效果而学习的潜变量；State 的 SE 是供预测使用的细胞表征。它们都是模型内部的表示，不能直接当作实验确认的生理稳态或完整基因调控网络。

## 放回 VCC 2026：真正留出的是什么

| 赛季 | 模型能看到什么 | 主要要跨越什么 |
| --- | --- | --- |
| 2025 | H1 人胚胎干细胞中一部分靶基因的扰动数据 | 同一细胞背景里，预测未见靶基因的响应 |
| 2026 | 新细胞背景的未扰动对照细胞和靶基因列表；没有赛事专属的扰动训练集 | 在没有该背景扰动样本的条件下，预测新背景中的响应 |

[Arc 的 2025 回顾](https://arcinstitute.org/news/virtual-cell-challenge-2025-wrap-up)指出，首届强方法常结合深度学习、公开扰动数据和统计特征，单纯扩大模型并不保证胜过简单基线。[VCC 2026 任务](https://arcinstitute.org/news/virtual-cell-challenge-2026)进一步要求跨 context 的 zero-shot 预测：六条不同来源的细胞系中，三条用于 validation，另三条用于 final test。此处“未见”主要指**该背景的扰动结果未见**；新背景的对照细胞仍提供了基线分布。

按 [VCC CLI](https://vcc-cli-wiki.virtualcellchallenge.org/) 的 validation 提交说明，每个 context 与靶基因需要恰好 400 个预测细胞，采用官方 18,533 基因面板并输出非负整数的原始 counts。于是只预测一个不错的平均向量还不够：模型还得交出一群像单细胞测序结果的细胞。CellOT 和 State 的图，都能帮助理解为什么这里要从“一个点”走向“一个分布”。

## 怎样判断预测像不像一场真实实验

一组预测细胞可以先汇总成 pseudo-bulk，与实测组比较平均响应；但差异表达还取决于每个基因在两群细胞中的**分布**。如果所有预测细胞都几乎相同，即使均值接近真实值，它们的离散度、零值比例和统计检验出的显著基因也可能失真。

[VCC 2026 官方指标](https://github.com/ArcInstitute/cell-eval2/blob/main/docs/vcc2026_metrics/vcc2026-metrics.md)从六个角度检查预测：扰动判别、整体表达误差、差异表达基因集合的重合、显著基因的 log fold change 误差、上调/下调方向的正确性，以及模型最有把握的方向预测是否可靠。它们分别追问“扰动信号有没有”“平均表达及逐基因差异表达是否匹配”“方向是否可靠”，不能由一个均值误差代替；这组指标也没有完整检验多基因联合分布与所有异质性。

官方还用两个参照点标准化分数：**0 对应基线预测，1 对应真实实验细胞的 split-half 拆半一致性水平**。这里的 split-half 是把同一实验条件下的细胞分成互不重叠的两半比较，并非独立的生物学重复。所以 1 不是数学满分，分数也不是“预测正确百分比”。评价任何模型时，要同时报清楚留出的对象、干预类型、细胞背景以及指标；不同论文里的单个百分比并不能直接横向排名。

## 读完四张图，应该留下什么判断

这些方法并不是在争同一种“万能模型”：CPA 擅长重组已学因素，GEARS 借关系图推未测靶基因，CellOT 从两群未配对细胞学习转移，State 则把大规模细胞表示与群体预测用于跨背景任务。它们分别解决了扰动预测的一部分难题，也各自规定了能泛化到哪里。

VCC 2026 把几道难题叠在一起：给定新背景的对照群，预测指定 CRISPRi 敲低后，在规定测量条件下会观察到的细胞群。成绩好说明模型在这一类终点测量中更有预测力；**它仍不能单凭两个快照证明模型恢复了真实的细胞内因果过程或干预后的时间轨迹。**

### 论文与任务资料

- [Lotfollahi et al., CPA，*Molecular Systems Biology*（2023）](https://doi.org/10.15252/msb.202211517)：可组合的潜空间扰动模型。
- [Roohani et al., GEARS，*Nature Biotechnology*（2024）](https://www.nature.com/articles/s41587-023-01905-6)：图关系辅助未测基因和组合扰动预测。
- [Bunne et al., CellOT，*Nature Methods*（2023）](https://www.nature.com/articles/s41592-023-01969-x)：从未配对群体学习最优传输映射。
- [Adduri et al., State，*Cell*（2026）](https://doi.org/10.1016/j.cell.2026.07.052)：细胞集合建模与跨背景扰动预测。
- [Cui et al., scGPT，*Nature Methods*（2024）](https://www.nature.com/articles/s41592-024-02201-0)：观测型单细胞预训练的代表。
- [Arc Institute，VCC 2026 任务说明](https://arcinstitute.org/news/virtual-cell-challenge-2026)与[官方评分规范](https://github.com/ArcInstitute/cell-eval2/blob/main/docs/vcc2026_metrics/vcc2026-metrics.md)：任务设置和指标的更新来源。

---
title: "从中心法则到蛋白质设计：AI4Protein 的任务谱与读数指南"
description: "蛋白质为什么值得建模、它有哪些可以喂给模型的特征、折叠与逆折叠各自在解什么题，以及 pLDDT、ipTM、QED 这些数字该怎么读。"
date: 2026-10-06
category: "protein_foundation model"
tags: [protein, AlphaFold, protein-design, inverse-folding, ESM]
outline_key: protein-foundation-model-1-1
permalink: /AI4Protein/
post_css:
  - /assets/posts/ai4protein-landscape/figures.css
---

单细胞领域习惯把细胞看成一个表达向量；蛋白质领域的建模对象更具体：一条有确定化学组成的链，它会折叠成一个有确定几何的三维物体，而这个物体能做事——催化反应、识别抗原、开关离子通道。这条"序列→结构→功能"的链条足够清楚，又在每一环都留着没解决的问题，所以它成了机器学习近五年最密集的应用场之一。

这篇文章想回答四个问题：蛋白质在生物学里处在什么位置；它有哪些可以当作模型输入或输出的**特征**；AI4Protein 具体被切成了哪些任务、各自有哪些代表模型；以及读论文时遇到的 pLDDT、ipTM、QED 这类数字该怎么解释。

## 一条链，从基因到功能

遗传信息的流向是这样的：DNA 转录成 mRNA，mRNA 在核糖体上按三联密码子翻译成氨基酸链，这条链折叠成特定的三维构象，构象决定它能结合什么、催化什么。

<figure class="ap-fig">
  <div class="ap-dogma" role="img" aria-label="信息从 DNA 到 mRNA 到多肽链到三维结构再到功能的四个层级，每一级有不同的机器可读表示：核苷酸串、密码子、氨基酸串、原子坐标。">
    <div class="ap-dogma__card">
      <span class="ap-dogma__level">基因</span>
      <strong>DNA</strong>
      <span class="ap-dogma__repr"><b>表示</b>：4 字母核苷酸串；编码区以 3 个碱基为一个密码子</span>
    </div>
    <div class="ap-dogma__step"><span>→</span><span>转录</span></div>
    <div class="ap-dogma__card">
      <span class="ap-dogma__level">转录本</span>
      <strong>mRNA</strong>
      <span class="ap-dogma__repr"><b>表示</b>：4 字母序列；剪接决定最终读框</span>
    </div>
    <div class="ap-dogma__step"><span>→</span><span>翻译</span></div>
    <div class="ap-dogma__card">
      <span class="ap-dogma__level">一级结构</span>
      <strong>多肽链</strong>
      <span class="ap-dogma__repr"><b>表示</b>：20 字母氨基酸串，长度 L；这就是蛋白质语言模型的 token 序列</span>
    </div>
    <div class="ap-dogma__step"><span>→</span><span>折叠</span></div>
    <div class="ap-dogma__card">
      <span class="ap-dogma__level">三级 / 四级结构</span>
      <strong>三维构象</strong>
      <span class="ap-dogma__repr"><b>表示</b>：原子坐标（L×3 骨架或全原子）、残基距离图 L×L</span>
    </div>
  </div>
  <figcaption>信息层级与它们各自的机器可读表示。AI4Protein 的大部分任务，本质上是在这张图相邻两级之间建立映射，或者在给定一级的条件下生成另一级。</figcaption>
</figure>

有一个常见的术语误用值得先澄清。[Crick 1970 年在 *Nature* 上写的"central dogma"](https://doi.org/10.1038/227561a0)，原意是**序列信息一旦进入蛋白质就不能再流回核酸**，它约束的是信息传递的方向性，而不是上图这个"DNA→RNA→蛋白质"的流程口号。后者更准确的叫法是基因表达的标准流程。逆转录病毒把 RNA 信息写回 DNA，并不违反 Crick 的原始命题。

真正支撑 AI4Protein 的那条假设来自另一篇文章：[Anfinsen 1973 年的 *Science* 论文](https://doi.org/10.1126/science.181.4096.223)提出，在生理条件下，蛋白质的天然构象由它的氨基酸序列唯一决定，对应自由能最低的状态。**这就是"从序列预测结构"在原理上可行的依据**——如果结构还依赖序列之外的隐藏变量，单靠序列输入的模型就不可能做对。

这条假设成立得很好，但不是无条件的。有相当比例的真核蛋白含**内在无序区**（intrinsically disordered region, IDR），它们在生理条件下不采取单一稳定构象；部分蛋白需要**分子伴侣**（chaperone）辅助才能折到正确状态，体外单靠序列会错折或聚集；还有些蛋白在结合配体前后构象明显不同（apo 与 holo 形态）。所以"序列决定结构"更准确的读法是：序列决定了一个构象分布，而实验结构往往只拍到了其中一个代表。后面讲指标时会看到，这个区别直接影响怎么解释 pLDDT。

### 为什么偏偏是蛋白质

功能的多样性是蛋白质值得单独建模的原因。同一套 20 字母表写出来的链，承担着细胞里几乎所有执行层面的工作：

| 功能类别 | 做什么 | 例子 |
| --- | --- | --- |
| 酶 | 催化化学反应，把反应速率提高若干个数量级 | 蛋白酶、聚合酶、激酶 |
| 受体与信号 | 接收胞外信号并向胞内传递 | GPCR、胰岛素受体 |
| 免疫识别 | 以高特异性结合外来分子 | 抗体、MHC、T 细胞受体 |
| 结构支撑 | 提供细胞与组织的力学骨架 | 胶原、肌动蛋白、微管蛋白 |
| 转运与通道 | 跨膜或在体内搬运物质 | 血红蛋白、离子通道、转运体 |
| 基因调控 | 结合 DNA 决定哪些基因被表达 | 转录因子、组蛋白修饰酶 |

这张表也解释了产业上的兴趣：**绝大多数已上市药物的作用靶点是蛋白质**，而抗体类药物本身就是蛋白质。能预测结构意味着能看清口袋；能设计序列意味着能造出结合物。这是 AI4Protein 和单细胞表征学习在动机上的一个差别——后者主要服务于理解与分型，前者从一开始就带着"造一个能用的分子"的工程目标。

## 可以喂给模型的特征有哪些

"蛋白质的 feature"不是一个单一答案。同一个蛋白在不同任务里会以完全不同的形态进入模型，下面这张表按"模型实际拿到什么张量"来组织。

<div class="ap-wide" markdown="1">

| 特征 | 形态 | 从哪来 | 谁在用 |
| --- | --- | --- | --- |
| 一级序列 | 长度 L 的 20 字母 token 串 | [UniProt](https://doi.org/10.1093/nar/gkac1052) 等序列库 | 所有蛋白质语言模型 |
| 多序列比对（MSA） | N×L 的同源序列矩阵 | 对序列库做同源搜索（jackhmmer、HHblits、MMseqs2） | AlphaFold2、RoseTTAFold |
| 共进化统计 | L×L 的残基对耦合强度 | 从 MSA 统计得到 | AF2 之前的接触预测方法 |
| 二级结构 | 每残基 3 类或 8 类标签（螺旋/折叠/环） | 由三维结构用 DSSP 一类工具标注 | 早期预测任务、辅助监督 |
| 骨架坐标 | L×3（Cα）或 L×4×3（N、Cα、C、O） | [PDB](https://doi.org/10.1093/nar/28.1.235) 实验结构 | 逆折叠、骨架生成模型 |
| 全原子坐标 | 变长，含侧链与配体 | PDB | AlphaFold3、对接与亲和力模型 |
| 距离图／接触图 | L×L 矩阵 | 由坐标导出 | 结构预测的中间表示 |
| 结构模板 | 同源已知结构的坐标 | PDB 检索 | AF2 的 template 通道 |
| 复合物拓扑 | 多链的链间接触与界面 | PDB 中的多聚体条目 | AlphaFold-Multimer、复合物预测 |
| 功能注释 | GO term、EC 编号、Pfam 域 | UniProt、InterPro | 功能预测、ESM3 的功能模态 |
| 突变适应度 | 每个单点突变的实验读数 | 深度突变扫描（DMS）实验 | 变异效应预测、[ProteinGym](https://proceedings.neurips.cc/paper_files/paper/2023/hash/cac723e5ff29f65e3fcbb0739ae91bee-Abstract.html) |
| 构象动态 | MD 轨迹、B-factor、多个实验构象 | 模拟或多次实验测定 | 动态建模，目前仍是薄弱环节 |
| 配体与环境 | 口袋内的小分子、金属离子、辅因子 | PDB 的 hetero 原子记录 | [LigandMPNN](https://doi.org/10.1038/s41592-025-02626-1)、AlphaFold3 |

</div>

这张表里有一行值得单独说：**MSA**。它是蛋白质相对自然语言的结构性优势。

把一个蛋白的同源序列从各个物种收集起来对齐，就得到了一份跨越亿年的天然突变实验记录。如果两个残基在三维空间里相互接触，那么其中一个发生了破坏性突变时，另一个往往需要一个补偿性突变来维持结构——于是这两列在 MSA 中呈现统计相关。**从序列的共进化模式，可以反推出空间上的邻近关系**，这是深度学习之前接触预测方法的理论基础，也是 AlphaFold2 把 MSA 作为一等输入的原因。换句话说，蛋白质数据自带一份免费的、关于三维邻接的弱标注，而一段英文句子没有这种东西。

代价是 MSA 并非总能拿到。孤儿蛋白、人工设计的序列、快速演化的病毒蛋白，可能根本找不到足够深的同源序列；而同源搜索本身在流程里往往是最耗时的一步。这个代价直接催生了后面要讲的单序列路线。

数据规模上有一个不对称值得记住：实验测定的结构数量远少于已知序列数量。PDB 累积的实验结构在十万量级，而序列库里的蛋白条目在亿级。[AlphaFold 蛋白结构数据库](https://doi.org/10.1093/nar/gkab1061)和 ESM Atlas 用预测结构填补了这个缺口——但要清楚，**这些是模型输出，不是实验观测**，把它们当训练数据会把上游模型的系统偏差一并继承下去。

## 任务谱：预测向前，设计向后

把 AI4Protein 的任务铺开，会发现它们都落在"序列、结构、功能"这三个顶点之间。有一个简洁的规律可以用来记：**预测类任务沿着自然的因果方向走，设计类任务反着走。**

<figure class="ap-fig">
  <div class="ap-tasks">
    <svg viewBox="0 0 860 440" role="img" aria-labelledby="apTitle apDesc">
      <title id="apTitle">AI4Protein 任务谱：序列、结构、功能三者之间的映射</title>
      <desc id="apDesc">序列、结构、功能构成三个顶点。实线箭头是预测方向：序列到结构是折叠，序列到功能是适应度与变异效应预测，结构到功能是结合、对接与功能注释。虚线箭头是设计方向：结构到序列是逆折叠，以及从无条件采样直接生成结构。</desc>
      <defs>
        <marker id="apArr" markerWidth="9" markerHeight="9" refX="7.5" refY="4.5" orient="auto">
          <path d="M1 1 L8 4.5 L1 8 Z" fill="var(--muted)"/>
        </marker>
        <marker id="apArrG" markerWidth="9" markerHeight="9" refX="7.5" refY="4.5" orient="auto">
          <path d="M1 1 L8 4.5 L1 8 Z" fill="var(--gold)"/>
        </marker>
      </defs>

      <path class="ap-gen" d="M700 44 L700 84" marker-end="url(#apArrG)"/>
      <text class="ap-tlabel" x="700" y="30" text-anchor="middle">从头生成（无条件采样）</text>

      <path class="ap-edge" d="M270 114 L586 114" marker-end="url(#apArr)"/>
      <text class="ap-tlabel" x="428" y="104" text-anchor="middle">折叠 folding</text>
      <path class="ap-gen" d="M590 150 L274 150" marker-end="url(#apArrG)"/>
      <text class="ap-tlabel" x="432" y="169" text-anchor="middle">逆折叠 inverse folding</text>

      <path class="ap-edge" d="M176 177 L366 323" marker-end="url(#apArr)"/>
      <text class="ap-tlabel" x="250" y="244" text-anchor="end">适应度与</text>
      <text class="ap-tlabel" x="250" y="262" text-anchor="end">变异效应预测</text>

      <path class="ap-edge" d="M684 177 L494 323" marker-end="url(#apArr)"/>
      <text class="ap-tlabel" x="610" y="244" text-anchor="start">结合、对接</text>
      <text class="ap-tlabel" x="610" y="262" text-anchor="start">与功能注释</text>

      <rect class="ap-node ap-node-seq" x="55" y="90" width="210" height="82" rx="10"/>
      <text class="ap-nlabel" x="160" y="123" text-anchor="middle">序列</text>
      <text class="ap-nsub" x="160" y="146" text-anchor="middle">20 字母氨基酸串</text>

      <rect class="ap-node ap-node-str" x="595" y="90" width="210" height="82" rx="10"/>
      <text class="ap-nlabel" x="700" y="123" text-anchor="middle">结构</text>
      <text class="ap-nsub" x="700" y="146" text-anchor="middle">原子三维坐标</text>

      <rect class="ap-node ap-node-fun" x="325" y="330" width="210" height="82" rx="10"/>
      <text class="ap-nlabel" x="430" y="363" text-anchor="middle">功能</text>
      <text class="ap-nsub" x="430" y="386" text-anchor="middle">催化、结合、稳定性</text>
    </svg>
  </div>
  <figcaption>实线是预测方向，虚线是设计方向。实际的设计流程通常把虚线串起来用：先按功能需求生成一个骨架，再逆折叠出能折成该骨架的序列，最后用一个折叠模型回头验证——这条链解释了后面"自洽性指标"的来历。</figcaption>
</figure>

下面按这张图的五条边展开。每个任务先说清**输入是什么、输出是什么、靠什么跨过中间那一步**，再说它的边界在哪。

### 折叠：序列 → 结构

这是领域的标志性任务，也是 2021 年之后变化最大的一块。

[AlphaFold2](https://doi.org/10.1038/s41586-021-03819-2) 的输入是目标序列加上检索到的 MSA 与结构模板。核心模块 Evoformer 把 MSA 表示和残基对表示交替更新：MSA 的列间统计影响残基对的几何判断，几何判断又回头修正对 MSA 的解读；这个来回进行 48 层。随后 structure module 直接输出所有残基的骨架框架与侧链扭转角，并且把预测结构再喂回网络循环数次（recycling）。它在 CASP14 的单域目标上取得了中位 GDT_TS 92.4，[这个成绩在历届 CASP 评估中是第一次达到](https://doi.org/10.1002/prot.26237)。

[RoseTTAFold](https://doi.org/10.1126/science.abj8754) 几乎同期给出了三轨道（序列、残基对、三维坐标同时更新）的方案，确立了开源侧的技术路线。

[ESMFold](https://doi.org/10.1126/science.ade2574) 换了一条路：**不做同源搜索，只输入单条序列**。它用 150 亿参数的 ESM-2 语言模型把序列编码成每残基表示，再接一个折叠头输出坐标。论文的结论是，当语言模型规模放大到一定程度，三维结构的信息会在表示里自然浮现；在语言模型困惑度低的序列上精度接近 AF2，推理速度快一个数量级。代价很直接——**对语言模型不熟悉的序列，精度下降明显**，MSA 带来的那份进化证据不是白拿的。

[AlphaFold3](https://doi.org/10.1038/s41586-024-07487-w) 把架构换成了扩散模型，预测对象从"蛋白单体"扩展到蛋白、核酸、小分子、离子和修饰残基的联合结构。论文报告它在蛋白–配体相互作用上显著超过传统对接工具，在蛋白–核酸上超过专用预测器，抗体–抗原精度也明显高于 AlphaFold-Multimer v2.3。这种"把什么都放进同一个模型一起折"的做法，现在一般叫 **co-folding**。

开源侧跟进得很快。[Boltz-1](https://doi.org/10.1101/2024.11.19.624167) 是第一个以 MIT 协议完全开放、达到 AF3 报告精度水平的复合物模型；[RoseTTAFold All-Atom](https://doi.org/10.1126/science.adl2528) 则把全原子与配体建模并入 RoseTTAFold 体系。

<div class="ap-wide" markdown="1">

| 模型 | 输入 | 关键机制 | 输出 |
| --- | --- | --- | --- |
| AlphaFold2 | 序列 + MSA + 模板 | Evoformer 交替更新 MSA 与残基对表示，recycling | 全原子单体结构 + pLDDT/PAE |
| RoseTTAFold | 序列 + MSA | 序列、残基对、坐标三轨道同时更新 | 单体结构，可扩展到复合物 |
| ESMFold | 单条序列 | 15B 蛋白质语言模型表示 + 折叠头，无同源搜索 | 全原子结构 + pLDDT |
| AlphaFold3 | 序列 + 核酸 + 配体 + 离子 | 扩散式结构生成，统一建模多种分子 | 复合物全原子结构 + pLDDT/PAE/ipTM |
| Boltz-1 / Boltz-2 | 同上 | AF3 路线的开源实现，Boltz-2 加亲和力预测头 | 复合物结构，Boltz-2 另给结合亲和力 |

</div>

### 逆折叠：结构 → 序列

给定一个骨架几何，问哪些氨基酸序列能折成它。这是设计流程的核心一环，因为生成模型通常先给出骨架，而实验室能合成的是序列。

[ProteinMPNN](https://doi.org/10.1126/science.add2187) 把骨架当成一张图：节点是残基，边由空间距离和相对朝向构成，消息传递之后逐位置输出 20 类氨基酸的概率分布，按一定顺序自回归地解码。它的实用性来自两点——速度快，以及设计出的序列在湿实验里表达和折叠的成功率明显高于此前基于物理能量函数的方法。

[ESM-IF](https://www.biorxiv.org/content/10.1101/2022.04.10.487779) 走的是数据放大路线：用 AlphaFold2 预测的约一千二百万个结构作为训练数据，弥补实验结构数量不足的问题。[LigandMPNN](https://doi.org/10.1038/s41592-025-02626-1) 则补上了 ProteinMPNN 忽略的东西——口袋里的小分子、金属离子和辅因子。对于酶和结合蛋白，这些非蛋白原子恰恰决定了活性位点该放什么残基。

需要注意逆折叠输出的性质：它给的是**与目标几何相容的序列**，不是**一定具有目标功能的序列**。几何相容是必要条件，不是充分条件。

### 蛋白质语言模型：序列自身的表示

这一类不直接对应图上某条边，而是为其他任务提供底层表示。做法基本平移自 NLP：把氨基酸当 token，在大规模序列库上做自监督。

[ESM-1b](https://doi.org/10.1073/pnas.2016239118) 确立了"掩码语言建模能学到生物结构与功能信息"这个结论，[ESM-2](https://doi.org/10.1126/science.ade2574) 把规模推到 150 亿参数并直接支撑了 ESMFold。[ProtTrans](https://doi.org/10.1109/tpami.2021.3095381) 系统比较了多种 Transformer 架构在蛋白序列上的迁移效果。[ProGen](https://doi.org/10.1038/s41587-022-01618-2) 换成自回归生成并加入功能标签作为控制条件，论文报告生成的人工溶菌酶经实验测定具有催化活性，尽管序列与天然酶相似度很低。

[ESM3](https://doi.org/10.1126/science.ads0018) 是一个方向上的变化：它把序列、结构、功能都离散成 token，在三种模态上联合做掩码生成。这意味着同一个模型可以在任意模态组合上做条件生成——给定部分结构和功能描述，补全序列。论文最受关注的实验是生成了一个与已知荧光蛋白序列相似度仅 58% 的新荧光蛋白，作者用"相当于五亿年自然演化距离"来描述这个差距。

这里有个常被忽略的点：**蛋白质语言模型的"零样本"能力有明确的生物学解释，而不只是涌现**。模型在大量同源序列上训练后，对某个位置给出的概率分布，近似反映了演化对该位置的约束强度。约束强的位置发生突变更可能有害——所以用模型给突变打的对数似然比，可以直接当作适应度预测，不需要任何该蛋白的实验标签。

### 从头设计：生成一个自然界没有的蛋白

这条边最接近工程目标：不是解释已有的蛋白，而是造一个满足指定要求的新蛋白。

[RFdiffusion](https://doi.org/10.1038/s41586-023-06415-8) 的做法是把 RoseTTAFold 在"结构去噪"任务上微调，得到一个蛋白骨架的扩散生成模型。从随机噪声出发逐步去噪，可以无条件采样出新骨架；也可以加条件——固定一个活性位点的若干残基，让模型生成能把这些残基摆到正确相对位置的骨架，这个任务叫 **motif scaffolding**；或者指定一个靶标表面，生成能贴合它的结合蛋白，这叫 **binder design**。

[Chroma](https://doi.org/10.1038/s41586-023-06728-8) 提供了另一套可编程的生成框架，允许用对称性、形状、二级结构组成等约束来引导采样。[FoldingDiff](https://doi.org/10.1038/s41467-024-45051-2) 把骨架表示成残基间的二面角序列再做扩散，是另一种参数化思路。2025 年，[RFdiffusion 被扩展到抗体设计](https://doi.org/10.1038/s41586-025-09721-5)，论文报告了原子级精度的从头抗体设计结果。

实践中这些模型很少单独使用。标准流程是一条流水线：

1. **生成骨架** —— RFdiffusion 按功能约束采样出三维骨架；
2. **设计序列** —— ProteinMPNN 或 LigandMPNN 为该骨架给出候选序列；
3. **计算机内验证** —— 用 AlphaFold2 或 ESMFold 把候选序列折回去，看是否重现了第 1 步的骨架；
4. **湿实验** —— 只有通过第 3 步筛选的少数候选才会真的去表达、纯化和测亲和力。

第 3 步是整条流水线的质量闸门，也是**自洽性指标**（self-consistency）的来源：没有真值结构可比，就用"另一个独立模型是否同意"作为代理。这个代理有明显的局限——两个模型可能共享同样的偏差，于是一致地错。后面讲指标时会回到这点。

### 复合物与相互作用：功能发生在界面上

蛋白质很少单独工作。抗体识别抗原、酶结合底物、受体接配体，都发生在两个分子的界面上，而界面预测比单体折叠难得多。

AlphaFold-Multimer 把 AF2 扩展到多链输入，并引入了专门衡量界面质量的 ipTM。AlphaFold3 与 Boltz 系列进一步把小分子、核酸纳入同一次预测。Boltz-2 在结构之外加了结合亲和力预测头，官方介绍称其精度接近基于物理的自由能扰动计算，而速度快约三个数量级。

但这块的真实水平需要独立评估来校准。CASP16 的复合物评估给出的结论相当克制：[复合物结构预测仍然是未解决的问题，即使最好的参赛组也只有略超过一半的目标达到高精度](https://pmc.ncbi.nlm.nih.gov/articles/PMC12750043/)。对照同一届的单体评估——[单域折叠已接近解决，所有评估单元中没有出现折叠类型被预测错的目标](https://pmc.ncbi.nlm.nih.gov/articles/PMC12750037/)——这个落差是目前领域最清楚的一条分界线：**单体折叠基本做完了，界面还没有。**

## 指标怎么读

这一节值得单独展开，因为这些数字最容易被误读，而误读的方向通常是过于乐观。

关键的区分只有一条：**有些指标是模型对自己的信心，有些是跟真值比出来的误差，还有些只是两个模型互相同意。** 它们完全不是一回事。

### 第一类：模型自报的置信度

这些数字不需要知道真实结构就能算出来，因为它们是模型预测的"我大概错多少"。[AlphaFold3 的官方输出文档](https://github.com/google-deepmind/alphafold3/blob/main/docs/output.md)对每一项都有明确定义：

<div class="ap-wide" markdown="1">

| 指标 | 范围 | 衡量什么 | 怎么读 |
| --- | --- | --- | --- |
| **pLDDT** | 0–100，越高越好 | 每个原子的局部结构预测精度 | >90 很高，可用于细节分析；70–90 可信，骨架大致正确；50–70 低，谨慎使用；<50 很低，通常是无序区 |
| **PAE** | 0–32 Å，越低越好 | 两个 token 之间相对位置与朝向的预期误差 | 以矩阵形式看。块状低值说明域内部可靠，域之间高值说明相对摆放不确定 |
| **pTM** | 0–1，越高越好 | 整体折叠的预测准确度 | >0.5 整体折叠可能与真实结构相似。对短链过于严苛，少于 20 个 token 时会给出低于 0.05 的值 |
| **ipTM** | 0–1，越高越好 | 链间界面的预测准确度 | >0.8 为可信的高质量界面，<0.6 提示预测失败，0.6–0.8 是灰区 |
| **ranking_score** | −100 到 1.5 | 用于在多个预测之间排序的组合分 | 公式为 0.8×ipTM + 0.2×pTM + 0.5×disorder − 100×has_clash。官方明确说明：**只用于排序，不能当作绝对质量评估** |

</div>

几个容易踩的坑：

**pLDDT 高不等于这个蛋白有用。** 它衡量的是模型对自己几何预测的信心，和这条序列能否在细胞里表达、能否正确折叠、是否具有目标功能都没有直接关系。设计出的序列拿到 pLDDT 95，只说明折叠模型觉得这个几何很确定。

**pLDDT 低有时就是正确答案。** 内在无序区本来就没有单一构象，模型给出低 pLDDT 是如实反映了这一点，而不是预测失败。把低 pLDDT 区域一律当作错误并删掉，会丢掉真实的生物学信息。

**ipTM 有已知的系统性缺陷。** [Dunbrack 在 2025 年的一篇文章](https://doi.org/10.1101/2025.02.10.637595)指出，ipTM 的计算会把大量实际并不接触的残基对也算进去——比如一条链的无序区与另一条链的任何残基。结果是：当两条链都含有较多无序区时，即使界面本身预测得完全一样，ipTM 也会明显下降；把全长序列裁剪成只保留相互作用的域，ipTM 反而会升高。该文提出的 ipSAE 只保留 PAE 良好的残基对参与计算，报告称区分真假复合物的效果优于原始 ipTM。所以看到一个偏低的 ipTM，**先确认构建体里有没有大段无序区**，再判断是不是界面真的不行。

### 第二类：跟真值比较的结构相似度

这些需要实验测定的结构作为参照，是 CASP 一类评估和论文报告精度时用的量。

| 指标 | 范围 | 特点 |
| --- | --- | --- |
| **lDDT** | 0–1 或 0–100 | [Mariani 等 2013 年提出](https://doi.org/10.1093/bioinformatics/btt473)，比较所有原子间距离的差异，**不需要做整体叠合**，因此不受域间运动影响，适合评估局部质量。pLDDT 就是对它的预测 |
| **TM-score** | 0–1 | [Zhang 与 Skolnick 2004 年提出](https://doi.org/10.1002/prot.20264)，对长度做了归一化。经验阈值：>0.5 通常认为属于同一折叠类型，<0.17 相当于随机 |
| **GDT-TS** | 0–100 | CASP 的传统主指标，统计在若干距离阈值下能叠合上的残基比例。AF2 在 CASP14 的中位 92.4 就是这个数 |
| **RMSD** | ≥0 Å，越低越好 | 最直观，但对单个离群区域极其敏感，且不做长度归一化，跨蛋白横向比较意义有限 |

实践上的经验是：**报告精度时 RMSD 单独给出来说服力最弱**，因为一个柔性尾巴就能让整体 RMSD 变得很差，而蛋白的核心可能完全正确。TM-score 和 lDDT 更稳健。

### 第三类：设计任务的自洽性

设计出的蛋白没有实验结构可比，于是用模型间的一致性作代理：

- **scRMSD / scTM**（self-consistency RMSD / TM-score）：把设计序列用折叠模型预测结构，和原始目标骨架比。常用的通过标准是 scRMSD < 2 Å。
- **designability**：一个生成骨架能否找到至少一条序列，使其折回去后自洽。
- **diversity / novelty**：生成样本之间的相互差异，以及与 PDB 中已有结构的最大相似度——用来检查模型是不是只会复述训练集。

这一类指标必须和**湿实验命中率**（hit rate，设计候选中实验验证成功的比例）一起看。计算机内的自洽通过率可以做到很高，而真正表达、折叠、有活性的比例要低得多。只报告 scRMSD 通过率的设计论文，证据链是不完整的。

### 第四类：功能、适应度与小分子

| 指标 | 用在哪 | 说明 |
| --- | --- | --- |
| **Spearman ρ** | 变异效应预测 | 预测分数与深度突变扫描实验读数的秩相关。[ProteinGym](https://proceedings.neurips.cc/paper_files/paper/2023/hash/cac723e5ff29f65e3fcbb0739ae91bee-Abstract.html) 汇集了 250 多个 DMS 实验作为标准测试集 |
| **AUROC** | 致病性变异分类 | 区分临床注释的致病与良性变异 |
| **K<sub>D</sub> / IC<sub>50</sub>** | 结合强度 | 湿实验测定的解离常数与半数抑制浓度，单位常为 nM。这是设计类工作最硬的证据 |
| **QED** | 小分子药物相似性 | [Bickerton 等 2012 年提出](https://doi.org/10.1038/nchem.1243)，把分子量、logP、氢键供受体数、极性表面积、可旋转键数、芳环数和不良子结构警报共八个性质映射成期望度再做几何平均，输出 0–1 |
| **SA score** | 小分子合成难度 | 估计一个分子合成的难易程度，常与 QED 一起用于过滤生成的分子 |

关于 **QED** 要特别说明：它是**小分子**的指标，不是蛋白质的指标。它出现在 AI4Protein 的语境里，通常是因为工作涉及小分子配体的生成或筛选——比如基于口袋结构设计配体。用 QED 评价一个蛋白设计是范畴错误。另外 QED 本身只是一个与口服小分子药物典型性质分布的相似度，它高不代表有活性，也不代表安全。

## 术语速查

读这个领域的论文会密集遇到下面这些词。

<div class="ap-wide" markdown="1">

| 术语 | 含义 |
| --- | --- |
| residue（残基） | 肽链中的一个氨基酸单元。蛋白长度一般以残基数计 |
| backbone（骨架） | 每个残基的 N、Cα、C、O 主链原子，决定整体走向 |
| side chain（侧链） | 残基的可变部分，决定化学性质与具体相互作用 |
| secondary structure | 局部规则构象，主要是 α 螺旋与 β 折叠 |
| domain（域） | 能独立折叠的结构单元，一个蛋白可以有多个 |
| fold（折叠类型） | 域的整体拓扑分类 |
| motif | 一小段有特定功能或几何意义的残基模式，如活性位点 |
| scaffold（支架） | 承载 motif 的其余结构部分；motif scaffolding 即为给定 motif 设计支架 |
| binder | 为结合指定靶标而设计的蛋白；较小的叫 minibinder |
| epitope（表位） | 抗原上被抗体识别的那一小块区域 |
| apo / holo | 未结合配体 / 已结合配体的两种构象状态 |
| IDR / IDP | 内在无序区 / 内在无序蛋白，不采取单一稳定构象 |
| MSA | 多序列比对，同源序列按列对齐后的矩阵 |
| co-folding | 把蛋白与配体、核酸等放在一次预测里联合建模 |
| recycling | 把预测结果重新输入网络再预测若干轮，AF2 的标准做法 |
| hallucination | 在蛋白设计语境中特指：固定目标性质，反向优化输入序列直到模型输出满足要求 |
| zero-shot | 不使用该蛋白任何实验标签直接预测，常见于用语言模型似然预测突变效应 |
| DMS | 深度突变扫描，系统测定大量单点突变的功能读数 |
| Å（埃） | 0.1 纳米。原子间距与结构误差的常用单位 |

</div>

## 2026 年的位置：还有哪些没做完

把前面的内容合起来看，目前的边界比较清楚地分成几条。

**单体折叠与界面预测的落差。** 这是 CASP16 给出的最直接判断，前面已经引过：单域折叠接近解决，复合物仍未解决。同一届评估还注意到，AlphaFold3 在发布后被很多参赛组接入使用，[它相对 AF2 的提升主要体现在置信度估计和模型选择上](https://pmc.ncbi.nlm.nih.gov/articles/PMC12750027/)——也就是说，更可靠地知道自己哪里不确定，本身就是一种进步。

**一个结构不是一部电影。** 现在的主流模型输出单个静态构象，而许多生物学机制恰恰在于构象变化：酶的催化循环、转运体的开关、变构调节。pLDDT 高的静态结构，对"这个蛋白怎么工作"这个问题的回答仍然有限。构象集合与动态建模是公认的薄弱环节，也是数据最稀缺的一块——MD 轨迹昂贵，多构象实验数据更少。

**数据偏置会被继承。** PDB 里的结构不是从蛋白质空间均匀采样来的，容易表达、容易结晶、受关注的蛋白被严重过表示，膜蛋白和大型柔性复合物则长期欠表示。用 AFDB、ESM Atlas 这类预测结构库扩充训练数据能缓解数量问题，但不解决分布问题，还会把上游模型的偏差一并带入。

**计算机内的通过率不是实验成功率。** 设计类工作必须看湿实验数字。这也是 2026 年最值得注意的一次发布的看点。

2025 年 11 月，ESM 系列背后的 EvolutionaryScale 团队并入 Biohub。2026 年 5 月 27 日，[Biohub 发布了一组被称为"蛋白质生物学世界模型"的模型](https://biohub.org/news/world-model-of-protein-biology/)，由三部分组成：**ESMC** 是在约 28 亿条序列上训练的表示模型；**ESMFold2** 把 ESMC 的序列表示转成生物分子复合物的原子级结构，官方称其在蛋白–蛋白与抗体–抗原相互作用基准上达到当前最好水平；**ESM Atlas** 收录 68 亿条序列与 11 亿个预测结构。

值得关注的是它报告的实验结果，而不只是基准分数：针对 EGFR、PDGFRβ、PD-L1、CTLA-4、CD45 五个靶点设计结合蛋白，紧凑型 minibinder 的实验命中率为 36–88%，抗体衍生格式为 15–29%，其中 PD-L1 的设计在实验中恢复了 T 细胞信号。**这类"命中率 + 功能验证"的报告方式，比单看 TM-score 更能说明设计模型的实际水平**，也代表了这个领域评价标准的迁移方向：从"预测得准不准"转向"造出来的东西管不管用"。

需要保留的判断是：命中率是在选定的靶点与设计格式下测得的，不同靶点难度差异很大；36–88% 这个区间本身的宽度就说明了这一点。它不能被读成"蛋白设计已经可靠"。

## 如果要继续往下读

按前面的任务谱，每条边都有值得单独细读的原始文献：

- **折叠**：[Jumper et al., AlphaFold2，*Nature*（2021）](https://doi.org/10.1038/s41586-021-03819-2)与[Abramson et al., AlphaFold3，*Nature*（2024）](https://doi.org/10.1038/s41586-024-07487-w)，两篇一起读能看清从 Evoformer 到扩散架构的转变。
- **单序列路线**：[Lin et al., ESMFold，*Science*（2023）](https://doi.org/10.1126/science.ade2574)，关于语言模型规模与结构信息涌现的论证。
- **逆折叠**：[Dauparas et al., ProteinMPNN，*Science*（2022）](https://doi.org/10.1126/science.add2187)，以及加入配体上下文的[LigandMPNN，*Nature Methods*（2025）](https://doi.org/10.1038/s41592-025-02626-1)。
- **从头设计**：[Watson et al., RFdiffusion，*Nature*（2023）](https://doi.org/10.1038/s41586-023-06415-8)，motif scaffolding 与 binder design 的方法来源。
- **多模态生成**：[Hayes et al., ESM3，*Science*（2025）](https://doi.org/10.1126/science.ads0018)，序列、结构、功能联合 token 化的代表。
- **指标定义**：[AlphaFold3 官方输出文档](https://github.com/google-deepmind/alphafold3/blob/main/docs/output.md)是查 pLDDT、PAE、ipTM 的第一手依据；[Mariani et al.（2013）](https://doi.org/10.1093/bioinformatics/btt473)是 lDDT 的原始定义。
- **独立评估**：CASP16 的[单体评估](https://pmc.ncbi.nlm.nih.gov/articles/PMC12750037/)与[复合物评估](https://pmc.ncbi.nlm.nih.gov/articles/PMC12750043/)，判断领域真实水平时比任何单篇论文的自报结果都更有参考价值。
- **适应度基准**：[ProteinGym，*NeurIPS*（2023）](https://proceedings.neurips.cc/paper_files/paper/2023/hash/cac723e5ff29f65e3fcbb0739ae91bee-Abstract.html)，变异效应预测的标准测试集。

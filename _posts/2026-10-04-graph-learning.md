---
title: "图学习入门：从消息传递到 GCN 与 GAT"
description: "理解图的节点与邻接矩阵，推导消息传递，并用轻量 PyTorch 代码看清 GCN 和 GAT。"
date: 2026-10-04
category: ML_foundation
tags: [graph-learning, GNN, GCN, GAT, PyTorch]
outline_key: ml-foundation-2-4
permalink: /GNN/
redirect_from: /2026/10/04/graph-learning/
---

## 图是怎样的数据

图 `G = (V, E)` 由节点集合 `V` 和边集合 `E` 组成。社交网络里人是节点、关系是边；分子里原子是节点、化学键是边。假设有 `N` 个节点，每个节点有 `F` 维特征，把特征排成矩阵 `X ∈ R^{N×F}`。邻接矩阵 `A ∈ {0,1}^{N×N}` 约定 `A[i,j]=1` 表示节点 `j` 是节点 `i` 的邻居。无向图的 `A` 对称；有向图要明确边的方向。

图学习任务可以落在不同尺度：预测某个节点的类别、判断两节点之间是否应有边，或给整张图分类。下面只讨论如何产生**节点表示**；任务头与标签取决于具体问题。图没有图像那样固定的像素网格，节点的邻居数也各不相同，因此常用“从邻居收集信息”的办法。

做节点分类时，可以把每个节点的最终表示接到分类器上；做整图分类时，通常先对节点表示做求和或均值等读出操作，再预测图的标签。边预测则会组合两个端点的表示。这些任务可以共享同一套图编码器，但损失函数和训练数据的划分不同。尤其要区分“图里存在一条边”和“某个节点的类别标签已知”：半监督节点分类往往只有少量节点有标签，却可利用整张图的连接关系。

## 消息传递：统一的直觉

设 `hᵢ⁽ˡ⁾` 是第 `l` 层的节点 `i` 表示。一层图神经网络通常做三步：从邻居 `j` 计算消息、聚合这些消息，再更新 `i` 的表示。可写成 `mᵢ = AGG({MSG(hᵢ, hⱼ, eᵢⱼ) : j ∈ N(i)})`，`hᵢ⁽ˡ⁺¹⁾ = UPDATE(hᵢ⁽ˡ⁾, mᵢ)`。聚合必须与邻居的排列无关，例如求和、均值或加权求和。堆两层时，一个节点通常能接收两跳内的信息；层数更多也不一定更好，可能出现节点表示趋同或计算成本上升。

不同模型主要区别在“邻居占多少权重”。GCN 使用由图结构决定的归一化权重；GAT 从节点特征学习注意力权重。两者都按图上的边限制信息流，并不会默认让每个节点看见所有节点。

例如节点 `i` 连着两个邻居 `j` 和 `k`，一次聚合会综合二者的信息，同时还可纳入自己的旧表示。若把邻居列表的输入顺序交换，最终结果不应改变；否则同一张图仅因存储顺序不同就会得到不同预测。这是图模型设计中的基本检查点。

## GCN：先归一化，再聚合

[Kipf 与 Welling 的 GCN](https://arxiv.org/abs/1609.02907) 常写成 `H' = σ(D̃⁻¹ᐟ² Ã D̃⁻¹ᐟ² H W)`。其中 `Ã = A + I` 加入自环，让节点也保留自身信息；`D̃[i,i] = Σⱼ Ã[i,j]` 是度矩阵；`W` 将 `F_in` 维投影到 `F_out` 维。左右的度归一化避免高连接度节点的邻居求和无限放大。这个简式适合无向、无权图；若图有方向或边权，归一化规则需要重新定义。

下面是一个**致密矩阵教学版本**。`x` 为 `[N, F_in]`，`adj` 为 `[N, N]`，返回 `[N, F_out]`。大图通常改用稀疏存储与邻居采样。

```python
import torch
from torch import nn

class GCNLayer(nn.Module):
    def __init__(self, in_features, out_features):
        super().__init__()
        self.linear = nn.Linear(in_features, out_features, bias=False)

    def forward(self, x, adj):
        n = x.size(0)
        a = adj.to(dtype=x.dtype) + torch.eye(n, device=x.device, dtype=x.dtype)
        degree = a.sum(dim=1)
        inv_sqrt = degree.pow(-0.5)
        normalized = inv_sqrt[:, None] * a * inv_sqrt[None, :]
        return normalized @ self.linear(x)
```

输入 `adj` 应是不含自环的无向 0/1 邻接矩阵；代码会自己加自环。若继续堆叠，通常在层间加非线性激活。这里先做特征投影再做邻居聚合，与上式等价，因为二者都是线性矩阵乘法。

## GAT：让模型学邻居权重

[Veličković 等的 GAT](https://arxiv.org/abs/1710.10903) 先用 `W` 投影节点特征，再为每条允许的边计算分数，例如 `eᵢⱼ = LeakyReLU(aᵀ[Whᵢ ‖ Whⱼ])`；对节点 `i` 的邻居做 softmax 得到 `αᵢⱼ`，最后计算 `h'ᵢ = σ(Σⱼ αᵢⱼ Whⱼ)`。符号 `‖` 表示拼接。这样同一个节点可对不同邻居分配不同权重；掩码仍使非邻居权重为零。原论文还使用多头注意力，隐藏层通常拼接各头，输出层可对各头取平均。

概念代码展示一头的核心计算。为便于读懂，`adj[i,j]` 同样表示从 `j` 收集到 `i`；`adj` 是布尔矩阵且初始不含自环。代码先加入自环，确保每行至少有一个可参与 softmax 的节点：

```python
z = linear(x)                                      # [N, F_out]
src = (z * a_left).sum(-1)                       # [N]
dst = (z * a_right).sum(-1)                      # [N]
scores = torch.nn.functional.leaky_relu(src[:, None] + dst[None, :], 0.2)
allowed = adj.bool() | torch.eye(x.size(0), device=x.device, dtype=torch.bool)
alpha = scores.masked_fill(~allowed, float('-inf')).softmax(dim=1)  # [N, N]
out = alpha @ z                                  # [N, F_out]
```

这里 `linear`、`a_left`、`a_right` 是待学习参数（后两者形状为 `[F_out]`）。拆开写的 `src + dst` 与对拼接后的向量做一次线性打分等价；softmax 只沿邻居维度 `j` 计算。示例会显式构造 `N × N` 分数矩阵，适合解释原理，不适合直接处理大规模稀疏图。

## 读论文时抓住的区别

GCN 的邻居系数来自连接关系和度；GAT 的系数还取决于节点表示，可以随训练改变。权重可视化能帮助观察模型聚合了哪些邻居，但不能仅凭权重断言因果解释。选模型时先看任务、图大小和边的含义，再决定是否需要可学习的邻居权重。

## 原论文

- [Kipf 与 Welling，*Semi-Supervised Classification with Graph Convolutional Networks*（ICLR 2017）](https://arxiv.org/abs/1609.02907)：GCN 的层更新式与半监督节点分类。
- [Veličković 等，*Graph Attention Networks*（ICLR 2018）](https://arxiv.org/abs/1710.10903)：邻域内的掩码注意力与多头机制。

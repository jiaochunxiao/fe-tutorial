---
id: rendering-002
title: 渲染原理之层叠上下文与绘制顺序
series: 浏览器渲染原理系列
seriesId: rendering
stage: expert
difficulty: 4
tags: [层叠上下文, 绘制顺序, Paint阶段, z-index, Stacking Context]
readingTime: 18
prev: rendering-001
next: rendering-003
createdAt: 2026-10-26
---

# 渲染原理之层叠上下文与绘制顺序

## 从「Paint 阶段的『顺序』是精确规则」说起

《rendering-001》讲 Paint 输出「绘制指令清单」——清单里**指令的先后顺序**决定了什么盖住什么。这套顺序不是「DOM 顺序那么简单」，而是一套精确的分层规则：**层叠上下文（Stacking Context）**。⭐⭐ css-deep-004 从 CSS 使用角度讲过它；本篇从**渲染管线的 Paint 阶段**下钻：上下文如何决定绘制次序、与分层/合成的关系。

## 现象与直觉解释

**层叠上下文 = 一块「内部自洽的绘制单元」**：

- 内部元素按「七层顺序」绘制；
- 整个上下文作为一个整体，参与外部世界的排序（**嵌套比较，不跨级比较**）⭐。

```
<div style="z-index: 5">  ← 上下文A（含子元素）
<div style="z-index: 3">  ← 上下文B
A 的 z-index 5 > B 的 3 → A 整体（连内部一切）盖住 B 整体
—— B 内部某元素 z-index: 9999？没机会 —— 它只跟 B 内部比（css-deep-004 的"信封"）
```

## 深入原理

### 一、同上下文内的「七层绘制顺序」（规范级记忆）⭐⭐⭐

一个层叠上下文内部，从底到顶的绘制次序：

```
① 根/上下文自身的背景与边框
② 负 z-index 的子层叠上下文（z 越小越底）
③ 常规流块级盒（按 DOM 顺序的 in-flow block）
④ 浮动盒
⑤ 行内盒（inline）
⑥ z-index: 0 / auto 的定位元素 与 平级上下文
⑦ 正 z-index 的子层叠上下文（z 越大越上）
```

**三个可推导的经典现象**：

```css
/* 现象1: 行内压浮动（③<④<⑤）—— 文字环绕图片时文字永远在图上 */
img { float: left; }  p { ... }   /* p 的行内内容盖在浮动图上 */

/* 现象2: "没定位的元素"永远垫底 —— 它在③层，定位+z 的在⑥⑦ */
/* 现象3: 同层按 DOM 顺序 —— z-index 相等时后来居上 */
```

### 二、谁创建层叠上下文（Paint 分组的触发条件）⭐⭐⭐

```
先天: html 根元素
定位类: position: absolute/relative + z-index ≠ auto；fixed/sticky（不需 z-index）
CSS3 类: opacity < 1 ⭐ / transform ≠ none ⭐ / filter / mix-blend-mode /
        will-change(指定上述属性) / isolation: isolate / contain: paint
其他: flex/grid 子项 + z-index ≠ auto
```

**面试高频三连**（css-deep-004 的渲染侧加深）：

```js
// ① opacity:0.99 就创建上下文 —— 「只想淡出却改变了层叠世界」的经典事故
// ② transform 创建上下文 —— 「旋转的元素突然盖住了 z-index 更高的弹窗」
// ③ z-index: auto vs 0: 渲染层级同在⑥，但 0 创建上下文而 auto 不创建
//    （子元素的 z-index 命运因此完全不同）
```

### 三、Paint 阶段的完整决策流 ⭐⭐

把《rendering-001》的 Paint 站展开：

```
Paint 阶段做两件事：
A. 分组：按层叠上下文把渲染树切组（上下文树 stacking context tree）
B. 排序：上下文树自上而下、上下文内按七层 —— 生成有序绘制指令

例: body(根上下文)
   ├─ header(z:1 上下文H) ── H内: [背景, logo(常规), 下拉(z:99)]
   └─ main(常规流) ── 文章(块级) 浮动图 行内文字
绘制序: 根背景 → main 的块级/浮动/行内 → H 上下文整体(其内部: 背景→logo→下拉)
       —— H 内的下拉 z:99 盖不过 H 之外 z:2 的弹窗（信封效应）
```

### 四、层叠上下文 vs 合成层（最易混淆的一对）⭐⭐⭐

| | 层叠上下文 Stacking Context | 合成层 Compositing Layer |
|---|---|---|
| 属于 | **Paint 阶段**的绘制分组与顺序 | **Composite 阶段**的 GPU 图层 |
| 决定 | 谁盖住谁（视觉次序） | 谁独立光栅化/更新（性能） |
| 创建者 | z-index/opacity/transform… | 3D transform、will-change、video… |
| 关系 | **相互独立的概念**——有上下文不一定有独立层 | 合成层参与合成时按「层叠顺序」排 z ⭐ |

**一句话分清**：层叠上下文回答「**画的时候谁在上**」（逻辑层序），合成层回答「**画在哪块 GPU 纹理上**」（物理分层）——两者在合成阶段汇合：GPU 拼图层时按层叠顺序排先后。

## 回看开篇

Paint 的「顺序」= 层叠上下文树的自上而下遍历 + 每个上下文内部的七层规则——z-index 的比较被严格限制在兄弟上下文之间。「9999 压不住」不是 z-index 失效，是**比较根本没发生在那一层**——绘制顺序是树的嵌套规则，不是全局排行榜。

## 实战延伸

**1. 面试答题骨架**：「层叠上下文是 Paint 阶段的绘制分组单元——每个上下文内部按七层顺序绘制：自身背景、负 z 子上下文、常规流块、浮动、行内、z 为零或 auto 的定位、正 z 子上下文；整个上下文作为整体参与外层排序，因此嵌套内的 z-index 无法跨出信封。创建条件包括定位加 z-index、fixed、opacity 小于一、transform、filter、isolation 等。它与合成层是两个概念——前者管绘制顺序逻辑、后者管 GPU 物理分层，合成时 GPU 按层叠顺序拼装图层。」

**2. DevTools 观察**：Layers 面板（三维展开图层树）+ Elements 面板选中元素的 Layer 信息——把抽象的「上下文/层」变成可视卡片。

## 图解总结

```
上下文内七层（底→顶）:
 ①背景边框 ②负z上下文 ③常规块 ④浮动 ⑤行内 ⑥z0/auto定位 ⑦正z上下文

创建: 根 │ pos+z≠auto │ fixed/sticky │ opacity<1 │ transform │ filter │ isolate
嵌套: 上下文=信封，z 比较只在兄弟上下文之间 ⭐

vs 合成层: 层叠上下文=Paint的"逻辑次序" │ 合成层=Composite的"GPU纹理"
           合成时 GPU 按层叠顺序拼层 —— 两概念在最后汇合
```

## 总结

- 层叠上下文 = Paint 的分组与排序单元；内部七层精确顺序；
- 嵌套比较不跨级——信封效应是「树序」而非「排行榜」；
- 创建条件一族：定位+z、fixed、opacity、transform、filter、isolation；
- z:auto 与 0 同层但只有 0 创建上下文；
- 层叠上下文（绘制顺序）与合成层（GPU 分层）是正交概念，在合成时汇合。

**面试一句话回答**：层叠上下文是浏览器绘制阶段的分组单元——每个上下文内部按照固定七层顺序绘制：先画自身背景与边框，再画负 z-index 的子上下文，然后是常规流块级盒、浮动盒、行内盒，接着是 z-index 为零或 auto 的定位元素，最后是正 z-index 的子上下文；整个上下文作为一个整体参与外层排序，因此深层嵌套的子元素无论 z-index 多大都无法越过所在信封与外部元素比较。创建层叠上下文的条件包括根元素、定位加非 auto 的 z-index、fixed 与 sticky、opacity 小于一、transform、filter 以及 isolation 等。它与合成层是两个正交概念——前者决定绘制顺序的逻辑层级，后者决定 GPU 的物理纹理分层，合成阶段 GPU 按层叠顺序把各图层拼成最终画面。

## 思考题

1. 手推绘制顺序：根上下文内 [块A, 浮动B, 定位C(z:auto), 定位D(z:-1), 行内E, 定位F(z:2)]。
2. `z-index: auto` 的父元素内部有个 z:99 子元素，与外部 z:1 的定位元素谁在上？（auto 父不建上下文——子元素直接参与外层比较，可能反超！画出两种结构对比）
3. 为什么 `isolation: isolate` 是「创建上下文但零副作用」的正解？（只为排序隔离，不触发重绘类副作用——对比 opacity 方案）
4. 开放实验：用 Layers 面板找出你项目里的合成层并数数量——>30 个时页面的内存/合成成本怎么评估？

（思考题解析将同步录入小程序题库，关联本文 id：rendering-002）

## 参考文献：

- CSS 2.2 Appendix E — Elaborate description of stacking contexts（顺序规范原文）
- Chrome 开发者文档 — Layers 面板
- 本课程《css-deep-004 position 与层叠上下文》（CSS 使用视角）、《rendering-003 合成层》

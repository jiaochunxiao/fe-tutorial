---
id: rendering-001
title: 渲染原理之渲染管线：从 DOM 到像素
series: 浏览器渲染原理系列
seriesId: rendering
stage: expert
difficulty: 4
tags: [渲染管线, Layout, Paint, Composite, 渲染流程]
readingTime: 22
prev: null
next: rendering-002
createdAt: 2026-10-26
---

# 渲染原理之渲染管线：从 DOM 到像素

## 从「一个像素的诞生」说起

> **系列导读**：《浏览器渲染原理系列》共 6 篇——渲染管线、层叠上下文、合成层、rAF、事件循环与渲染的交错、性能案例。它是 performance 系列的「原理层」，也是 css-deep 的「底牌层」。

```js
el.style.color = 'red';    // 这行代码之后，屏幕上的像素经历了什么？
// 你以为：一个像素变了。
// 实际：样式重算 → 层叠与布局 → 生成绘制指令 → 光栅化 → 合成 → 上屏 —— 一条流水线全跑
```

⭐⭐⭐ 渲染管线（Rendering Pipeline）是前端性能与渲染的**总原理**——重排/重绘/合成的性能阶梯（performance-005）、transform 为什么快（css-deep-010）、GPU 加速（003 篇）全部由此推导。

## 现象与直觉解释

浏览器把「DOM + CSS」变成「像素」的完整流水线五站：

```
① Parse（解析）:        HTML→DOM，CSS→CSSOM（构建期，一次为主）
② Style（样式计算）:     为每个可见节点算出【最终样式】（computed style）
③ Layout（布局）:        算几何——每个盒子的位置与大小（输出布局树）
④ Paint（绘制）:         生成【绘制指令】与分层（哪个层画什么、什么顺序）
⑤ Composite（合成）:     GPU 把各图层拼成一帧 → 上屏
```

直觉：**装修五步**——读懂图纸（Parse）→ 定配色（Style）→ 排家具位置（Layout）→ 每面墙写施工单（Paint）→ 装修队按单施工拼装（Composite/GPU）。

## 深入原理：五站逐个下钻

### 第①②站：解析与样式计算 ⭐⭐

```
HTML ──解析──▶ DOM 树
CSS  ──解析──▶ CSSOM
     二者合成【渲染树 Render Tree】：
     只含【可见】节点（display:none 不进；head/script 不进）
     每个节点携带最终样式（选择器匹配 + 继承 + 层叠计算——css-deep-005）
```

**Style 阶段的成本因子**：节点数量 × 选择器复杂度——「几万个节点的深嵌套 + 后代选择器链」是样式计算的两大负担（优化：类名扁平化、减少无谓层级）。

### 第③站：Layout（布局/回流）⭐⭐⭐

```
输入: 渲染树（样式）
输出: 布局树（每个盒子的 x/y/width/height —— 盒模型几何，css-deep-001）

触发「全局或局部重算」的改动:
  几何属性（宽高/边距）、增删节点、文本变化、窗口 resize…
成本: 几何是【连锁】的——一个盒宽变化，兄弟重排、父容器重算、可能全局回弹
（读写分离/强制同步布局的问题就在这站 —— performance-005）
```

### 第④站：Paint（绘制）与分层 ⭐⭐⭐

```
Paint 输出的不是像素，是【绘制指令清单】（display list）：
  "在(x,y)画一个 100×50 的红色矩形" "在(x,y)绘制文字'hello'" …

同时浏览器做【分层决策】（layerization）：
  哪些节点该独立成层？—— 合成层提升规则（rendering-003 专篇）：
  3D transform、will-change、video/canvas、opacity 动画…
  分层的意义: 各层独立光栅化与更新，合成时只需重新拼装
```

**重绘（Repaint）的触发**：颜色/背景/阴影等「不改几何」的外观变化——从 Paint 站重新开始（跳过 Layout）。

### 第⑤站：Composite（合成）——GPU 的舞台 ⭐⭐⭐

```
光栅化（Rasterization）: 绘制指令 → 真实像素（在光栅线程，GPU 加速）
合成（Compositing）:     把多个图层按正确的 z 顺序、transform 拼成最终帧
                        （在合成线程 —— 可不依赖主线程！browser-basic-002 的滚动秘密）

合成站专属的改动（最便宜）:
  transform: translate/scale/rotate 与 opacity —— 只改"拼装参数"
  不触发 Style/Layout/Paint —— GPU 重新合成即可 ⭐⭐
```

<figure style="margin:2.2em 0">
<svg viewBox="0 0 720 280" width="100%" role="img" aria-label="渲染管线五站与性能阶梯">
  <defs>
    <marker id="r1-ink" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#1C1A17"/>
    </marker>
    <marker id="r1-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#B03A2E"/>
    </marker>
  </defs>
  <rect x="20" y="52" width="128" height="52" rx="8" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.5"/>
  <text x="84" y="74" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12.5" font-weight="700" fill="#1C1A17">Style</text>
  <text x="84" y="92" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="11" fill="#6E675A">最终样式</text>
  <rect x="164" y="52" width="128" height="52" rx="8" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.5"/>
  <text x="228" y="74" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12.5" font-weight="700" fill="#1C1A17">Layout</text>
  <text x="228" y="92" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="11" fill="#6E675A">几何计算</text>
  <rect x="308" y="52" width="128" height="52" rx="8" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.5"/>
  <text x="372" y="74" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12.5" font-weight="700" fill="#1C1A17">Paint</text>
  <text x="372" y="92" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="11" fill="#6E675A">绘制指令</text>
  <rect x="452" y="52" width="128" height="52" rx="8" fill="#FBF8F1" stroke="#B03A2E" stroke-width="1.8"/>
  <text x="516" y="74" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12.5" font-weight="700" fill="#B03A2E">Composite</text>
  <text x="516" y="92" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="11" fill="#6E675A">GPU 合成上屏</text>
  <path d="M 148 78 H 158" stroke="#1C1A17" stroke-width="1.5" marker-end="url(#r1-ink)"/>
  <path d="M 292 78 H 302" stroke="#1C1A17" stroke-width="1.5" marker-end="url(#r1-ink)"/>
  <path d="M 436 78 H 446" stroke="#1C1A17" stroke-width="1.5" marker-end="url(#r1-ink)"/>
  <path d="M 120 40 H 440" fill="none" stroke="#B03A2E" stroke-width="2" marker-end="url(#r1-red)"/>
  <text x="280" y="30" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12.5" font-weight="700" fill="#B03A2E">改 transform/opacity：跨过前三站直奔合成 ⭐</text>
  <text x="84" y="132" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12" fill="#6E675A">改宽高/位置：</text>
  <text x="84" y="150" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12" fill="#6E675A">全链重排 💰💰💰</text>
  <text x="372" y="132" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12" fill="#6E675A">改颜色/背景：</text>
  <text x="372" y="150" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12" fill="#6E675A">从 Paint 起 💰💰</text>
  <text x="516" y="132" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12" fill="#6E675A">动画用这俩属性</text>
  <text x="516" y="150" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12" fill="#6E675A">= 性能铁律 💰</text>
  <path d="M 20 200 H 700" stroke="#CDC4AF" stroke-width="1"/>
  <text x="20" y="230" font-family="Noto Sans SC,sans-serif" font-size="13" fill="#1C1A17">五站之外的补充：</text>
  <text x="20" y="256" font-family="Noto Sans SC,sans-serif" font-size="13" fill="#6E675A">光栅化（指令→像素）在光栅线程/GPU 上进行，合成在合成线程完成——</text>
  <text x="20" y="280" font-family="Noto Sans SC,sans-serif" font-size="13" fill="#6E675A">主线程卡死时，已光栅化图层的滚动与 transform 动画仍可由合成线程推进。</text>
</svg>
<figcaption style="font-family:'Noto Sans SC',sans-serif;font-size:13px;color:#6E675A;text-align:center;margin-top:10px">图 · 渲染管线五站——性能优化的本质是把改动沿管线往右推，能走合成就不走重排</figcaption>
</figure>

### 性能阶梯（全篇最重要的一张图）⭐⭐⭐

```
改动类型         触发管线                     成本
几何变化    →  Style→Layout→Paint→Composite   💰💰💰 重排
外观变化    →  Style(部分)→Paint→Composite     💰💰   重绘
transform/opacity → Composite                  💰     合成 ✅ 圣杯

←—— 优化方向：把改动尽量往右推 ——→
（css-deep-010 的动画铁律、performance-005 的读写分离、react-008 的重渲染控制
   最终都汇入这张图）
```

### 一帧内发生了什么（连接 005 篇）⭐

```
rAF 回调 → Style → Layout → Paint → Composite → 上屏
（事件循环: 任务 → 微任务 → 【rAF → 渲染管线】→ 下一任务 —— rendering-005 展开）
```

## 回看开篇

`el.style.color = 'red'` 的完整旅程：Style 重算（这个节点）→（颜色不改几何，跳过 Layout）→ 生成新绘制指令 → 光栅化受影响区域 → 合成上屏。**一行代码 = 半条流水线**——理解管线后，「改什么属性贵不贵」不再靠背，靠推导。

## 实战延伸

**1. 面试答题骨架**：「渲染管线分五站——HTML/CSS 解析成 DOM 与 CSSOM 合成只含可见节点的渲染树；样式计算为每个节点求最终样式，成本随节点数与选择器复杂度增长；布局计算全部盒子的几何并输出布局树，几何改动会连锁触发；绘制生成绘制指令并做分层决策，外观改动从这站开始；合成由 GPU 把已光栅化的图层拼成帧，transform 与 opacity 只影响这站所以最快。性能优化的本质就是把改动在 Layout、Paint、Composite 三档中尽量往右推。」

**2. 观察工具**：DevTools → Performance → Layers 面板（看分层）；Rendering 面板的 Paint flashing（重绘区域高亮）、Layout Shift Regions。

## 图解总结

```
HTML→DOM ┐
          ├▶ 渲染树(可见+最终样式) ─▶ Layout(几何) ─▶ Paint(指令+分层)
CSS→CSSOM┘                                              │
                              光栅化(指令→像素, 光栅线程/GPU)
                                                        ▼
                              Composite(合成线程: 图层拼帧) ═▶ 上屏

阶梯: 几何改=全链重排💰💰💰 │ 外观改=Paint起💰💰 │ transform/opacity=合成💰✅
每帧: rAF → Style → Layout → Paint → Composite（rendering-005 的节拍）
```

## 总结

- 五站管线：Parse → Style → Layout → Paint → Composite；
- 渲染树只含可见节点；样式成本=节点数×选择器复杂度；
- Layout 输出几何、连锁重算；Paint 输出指令与分层；
- 合成在 GPU/合成线程——transform/opacity 只走此站（性能圣杯的原理）；
- 一切渲染优化=把改动沿管线右推。

**面试一句话回答**：浏览器渲染管线分五步——先解析 HTML 与 CSS 得到 DOM 树与 CSSOM，合成只包含可见节点且带最终计算样式的渲染树；接着样式计算为每个节点匹配选择器并处理继承层叠得出最终样式；布局阶段计算每个盒子的大小位置输出布局树，任何几何变化都会连锁触发上下游盒子重算；绘制阶段生成绘制指令清单并决定分层，外观类变化从这一步开始；最后光栅化把指令转成像素、合成阶段由 GPU 按层级顺序拼装各图层输出到屏幕。性能关键在于改动落在哪一段——改几何触发整条链最贵，改外观只从绘制开始，而 transform 与 opacity 只影响最后的合成阶段由 GPU 完成，因此动画必须使用合成属性，一切渲染优化的本质就是把改动尽量推迟到管线的最后一站。

## 思考题

1. `display:none` 与 `visibility:hidden` 在管线各站的差异？（不进渲染树 vs 进树但绘制跳过；布局/命中测试的差异）
2. 为什么「改变字体大小」几乎是最贵的操作之一？（几何+样式继承+可能回流全文——沿管线推演）
3. 光栅化为什么可以按「图块(tile)」进行？（视口优先、按需光栅化——大页面不必全部转像素）
4. 开放实验：Performance 面板录三段动画（left/背景色/transform），对照紫色 Layout 与绿色 Paint 块的差异，验证性能阶梯。

（思考题解析将同步录入小程序题库，关联本文 id：rendering-001）

## 参考文献：

- Chrome 开发者文档 — Rendering Performance / The Anatomy of a Frame
- web.dev — 渲染性能指南
- 本课程《performance-005 重排重绘》《rendering-003 合成层》《css-deep-010 动画》

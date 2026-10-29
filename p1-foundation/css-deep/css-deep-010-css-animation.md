---
id: css-deep-010
title: CSS 深入之动画：transition 与 animation
series: CSS 深入系列
seriesId: css-deep
stage: foundation
difficulty: 3
tags: [transition, animation, keyframes, GPU 加速, 性能]
readingTime: 18
prev: css-deep-009
next: null
createdAt: 2026-10-26
---

# CSS 深入之动画：transition 与 animation

## 从「hover 动画很卡」说起

```css
.card:hover { left: 100px; }         /* 用 left 做位移动画 —— 掉帧 */
.card:hover { transform: translateX(100px); }  /* 丝般顺滑 */
```

一行之差，帧率天壤之别。原因藏在渲染管线里：**有的属性动画要重排整棵树，有的只需要 GPU 合成**。⭐⭐ 动画是 CSS 面试「性能 + 语法」的双考点，本文覆盖两套动画体系 + 性能分层 + 工程实践。

## 现象与直觉解释

两套动画体系的分工：

| | transition（过渡） | animation（动画） |
|---|---|---|
| 触发 | **属性值变化时**被动响应（hover/class 切换） | 声明即主动播放 |
| 状态数 | 起点与终点（2 个） | 关键帧任意个 |
| 循环 | ❌ | ✅ infinite |
| 暂停/反向 | ❌（只能回） | ✅（alternate/暂停） |
| 适用 | 交互反馈（hover、展开收起） | 循环/入场/复杂编排 |

直觉：**transition 是「变化的缓冲」**（让状态切换不生硬），**animation 是「剧本」**（写好每一幕，包括循环与编排）。

## 深入原理

### 一、transition 四要素 ⭐

```css
.box {
  transition-property: transform, opacity;  /* 哪些属性参与过渡 */
  transition-duration: 300ms;               /* 时长 */
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); /* 缓动曲线 */
  transition-delay: 0s;                     /* 延迟 */
  /* 简写: transition: transform 300ms ease-out 100ms; */
}
.box:hover { transform: scale(1.05); }  /* 变化发生时自动过渡 */
```

**缓动函数速记** ⭐：

```
ease        默认（先快后慢的柔和曲线）
linear      匀速（进度条、加载环）
ease-in     慢起（物体离场、被"吸走"）
ease-out    慢收（物体进场、"落地"）★ 入场首选
ease-in-out 慢起慢收（位移往返）
cubic-bezier(x1, y1, x2, y2)  自定义（y>1 可做过冲弹性）
```

**transition 的三个经典限制**：① 只能两态（A→B，中间无关键帧）；② 不能自动触发（必须有属性变化）；③ 不能循环。

### 二、animation 与 @keyframes ⭐⭐

```css
@keyframes slide-in {
  0%   { transform: translateX(-100%); opacity: 0; }
  60%  { transform: translateX(8px); }        /* 可以做过冲 —— 比 transition 强 */
  100% { transform: translateX(0); opacity: 1; }
}

.toast {
  animation: slide-in 300ms ease-out both;    /* both: 前后都保持关键帧状态 */
  /* 完整语法: name duration timing delay iteration-count direction fill-mode play-state */
  animation-iteration-count: infinite;
  animation-direction: alternate;   /* 奇数次正放、偶数次倒放（往返）*/
  animation-fill-mode: forwards;    /* 结束后停在最后一帧（默认回到原样！）⭐*/
  animation-play-state: paused;     /* 暂停（hover 恢复的技巧）*/
}
```

**fill-mode 四值**（高频考点）：`none`（播完打回原形）/ `forwards`（停在最后一帧）/ `backwards`（delay 期间先呈第一帧）/ `both`。

### 三、性能分层：为什么 transform/opacity 是圣杯 ⭐⭐⭐

回顾渲染管线（详见《rendering-001》《performance-005》）：

```
Layout（重排） ──▶ Paint（重绘） ──▶ Composite（GPU 合成）
  贵               中                便宜 ✅
```

动画属性按触发层分级：

| 层级 | 属性 | 代价 |
|---|---|---|
| 🔴 重排级 | `width height top left margin font-size` | 几何全量重算，波及邻居 |
| 🟡 重绘级 | `color background box-shadow` | 不动几何，但逐像素重画 |
| 🟢 合成级 | **`transform` `opacity`** | 只影响合成，GPU 直接处理 ✅ |

**工程铁律**：位移动画用 `translate` 不用 `left/top`；显隐淡入用 `opacity` 不用 `display`（display 不能过渡）；缩放用 `scale` 不用 width/height。

**will-change 与合成层**（关联《rendering-003》）：给频繁动画的元素 `will-change: transform` 提示浏览器提前提升合成层——但**别滥用**（每层都占显存），只在确认卡顿时用。

### 四、实战技巧三则 ⭐

```css
/* ① display 不能过渡 —— 用 visibility/opacity 组合或新增 transition-behavior: allow-discrete */
.dropdown {
  display: none; opacity: 0;
}
.dropdown.open { display: block; opacity: 1; transition: opacity 200ms; }
/* ⚠️ display:none→block 的瞬间 opacity 过渡会失效 —— 需要双 rAF 或 allow-discrete（新）*/

/* ② 动画结束事件（JS 挂点）*/
el.addEventListener('transitionend', (e) => { /* 过渡完成后清理 */ });
el.addEventListener('animationend', (e) => { /* 播完移除 DOM：toast 自动消失 */ });

/* ③ prefers-reduced-motion：无障碍强约束 */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

### 五、JS 动画的定位（rAF 与 WAAPI 一句话）

CSS 动画跑在合成线程、声明式、性能好，但**不与状态联动**；复杂编排（物理曲线、跟随手势、中途变速）交给 JS——`requestAnimationFrame` 对齐渲染帧（《rendering-004》专篇），`element.animate()`（WAAPI）用 JS 调用与 CSS 相同的动画引擎。**选型：能用 CSS 就 CSS，需要交互联动才上 JS。**

## 回看开篇

left 动画卡、transform 顺滑的原因：left 改变几何 → 触发重排 → 整树 Layout+Paint 在主线程抢帧；transform/opacity 只影响合成 → GPU 在合成器上独立完成，主线程忙别的也不掉帧。**动画性能优化的第一课就是选对属性。**

## 实战延伸

**1. 面试答题骨架**：「transition 负责两态之间的被动过渡（属性变化触发，配缓动函数），animation 配合 keyframes 主动播放多关键帧、支持循环、方向与 fill-mode；性能上按渲染管线分三级——width/top 类触发重排最贵、color/background 类触发重绘居中、transform/opacity 只走 GPU 合成最廉价，因此动画应优先 transform 与 opacity，位移不用 left、显隐用 opacity；复杂交互动画交给 rAF 或 WAAPI，并尊重 prefers-reduced-motion。」

**2. 快手辨析**：`transition: all` 的两宗罪——性能（无关属性变化也开过渡）与失控（新属性意外被动画）——显式列举属性。

## 图解总结

```
transition: 变化的缓冲（两态被动）  animation: 剧本（多帧主动可循环）
  property/duration/timing/delay      keyframes + iteration/direction/fill-mode

性能三级（渲染管线）：
 🔴 Layout: width/left/margin ──重排──▶ Paint ──▶ Composite   全程主线程
 🟡 Paint:   color/background ─────────▶ Paint ──▶ Composite  逐像素重画
 🟢 Composite: transform/opacity ─────────────────▶ Composite  GPU 独立 ✅

工程: 位移=translate │ 显隐=opacity │ 提层=will-change(慎用) │ 无障碍=reduced-motion
```

## 总结

- transition 两态被动过渡（四要素），animation 多关键帧主动播放（fill-mode/循环/方向）；
- 缓动函数选型：入场 ease-out、离场 ease-in、自定义 bezier 做过冲；
- 性能三级：重排属性（几何）> 重绘属性（视觉）> 合成属性（transform/opacity）——动画只用第三级；
- display 不能过渡，用 opacity/visibility 组合或 allow-discrete；will-change 慎用；
- JS 动画（rAF/WAAPI）负责交互联动场景。

**面试一句话回答**：transition 是两态之间的被动过渡，属性值变化时按指定时长与缓动曲线平滑过渡；animation 配合 keyframes 定义多个关键帧，可循环、反向、暂停，fill-mode 控制播放前后的停留状态。性能上依据渲染管线分三级——改 width、top、margin 触发重排代价最高，改 color、background 触发重绘次之，而 transform 与 opacity 只影响合成层、由 GPU 独立处理最为流畅，因此动画应优先使用 transform 做位移缩放、opacity 做淡入淡出，避免动几何属性；复杂交互可交给 requestAnimationFrame 或 Web Animations API，同时用 prefers-reduced-motion 照顾无障碍。

## 思考题

1. `transition: width 300ms` 与 `transform: scaleX()` 缩放的视觉差异是什么？（文字被压扁、边框变细——几何缩放 vs 视觉缩放）
2. animation-fill-mode 不设 forwards 时的「闪回」怎么复现？三种修复姿势？
3. 用一个 keyframes 实现加载骨架屏的呼吸效果（opacity 循环）——再问：为什么这里不用 JS setInterval 改 opacity？
4. 开放设计：Toast 从出现到自动消失的完整动画链（入场 → 停留 → 出场 → 移除 DOM）——CSS 动画 + animationend 事件 + 出场 class 切换，写出状态机。

（思考题解析将同步录入小程序题库，关联本文 id：css-deep-010）

## 参考文献：

- MDN — [使用 CSS 过渡](https://developer.mozilla.org/zh-CN/docs/Web/CSS/CSS_transitions/Using_CSS_transitions)、[CSS 动画](https://developer.mozilla.org/zh-CN/docs/Web/CSS/CSS_animations/Using_CSS_animations)
- CSS Triggers（属性触发的渲染阶段速查表）
- 本课程《rendering-001 渲染管线》《rendering-003 合成层》《performance-005 渲染优化》

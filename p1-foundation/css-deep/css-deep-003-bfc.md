---
id: css-deep-003
title: CSS 深入之 BFC：块级格式化上下文
series: CSS 深入系列
seriesId: css-deep
stage: foundation
difficulty: 3
tags: [BFC, 格式化上下文, 清除浮动, margin 折叠, 面试高频]
readingTime: 20
prev: css-deep-002
next: css-deep-004
createdAt: 2026-10-26
---

# CSS 深入之 BFC：块级格式化上下文

## 从两个「祖传 Bug」说起

```html
<!-- Bug 1：父元素包不住浮动的孩子 -->
<div class="parent" style="background: #eee;">
  <div class="child" style="float: left;">我是浮动的</div>
</div>
<!-- parent 高度塌陷为 0 —— 背景色消失，后续内容顶了上来 -->

<!-- Bug 2：孩子的 margin 穿透了父亲 -->
<div class="box" style="margin-top: 20px;">
  <div class="inner" style="margin-top: 30px;">inner</div>
</div>
<!-- 页面顶部出现 30px 空隙 —— inner 的 margin「穿透」了 box -->
```

两个 Bug 的官方标准解法是同一个：**给父元素建一个 BFC**。⭐⭐ BFC 是 CSS 面试的绝对高频——但能说清「BFC 到底是什么、规则是什么、为什么能解决这些问题」的人不多。

## 现象与直觉解释

**BFC（Block Formatting Context，块级格式化上下文）**：一块**独立的排版区域**——区域内部的布局（浮动、margin 折叠、背景延伸……）**自成一派，不受外部影响，也不影响外部**。

直觉模型：**把一群元素关进一个「独立包间」**——

- 包间里的 margin 折叠只在包间内发生，不会「串门」到包间外；
- 浮动元素也想逃出包间？包间的边界会把它们圈住（计算高度时包含浮动子元素）；
- 外面的浮动元素也别想挤进包间占位。

一句话：**BFC = 布局隔离单元**。

## 深入原理

### 一、怎么建 BFC：触发条件清单 ⭐⭐

| 触发方式 | 写法 | 副作用 |
|---|---|---|
| 根元素 | `html` | 天生 BFC |
| 弹性/网格项 | flex/grid 容器的直接子项 | 无 |
| 绝对/固定定位 | `position: absolute/fixed` | 脱离文档流 |
| 浮动 | `float ≠ none` | 脱离文档流 |
| 溢出裁剪 | `overflow: hidden/auto/scroll` | 裁剪溢出内容 |
| **专用属性** | **`display: flow-root`** | **无 ✅ 现代首选** |
| 表格/单元格等 | `display: table-cell` 等 | 改变显示类型 |

`display: flow-root` 的名字含义：「创建一个**根一样的流**」——专为建 BFC 而生（2018 年后浏览器全面支持），**无任何副作用**。历史代码里的 `overflow: hidden` 清浮动，本质是在「借」BFC 效果，附带裁剪内容的风险。

### 二、BFC 的五条布局规则 ⭐⭐

```
规则 ①：内部的盒子在垂直方向一个接一个放置（块级排布）
规则 ②：同一个 BFC 内相邻块级盒的垂直 margin 折叠
规则 ③：BFC 的区域【不与浮动元素重叠】
规则 ④：BFC 计算高度时【包含】内部浮动子元素
规则 ⑤：BFC 是隔离的 —— 内外布局互不干扰
```

规则听着抽象，**逐条对应经典问题**才是正确的打开方式：

### 三、规则 ④ —— 高度塌陷与清浮动 ⭐⭐

```html
<style>
  .parent { display: flow-root; }   /* 建 BFC → 高度重新包住浮动子元素 */
  .child  { float: left; width: 100px; height: 100px; }
</style>
```

为什么浮动会导致塌陷？——**浮动的本意是「文字环绕」**：设计者假设会有文字流过来包围它，所以容器计算高度时**故意不含浮动子元素**（否则环绕无从谈起）。而 BFC 容器说「我不参与外部的环绕游戏，内部的一切都算我的」→ 高度包含了浮动子元素。

**清浮动方案演进**（面试常考清单）：

```css
/* 方案 A：BFC 容器（现代首选） */
.parent { display: flow-root; }

/* 方案 B：老派 clearfix（不建 BFC，用伪元素"占位"） */
.clearfix::after { content: ''; display: block; clear: both; }

/* 方案 C：overflow: hidden（借 BFC，有裁剪副作用） */
.parent { overflow: hidden; }
```

### 四、规则 ② —— margin 穿透与折叠 ⭐⭐

```css
/* Bug 2 的修复：给 box 建 BFC，inner 的 margin 折叠被隔离在内部 */
.box { display: flow-root; }
/* 现在效果：box 外部间距 20px（自己的 margin），inner 在 box 内部下移 30px */
```

原理：**margin 折叠只发生在「同一个 BFC 内」的相邻块级盒之间**——box 成为 BFC 后，inner 的 margin-top 与外部世界的 margin 分属不同 BFC，折叠链路被切断。

### 五、规则 ③ —— 不与浮动重叠：双栏自适应布局 ⭐

```html
<style>
  .float-side { float: left; width: 200px; }
  .main { display: flow-root; }   /* 建 BFC */
</style>
<div class="float-side">固定侧栏</div>
<div class="main">自适应主内容</div>
```

没有 BFC 时，main 的行内内容会环绕侧栏（排版怪异、需要 margin 让位）；建 BFC 后 main 整体**从浮动元素旁边划出独立区域**——经典「左定宽右自适应」的纯 CSS 解。

### 六、IFC 与其他 FC 一句话（概念的完整性）⭐

格式化上下文家族：BFC（块级）、IFC（行内——行内盒在「行盒」中的排布规则，行高、基线对齐都归它管）、FFC（flex 格式化上下文）、GFC（grid）。**每个 FC 都是一套独立的排版规则系统**——BFC 只是其中最常被提问的一个。

## 回看开篇

两个 Bug 同一个根因：**默认文档流里，容器的高度不含浮动子元素、相邻盒的 margin 会折叠串门**。BFC 修复它们的原理不是「清浮动」这个动作，而是「**建立独立排版区域**」——规则 ④ 包住浮动、规则 ②③ 隔离干扰。用 `display: flow-root` 一行解决，无副作用。

## 实战延伸

**1. 面试答题骨架**：「BFC 是块级格式化上下文——一块独立的排版区域，内部布局与外界互相隔离。触发方式包括根元素、绝对定位、浮动、overflow 非 visible、flex/grid 子项，以及无副作用的现代专用属性 display: flow-root。它的五条规则解决三类经典问题——高度塌陷（BFC 高度包含浮动子元素，替代老式 clearfix）、margin 穿透与折叠（折叠只发生在同一 BFC 内）、以及不与浮动重叠实现自适应双栏布局。」

**2. 一道综合快手题**：

```html
<div style="overflow: hidden;">        <!-- BFC 容器 -->
  <p style="margin-top: 30px;">A</p>   <!-- 与 B 的 margin 折叠为 30 -->
  <p style="margin-top: 20px;">B</p>
</div>
<!-- 容器整体间距为什么不会是 30 + 30？——A 的 margin 与容器外的折叠被 BFC 隔断；
    A 与 B 在同一 BFC 内仍折叠（30）——「隔离的是内外，不是内部自身」 -->
```

## 图解总结

```
        ┌══════════ BFC（独立包间）══════════┐
        │  ① 垂直堆叠                          │
        │  ② 内部相邻 margin 折叠（不出门）      │
        │  ④ 高度包含浮动子元素（清浮动）        │
        │     ┌────┐                          │
        │     │float│ ← 被圈住，不再"逃逸"      │
        │     └────┘                          │
        └───────────┬───────────────────────┘
                    │ ③ 边界不与外部浮动重叠
        ✂️ 与外界的折叠/环绕/重叠 —— 全部隔离

触发（无副作用首选）：display: flow-root
经典三用：清浮动 / 止折叠 / 自适应两栏
```

## 总结

- BFC = 独立排版区域：内外布局互不干扰；
- 触发清单里 `display: flow-root` 是现代首选（零副作用），overflow:hidden 是历史借用；
- 五条规则对应三大应用：高度包含浮动子元素（清浮动）、折叠只在同 BFC 内发生（止穿透）、不与外部浮动重叠（自适应两栏）；
- 格式化上下文是家族概念：BFC/IFC/FFC/GFC 各管一套排版规则；
- 面试答 BFC 的最高效结构：定义 → 触发 → 规则 → 三大应用。

**面试一句话回答**：BFC 是块级格式化上下文，一块独立的排版区域，内部元素的布局与外部完全隔离。可通过根元素、绝对定位、浮动、非 visible 的 overflow、flex 或 grid 的子项触发，现代推荐无副作用的 display: flow-root。其核心规则带来三大应用——BFC 计算高度时包含内部浮动子元素从而解决高度塌陷，垂直 margin 折叠只发生在同一 BFC 内从而解决 margin 穿透与叠加，且 BFC 区域不与外部浮动元素重叠从而实现自适应两栏布局。

## 思考题

1. `display: inline-block` 的元素会建 BFC 吗？用它包含浮动子元素行得通吗？副作用是什么？
2. 为什么 flex 容器的子项之间 margin 不折叠？（提示：flex 格式化上下文 FFC 的规则独立性）
3. 手画：float:left 的 A、B 与普通块 C 的排布——给 C 建 BFC 前后各是什么样？
4. 开放讨论：既然 `display: flow-root` 这么完美，为什么大量老代码仍是 clearfix 伪元素方案？（兼容性窗口期、团队惯性、代码生成器）

（思考题解析将同步录入小程序题库，关联本文 id：css-deep-003）

## 参考文献：

- CSS 规范 — CSS 2.2 §9.4.1 Block formatting contexts（规则原文）
- MDN — [块格式化上下文](https://developer.mozilla.org/zh-CN/docs/Web/CSS/CSS_display/Block_formatting_context)
- 《CSS 世界》第 7 章（BFC 的中文经典论述）

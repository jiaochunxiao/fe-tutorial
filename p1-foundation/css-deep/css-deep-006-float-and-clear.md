---
id: css-deep-006
title: CSS 深入之浮动与清除浮动
series: CSS 深入系列
seriesId: css-deep
stage: foundation
difficulty: 3
tags: [float, 清除浮动, 高度塌陷, clearfix, 历史布局]
readingTime: 16
prev: css-deep-005
next: css-deep-007
createdAt: 2026-10-26
---

# CSS 深入之浮动与清除浮动

## 从「float 的一生」说起

float 的职业生涯非常戏剧化：

```
1996 设计初衷：图文环绕 —— 让文字绕着图片排（印刷排版的传统）
2000s  被滥用：全站两栏/三栏布局全靠 float（那时没有 flex/grid）
2010s  回归本位：布局交给 flex/grid，float 回归「环绕」小场景
```

理解这段历史，就理解了为什么面试还在考它——**大量存量代码里全是 float 布局的遗迹**，而它遗留的「高度塌陷」问题正是 CSS Bug 排行榜的常青树。⭐ 本文讲透 float 的行为规则、塌陷成因、清浮动的三种姿势。

## 现象与直觉解释

`float: left/right` 让元素**脱离文档流**，但保留一个关键特性：

```
absolute 定位：完全消失于流 —— 后面的内容当我不存在，直接顶上来
float：脱离流，但【行内内容会让开】 —— 文字会绕着我排（wrapping）
```

直觉：float 元素像**放进水里的一块木头**——块级盒子（船）会无视它直接开过去，但文字（水）会绕着它流动。

```html
<style>
  .float-img { float: left; width: 120px; }
</style>
<img class="float-img" src="...">
<p>这段文字会环绕在图片右侧……排满图片宽度后自动回到页面全宽。</p>
```

## 深入原理

### 一、float 的五条行为规则 ⭐⭐

```css
/* ① 脱离文档流，但影响行内内容的排布（环绕） */
/* ② float 元素会尽量【向左/向上】停靠： */
/*    向指定方向挤到容器边或【另一个 float 元素】为止（横向依次排列） */
/* ③ 同方向的 float 依次排列；放不下时【找前一个元素的下沿】换行 */
/* ④ float 会让自身【收缩为内容宽】（类似 inline-block）——除非显式设宽 */
/* ⑤ 文档流的块级盒"看不见"float —— 于是有了高度塌陷 */
```

### 二、高度塌陷：罪与罚 ⭐⭐

```html
<div class="parent" style="border: 2px solid red;">
  <div class="child" style="float: left; height: 100px; width: 100px;"></div>
</div>
<!-- parent 高度 = 0：只剩边框贴成一条线 -->
```

**成因（联系《css-deep-003》BFC）**：浮动的设计初衷是「环绕」——容器假设会有文字流过来包住浮动元素，所以**计算高度时故意不含 float 子元素**（否则环绕无从谈起）。当 float 被用来做布局、容器里没有环绕文字时，这个「特性」就表现为「塌陷」。

塌陷的三宗罪：父元素背景/边框消失、后续布局错乱、footer 顶上来穿模。

### 三、清除浮动的三种姿势 ⭐⭐

**姿势 A：BFC 包裹（现代首选，原理见 css-deep-003 规则④）**：

```css
.parent { display: flow-root; }   /* BFC 高度包含浮动子元素 ✅ 零副作用 */
```

**姿势 B：clearfix 伪元素（历史标准，存量代码主流）**：

```css
.clearfix::after {
  content: '';
  display: block;   /* 一个看不见的块级盒 */
  clear: both;      /* 强制它排到所有浮动元素【下方】→ 撑开父高度 */
}
/* 原理：clear 让这个空盒"避让"浮动元素，父元素要包住它就得延伸到浮动元素下方 */
```

**姿势 C：overflow: hidden（借 BFC 的老偏方）**：

```css
.parent { overflow: hidden; }  /* 建立 BFC，副作用：裁剪溢出内容、下拉菜单被剪 */
```

**clear 属性本身的语义**：`clear: left/right/both`——「我不允许我的左侧/右侧/两侧有浮动元素」，元素会**下移**避开浮动。它管的是「自己怎么躲」，不是「清掉浮动」——名字叫 clear，动作是「避让」。

### 四、float 布局时代遗迹速览（读老代码必备）⭐

```css
/* 两栏布局（float + BFC）： */
.sidebar { float: left; width: 200px; }
.main    { display: flow-root; }     /* 或 overflow:hidden —— 不与浮动重叠 */

/* 圣杯/双飞翼三栏：float 负 margin 的杂技年代
   （两侧 float + 中间自适应 + 负 margin 拉回）—— 读得懂即可，新代码勿写 */
```

**新代码的判断标准**：布局用 flex/grid；环绕效果（文字绕图）用 float——**float 回到了它唯一正确的工作岗位**。

## 回看开篇

float 的一生：为环绕而生 → 被布局滥用 → 布局职责被 flex/grid 接管。高度塌陷是「环绕设计」与「布局用法」的错配产物——BFC（flow-root）与 clearfix 是给这个错配打的两个补丁。读懂它就读懂了 CSS 布局的演进史。

## 实战延伸

**1. 面试答题骨架**：「float 让元素脱离文档流但行内内容会环绕它，元素停靠到容器边或前一个浮动元素，宽度收缩为内容宽。容器计算高度时不含浮动子元素导致高度塌陷——清除方式三种：父级建 BFC（display: flow-root 零副作用首选）、clearfix 伪元素加 clear: both（存量主流）、overflow: hidden（有裁剪副作用）。clear 的语义是避让浮动而非删除浮动。现代布局交给 flex/grid，float 回归图文环绕的本职。」

**2. 一个快手辨析**：`display: inline-block` 排一行 vs `float` 排一行——前者不脱流（父高度正常）但有空白缝隙；后者脱流（塌陷）但无缝隙且可被 clear 避让。

**3. shape-outside 一句话**（加分）：让环绕按不规则形状排（圆形、多边形），float 在现代的高级玩法。

## 图解总结

```
float 行为：脱流 · 行内环绕 · 靠边停靠 · 宽度收缩 · 依次排列

      ┌─ parent（高度塌陷=0）─────────────┐
      │ ┌────┐                            │
      │ │float│  ← 文字绕行；块级盒穿过它   │
      │ └────┘                            │
      └────────────────────────────────────┘

清除三式：
 A. parent { display: flow-root }   ← BFC 包含浮动 ✅首选
 B. .clearfix::after { clear:both } ← 空盒避让撑高（存量主流）
 C. parent { overflow: hidden }     ← 借 BFC（裁剪副作用）

现代分工：布局=flex/grid | 环绕=float + shape-outside
```

## 总结

- float 五规则：脱流、行内环绕、靠边停靠、宽度收缩、同向依次排列；
- 高度塌陷根因：容器高度不含浮动子元素（环绕设计的副作用）；
- 清浮动三式：flow-root（首选）、clearfix::after + clear（存量主流）、overflow:hidden（有副作用）；
- clear 语义是「避让」浮动，不是「清除」浮动；
- float 已回归图文环绕本职，布局由 flex/grid 接管。

**面试一句话回答**：float 使元素脱离文档流、行内内容环绕其排布，元素向指定方向停靠并在宽度上收缩为内容尺寸；由于容器计算高度时不包含浮动子元素，会发生高度塌陷——清除浮动的方式有三种：给父元素建立块级格式化上下文，如 display: flow-root 或 overflow: hidden，使高度包含浮动子元素；或在父元素末尾添加 clearfix 伪元素并设置 clear: both，让一个空块级盒避让浮动元素从而撑开父级高度。clear 的本质是让元素下移避开浮动而非删除浮动。现代开发中布局职责已交给 flex 与 grid，float 回归图文环绕的本职场景。

## 思考题

1. 三个 float:left 的元素宽度各 33.3%，为什么可能还是放不下一行、最后一个掉了下来？（盒模型总宽、空白、box-sizing）
2. `clear: left` 的元素遇到 `float: right` 的元素会避让吗？clear 与 float 方向怎么对应？
3. 为什么 `display: inline-block` 的父容器不会高度塌陷？从「是否脱流」与「是否被父高度包含」两个维度对比 float。
4. 开放讨论：项目里还有 float 布局的老代码，你会在什么时机迁移到 flex/grid？迁移的回归风险清单（等高、间距、顺序）怎么列？

（思考题解析将同步录入小程序题库，关联本文 id：css-deep-006）

## 参考文献：

- CSS 规范 — CSS 2.2 §9.5 Floats（规则原文）
- MDN — [float](https://developer.mozilla.org/zh-CN/docs/Web/CSS/float)、[clear](https://developer.mozilla.org/zh-CN/docs/Web/CSS/clear)
- 《CSS 世界》第 6 章

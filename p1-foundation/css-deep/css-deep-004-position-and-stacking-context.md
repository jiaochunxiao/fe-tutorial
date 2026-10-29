---
id: css-deep-004
title: CSS 深入之 position 与层叠上下文
series: CSS 深入系列
seriesId: css-deep
stage: foundation
difficulty: 3
tags: [position, absolute, sticky, z-index, 层叠上下文]
readingTime: 20
prev: css-deep-003
next: css-deep-005
createdAt: 2026-10-26
---

# CSS 深入之 position 与层叠上下文

## 从「z-index: 9999 都压不住」的绝望说起

```css
.modal { position: fixed; z-index: 9999; }   /* 弹窗 */
.header { position: relative; z-index: 1; }
/* 结果：弹窗居然被 header 的子元素盖住了？！ */
```

无数前端在深夜对着 `z-index: 99999` 仰天长啸——因为 **z-index 不是全局排行榜，而是「层叠上下文」内部的局部比较**。⭐⭐ position 五值 + 层叠上下文，是 CSS 面试的常规重灾区，也是弹窗/吸顶/浮层等日常需求的直接知识。

## 第一部分：position 五值

### 定位体系速查 ⭐⭐

| 值 | 脱离文档流 | 定位参照 | 典型用途 |
|---|---|---|---|
| `static` | ❌ | 无（默认） | — |
| `relative` | ❌ | **自己在文档流中的原位置** | 微调 + 当 absolute 的参照 |
| `absolute` | ✅ | **最近的「已定位」祖先** | 悬浮徽标、弹层 |
| `fixed` | ✅ | **视口**（transform 陷阱⚠️） | 吸底栏、悬浮按钮 |
| `sticky` | ❌ | 滚动容器的指定阈值 | 吸顶表头 |

```css
/* relative 的核心理解：占位不动，视觉偏移 */
.box { position: relative; top: 10px; left: 20px; }
/* 文档流仍按原位置给它留坑（不挤别人），元素视觉上挪到 (20,10) */

/* absolute 的参照规则（面试必考）：
   从最近祖先向上找 position ≠ static 的第一个，找不到则是初始包含块（≈页面）
   ⚠️「已定位」包括 relative/absolute/fixed/sticky */

/* 经典组合拳：父 relative 子 absolute */
.parent { position: relative; }
.badge { position: absolute; top: 0; right: 0; }  /* 定在父的右上角 */

/* absolute 的"收缩"副作用：没写 left/top 时仍以原位置为基准（配合 margin 布局技巧）；
   写了 left:0; right:0 时可用 margin:auto 水平居中 —— 替代老式 transform 居中 */
```

**fixed 的 transform 陷阱** ⭐：

```css
/* 祖先有 transform/filter/perspective 时，fixed 的参照【不再是视口】而是该祖先！ */
.scroll-panel { transform: translateZ(0); }   /* 为优化加的硬件加速 */
.fixed-bar   { position: fixed; }             /* 悲剧：跟着 .scroll-panel 滚动了 */
```

**sticky 的三个使用前提**：

```css
.thead { position: sticky; top: 0; }
/* 生效条件：① 指定 top/bottom 阈值 ② 父容器不设 overflow: hidden（会新建滚动上下文）
           ③ 父容器高度大于粘性元素 —— 否则"粘"不出效果 */
```

## 第二部分：层叠上下文（Stacking Context）

### 一、它是什么：三维世界的「独立图层组」⭐⭐

层叠上下文 = 一个**三维概念上的独立图层组**：

- 组内元素的 z-index 只在**组内**比较；
- 组与组之间，用**组根元素的层级**比较——**一旦组决出胜负，组内 z-index 再大也出不了组**。

```
        视觉（Z 轴）
          ▲
          │   ┌─[层叠上下文A：z=2]────┐
          │   │  ┌─[子上下文A1：z=5]─┐│  ← 9999 也只在这个"信封"里有效
   ┌──────┼───│──│─────────────────││──┐
   │      │   │  └──────────────────┘│  │
   │  ┌───┼───┴──────────────────────┘  │
   │  │[层叠上下文B：z=3] —— 整组压在 A 上 │
   │  └─────────────────────────────────│
   └────────────────────────────────────┘
   A1 的 z=5 出不了 A 信封 → 被 B 整组盖住 ❗（开篇的绝望现场）
```

### 二、什么会创建层叠上下文 ⭐⭐

| 创建条件 | 例子 |
|---|---|
| 根元素 html | 页面本身就是一个大上下文 |
| position + z-index ≠ auto | `position:relative; z-index:1` |
| fixed / sticky（无需 z-index） | 吸顶/悬浮天生成组 |
| z-index 的 flex/grid 子项 | `z-index:1` 的 flex item |
| opacity < 1 | `opacity: 0.99` 就成 ⭐ |
| transform / filter / perspective | `transform: translateZ(0)` 的「硬件加速」常见副作用 |
| isolation: isolate | 专为隔离而生（零副作用）✅ |
| will-change 某些值 | 性能提示的意外副作用 |

### 三、没有 z-index 时的默认层叠顺序（7 层金字招牌）⭐⭐

同一个层叠上下文内，元素从底到顶：

```
① 背景边框（层叠上下文元素的 background/border）
② 负 z-index 的子上下文
③ 常规流块级盒（文档流 block）
④ 浮动盒
⑤ 行内盒（inline）
⑥ z-index: auto / 0 的定位元素
⑦ 正 z-index 的定位元素（数值越大越靠上）
```

**经典推论**：行内元素压过浮动（文字环绕图时文字在上）、`z-index:0` 与 `auto` 都在定位层但 0 会创建上下文而 auto 不会。

### 四、破案：开篇的绝望时刻

```css
.header { position: relative; z-index: 1; }    /* header 成了层叠上下文 */
.header .subnav { position: absolute; z-index: 9999; }
/* subnav 的 9999 只在 header 组内有效；
   弹窗 modal z-index: 9999 与 header 组比较 —— 同级 9999 按文档流顺序，
   header 在后 → header 组整体压住 modal ❗ */

/* 修复三选一：*/
/* A. 给 modal 更大的组级 z-index（99999 治标）*/
/* B. 把 modal 挪出 header 的兄弟结构，提升到 body 直下（弹层的标准做法——portal）*/
/* C. header 不建上下文：去掉 z-index 或用 isolation 隔离子导航 */
```

### 五、工程规范：z-index 分层治理 ⭐

```css
:root {
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-overlay: 300;   /* 遮罩 */
  --z-modal: 400;
  --z-toast: 500;     /* 永远最高 */
}
/* 三个纪律：
   1. 只允许在少数"浮层基类"上用 z-index，业务组件禁止随手写
   2. 弹层一律渲染到 body（React portal / Vue Teleport），避免陷入别人的上下文
   3. 需要隔离时用 isolation: isolate，别用 transform 之类的副作用属性 */
```

## 回看开篇

z-index 9999 压不住的原因：它困在某个层叠上下文「信封」里，而对手是另一个信封——**信封之间的比较看根元素的层级，与信封内部的 9999 无关**。定位到 body + 分层变量治理，从此不再堆数字。

## 实战延伸

**1. 面试答题骨架**：「position 五值中 relative 不脱流、以原位置偏移并常作 absolute 的定位参照；absolute 脱流找最近的已定位祖先；fixed 参照视口但祖先有 transform 时会被劫持；sticky 需要阈值且受滚动容器限制。层叠上下文是三维的独立图层组——z-index 只在组内有效，position+z-index、fixed、opacity 小于 1、transform 等都会创建；同上下文内默认层叠顺序是背景、负 z-index、块级、浮动、行内、z0 定位、正 z-index；工程上弹层渲染到 body 并用分层变量治理 z-index。」

**2. 快手辨析**：`z-index: auto` 与 `z-index: 0`——渲染层级相同，但 **0 创建层叠上下文而 auto 不创建**（子元素的 z-index 因此产生不同命运）。

## 图解总结

```
position: static→relative(占位偏移)→absolute(脱流找定位祖先)→fixed(视口,怕transform)→sticky(阈值粘性)

层叠上下文 = 独立信封：
  创建：html / positioned+z-index / fixed、sticky / opacity<1 / transform / isolation
  组内比较：z-index 生效；组间比较：看信封根的层级
  组内七层：背景 < 负z < 块级 < 浮动 < 行内 < z0定位 < 正z
治理：浮层变量分层 + portal 到 body + isolation 隔离
```

## 总结

- relative 占位偏移、absolute 脱流找定位祖先、fixed 对视口（transform 劫持）、sticky 需阈值与滚动容器配合；
- 层叠上下文是独立图层组：z-index 只在组内有效，组间看根的层级；
- 创建条件一族：position+z-index、fixed/sticky、opacity<1、transform、isolation；
- 组内七层默认顺序：背景→负z→块→浮→行内→z0 定位→正z；
- 工程治理：z-index 变量分层、弹层 portal 到 body、isolation 替代副作用属性。

**面试一句话回答**：position 中 relative 不脱离文档流、相对原位置偏移并常作为 absolute 的定位参照，absolute 脱离文档流相对最近的已定位祖先定位，fixed 相对视口定位但祖先有 transform 时参照会被劫持，sticky 需要阈值且父级不能有 overflow hidden；层叠上下文是三维上的独立图层组，z-index 只在组内生效，组与组之间以根元素层级比较，因此子元素设置再大的 z-index 也无法超越父级所在组的层级——position 加 z-index、fixed、sticky、opacity 小于 1、transform、isolation 都会创建上下文，同一上下文内的默认顺序是背景边框、负 z-index、块级、浮动、行内、定位的 z0、定位的正 z-index。

## 思考题

1. `z-index: auto` 与 `z-index: 0` 的子元素命运实验：两组各含一个 `z-index: 999` 的子元素，谁的子元素能盖过外部元素？为什么？
2. 为什么「文字永远压在浮动图片上」？（用七层顺序解释图文环绕现象）
3. 吸顶表格 thead 用 sticky 失效的三个排查步骤（阈值、overflow 祖先、父高）分别怎么检查？
4. 开放设计：团队的 z-index 规范从「各自凭感觉写 9999」演进到「CSS 变量分层」——列出你的分层表（dropdown/sticky/overlay/modal/toast）并说明弹层为什么还要配合 portal。

（思考题解析将同步录入小程序题库，关联本文 id：css-deep-004）

## 参考文献：

- CSS 规范 — CSS Positioned Layout / CSS 2.2 Appendix E（层叠顺序的规范原文）
- MDN — [position](https://developer.mozilla.org/zh-CN/docs/Web/CSS/position)、[层叠上下文](https://developer.mozilla.org/zh-CN/docs/Web/CSS/CSS_positioned_context/Stacking_context)
- 《CSS 世界》第 10 章

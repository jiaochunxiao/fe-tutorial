---
id: dom-events-002
title: DOM 与事件之事件流：捕获、目标与冒泡
series: DOM 与事件系列
seriesId: dom-events
stage: foundation
difficulty: 3
tags: [事件流, 捕获, 冒泡, addEventListener, DOM2 事件模型]
readingTime: 18
prev: dom-events-001
next: dom-events-003
createdAt: 2026-10-26
---

# DOM 与事件之事件流：捕获、目标与冒泡

## 从「两个 listener 触发顺序相反」说起

```js
grandpa.addEventListener('click', () => console.log('grandpa'));
grandpa.addEventListener('click', () => console.log('grandpa-捕获'), true);
// 点击 grandpa 内部按钮，输出：
// grandpa-捕获
// grandpa          ← 同一个元素上的两个监听，顺序竟由第三个参数决定！
```

这段代码引出 DOM 事件模型的核心：**事件不是「直接被元素收到」的，它经历了一场从窗口到目标再返回的完整旅行**。⭐⭐ 事件流（捕获→目标→冒泡）是事件体系的总纲——事件委托（下一篇）、阻止传播、框架合成事件全部建立在它之上。

## 现象与直觉解释

一次点击的完整旅程（DOM2 事件模型，1998 至今）：

```
① 捕获阶段（Capture）：从 window 一路【向下】问到目标
   window → document → html → body → … → 目标的父元素

② 目标阶段（Target）：事件到达被点击的元素
   （现代浏览器在此阶段按注册顺序执行监听，不再区分捕获/冒泡形态）

③ 冒泡阶段（Bubble）：从目标【向上】返回 window
   目标 → 父元素 → … → body → document → window
```

直觉模型：**「下潜送信，上浮回执」**——事件先潜到最深处（捕获），把信交给目标，再一路浮上来（冒泡），沿途每个元素都有机会处理。

### addEventListener 第三参 ⭐⭐

```js
el.addEventListener('click', handler, false);   // false（默认）：冒泡阶段执行
el.addEventListener('click', handler, true);    // true：捕获阶段执行
// 同一元素同一阶段按【注册顺序】执行；同一函数注册多次只生效一次
```

## 深入原理

### 一、完整旅程实验 ⭐⭐

```html
<div id="g">
  <div id="p">
    <button id="b">点我</button>
  </div>
</div>
```

```js
[['g'], ['p'], ['b']].forEach(([id]) => {
  document.getElementById(id).addEventListener('click',
    () => console.log(id, '捕获'), true);
  document.getElementById(id).addEventListener('click',
    () => console.log(id, '冒泡'));
});

// 点击按钮的输出：
// g 捕获
// p 捕获
// b 捕泡阶段执行？—— 目标阶段：现代浏览器按注册顺序
// b 捕获        ← 目标元素上的监听按【注册顺序】执行（先注册了捕获版）
// b 冒泡
// p 冒泡
// g 冒泡
```

**两个易错点**：① 旅程是 window 起、window 终（document/html 只是中途站）；② 目标阶段不重排——按注册顺序执行（规范早期在目标阶段也分捕泡，现代统一为注册序）。

<figure style="margin:2.2em 0">
<svg viewBox="0 0 720 340" width="100%" role="img" aria-label="事件流：捕获下潜、目标触发、冒泡上浮">
  <defs>
    <marker id="ef-ink" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#1C1A17"/>
    </marker>
    <marker id="ef-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#B03A2E"/>
    </marker>
  </defs>
  <rect x="270" y="36" width="180" height="42" rx="6" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.5"/>
  <text x="360" y="62" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13" font-weight="700" fill="#1C1A17">window</text>
  <rect x="286" y="94" width="148" height="42" rx="6" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.5"/>
  <text x="360" y="120" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13" fill="#1C1A17">document</text>
  <rect x="302" y="152" width="116" height="42" rx="6" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.5"/>
  <text x="360" y="178" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13" fill="#1C1A17">body</text>
  <rect x="318" y="210" width="84" height="42" rx="6" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.5"/>
  <text x="360" y="236" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13" fill="#1C1A17">div</text>
  <rect x="330" y="268" width="60" height="42" rx="6" fill="#FBF8F1" stroke="#B03A2E" stroke-width="2"/>
  <text x="360" y="294" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13" font-weight="700" fill="#B03A2E">button</text>
  <path id="ef-cap" d="M 240 57 C 210 90 240 140 262 173 C 286 208 300 250 324 289" fill="none" stroke="#1C1A17" stroke-width="1.6" stroke-dasharray="6 4" marker-end="url(#ef-ink)"/>
  <path id="ef-bub" d="M 396 289 C 430 250 462 200 496 150 C 520 116 512 80 452 57" fill="none" stroke="#B03A2E" stroke-width="1.6" stroke-dasharray="6 4" marker-end="url(#ef-red)"/>
  <circle r="6" fill="#1C1A17">
    <animateMotion dur="3.2s" repeatCount="indefinite" rotate="auto">
      <mpath href="#ef-cap"/>
    </animateMotion>
  </circle>
  <circle r="6" fill="#B03A2E">
    <animateMotion dur="3.2s" begin="1.6s" repeatCount="indefinite" rotate="auto">
      <mpath href="#ef-bub"/>
    </animateMotion>
  </circle>
  <text x="150" y="90" font-family="Noto Sans SC,sans-serif" font-size="13" font-weight="700" fill="#1C1A17">① 捕获阶段</text>
  <text x="150" y="112" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#6E675A">从 window 一路下潜</text>
  <text x="540" y="230" font-family="Noto Sans SC,sans-serif" font-size="13" font-weight="700" fill="#B03A2E">③ 冒泡阶段</text>
  <text x="540" y="252" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#6E675A">逐级上浮回 window</text>
  <text x="150" y="300" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#6E675A">第三方参 = true 时</text>
  <text x="150" y="322" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#6E675A">捕获段被叫醒</text>
</svg>
<figcaption style="font-family:'Noto Sans SC',sans-serif;font-size:13px;color:#6E675A;text-align:center;margin-top:10px">图 · 一次点击的完整旅行——黑点下潜（捕获），红点上浮（冒泡），button 是两者交汇的目标站</figcaption>
</figure>

### 二、哪些事件不冒泡 ⭐

大多数事件（click/input/keydown/submit）会冒泡；**不冒泡的著名例外**：

| 事件 | 说明 |
|---|---|
| `focus` / `blur` | 焦点进出（用 `focusin/focusout` 替代——会冒泡版 ⭐） |
| `mouseenter` / `mouseleave` | （用 `mouseover/mouseout` 替代——会冒泡且进出子元素触发） |
| `load` / `error`（资源类） | window/document 层级监听 |

「想在容器上委托 focus 事件」是经典陷阱——标准答案：换 `focusin`。

### 三、阻止传播：stopPropagation vs stopImmediatePropagation ⭐⭐

```js
btn.addEventListener('click', (e) => {
  e.stopPropagation();            // 不再【传给别的元素】——本元素其他监听仍执行
  e.stopImmediatePropagation();   // 连本元素后续监听一起停（抢先独占）
});

// ⚠️ 两个都不阻止「默认行为」——阻止跳转/提交要用 e.preventDefault()（下一篇详解）
```

## 回看开篇

同一个 grandpa 上两监听顺序相反的原因：`true` 让监听排队在**捕获阶段**（下潜路过时执行），`false` 排在**冒泡阶段**（上浮路过时执行）——同一元素因为「旅行路线」被访问两次，各阶段触发各自的监听。**第三参就是「你想在旅行的哪一段被叫醒」。**

## 实战延伸

**1. 面试答题骨架**：「DOM2 事件流分捕获、目标、冒泡三阶段——事件从 window 一路下潜到目标再上浮回 window；addEventListener 第三参 true 表捕获阶段执行、默认 false 表冒泡阶段执行，同元素同阶段按注册顺序、同一函数重复注册只生效一次；focus/blur 与 mouseenter/mouseleave 不冒泡，委托时改用 focusin 与 mouseover；stopPropagation 停止跨元素传播、stopImmediatePropagation 连同元素后续监听也停，两者都不阻止默认行为。」

**2. 「为什么默认监听冒泡而不是捕获」**：业务语义大多是「我或我的孩子被点了」——冒泡让祖先统一处理（事件委托的根基）；捕获的用途是「在孩子之前拦截」（全局快捷键拦截、埋点劫持）。

**3. 框架视角一句话**：React17 起把事件委托挂在 root 容器、Vue 原生冒泡——框架合成事件系统都构建在本篇的原生事件流之上。

## 图解总结

```
      window ◀━━━━━━━━ ③冒泡（上浮回执）━━━━━━━┓
        ▼                                        ┃
     document     ①捕获（下潜送信）              ┃
        ▼  window→…→父→目标            父元素 → … → body → document → window
      target ═══════ ②目标阶段（按注册顺序执行）═══════

第三参: true=捕获段被叫醒 | false/默认=冒泡段被叫醒
不冒泡: focus/blur(→focusin) | mouseenter/leave(→mouseover/out)
停止:   stopPropagation(不传别的元素) | stopImmediatePropagation(全停)
        ⚠️ 都不阻止默认行为 → preventDefault（下一篇）
```

## 总结

- 事件流三阶段：捕获（window→目标）、目标（注册序）、冒泡（目标→window）；
- 第三参选段：true 捕获、false 冒泡；同函数重复注册只一次；
- 不冒泡家族：focus/blur、mouseenter/mouseleave——委托用 focusin/mouseover；
- stopPropagation 停跨元素传播，stopImmediate 全停；均不影响默认行为；
- 冒泡是事件委托的根基，捕获用于提前拦截。

**面试一句话回答**：DOM2 事件模型把一次事件分为三个阶段——事件对象从 window 开始沿捕获路径向下传递到目标元素（捕获阶段），在目标元素上按监听注册顺序执行（目标阶段），再沿冒泡路径逐级上传回 window（冒泡阶段）；addEventListener 第三个参数为 true 时在捕获阶段触发、默认 false 在冒泡阶段触发，同一函数重复注册只会生效一次；focus、blur、mouseenter、mouseleave 不冒泡，需要委托时使用 focusin 和 mouseover 等冒泡版本；stopPropagation 阻止事件继续传播给其他元素、stopImmediatePropagation 额外阻止同元素后续监听，而两者都不阻止链接跳转等默认行为。

## 思考题

1. 画出点击三层嵌套最内层按钮时，全部 6 个监听（三层各捕泡）的执行顺序。
2. 为什么「全局快捷键」推荐在 window 上用捕获监听？从「比页面任何处理者都早」解释。
3. `e.stopPropagation()` 写在事件委托的 handler 里安全吗？什么场景会「误伤」其他委托？
4. 开放讨论：React 16 及之前把所有事件委托到 document，17 起改为挂到 root 容器——从事件流与多版本共存（微前端场景）的角度分析这次变更的原因。

（思考题解析将同步录入小程序题库，关联本文 id：dom-events-002）

## 参考文献：

- DOM Level 2 Events Specification — Event dispatch and DOM event flow（模型原文）
- MDN — [addEventListener](https://developer.mozilla.org/zh-CN/docs/Web/API/EventTarget/addEventListener)、[事件冒泡](https://developer.mozilla.org/zh-CN/docs/Learn/JavaScript/Building_blocks/Events#事件冒泡及捕获)
- 本课程《dom-events-003 事件对象》《dom-events-004 事件委托》

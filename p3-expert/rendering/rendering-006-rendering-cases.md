---
id: rendering-006
title: 渲染原理之性能案例复盘
series: 浏览器渲染原理系列
seriesId: rendering
stage: expert
difficulty: 4
tags: [性能案例, 复盘, 火焰图, 掉帧, 综合实战]
readingTime: 20
prev: rendering-005
next: null
createdAt: 2026-10-26
---

# 渲染原理之性能案例复盘

## 三个真实病例（本系列收官：把五篇原理装进病例）

> 医学以病例教学；性能以 case 复盘——本篇模拟三个典型「渲染病例」的完整诊断过程，每个病例都标注「用了哪篇的哪个原理」。

```
病例A: 商品列表滚动掉帧（FPS 曲线红成海）
病例B: 弹窗动画「先卡 200ms 再动」
病例C: 输入框打字延迟（每敲一个字卡 100ms）
```

## 病例 A：滚动掉帧 ⭐⭐⭐

**症状与第一现场**：

```
Performance 录制滚动 3 秒：
  Frames 轨: 大片红条（<30fps）
  Main 轨: 每个 scroll 事件任务 ~25ms，其中紫色 Recalculate Style + Layout 占 18ms
  （对照 rendering-001: 样式计算+布局是管线中段）
```

**诊断（沿证据链）**：

```js
// 业务代码（节选）——scroll 回调里的两大嫌疑：
window.addEventListener('scroll', () => {
  document.querySelectorAll('.item').forEach((el) => {       // 嫌疑① 每帧全量查询
    const rect = el.getBoundingClientRect();                  // 嫌疑② 读几何
    el.classList.toggle('active', rect.top < 100);            // 嫌疑③ 写样式(触发Style)
  });
}, { passive: true });
```

**病理分析**（三篇原理合击）：

```
① 读几何(rect) + 写样式(toggle) 交替 → Layout Thrashing（performance-005）
② scroll 作为任务跑在主线程（rendering-005 拼图①）—— 回调 25ms 吃掉 1.5 帧预算
③ 2000 个 item 每帧全量处理 —— 本可用观察者只处理可见项（dom-events-006）
```

**处方**（分层下药）：

```js
// 药1: rAF 合帧（rendering-004/005）——scroll 只置脏，rAF 里统一算
let ticking = false;
window.addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => { update(); ticking = false; });   // 每帧最多一次
}, { passive: true });

// 药2: 读写分离（performance-005）——先收集全部 rect 再统一改 class
// 药3: IntersectionObserver 替代全量遍历（dom-events-006）—— 只处理进出视口的项
// 药4: CSS containment: .item { contain: layout style; } 隔离重算范围（渲染侧加分项）

// 疗效: Main 轨单帧 < 6ms，FPS 回到 55+ ✅
```

## 病例 B：弹窗动画先卡后动 ⭐⭐

**症状**：点击「打开弹窗」→ 卡 200ms → 动画才开始。

**第一现场**：Main 轨显示动画开始前有一段 ~200ms 的任务：`buildModalDOM`（JS 动态创建 300 个节点）+ 首次 Layout。

**病理**（两篇合击）：

```
① 同步建 300 节点 = 长任务（>50ms，rendering-005 帧预算）
   —— 首帧动画排队等它 → 「先卡后动」
② 首次打开触发整棵树的 Style/Layout（rendering-001 管线全价）
```

**处方**：

```js
// 药1: 骨架先行 + 内容异步（打开瞬间只建外壳，内容 requestIdleCallback 分片补）
// 药2: 节点批量构建用 DocumentFragment（dom-events-001 一次上树）
// 药3: 预构建（空闲时提前 build 藏起来，打开只是 display 切换）⭐ 交互优化的经典手筋
// 药4: 弹窗提合成层 + transform 动画（rendering-003/css-deep-010）
//      —— 动画阶段零主线程参与，即便低端机也只动合成器

// 疗效: 打开到动画开始 < 16ms（一帧内）✅
```

## 病例 C：打字延迟 100ms ⭐⭐

**症状**：搜索框每敲一键卡顿（INP 视角：每次按键到字符上屏 ~100ms）。

**第一现场**：每次 input 事件的 Main 轨：`validate 全表单 30ms` + `render 实时预览列表 60ms` + Style/Layout 10ms。

**病理**：

```
input 每键都同步触发「全表单校验 + 全列表重渲」——
  ① 每键一个长任务（rendering-005: 输入回调排队→按键到上屏延迟）
  ② 校验与预览是「每键必做吗？」—— 语义拆解: 校验可 debounce、预览可分帧
```

**处方**：

```js
// 药1: 校验 debounce 300ms（handwritten-005 —— 停顿才验）
// 药2: 预览改增量/虚拟列表（performance-006 —— 只渲可见几十行）
// 药3: 校验逻辑迁 Worker？—— 单次 30ms 未到搬运阈值（performance-007 判定表）
//      改为: 拆分校验函数 + scheduler.yield 让路（每键内主线程及时归还→字符即时上屏）⭐
// 疗效: INP 从 100ms → 40ms ✅（输入的本质是"上屏优先，其余靠后"）
```

## 病例复盘的通用方法论 ⭐⭐⭐

三个病例共享同一条诊断流水线：

```
① 复现 + 录制（Performance 面板，稳定场景录 3 次取典型）
② 读三轨: Frames(掉帧?) → Main(谁长?) → 任务的色彩构成(JS黄? 布局紫? 绘制绿?)
③ 归因到管线段位: 任务太长? Style/Layout 太重? Paint 太大? 合成超载?
   （rendering-001 的五站 = 病理分科表）
④ 处方四素: 少做(算法/范围) │ 晚做(debounce/idle) │ 挪走(Worker/合成线程) │ 拆碎(yield/分帧)
⑤ 验证: 重录对比 + RUM 曲线（performance-002 的闭环）
```

**「四素处方」是万金油**——所有渲染性能优化都是这四个动作的组合。

## 回看整个系列

```
rendering-001 管线五站      → 病理分科表（归因框架）
rendering-002 层叠上下文    → 绘制顺序的正确性
rendering-003 合成层        → 病例B的"零主线程动画"
rendering-004 rAF           → 病例A的合帧、读写时机
rendering-005 事件循环交错  → 病例C的"上屏优先"、长任务病理
本篇                        → 诊断流水线 + 四素处方（收官）
```

原理不是背的——**每个原理都应该能在火焰图上指认出来**。

## 图解总结

```
诊断流水线:
 复现录制 → 三轨阅读(Frames/Main/色彩) → 归因到管线段位 → 四素处方 → 重录验证

四素处方:
 少做: 算法优化/范围收窄(contain/observer)
 晚做: debounce/idle/分优先级
 挪走: Worker(计算)/合成层(transform动画)
 拆碎: yield/分帧/虚拟化

病例速记:
 A滚动掉帧 = thrashing+全量 → rAF合帧+读写分离+IO观察者
 B先卡后动 = 长任务+首渲染 → 预构建+Fragment+合成层动画
 C打字延迟 = 每键长任务 → debounce+增量渲染+yield(上屏优先)
```

## 总结

- 诊断流水线五步：录制→三轨阅读→管线归因→四素处方→验证闭环；
- 四素处方：少做、晚做、挪走、拆碎——一切渲染优化的组合基；
- 病例 A/B/C 分别示范 thrashing、长任务、每键任务三大典型病理；
- 性能医生的职业习惯：先看三轨再开药，改完必须复测；
- 原理与火焰图互证——这才是「懂渲染原理」的最终形态。

**面试一句话回答**：渲染性能问题的诊断遵循固定流水线——先用 Performance 面板在可复现场景录制，然后读三轨：Frames 轨看掉帧分布、Main 轨找长任务、按颜色区分脚本、样式布局与绘制的占比，把问题归因到渲染管线的具体段位，再用四类处方组合施治——少做（收窄范围与算法）、晚做（防抖与空闲调度）、挪走（计算进 Worker、动画上合成层）、拆碎（任务让路与分帧渲染），最后重新录制并对照真实用户曲线验证闭环。典型病例如滚动掉帧源于读写交错的布局抖动加全量处理，用 rAF 合帧与读写分离治理；弹窗先卡后动源于同步建节点与首次渲染的长任务，用预构建与合成层动画治理；输入延迟源于每键全量校验渲染，用防抖与增量渲染加主动让路治理。

## 思考题

1. 把病例 A 的处方再前进一步：`content-visibility: auto` 能替代 IntersectionObserver 方案吗？各自的边界？
2. 病例 B 的「预构建」对内存的代价怎么评估？（隐藏树也占 DOM/样式内存——什么规模值得）
3. 给病例 C 设计 A/B 实验：验证「yield 让路」对打字延迟的收益——指标怎么定（INP per keystroke）？
4. 开放复盘：找一个你项目的真实性能问题，按本篇流水线写一份 200 字病历（症状/三轨证据/归因/处方/疗效）。

（思考题解析将同步录入小程序题库，关联本文 id：rendering-006）

## 参考文献：

- Chrome DevTools — Performance 面板官方教程（三轨阅读法）
- web.dev — Rendering Performance 系列案例
- 本课程《performance》全系列 + 《rendering-001~005》（本篇的全部依据）

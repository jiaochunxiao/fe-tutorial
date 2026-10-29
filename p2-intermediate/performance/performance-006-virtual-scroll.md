---
id: performance-006
title: 性能优化之长列表优化：虚拟滚动
series: 性能优化系列
seriesId: performance
stage: intermediate
difficulty: 4
tags: [虚拟滚动, 长列表, 定高, 变高, 手写实现]
readingTime: 20
prev: performance-005
next: performance-007
createdAt: 2026-10-26
---

# 性能优化之长列表优化：虚拟滚动

## 从「10 万条数据的下拉框」说起

```jsx
// 把 10 万条数据直接渲染成 DOM：
{list.map((item, i) => <Row key={i} {...item} />)}   // 生成 10 万个节点
// 结果：内存暴涨、首渲染十几秒、滚动掉帧成 PPT —— 浏览器扛不住的不是数据，是 DOM
```

DOM 节点的成本：每个节点占内存、参与样式计算与布局、拖累遍历——**万级 DOM 是页面性能的生死线**。⭐⭐⭐ 虚拟滚动（Virtual Scroll）是长列表的标准解，也是手写题的常客——核心思想一句话：**只渲染视口内的十几行，其余全是「数学」**。

## 现象与直觉解释

```
用户看到的视口（比如 800px 高，行高 40px → 可见 20 行）

传统渲染：｜████████████ 10万行 DOM ████████████｜  ← 全部真实存在
虚拟滚动：｜ ░░░空白(撑高度)░░░ ｜ 20 行真实 DOM ｜ ░░░空白(撑高度)░░░ ｜
           ↑ 一个高 400 万 px 的「假容器」撑起滚动条
           ↑ 滚动时算出「此刻该显示第 N~N+20 行」，动态换血
```

**三个关键角色**：

1. **撑高容器**：高度 = 总行数 × 行高（让滚动条如实地反映总量）；
2. **可见窗口的偏移**：`translateY(起始索引 × 行高)` 把渲染的行「搬」到正确位置；
3. **渲染窗口**：只渲染 `[startIndex, endIndex]` 的行（外加上下缓冲区）。

## 深入原理

### 一、定高版实现（50 行核心）⭐⭐⭐

```html
<div class="viewport" style="height: 800px; overflow: auto;">   <!-- 滚动容器 -->
  <div class="phantom" style="height: 4000000px;"></div>          <!-- 撑高 -->
  <div class="list" style="transform: translateY(0px);">          <!-- 渲染窗口 -->
    <!-- 只放 20 来行 -->
  </div>
</div>
```

```js
const ROW_H = 40, VIEW_H = 800, BUFFER = 5;
let data = [];               // 十万条
let listEl = …, phantomEl = …;

function onScroll() {
  const scrollTop = viewport.scrollTop;
  render(scrollTop);
}

function render(scrollTop) {
  // ① 数学换算：滚动位置 → 可见行范围
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - BUFFER);
  const end = Math.min(data.length, Math.ceil((scrollTop + VIEW_H) / ROW_H) + BUFFER);
  // ② 换血：窗口内的行重新渲染
  listEl.innerHTML = data.slice(start, end)
    .map((item, i) => rowHTML(item, start + i)).join('');
  // ③ 搬家：窗口平移到正确位置（transform 不触发重排 ⭐ performance-005）
  listEl.style.transform = `translateY(${start * ROW_H}px)`;
}

viewport.addEventListener('scroll', onScroll);   // 真实实现配 rAF 节流
```

**关键点**：滚动时只做「切片重渲 + 一次 translate」——DOM 数量恒定（~30 个），10 万条与 10 条的渲染成本相同。

### 二、变高版：定高公式的失效与对策 ⭐⭐

行高不定（聊天消息、评论），`scrollTop / ROW_H` 失效。三种解法：

```
① 预估+测量缓存（主流）：先用预估高渲染 → 渲染后测真实高存 Map
   → 累计高度数组（前缀和）→ 起始索引用二分查找 ⭐
   → 误差通过「滚动锚定/修正」渐进消除

② 全量预计算：数据先异步排版一遍拿全部真实高度（首屏延迟换确定性）

③ 分组等高：把变高内容分组，组内等高（简化问题的工程妥协）
```

```js
// 二分查找：给定 scrollTop，找到第一行满足 prefixSum[i+1] > scrollTop
function findStart(prefix, top) {
  let lo = 0, hi = prefix.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    (prefix[mid + 1] > top) ? hi = mid : lo = mid + 1;
  }
  return lo;
}
```

### 三、框架生态对应 ⭐

```jsx
// React：react-window（轻量）/ react-virtuoso / TanStack Virtual
import { FixedSizeList } from 'react-window';
<FixedSizeList height={800} itemCount={list.length} itemSize={40} width="100%">
  {({ index, style }) => <Row style={style} {...list[index]} />}
</FixedSizeList>

// Vue：vue-virtual-scroller（RecycleScroller 连 DOM 都复用）
```

**面试加分点**：RecycleScroller 的「DOM 回收复用」——滚动时上下场的行不是销毁重建，而是**挪位置换内容**（进一步省创建成本）；配合框架的 key 与状态保持（react-008 的 memo 确保窗口外不渲染）。

### 四、虚拟滚动的边界与代价 ⭐⭐

```
不适合虚拟滚动的场景：
  行内需要「浏览器原生查找 Ctrl+F」——虚拟列表搜不到未渲染行
  SEO/无 JS 环境（内容不在 DOM 里）
  行高度极度不稳定且无法预估（体验抖动）
代价：
  实现复杂度（变高/分组表头/横向滚动）
  无障碍与自动化测试的额外适配
替代/组合方案：
  分页加载（infinite scroll）+ 懒渲染 —— 万级以下够用
  content-visibility: auto（performance-005）—— 长文页面免 JS 的近亲方案
  Canvas/网格渲染 —— 超大规模表格（百万单元格）的终极方案
```

## 回看开篇

10 万行卡的根源是「10 万个 DOM 同时存在」；虚拟滚动的三件套（撑高假容器 + translateY 窗口 + 切片渲染）让 DOM 恒定在 ~30 个——**用「数学上的存在」替代「物理上的存在」**，这正是应对规模问题的通用思想（分页、懒加载、虚拟化同族）。

## 实战延伸

**1. 面试答题骨架**：「虚拟滚动的原理是只渲染视口内的行——用一个高度等于总行数乘行高的占位容器撑出真实滚动条，滚动时按 scrollTop 除以行高算出可见起止索引（加缓冲），只渲染该切片，并用 translateY 把窗口平移到正确位置、transform 不触发布局；DOM 数量恒定使渲染成本与数据总量无关。变高行的方案是预估高度加渲染后测量缓存，累计高度用二分查找定位，误差渐进修正；生产用 react-window 或 vue-virtual-scroller，其中 RecycleScroller 还会复用行 DOM。边界是 Ctrl+F 搜索、SEO 与极度不定的行高场景。」

**2. 手写价值**：定高版 50 行——亲手写一遍并回答三个追问（缓冲区作用/translateY 为什么不用 top/滚动抖动怎么来的）。

## 图解总结

```
viewport(overflow:auto) ────────────────────────
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░ phantom: height=总数×行高（撑滚动条）░░ │
│      ┌─ translateY(start×行高) ─┐           │
│      │ Row[start] … Row[end]    │ ← 只渲染的窗口（+缓冲）
│      └──────────────────────────┘           │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
滚动: scrollTop → start=floor(top/行高)-buf → 切片重渲+transform平移
变高: 预估高渲染→测量缓存→前缀和+二分定位→渐进修正
```

## 总结

- 三件套：撑高容器（真实滚动条）+ 渲染窗口切片 + translateY 平移；
- 定高版 50 行核心：数学换算索引 + transform 搬家（不触发重排）；
- 变高版：预估+测量+前缀和+二分；生产用成熟库（含 DOM 复用）；
- 边界：Ctrl+F、SEO、极端变高不适合；万级以下分页够用；
- 与 content-visibility、Canvas 方案构成规模阶梯。

**面试一句话回答**：虚拟滚动的核心是用数学存在替代物理存在——渲染一个高度等于总行数乘行高的占位容器来撑出真实的滚动条，滚动时根据 scrollTop 除以行高计算出当前可见的起止行索引并加上下缓冲区，只渲染这个切片里的十几二十行，再通过 translateY 把渲染窗口平移到滚动位置——transform 不触发布局重排，DOM 数量恒定使渲染成本与数据总量无关。行高不定时采用预估高度先渲染、渲染后测量真实高度缓存并维护累计高度前缀和、用二分查找定位起始行、误差渐进修正的方案；生产使用 react-window 或 vue-virtual-scroller 等成熟实现，其中还包含行 DOM 的回收复用。需要注意虚拟列表不支持浏览器原生查找且对 SEO 不友好。

## 思考题

1. 缓冲区（BUFFER=5）解决什么问题？调大/调小各有什么代价？
2. 用 `top` 替代 `translateY` 平移窗口会发生什么？（每帧重排——performance-005 的直接应用）
3. 聊天记录「跳到底部」在虚拟列表里怎么实现？（总高计算误差 + scroll 锚定修正）
4. 开放设计：表格同时支持「10 万行 × 50 列」的虚拟化（双向虚拟）——横向列虚拟的额外难点（列宽与粘性表头）。

（思考题解析将同步录入小程序题库，关联本文 id：performance-006）

## 参考文献：

- react-window / vue-virtual-scroller 文档与源码
- web.dev — Virtualize long lists（官方思路）
- 本课程《performance-005 渲染优化》《dom-events-006 观察者API》（懒加载近亲）

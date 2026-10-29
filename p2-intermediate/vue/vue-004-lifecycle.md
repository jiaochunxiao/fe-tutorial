---
id: vue-004
title: Vue 原理之生命周期钩子的触发时机
series: Vue 原理系列
seriesId: vue
stage: intermediate
difficulty: 3
tags: [生命周期, beforeCreate, mounted, patchFlag, 组合式API]
readingTime: 18
prev: vue-003
next: vue-005
createdAt: 2026-10-26
---

# Vue 原理之生命周期钩子的触发时机

## 从「mounted 里拿不到最新 DOM」的悬案说起

```js
// Vue 2 或选项式 API 的常见悬案：
watch: {
  list() {
    this.$refs.list;        // ⚠️ 可能还是旧的
    this.$nextTick(() => { this.$refs.list; }); // ✅ 拿到新的
  }
}
```

要解释它，得知道**每个钩子在渲染流程的哪一站被调用**。⭐ 生命周期不是八个孤立的名词，而是**一条渲染流水线上的八个站点**——记住流水线，钩子的顺序、能拿到什么、该做什么，全部自洽。

## 现象与直觉解释

一个组件实例的一生 = **创建（setup）→ 挂载（mount）→ 更新（update 循环）→ 卸载（unmount）** 四幕：

```
          创建            挂载            更新(可循环)          卸载
  ┌─────────────┬──────────────┬────────────────────┬──────────────┐
  │ setup*      │ onBeforeMount │ onBeforeUpdate    │ onBeforeUnmount│
  │ onCreated†  │ onMounted ⭐  │ onUpdated ⭐      │ onUnmounted   │
  └─────────────┴──────────────┴────────────────────┴──────────────┘
  † 选项式 API；* 组合式 API 中 setup 即"beforeCreate+created"
```

## 深入原理：把钩子钉在渲染流程上 ⭐⭐

### 第一幕：创建——响应式就绪，但无 DOM

```
① props 解析 → ② setup() 执行（组合式 API 的"初始化主场"：
   此时能用 props 与响应式声明，但【没有 this、没有实例方法】）
   → ③ 选项式：beforeCreate（此时拿不到 data/methods）
   → ④ 注入响应式（data/reactive 初始化）→ created（数据就绪，仍无 DOM）
```

**结论**：请求数据放 created 或 setup 都行（不依赖 DOM）；setup 里没有 this（组合式的原则：用闭包不用实例）。

### 第二幕：挂载——DOM 诞生

```
⑤ 编译模板/取 render 函数 → beforeMount
⑥ 执行 render → 生成 vnode → patch 挂载真实 DOM（递归子组件各自走一遍⑤⑥）
⑦ 【所有同步子组件都 mounted 之后】→ 父组件 mounted ⭐
```

**mounted 的两个经典细节** ⭐：

- **子先父后**：整棵树同步挂载完成，最深的子组件先 mounted，父组件最后——「父 mounted 时子一定 mounted（同步子组件）」；
- mounted **不保证所有异步内容就绪**（图片高度、异步组件）——要精确时机用 nextTick 或对应 API。

### 第三幕：更新——数据变 → 重新渲染 ⭐⭐（开篇悬案的现场）

一次更新的完整时序：

```
数据变化 → trigger → 组件渲染 effect 入【调度队列】（不立即执行！vue-001）
→ 队列 flush 时依次执行组件更新：
    onBeforeUpdate      ← 此时：数据已是新的，DOM 还是旧的 ⭐
    重新 render + patch → DOM 更新
    onUpdated          ← 此时：DOM 已是新的
```

**watch 回调的入队时机**（默认 flush: 'pre'）：在 beforeUpdate 之前、渲染之前——所以 watch 回调里**直接读 DOM 是旧的**（开篇悬案的答案），`nextTick` 把操作挪到本轮 flush 之后（DOM 已更新）。这也解释了 `flush: 'post'` 的 watch 为什么能直接拿新 DOM——它的回调排在更新之后（《vue-003》）。

### 第四幕：卸载——清理的最后一站

```
onBeforeUnmount → 实例仍完整（适合「关闭前的确认/上报」）
→ 拆除：停止渲染 effect、解绑指令、递归卸载子组件
→ onUnmounted → 组件树与 DOM 移除完毕
```

**清理清单**（组件卸载必做，防内存泄漏）：手动 addEventListener 的解绑、定时器 clear、第三方实例 destroy、全局总线 off——《v8-005》可达性的工程面。

### 钩子与调试工具 ⭐

Vue DevTools 的 Timeline 能可视化每次钩子的触发；**keep-alive 专属二钩**：`onActivated/onDeactivated`（缓存激活/失活——被缓存组件不走卸载流程，这是与普通卸载的最大差异）。

### 组合式 API 的组织哲学 ⭐⭐

选项式把代码按「钩子类型」分组（所有 data 一块、所有 mounted 一块）；组合式按「功能」分组（一个功能的 state+watch+onMounted 写在一起）——**钩子从「时间切片」变成「功能切片里的时间点」**：

```js
// 一个"搜索"功能的全部逻辑聚在一处（含它的生命周期点）：
function useSearch() {
  const kw = ref('');
  const results = ref([]);
  onMounted(() => loadFromCache());      // 属于本功能
  onUnmounted(() => saveToCache());      // 属于本功能
  return { kw, results };
}
```

## 回看开篇

watch 回调（默认 pre flush）跑在**渲染之前**——数据新、DOM 旧；`$nextTick` 的语义是「本轮更新 flush 完成后」（微任务，《vue-005》专篇），所以能拿到新 DOM。**钩子时序不是背出来的，是渲染流水线推导出来的。**

## 实战延伸

**1. 面试答题骨架**：「生命周期四幕——创建期 setup/created 时响应式与数据就绪但无 DOM；挂载期 beforeMount 后执行 render 并 patch，同步子组件全部挂载完才触发父级 mounted（子先父后）；更新期数据变化先把渲染 effect 入调度队列，flush 时依次经过 beforeUpdate（数据新 DOM 旧）、重新 patch、updated（DOM 新）——默认 watch 回调排在渲染前所以读到旧 DOM，需 nextTick 或 flush post；卸载期 beforeUnmount 时实例仍可用，onUnmounted 后完成解绑清理。keep-alive 组件不卸载而走 activated/deactivated。」

**2. 快手排序题**：父子的 mounted 顺序？——子先父后；beforeMount 顺序？——父先子后（父先进入挂载流程才轮到子）。

**3. 一道综合题**：异步组件的 mounted 时序——父 mounted 不等异步子组件（首次渲染时异步子尚未到位，父照样 mounted；异步组件加载完成后自己走挂载）。

## 图解总结

```
 setup（组合式初始化）
   │ 数据就绪，无DOM
 beforeCreate ──注入响应式──▶ created
   │
 beforeMount ──render+patch──▶ DOM诞生 ──同步子组件全部挂载──▶ mounted（子先父后）
   │
   ▼ ──── 数据变化（可循环）────
 trigger → 渲染effect入队 → flush:
   beforeUpdate（数据新/ DOM旧）→ patch → updated（DOM新）
   （watch pre 回调在 patch 前 → 读DOM需 nextTick）
   │
 beforeUnmount（实例完整）→ 解绑/递归卸载 → onUnmounted
 keep-alive 支线: deactivated ⇄ activated（不卸载）
```

## 总结

- 四幕模型：创建（数据就绪无 DOM）→ 挂载（DOM 诞生，子先父后）→ 更新（beforeUpdate 数据新 DOM 旧）→ 卸载（beforeUnmount 实例仍在）；
- watch 默认 pre：回调在渲染前——读新 DOM 要 nextTick 或 flush: post；
- mounted 不等异步内容；异步组件独立走挂载；
- keep-alive 用 activated/deactivated 替代卸载；
- 组合式 API 把钩子从时间切片变成功能切片的时间点。

**面试一句话回答**：生命周期按四幕展开——创建阶段 setup 与 created 时响应式数据就绪但还没有 DOM，请求不应依赖 DOM 的可以在此发起；挂载阶段 beforeMount 后执行 render 与 patch 生成真实 DOM，同步子组件全部挂载完成后父组件的 mounted 才触发，即子先于父，但 mounted 不保证异步内容就绪；更新阶段数据变化先将渲染副作用排入调度队列，flush 时先触发 beforeUpdate（数据已新、DOM 还是旧）、随后重新 patch、再触发 updated；卸载阶段 beforeUnmount 时实例仍完整适合收尾上报，onUnmounted 后完成全部解绑，需在此清理定时器、全局监听与第三方实例。keep-alive 缓存的组件不走卸载而是 activated 与 deactivated。

## 思考题

1. 为什么父组件 mounted 时「同步子组件一定已挂载，异步子组件不一定」？从 patch 的递归顺序解释。
2. 在 `onUpdated` 里改自身状态会发生什么？（可能死循环——updated 内改触发更新的数据；如何防御）
3. setup 里能用 onMounted 吗？为什么组合式 API 要求钩子「同步注册」？（异步调用时 activeInstance 已变——注册与实例的绑定关系）
4. 开放设计：给「图表组件」设计生命周期策略：mounted 初始化实例、updated 更新数据、resize 监听在 mounted 加/unmounted 卸、keep-alive 下 deactivated 冻结——列出各钩子的职责表。

（思考题解析将同步录入小程序题库，关联本文 id：vue-004）

## 参考文献：

- Vue 3 官方文档 — 生命周期钩子图示与组合式 API 对照
- 《Vue.js 设计与实现》第 6 章（挂载与更新中钩子的调用位置）
- 本课程《vue-001 响应式》《vue-003 computed/watch》《vue-005 nextTick》

---
id: react-006
title: React 原理之 setState：批处理与更新时机
series: React 原理系列
seriesId: react
stage: intermediate
difficulty: 4
tags: [setState, 批处理, 自动批处理, 合并, React 18]
readingTime: 18
prev: react-005
next: react-007
createdAt: 2026-10-26
---

# React 原理之 setState：批处理与更新时机

## 从「一次点击，两个 state，渲染几次」说起

```jsx
function handleClick() {
  setCount(count + 1);
  setFlag(!flag);
  // React 17：渲染 1 次（事件回调内自动批处理 ✅）
}
setTimeout(() => {
  setCount(count + 1);
  setFlag(!flag);
  // React 17：渲染 2 次 ❗（回调外不批处理）
  // React 18：渲染 1 次 ✅（automatic batching）
}, 1000);
```

「批处理（batching）」——React 性能模型的第一个词，也是 17→18 变化最大的一处。⭐⭐「setState 是同步还是异步」「为什么连续两次 +1 只加一」是面试的经典三连，本篇一次讲透。

## 现象与直觉解释

先破题：**「setState 是异步的」是不精确的说法**。精确表述：

> setState **从来不是异步操作**（它同步地把更新排入队列）；「异步」的是**渲染**——React 把一次事件里的多次 setState 攒起来，**稍后合并成一次渲染**。

```
setCount(1) ─┐
setFlag(true)─┼──▶ [更新队列] ──同步代码结束──▶ 批量 flush：一次 render+commit
setX('a')  ──┘
```

与 Vue 的 nextTick 调度器本质同源（《vue-005》——两家用同一套「微任务批量」思想），差异在收集方式（React 事件边界/任意上下文 vs Vue 响应式触发自动入队）。

## 深入原理

### 一、批处理的演进：17 的「事件边界」与 18 的「自动」⭐⭐

**React 17 及之前：合成事件内批处理**

- 合成事件回调（onClick 等）里：多次 setState 自动合并（事件系统用 `isBatchingUpdates` 标志包裹）；
- 回调之外（setTimeout、Promise.then、原生事件）：**逐个触发渲染**——每次 setState 单独走一遍 render+commit。

**React 18：automatic batching（自动批处理）**

- 新的并发调度（react-003 的 Scheduler）接管：**任何上下文**里的多次 setState 都合并——setTimeout、Promise、原生事件一视同仁；
- 需要立即逐次更新时：`flushSync(() => { setX(1) })` 强制同步冲刷（如 toast 顺序保证）。

### 二、「连续两次 +1 只加一」的完整解释 ⭐⭐⭐

```jsx
const [count, setCount] = useState(0);
setCount(count + 1);   // count 是本次渲染的快照 = 0 → 排队更新"设为 1"
setCount(count + 1);   // 还是同一个快照 0      → 排队更新"设为 1"（覆盖前一个）
// 渲染：count = 1 ❗ 两次 +1 实际 +1

setCount((c) => c + 1);  // 函数式：基于队列最新值 0 → 1
setCount((c) => c + 1);  // 基于队列最新值 1 → 2 ✅ 两次 +1 正确 +2
```

两个机制叠加的解释（各占一半责任）：

1. **快照**：count 是本次渲染的常量（react-004）——两次读的都是 0；
2. **合并**：对象式更新「后者覆盖前者」，函数式更新在队列里**链式叠加**。

类组件的 `this.setState({ count: this.state.count + 1 })` 同病同方（`this.setState((s) => ({ count: s.count + 1 }))`）。

### 三、「更新到底什么时候生效」⭐⭐

```jsx
setCount(1);
console.log(count);              // 旧值（本快照内 count 永不变）
// 生效时机：本轮批处理 flush → 重新执行组件函数 → 新快照 count=1

// 需要等"生效后"的代码怎么写：
// ① 函数组件：useEffect(() => {...}, [count])      ← 副作用时机
// ② 类组件：componentDidUpdate / setState 回调（第二参，legacy）
// ③ 强同步：flushSync(() => setCount(1)); 之后立即可读（DOM 与状态都最新）
```

### 四、批处理下的执行顺序细节 ⭐

```jsx
setTimeout(() => {
  console.log('A');          // 同步代码
  setCount(1);               // 入队
  Promise.resolve().then(() => console.log('C'));  // 微任务
  setFlag(true);             // 入队（18：与上面合并为一次渲染）
  console.log('B');          // 同步代码
}, 0);
// 输出顺序：A → B → C；渲染发生在同步代码之后的调度中（微任务/更晚的调度点）
```

### 五、容易混淆的三种「合并」⭐

| 概念 | 谁和谁合并 | 层面 |
|---|---|---|
| 批处理 batching | 多次 setState → 一次渲染 | 调度层 |
| 函数式更新叠加 | 队列里的多个更新函数链式执行 | 状态计算层 |
| 对象式覆盖 | 后一个对象更新覆盖前一个 | 状态计算层 |

三句话记忆：**调度上合批、计算上函数链、对象式会覆盖**。

## 回看开篇

一次点击两个 state 渲染几次的完整答案：React 17 只在合成事件内合批（回调外两次）；React 18 的自动批处理覆盖所有上下文（一律一次）——`flushSync` 是唯一的「现在就要」通道。

## 实战延伸

**1. 面试答题骨架**：「setState 本身是同步的入队操作，异步的其实是渲染——React 把一次执行上下文里的多次更新合并为一次 render+commit。React 17 只在合成事件回调内批处理，setTimeout、Promise、原生事件里的 setState 会逐个触发渲染；React 18 的 automatic batching 在任何上下文都合并，需要立即更新时用 flushSync。连续两次对象式 +1 只加一，一半责任是快照（count 是本次渲染常量）、一半是合并（对象式更新相互覆盖），函数式 setState 基于队列最新值链式叠加是正解。」

**2. 一道时序综合题**（把 004/005/006 串起来）：

```jsx
const [n, setN] = useState(0);
function click() {
  console.log(n);            // 0
  setN(n + 1);               // 快照 0 → 队列"设为1"
  console.log(n);            // 0
  setN((c) => c + 1);        // 队列链：1 → 2
  console.log(n);            // 0
  Promise.resolve().then(() => console.log(n));  // 0（微任务在 flush 前？——18 中批 flush 也在微任务，注册序在前则先打印旧值）
}
// 输出：0 0 0 … 0 —— 本快照内 n 恒为 0；新值要到下一次渲染
```

**3. 对照 Vue 一句话**：Vue 用响应式触发自动入队（开发者无感），React 靠调用边界合批（需要理解机制）——「数据驱动调度」vs「调用驱动调度」。

## 图解总结

```
setState(1)──┐                        「异步的是渲染，不是 setState」
setState(2)──┼──▶ 更新队列 ──同步代码结束──▶ flush：一次 render+commit
setState(3)──┘        （函数式更新在队列内链式叠加 ⭐）

React 17: 合成事件内批处理 | setTimeout/Promise/原生事件 ❌逐次渲染
React 18: automatic batching —— 任何上下文都合并 | flushSync 强制同步冲刷

+1 陷阱: 对象式 setCount(count+1)×2 → +1（快照恒0 + 对象覆盖）
         函数式 setCount(c=>c+1)×2 → +2（队列链式叠加）
```

## 总结

- setState 同步入队，渲染被合批推迟——「异步」的是渲染不是调用；
- 17 事件边界批处理 → 18 全上下文自动批处理；flushSync 是逃生舱；
- 连续 +1 只加一 = 快照 + 对象式覆盖；函数式更新队列链式叠加是正解；
- 读取更新后状态：useEffect / 更新回调（类组件）/ flushSync；
- 三种合并辨析：调度合批、函数链叠加、对象覆盖。

**面试一句话回答**：setState 本身是同步的入队操作，所谓异步的其实是渲染——React 把一个执行上下文里的多次更新攒进队列，在同步代码结束后合并为一次 render 与 commit。React 17 只对合成事件回调内的多次 setState 批处理，setTimeout、Promise、原生事件中的调用会各自触发渲染；React 18 引入自动批处理，任何上下文下的更新都会合并，需要立即生效时使用 flushSync 冲刷。连续两次 setCount(count+1) 只加一，一半原因是 count 是本次渲染的快照常量、另一半是对象式更新在队列中相互覆盖；函数式 setCount(c=>c+1) 基于队列最新值链式叠加，是连续更新的正确写法。

## 思考题

1. `flushSync` 包裹两个 setState 会渲染几次？滥用它有什么代价？
2. React 18 的自动批处理对「第三方库里 setTimeout 中连续 setState」的老代码是优化还是隐患？（行为变化点）
3. 类组件 `setState(partialState, callback)` 的 callback 与 useEffect 对应关系？为什么说 callback 是 legacy？
4. 开放讨论：Vue 的响应式调度与 React 的批处理，谁对「开发者心智」更友好？谁对「性能下限」更稳？各自付出什么代价？

（思考题解析将同步录入小程序题库，关联本文 id：react-006）

## 参考文献：

- React 官方博客 — Automatic batching（React 18 发布说明）
- React 官方文档 — State Updates May Be Batched / queueState 系列文档
- 本课程《react-004 Hooks 原理》《vue-005 nextTick》（两家的调度对照）

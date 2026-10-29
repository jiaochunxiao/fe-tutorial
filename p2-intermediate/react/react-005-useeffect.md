---
id: react-005
title: React 原理之 useEffect 与闭包陷阱
series: React 原理系列
seriesId: react
stage: intermediate
difficulty: 4
tags: [useEffect, 依赖数组, 闭包陷阱, 清理函数, useLayoutEffect]
readingTime: 22
prev: react-004
next: react-006
createdAt: 2026-10-26
---

# React 原理之 useEffect 与闭包陷阱

## 从「setInterval 计数永远停在 1」说起

```jsx
useEffect(() => {
  const id = setInterval(() => setCount(count + 1), 1000);
  return () => clearInterval(id);
}, []);
// 期望每秒 +1，实际：到 1 之后就【永远不动了】
```

这是 React 最著名的「闭包陷阱」现场——也是理解 useEffect 本质的最佳入口：**effect 是「当次渲染的快照」的囚徒**。⭐⭐⭐ useEffect 的执行时机、清理模型、闭包陷阱与逃生通道，是 React 面试的核心考点。

## 现象与直觉解释

useEffect 的心智模型（来自官方的精准比喻）：

> **每次渲染完，都把 effect 函数「拍下来」存好，渲染后异步执行；下次依赖变了，先执行上一张快照的清理函数，再执行新快照的 effect。**

```jsx
// 第 1 次渲染 (count=0)：effect₁ = { () => {... setCount(0+1) ...} }  ← 闭包捕获 count=0
// 第 2 次渲染 (count=1)：effect₂ = { () => {... setCount(1+1) ...} }  ← 捕获 count=1
// 依赖 [count] 时：渲染后 先 cleanup effect₁ → 执行 effect₂
// 依赖 [] 时：只执行 effect₁ —— setInterval 每秒都在跑 effect₁ 的闭包：0+1
//   第 1 秒 setCount(1)，之后每秒仍然 setCount(0+1)=1 —— 「永远停在 1」❗
```

**effect 不是「最新的逻辑」，是「某一次渲染的逻辑」**——闭包快照（js-deep-005）在 Hooks 场景的全部戏剧性。

## 深入原理

### 一、执行时机：异步、渲染后、批量 ⭐⭐

```
组件函数执行（render 阶段）
  └─ useEffect 被调用：只是【登记】（把 effect 回调 + 依赖挂到 Fiber 的链表）
commit 阶段（DOM 已更新）
  ├─ 同步执行 useLayoutEffect ──▶ 浏览器 paint ──▶ 异步执行 useEffect
  │   （paint 前同步 / paint 后异步 —— 两个 Hook 的唯一本质差异 ⭐）
  └─ 「渲染完成后执行副作用」的精确含义：DOM 就绪、用户尚未/已见新帧
```

**为什么 useEffect 异步**：副作用（请求、日志、订阅）不该阻塞绘制——先让用户看到界面，副作用稍后补齐。**useLayoutEffect 同步**：适合「必须在新帧画出来前完成的 DOM 操作」（量尺寸、防闪烁定位）。

### 二、清理函数的完整模型 ⭐⭐

```jsx
useEffect(() => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);    // 清理函数
}, [count]);
```

清理的触发时机（两个，都常被忽略第二个）：

1. **依赖变化**：执行新 effect **之前**先清理旧的；
2. **组件卸载**：最后清理一次。

完整时序（依赖变化）：

```
渲染N(count=1) → commit → 【清理 effectₙ₋₁】→ 执行 effectₙ
```

**这个模型解决了「订阅泄漏」与「竞态」**——每次清理重建，等于「每个状态版本一个独立的副作用生命周期」：

```jsx
// 竞态治理的标准姿势（对比 js-async-008 的手动取消）：
useEffect(() => {
  let ignore = false;                        // ⭐ 竞态守卫
  fetchUser(userId).then((u) => { if (!ignore) setUser(u); });
  return () => { ignore = true; };           // 下次/卸载前：作废本次结果
}, [userId]);
```

### 三、依赖数组：三种形态与「诚实原则」⭐⭐

| 写法 | 执行时机 | 场景 |
|---|---|---|
| 不写（undefined） | **每次渲染后** | 少数必须每次跑的 |
| `[]` | 仅首次（+卸载清理） | 挂载时订阅（但注意闭包快照！） |
| `[a, b]` | a/b 变化时 | 主流：副作用与哪些状态绑定 |

**依赖数组的本质：声明「这个 effect 快照对哪些值敏感」**——漏写依赖 = 声明「不敏感」= 使用过期快照而不自知。ESLint exhaustive-deps 是「诚实检查器」。

### 四、闭包陷阱的四条逃生通道 ⭐⭐⭐（本文压轴）

```jsx
// 陷阱现场：定时器/事件监听/长任务里读到旧值

// 通道① 函数式更新（最优先 —— 状态计算类）
setCount((c) => c + 1);           // 基于队列最新值，不依赖闭包快照

// 通道② 把依赖写全 —— 让 effect 随值重建
useEffect(() => { ... }, [count]);   // 每次用新快照重建副作用（订阅类正解）

// 通道③ useRef —— 「逃生舱」：ref.current 永远指向最新值（不触发渲染）
const countRef = useRef(count);
useEffect(() => { countRef.current = count; });     // 每次渲染同步最新值
setInterval(() => setCount(countRef.current + 1), 1000);  // 读 ref 取新值 ✅

// 通道④ useReducer —— 把「逻辑+最新状态」都放进 reducer（调度到 state 更新机制）
```

**选型口诀**：能用函数式更新就用它（零成本）；副作用与状态强绑 → 写全依赖让它重建；定时器/全局监听类（不能频繁重建）→ ref 逃生舱。

### 五、useEffect 中的经典误区清单 ⭐

1. **「useEffect 当生命周期钩子用」**——它是「同步副作用的声明」，不是 componentDidMount 的替身；心智换成「声明式同步」会少踩一半坑；
2. **对象/数组依赖**：`[obj]` 每次都是新引用 → 每次都执行——依赖要拆到原始值或 memo 化对象；
3. **effect 里 await 后直接 setState**——组件可能已卸载（ignore 守卫或 AbortController）；
4. **链式 effect**（a 变 → effect 设置 b → b 的 effect 设置 a）——多数是「派生状态」该用 useMemo/渲染期计算，不是 effect。

## 回看开篇

定时器停在 1 的完整解释：空依赖导致 effect 只执行**第一次渲染的快照**——setInterval 每 1000ms 执行的都是 `setCount(0 + 1)`；count 到 1 后永远 1。四条通道任选其一即可修复：函数式 `setCount(c => c+1)` 最简——它根本不需要读闭包。

## 实战延伸

**1. 面试答题骨架**：「useEffect 在 render 阶段只登记，commit 后于浏览器绘制之后异步执行，useLayoutEffect 则在绘制前同步执行。每次渲染都会创建捕获当次状态快照的 effect 函数，依赖变化时的顺序是先执行上一份的清理函数再执行新的，卸载时再清理一次——这套重建模型天然用于订阅管理与竞态守卫。闭包陷阱的根源是快照：函数式更新基于队列最新值、写全依赖让副作用随状态重建、useRef 的 current 永远是最新的可作为逃生舱、复杂联动用 useReducer。」

**2. 一道综合题**：搜索框 userId 变化请求用户——要求无竞态、卸载不 setState——把「ignore 守卫 + AbortController + 依赖 [userId]」组合写出，正是《js-async-008》在 React 里的标准落地。

## 图解总结

```
渲染N: 函数执行 ──▶ useEffect登记(快照effectₙ + deps) ──▶ commit
   ├─ paint 前: useLayoutEffect 同步执行（量尺寸/防闪烁）
   ├─ paint ✚
   └─ paint 后: useEffect 异步执行
下次依赖变化: 【cleanup effectₙ₋₁】→ 执行 effectₙ ；卸载: 最后 cleanup

闭包陷阱: effect 是当次渲染快照的囚徒
  setCount(count+1) ×2 → +1 而非 +2（快照叠加）
  [] + setInterval → 永远用旧值计算
逃生: ①函数式更新 ②写全依赖(重建) ③ref.current(最新值) ④useReducer
```

## 总结

- useEffect 登记于 render、异步执行于 paint 后；useLayoutEffect 同步于 paint 前；
- 每次渲染一份 effect 快照；依赖变化先清理旧的再执行新的；卸载再清理；
- 依赖数组 = 「对哪些值敏感」的声明；漏写 = 用过期快照；
- 闭包陷阱四通道：函数式更新 / 写全依赖 / useRef / useReducer；
- effect 是声明式同步，不是生命周期钩子。

**面试一句话回答**：useEffect 在渲染阶段只做登记，提交完成后在浏览器绘制之后异步执行，useLayoutEffect 则在绘制前同步执行。关键心智是每次渲染都会生成一份捕获当次状态快照的 effect 函数——依赖数组声明该快照对哪些值敏感，依赖变化时先执行上一份 effect 的清理函数再执行新一份，卸载时清理最后一次，这套先清理后执行的模型天然管理订阅与竞态。闭包陷阱的根源正是快照语义：连续 setCount(count+1) 只加一、空依赖加定时器永远读到旧值——解法按序是函数式更新基于队列最新值、写全依赖让副作用随状态重建、用 ref 的 current 读取最新值以及复杂场景下 useReducer。

## 思考题

1. 写出三轮渲染（count: 0→1→2，依赖 [count]）中 effect 与 cleanup 的完整执行序号。
2. 「在 useEffect 里调用 setState 触发对象更新，对象又在依赖里」的无限循环怎么形成？两种修复。
3. useLayoutEffect 里同步改 DOM 为什么不会引起用户可见的闪烁？（paint 前完成 → 浏览器一次性画出最终态）
4. 开放设计：用「ignore 守卫 + AbortController」实现 useSearch(keyword)：返回 { results, loading, error }——标出每个清理动作发生在模型的哪一步。

（思考题解析将同步录入小程序题库，关联本文 id：react-005）

## 参考文献：

- React 官方文档 — Using the Effect Hook / A Complete Guide to useEffect（Dan Abramov 的史诗长文）
- 本课程《js-deep-005 闭包》《react-004 Hooks 原理》《js-async-008 异步实战》

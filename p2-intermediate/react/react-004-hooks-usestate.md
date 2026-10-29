---
id: react-004
title: React 原理之 Hooks 原理：useState 到底做了什么
series: React 原理系列
seriesId: react
stage: intermediate
difficulty: 4
tags: [Hooks, useState, memoizedState, 链表, 调用顺序]
readingTime: 22
prev: react-003
next: react-005
createdAt: 2026-10-26
---

# React 原理之 Hooks 原理：useState 到底做了什么

## 从「Hook 不能写在 if 里」说起

```jsx
function App({ isVip }) {
  if (isVip) {
    const [gift] = useState('礼包');    // ❌ 条件调用 Hook —— React 警告
  }
  const [count, setCount] = useState(0);
}
```

为什么别的函数都能随便放 if 里，Hook 不行？还有一串「祖传规则」：只能在函数组件顶层调用、只能在自定义 Hook 里调用、依赖数组……全部答案藏在同一个数据结构里：**Fiber 上的 Hooks 链表**。⭐⭐⭐ 「Hooks 的实现原理」是 React 面试的深水区必考，一条链表讲完全部规则。

## 现象与直觉解释

函数组件「没有实例」——它每次渲染都被**重新执行一遍**，局部变量全部重建。那 `useState` 的状态凭什么能「记住」上次的值？

答案（react-003 的伏笔）：**状态不在函数里，在函数对应的 Fiber 节点上**——`fiber.memoizedState` 指向一条 **Hooks 链表**。

```
Fiber.memoizedState ──▶ [useState 节点] ──▶ [useEffect 节点] ──▶ [useState 节点] ──▶ null
                          state: 0           effect: […]          state: {…}
```

**Hook 的调用顺序 = 它在链表上的位置**——「凭什么记住状态」与「为什么不能进 if」是同一个机制的正反两面。

## 深入原理

### 一、渲染时 Hooks 链表的遍历：两套工作指针 ⭐⭐⭐

组件每次执行（render），Hooks 依次被调用。React 用两个指针管理「这次调用对应链表哪个节点」：

```js
// 极简模型（原理同源）：
let workInProgressHook = null;   // 本次渲染的"工作指针"（新建/更新中的链表）
let currentHook = null;          // 指向上一轮渲染的链表节点（旧值来源）

function useState(initialValue) {
  if (currentHook) {
    // ⭐ 更新渲染：不是第一个 Hook 位置 —— 按【顺序】取旧节点
    workInProgressHook = currentHook;      // 复用旧节点（带着旧 state）
    currentHook = currentHook.next;        // 旧指针前移
    workInProgressHook = workInProgressHook.next || 创建新节点;
  } else {
    // ⭐ 首次渲染：创建新节点挂上链表
    const hook = { memoizedState: initialValue, next: null };
    // 挂链尾，指针前移
  }
  const setState = (newValue) => { /* 触发调度，把新值存入 hook.memoizedState */ };
  return [workInProgressHook.memoizedState, setState];
}
```

**「按调用顺序对应链表节点」——没有名字、没有 key，只有顺序**。所以：

- 第 1 次渲染：Hook 调用 A、B、C → 建链 [A, B, C]；
- 第 2 次渲染：还是调用 A、B、C → 依次取链上的 1、2、3 号位——状态正确接续 ✅；
- **如果第 2 次因为 if 少调了 B** → 调用序变成 A、C——C 对到了 2 号位（B 的节点）——**状态错位，数据张冠李戴** ❗。

这就是「Hook 必须无条件、按同一顺序调用」的机制真相——**规则不是风格洁癖，是链表寻址的物理约束**（ESLint 的 react-hooks/rules-of-hooks 把它固化成检查）。

### 二、setState 的三件事 ⭐⭐

```js
setCount(count + 1);
// 内部发生：
// ① 把新值（或更新函数）排入 hook.queue（更新队列）
// ② 标记该 Fiber 需要更新（安排一次 render，走 react-002 的两阶段流程）
// ③ 触发调度（可能批处理合并——react-006）
// 状态真正写入 memoizedState 发生在下一次 render 执行到这个 Hook 时
```

**「setState 后 count 变量为什么还是旧值」**的经典疑问：本次函数执行中 `count` 是**本次渲染的常量快照**——新值要等**下一次渲染**重新执行函数、重新调用 useState 从链表取回。**每次渲染都是一次快照**（Closure 快照——《js-deep-005》闭包的直接应用，react-005 的核心主题）。

### 三、多个 useState 与一次 useState(对象) 的等价性 ⭐

```jsx
const [a, setA] = useState(0);
const [b, setB] = useState(0);
// 等价于
const [state, setState] = useState({ a: 0, b: 0 });
// 区别只在【更新粒度】：
setB(1);                                    // 单独更新 b（自动批处理合并）
setState({ ...state, b: 1 });               // 手动展开——必须记得带上 a
```

两者链表占用完全等价（两个节点 vs 一个对象节点）；粒度差异带来代码习惯不同——**「拆开多个 useState」通常更好**（免得每次展开旧状态）。

### 四、函数式更新：为什么推荐 `setCount(c => c + 1)` ⭐⭐

```js
// 连续两次：
setCount(count + 1);   // 基于【快照 count】
setCount(count + 1);   // 还是基于【同一个快照 count】→ 两次 +1 实际只 +1 ❗
setCount((c) => c + 1); // 基于【队列最新值 c】→ 正确 +2 ✅
```

因为「count 是本次渲染的常量」——同一轮里多次用快照值计算会互相覆盖；函数式更新拿到的是**更新队列的链尾值**（前一次更新后的结果）。同理解决「闭包里 count 永远是旧值」的一类 Bug。

### 五、自定义 Hook：共享逻辑而非共享状态 ⭐⭐

```js
function useCounter() {
  const [count, setCount] = useState(0);
  return { count, increment: () => setCount((c) => c + 1) };
}
// 组件 A、B 各自调用 useCounter() —— 两个组件【各自独立的链表节点】
// 复用的是"逻辑的执行路径"，状态各归各的 Fiber ⭐
```

「自定义 Hook 复用逻辑不复用状态」——与 mixin 的本质区别（Vue composable 同理，《vue-008》）。

## 回看开篇

if 里调 Hook 为什么错：链表靠**调用顺序**寻址——条件分支让不同渲染的调用序列不一致，第 N 次调用的 Hook 对上了链表上错误的节点，状态错位。三条规则（顶层调用/只在组件或自定义 Hook/顺序稳定）全部由「顺序寻址」一条推出——**规则是数据结构的投影**。

## 实战延伸

**1. 面试答题骨架**：「函数组件每次渲染重新执行，状态存在对应 Fiber 的 memoizedState 指向的 Hooks 链表上——每个 Hook 调用对应链表上一个节点，渲染时用工作指针按调用顺序依次创建或复用节点，因此 Hook 必须无条件地以稳定顺序调用，条件或循环中调用会导致错位取到别人的状态。setState 把更新排入队列并安排渲染，本次渲染中的 state 是快照常量，连续更新需用函数式 setState 基于队列最新值计算；自定义 Hook 复用的是逻辑执行路径，状态仍各自归属调用者的 Fiber。」

**2. 一道快照题**：

```jsx
function App() {
  const [n, setN] = useState(0);
  const log = () => setTimeout(() => alert(n), 3000);   // 闭包捕获本次的 n
  return <button onClick={() => { alert(n); setN(n + 1); log(); }}>点我</button>;
}
// 点击后立即弹 0，3 秒后再弹 0 —— setTimeout 的闭包里是【点击那次渲染】的 n
```

## 图解总结

```
fiber.memoizedState ──▶ ● ──▶ ● ──▶ ● ──▶ null      （Hooks 链表）
                        useState  useEffect useState
                        state:0   deps:[…]  state:{}

渲染 n：按调用顺序对号入座（顺序即地址 ⭐）
  首次：建节点    更新：取旧节点复用 state
  ⚠️ if/循环导致顺序变化 → 错位 → 状态张冠李戴

setState: 入队列 + 安排渲染 —— 本次渲染的 state 是快照
  连续更新 → setN(c => c + 1)（函数式，基于队列最新值）
自定义 Hook：复用逻辑路径；状态各归各的 Fiber
```

## 总结

- 状态住在 Fiber.memoizedState 的 Hooks 链表上；调用顺序即地址；
- 顺序稳定的规则是链表寻址的物理约束，不是风格建议；
- setState 入队并安排渲染；本次渲染中 state 是快照常量；
- 函数式更新解决快照叠加与闭包旧值问题；
- 自定义 Hook 复用逻辑不复用状态。

**面试一句话回答**：函数组件没有实例、每次渲染都重新执行，useState 的状态实际存放在组件对应 Fiber 节点的 memoizedState 指向的 Hooks 链表上——链表按 Hook 调用顺序排列，首次渲染逐个创建节点，更新渲染用工作指针按相同顺序复用旧节点取回状态，因此 Hook 必须在函数顶层无条件地以稳定顺序调用，放进条件或循环会导致下一次渲染的 Hook 与链表节点错位、读到别人的状态。setState 只是把更新排入该 Hook 的队列并安排一次渲染，本次渲染里的 state 是闭包快照常量，所以连续更新应使用函数式 setState 基于队列最新值计算；自定义 Hook 复用的是逻辑执行路径，状态仍各自属于调用它的组件的 Fiber。

## 思考题

1. `useEffect(() => {...}, [])` 空依赖的 effect 闭包里为什么永远是首次的 state？用「渲染快照 + 链表复用」解释（react-005 主菜）。
2. 两个组件同时调用 `useCounter()`，链表怎么互不干扰？（各自的 Fiber 各自的链表——画出两条）
3. 实现 `useToggle(initial)`：返回 [on, toggle]——注意 toggle 用函数式更新；再问：为什么 `setOn(!on)` 在快速连点时也会出错？
4. 开放讨论：如果让你设计「按名字寻址」的 Hooks API（`useState('count', 0)`），会引入什么新问题？（名字管理、冲突、动态名——顺序寻址的极简 vs 命名寻址的心智）

（思考题解析将同步录入小程序题库，关联本文 id：react-004）

## 参考文献：

- React 官方文档 — Hooks 规则（官方解释的原理版）
- React 源码 — ReactFiberHooks（dispatchSetState 的队列实现）
- 本课程《react-003 Fiber》《js-deep-005 闭包》（快照的原理地基）

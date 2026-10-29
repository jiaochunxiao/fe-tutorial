---
id: react-002
title: React 原理之渲染流程：render 与 commit
series: React 原理系列
seriesId: react
stage: intermediate
difficulty: 4
tags: [渲染流程, render阶段, commit阶段, 调和, Diff]
readingTime: 20
prev: react-001
next: react-003
createdAt: 2026-10-26
---

# React 原理之渲染流程：render 与 commit

## 从「render 函数跑了，DOM 没变」说起

```jsx
function App() {
  console.log('App render');       // 打印了！
  return <div>hello</div>;
}
setCount(1);  // 控制台打印 'App render'，但页面毫无变化 —— 新老内容一样
```

组件函数执行了（「render」发生了），DOM 却纹丝不动——因为 **React 的渲染是两阶段的流水线**，组件函数执行只是第一阶段，DOM 更新发生在第二阶段，且第二阶段还要过 Diff 的筛。⭐⭐「React 渲染的两个阶段」是理解 Fiber、并发特性、StrictMode 双调用的地基。

## 现象与直觉解释

React 的一次更新分两大阶段（+ 一个前置的触发）：

```
触发（setState/render） 
 → 【render 阶段】（可中断的计算）：
    逐个组件调用函数/执行 Hooks → 新旧 React 元素 Diff → 算出「要做的变更列表」
    ⭐ 本阶段纯计算，不碰真实 DOM —— 可以随时中断恢复（并发特性的地基）
 → 【commit 阶段】（不可中断的落地）：
    把变更列表一次性应用到真实 DOM + 执行生命周期/副作用
    ⭐ 本阶段同步完成 —— 保证用户不会看到"改了一半"的 UI
```

直觉类比：**装修分两步——先出施工图（render，可以反复修改图纸），再一口气施工（commit，中途不能停工否则房子没法住）**。

## 深入原理

### 一、render 阶段：递归 + Diff 的计算旅程 ⭐⭐

从更新的起点开始（首次是根容器，更新时是某个触发变更的组件），React 递归处理：

```
① 调用组件函数（或执行类组件 render）
    └─ 期间执行 Hooks（useState 的读取、useEffect 的「登记」——react-004）
② 得到该组件的新 React 元素（react-001）
③ 与旧 Fiber 的元素做 Diff（reconcile 调和）
    └─ 判定每个孩子的处理方式：复用/更新/新增/删除 → 标记 EffectTag（副作用标记）
④ 深入子组件重复 ①-③；同级处理完再回头处理兄弟
⑤ 全部处理完 → 得到「变更列表（Effect List）」
```

**两个关键设计**（为下一篇 Fiber 铺垫）：

- **Diff 在「元素层」做**：新旧都是普通对象，比较是纯计算——这就是开篇「render 跑了但 DOM 不动」的原因之一：**Diff 发现无差异 → 变更列表为空 → commit 无事可做**；
- **本阶段可中断**：计算过程中优先级更高的更新可以插队（用户输入 > 数据请求）——「并发模式」的物理基础。

### 二、commit 阶段：三个小步骤的落地 ⭐⭐

```
commitMutation 前：
① Before Mutation：getSnapshotBeforeUpdate（读取旧 DOM 的最后机会）
② Mutation：真正操作 DOM —— 插入/移动/删除节点（此时 DOM 与界面暂时不一致）
③ Layout：componentDidMount/DidUpdate、useLayoutEffect 同步执行
    └─ 此刻 DOM 已就位 —— 「可以直接量尺寸、滚动定位」的原因
此后（异步）：useEffect 的回调在 painted 之后被调度执行（react-005 详解）
```

**「不可中断」的意义**：如果 DOM 改到一半被打断，用户看到残缺 UI——React 把所有「碰真实 DOM」的动作压进一个同步阶段，一次做完。

### 三、首次挂载 vs 更新：同一流水线的两态 ⭐

```
首次挂载（mount）：
  旧 Fiber 树不存在 → Diff 退化为「逐个创建」→ 变更列表 = 全量插入
更新（update）：
  新旧元素 Diff → 变更列表 = 差异部分
（对应 Vue 术语：mount 与 patch —— React 里都叫 reconcile，只是旧树有无之分）
```

### 四、渲染的「触发源」清单 ⭐

```
① 组件自身 setState / useState 的 setter
② 父组件重渲染（props 变化或父自身重渲）—— 子组件默认跟着执行函数 ⭐
③ Context 变化 → 消费它的组件重渲染
④ 自定义 hooks 内部触发的上述任一
（记住核心：React 的重渲染单位是【组件函数重跑】，不是"属性变化才重渲染"）
```

**「父渲染 → 子必渲染」**是 React 与 Vue 的显著差异：Vue 靠依赖收集只重跑「用到该数据的组件」；React 默认整棵子树重跑组件函数，靠 memo/shouldComponentUpdate 剪枝（react-008 主题）。**执行函数 ≠ 更新 DOM**——函数重跑后 Diff 无差异，commit 就无事可做，但计算成本已付出（这就是性能优化的对象）。

### 五、StrictMode 的双调用之谜（本篇模型的应用）⭐

```jsx
<React.StrictMode>
  <App />   // 开发模式：App 函数执行【两次】！
</React.StrictMode>
```

为什么故意双跑？——**帮你暴露 render 阶段的副作用**：render 应是纯计算（不碰 DOM、不发请求、不改全局变量），双跑时若结果不一致/副作用可见即暴露问题。理解了「render=纯计算、commit=落地」的两阶段模型，双调用检测的逻辑不言自明。

## 回看开篇

`setCount` 后打印了 render 但 DOM 没变：① render 阶段执行了组件函数（打印发生）→ ② Diff 新旧元素**完全相同** → 变更列表为空 → ③ commit 无事可做。「渲染」一词在 React 语境中特指 render+commit 整体，而**组件函数执行 ≠ DOM 更新**。

## 实战延伸

**1. 面试答题骨架**：「React 更新分 render 与 commit 两阶段——render 阶段从触发点开始递归调用组件函数、执行 Hooks 生成新的元素树，与旧 Fiber 做 Diff，产出带副作用标记的变更列表，全程纯计算不碰 DOM，且可被更高优先级更新中断；commit 阶段同步执行、不可中断，按 before mutation、mutation（真实 DOM 操作）、layout（DidMount/DidUpdate/useLayoutEffect）三步落地，useEffect 在其后异步调度。父组件重渲染默认导致子组件函数重跑，但函数执行不等于 DOM 更新——Diff 无差异则 commit 无操作；StrictMode 开发态双调用组件函数正是为了暴露 render 阶段的非纯副作用。」

**2. 一道时序题**：点击按钮 setState → 组件函数执行 → useLayoutEffect 执行 → 浏览器 paint → useEffect 执行。（react-005 展开为什么 layout 在 paint 前同步、effect 在 paint 后异步。）

## 图解总结

```
触发: setState ─────────────────────────────────────────┐
                                                        ▼
【render 阶段】(可中断·纯计算)                    【commit 阶段】(同步·不可中断)
 组件函数重跑 ─▶ 新元素                变更列表 ─▶ ① before mutation
 Hooks 执行/登记                                 ② mutation: 改 DOM
 Diff(reconcile) 旧 Fiber ─▶ EffectTag           ③ layout: DidMount/useLayoutEffect
 产出: 变更列表 ──────────────────────────────▶        └─(异步)useEffect
                                                    
要点: 函数执行 ≠ DOM 更新（Diff 无差异→commit 无事可做）
     父渲染默认带动子函数重跑（memo 剪枝 → react-008）
```

## 总结

- 两阶段模型：render（可中断纯计算：组件函数+Hooks+Diff）→ commit（同步落地：DOM 三步走）；
- 变更列表是两阶段的交接物；Diff 无差异则 commit 无操作；
- commit 三小步：before mutation / mutation（改 DOM）/ layout（同步钩子）；
- useEffect 在 paint 后异步执行（下篇详解）；useLayoutEffect 在 paint 前同步；
- 重渲染单位是组件函数；StrictMode 双调用检验 render 纯度。

**面试一句话回答**：React 的更新流程分 render 与 commit 两大阶段——render 阶段从触发更新的组件开始递归执行组件函数与 Hooks、生成新的元素树，并与旧 Fiber 节点做协调对比，产出带副作用标记的变更列表，这一阶段是纯计算、不触碰真实 DOM 且可以被更高优先级任务中断；commit 阶段则同步且不可中断，依次经过 before mutation、mutation 真正操作 DOM、layout 执行 componentDidMount 与 useLayoutEffect 三步，useEffect 在浏览器绘制之后异步调度。需要注意组件函数执行不等于 DOM 更新——Diff 无差异时 commit 无事可做；父组件重渲染默认使子组件函数重新执行，StrictMode 的双调用正是为了暴露 render 阶段的副作用。

## 思考题

1. 「在组件函数里直接操作 DOM」会破坏什么前提？结合两阶段模型说明它与 useLayoutEffect 的本质区别。
2. commit 为什么必须不可中断？如果 mutation 中途被打断，用户会看到什么？
3. 子组件 props 完全没变，父组件重渲染——render 阶段子组件函数跑不跑？DOM 会不会更新？（React.memo 之前/之后对比）
4. 开放讨论：React 18 的 startTransition 允许把一次更新的 render 阶段变成「低优先级可打断」——从两阶段模型解释它改善了什么交互场景。

（思考题解析将同步录入小程序题库，关联本文 id：react-002）

## 参考文献：

- React 官方文档 — 渲染与提交（Render and Commit）
- React Fiber 架构官方说明（ reactjs.org 2018）
- 本课程《react-001 JSX》《react-003 Fiber》《react-005 useEffect》

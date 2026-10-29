---
id: handwritten-008
title: 手写虚拟 DOM 与 diff
series: 手写源码系列
seriesId: handwritten
stage: expert
difficulty: 5
tags: [虚拟DOM, diff算法, patch, key, 手写框架]
readingTime: 26
prev: handwritten-007
next: handwritten-009
createdAt: 2026-10-26
---

# 手写虚拟 DOM 与 diff

## 从「为什么改一个字要重排整个列表」说起

命令式 DOM 时代的写法：数据变了，手动找到对应节点改文本/属性。列表重排时更痛苦——**移动节点还是全部重建？** 全建浪费（丢失焦点、状态、动画），手动对齐心智负担巨大。

虚拟 DOM 的答案：**用 JS 对象描述 UI，数据变化生成新树，diff 出「最小变更集」，只对真实 DOM 做这些变更**。⭐⭐⭐ 本篇手写三件套（h / render / patch + diff），是《vue-002》《react-003》两篇框架原理的地基。

## 第一部分：三个函数认识虚拟 DOM

```js
// ① h（createElement）：声明 UI 结构 —— 框架模板/JSX 的编译产物
const vnode = h('ul', { class: 'list' }, [
  h('li', { key: 'a' }, '苹果'),
  h('li', { key: 'b' }, '香蕉'),
]);

// 虚拟节点长什么样：
// { type: 'ul', props: {class:'list'}, children: [ … ] }
// { type: Symbol(Text), props: {}, children: [], text: '苹果' }

// ② render：vnode → 真实 DOM
mount(vnode, document.getElementById('app'));

// ③ patch：新旧对比，把真实 DOM 从「旧树状态」改成「新树状态」
patch(n1, n2);
```

### 基础设施：h 与 mount

```js
const Text = Symbol('text');

function h(type, props = {}, children = []) {
  return {
    type,                                   // 标签 / Text / 组件（本篇只做元素）
    props,
    children: [].concat(children).map(normalize),  // 子节点归一化
    key: props?.key,                        // diff 的身份证
  };
}

function normalize(child) {
  if (typeof child === 'string' || typeof child === 'number') {
    return { type: Text, props: {}, children: [], text: String(child) }; // 文本节点
  }
  return child;
}

function createDom(vnode) {
  if (vnode.type === Text) return document.createTextNode(vnode.text);
  const el = document.createElement(vnode.type);
  return el;
}

function mount(vnode, container) {
  const el = (vnode.el = createDom(vnode));   // ⭐ el 回挂在 vnode 上——patch 的定位锚点

  // 属性
  for (const [k, v] of Object.entries(vnode.props ?? {})) {
    if (k === 'key') continue;
    patchProp(el, k, undefined, v);
  }
  // 子节点递归
  vnode.children.forEach((c) => mount(c, el));
  container.appendChild(el);
}

function patchProp(el, key, prev, next) {
  if (key.startsWith('on')) {                // 事件（简版：全量替换）
    const name = key.slice(2).toLowerCase();
    if (prev) el.removeEventListener(name, prev);
    if (next) el.addEventListener(name, next);
  } else if (key === 'class') {
    el.className = next ?? '';
  } else if (key === 'style') {
    for (const p in next) el.style[p] = next?.[p] ?? '';
  } else if (next == null) {
    el.removeAttribute(key);
  } else {
    el.setAttribute(key, next);
  }
}
```

## 第二部分：diff 与 patch 的完整实现 ⭐⭐

### 设计前提：三条工程决策

虚拟 DOM 的 diff 之所以可行，靠三个「简化假设」（O(n³) → O(n) 的代价）：

1. **只做同层比较**——不跨层级移动节点（跨层的当删除+新建）；
2. **类型不同直接替换**——`div` → `span` 整棵子树重建；
3. **同层列表靠 key 认人**——「同位置同类型」不等于「同一个节点」。

### patch 主函数

```js
function patch(n1, n2) {
  // 情形 0：类型不同（含 Text vs 元素）→ 整体替换
  if (n1.type !== n2.type) {
    const parent = n1.el.parentNode;
    parent.removeChild(n1.el);
    mount(n2, parent);
    return;
  }

  // 类型相同：复用 DOM（⭐ 这就是「原地更新」的锚点）
  const el = (n2.el = n1.el);

  // ① 文本节点：比文本
  if (n1.type === Text) {
    if (n1.text !== n2.text) el.textContent = n2.text;
    return;
  }

  // ② 属性：逐 key patch
  const props = { ...n1.props, ...n2.props };
  for (const k in props) {
    if (n1.props[k] !== n2.props[k]) patchProp(el, k, n1.props[k], n2.props[k]);
  }

  // ③ 子节点：diffChildren（核心战场）
  diffChildren(el, n1.children, n2.children);
}
```

### diffChildren：无 key 的朴素版（先建立直觉）

```js
function diffChildrenSimple(el, oldCh, newCh) {
  const len = Math.min(oldCh.length, newCh.length);
  // ① 逐位 patch 公共部分
  for (let i = 0; i < len; i++) patch(oldCh[i], newCh[i]);
  // ② 新的更长：批量新增
  for (let i = len; i < newCh.length; i++) mount(newCh[i], el);
  // ③ 旧的更长：批量删除
  for (let i = oldCh.length - 1; i >= len; i--) el.removeChild(oldCh[i].el);
}
```

**朴素版的致命场景**（key 存在的全部理由）⭐⭐⭐：

```
旧：[A, B, C]
新：[D, A, B, C]        // 头部插入一个 D

朴素 diff：位置0 C≠D 改，位置1 A≠B 改，位置2 B≠C 改，尾部新增 C
         → 3 次内容改写 + 1 次新建 —— 而「理想答案」只是头部 insertBefore(D)！

带 key 的 diff：识别出 A/B/C 是「同一批节点、整体后移」→ 只做 1 次插入 ✅
```

### diffChildren：带 key 的正式版（Vue2 双端思想的简化）⭐⭐

```js
function diffChildren(el, oldCh, newCh) {
  const oldStart = 0, newStart = 0;
  const oldEnd = oldCh.length - 1, newEnd = newCh.length - 1;

  // key → 旧节点下标 的索引表（把 O(n²) 查找降到 O(n)）
  const keyIndex = new Map();
  oldCh.forEach((n, i) => { if (n.key != null) keyIndex.set(n.key, i); });

  const toMount = [];   // 新增节点（在参照点插入）
  let refEl = null;     // 插入参照（从尾部倒序处理时的锚点）

  // 从后往前遍历新列表（倒序 insertBefore 不需要不断更新参照物）
  for (let i = newEnd; i >= newStart; i--) {
    const n2 = newCh[i];
    const oldIdx = n2.key != null ? keyIndex.get(n2.key) : undefined;

    if (oldIdx === undefined) {
      // 情形 1：新节点 —— 先挂载，记录待插
      mount(n2, el);
      toMount.push({ node: n2, before: refEl });
    } else {
      // 情形 2：可复用 —— patch 并把 DOM 移到正确位置
      patch(oldCh[oldIdx], n2);
      el.insertBefore(n2.el, refEl);
      oldCh[oldIdx] = null;               // 标记已消费
    }
    refEl = n2.el;                         // 当前节点成为下一轮的参照
  }

  // 挂载的新节点按参照插入
  toMount.forEach(({ node, before }) => el.insertBefore(node.el, before));

  // 剩下没被消费的旧节点 → 删除
  oldCh.forEach((n) => { if (n !== null) el.removeChild(n.el); });
}
```

执行推演（`[A,B,C]` → `[D,A,B,C]`，全部带 key）：

```
i=3: C 在旧表(idx2) → patch(C,C) + insertBefore(C, null)   消费旧2
i=2: B 在旧表(idx1) → patch(B,B) + insertBefore(B, C.el)    消费旧1
i=1: A 在旧表(idx0) → patch(A,A) + insertBefore(A, B.el)    消费旧0
i=0: D 不在旧表     → mount + 待插到 A 前
收尾: toMount 插入 D；旧表全 null 无删除
→ 总操作：3 次「移动」+ 1 次新建 ✅（朴素版：3 改写 + 1 新建，且状态全丢）
```

（Vue3 的实现用「最长递增子串」进一步省掉那些本来就**相对有序**的移动——本版的「全部 insertBefore」正确但不最优，这个差距正是《vue-002》要展开的。）

## 回看开篇

列表头部插入的答案：**key 让 diff 认出「A/B/C 是同一批节点」**，从「改写三个节点的内容」变成「移动 + 新建一个」。key 的三条军规（追问点）：**唯一**（同层不重复）、**稳定**（不能用 index——头插时 index 全变，等于没有）、**不随机**（随机数每渲染都变，永远在重建）。

## 实战延伸

**1. 一张经典图记 diff**：

```
            ┌ 同类型 → patch 复用（属性 diff + 子节点 diff）
  n1 vs n2 ─┤
            └ 不同类型 → 删旧建新
  子节点：key 索引表 → 可复用的 patch+move，新的 mount，剩的 remove
```

**2. 虚拟 DOM 的价值重估**（高级面试的开放题）：它赢在「声明式开发体验 + 可预知的性能下限 + 跨端能力（同一棵树渲染到 Canvas/原生）」；**不是**「比手写 DOM 快」——最优手写永远更快，只是写不起。React Fiber（《react-003》）把这棵树又改成了可中断的链表——虚拟 DOM 的演进未完待续。

## 图解总结

```
h(标签,属性,子) ──▶ vnode 树 ──mount──▶ 真实 DOM（el 回挂 vnode）
新数据 ──▶ 新 vnode 树 ──patch(旧,新)──▶
   ├─ 类型变 → 替换子树
   ├─ 文本变 → 改 textContent
   ├─ 属性变 → patchProp
   └─ 子节点 → key 索引表：复用 patch+move / 新建 insertBefore / 剩余删除
                    ⭐ key = 节点的身份证（唯一、稳定、禁用 index）
```

## 总结

- 三件套：h 声明结构、mount 建真实 DOM（el 回挂锚点）、patch 做最小变更；
- diff 三假设：同层比较、类型变即替换、key 认节点——O(n³) 降到 O(n)；
- 带索引表的 diffChildren：可复用的 patch+移动、新的挂载插入、未消费的删除；
- key 三军规：唯一、稳定、禁用数组下标；无 key 的逐位 patch 在头插场景退化为全量改写；
- 虚拟 DOM 的价值是声明式与性能下限，不是绝对性能。

**面试一句话回答**：虚拟 DOM 用 JS 对象描述 UI——h 函数生成 vnode 树、mount 递归创建真实 DOM 并把 el 回挂在 vnode 上作为锚点；更新时对新旧树做 patch：类型不同整棵替换、文本只改 textContent、属性逐 key 对比、子节点用 key 建索引表——可复用的节点原地 patch 并 insertBefore 到正确位置、新增的挂载插入、旧列表未消费的删除；key 的作用是节点身份标识，必须唯一且稳定、不能使用数组下标，否则头部插入等场景会退化为大量内容改写并丢失节点状态，这就是 diff 以 O(n) 复杂度换取工程可行性的核心设计。

## 思考题

1. 手写测试驱动：构造 `h('ul',{},[a,b,c])` → `h('ul',{},[c,a,b])` 的 diff，统计 DOM 操作数（应远小于重建）。
2. 本版 diff 对「移动」的优化不完美：找出 `[A,B,C,D]` → `[B,C,D,A]` 的多余移动，并说明最长递增子序列策略为什么能省掉它（预习《vue-002》）。
3. patchProp 的事件处理是全量替换——若新旧 handler 都存在，有没有更省的方案？副作用与记忆化怎么权衡？
4. 开放设计：把本框架加上「组件节点」（type 为函数），思考：组件的 vnode 怎么 diff？状态从哪来？（这将是《handwritten-009 mini-Vue》的起点）

（思考题解析将同步录入小程序题库，关联本文 id：handwritten-008）

## 参考文献：

- 《Vue.js 设计与实现》第 4~7 章（渲染器与 diff 的工业实现）
- React 官方博客 — React Basic（虚拟 DOM 的设计动机）
- 本课程《handwritten-009 mini-Vue》《vue-002 虚拟 DOM 与 diff》（本篇的延续与对照）

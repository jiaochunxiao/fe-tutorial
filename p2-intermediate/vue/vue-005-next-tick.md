---
id: vue-005
title: Vue 原理之 nextTick 的原理
series: Vue 原理系列
seriesId: vue
stage: intermediate
difficulty: 4
tags: [nextTick, 批量异步更新, 微任务, 调度器, 事件循环]
readingTime: 18
prev: vue-004
next: vue-006
createdAt: 2026-10-26
---

# Vue 原理之 nextTick 的原理

## 从「连改三次数据，只渲染一次」说起

```js
// 同步代码里连改三个状态：
count.value = 1;
count.value = 2;
list.value.push('x');
name.value = 'new';

// 组件重渲染了几次？
// ❌ 直觉：3~4 次    ✅ 实际：**1 次**
```

这就是 Vue 的**批量异步更新**——也是 nextTick 存在的理由。⭐⭐「为什么改了数据 DOM 不会立即更新」「nextTick 原理」是 Vue 面试的保留节目，其本质是一套**调度器**设计，底层正是《js-async-005》的微任务。

## 现象与直觉解释

**数据变化 ≠ 立即渲染**。Vue 在两者之间放了一个调度器：

```
同步修改数据 ×N ──▶ trigger 逐个触发
                     │ 渲染 effect 不立即执行，而是入【队列】并去重
                     ▼
同步代码执行完（微任务时机）
                     │ flush 队列：每个组件只跑一次更新
                     ▼
              DOM 批量更新完成 ══▶ nextTick 的回调们执行
```

直觉：**快递攒单发货**——一个同步块里的全部变更合并成一单，一趟车送完；nextTick 是「这趟车发完后通知我」。

## 深入原理

### 一、为什么要批量：性能的本质 ⭐⭐

如果不做调度，`count++; count++` 就是两轮完整的「render → diff → patch」——中间那次结果根本没人看到。**中间状态在同步代码结束前不可见**（JS 单线程，期间浏览器插不进任何渲染）——那为什么要为「不可见的中间状态」买单？

结论：**同一轮事件循环里的 N 次数据变更，最优渲染次数是 1**。调度器就是把这个「显然」落实成机制的组件。

### 二、调度器实现：队列 + 微任务 + 去重 ⭐⭐⭐

```js
// 极简调度器（原理同源）：
const queue = new Set();        // Set 天然按组件去重 ⭐
let isFlushing = false;
let flushPromise = null;

function queueJob(job) {        // job = 某个组件的渲染 effect
  queue.add(job);               // 同一组件多次 trigger → Set 里仍只有一份
  if (!isFlushing) {
    isFlushing = true;
    flushPromise = Promise.resolve().then(flushJobs);  // ⭐ 微任务时机统一 flush
  }
}

function flushJobs() {
  try {
    queue.forEach((job) => job());   // 每个组件各执行一次更新
  } finally {
    queue.clear();
    isFlushing = false;
    // flush 结束后，执行等待中的 nextTick 回调（callbacks 队列）
    flushCallbacks();
  }
}

// nextTick 本体：
function nextTick(fn) {
  return flushPromise.then(fn);   // 挂在「本轮 flush 的 promise 之后」⭐
  // 保证回调一定在本轮 DOM 更新之后执行
}
```

三个设计点（全是追问点）：

1. **Set 去重**：同一组件一轮只更新一次——开篇「3 次变更加 1 个组件 = 1 次渲染」的实现基础；
2. **微任务时机**（`Promise.resolve().then`）：`queueJob` 只负责排队，「真正 flush」等当前同步代码跑完——微任务正是「当前任务结束、渲染之前」的窗口（《js-async-005》浏览器循环模型：任务→微任务→渲染）；
3. **nextTick 挂 flushPromise 之后**：回调顺序必然在 DOM 更新之后——这就是「nextTick 能拿到新 DOM」的全部原理。

### 三、nextTick 的经典使用场景 ⭐⭐

```js
// ① 数据更新后立刻操作 DOM
count.value++;
await nextTick();                 // 或 nextTick(() => {...})
el.textContent;                   // 新值 ✅

// ② 动态渲染的元素聚焦
list.value.push(newItem);
await nextTick();
inputRef.value.focus();

// ③ 读取更新后的尺寸（弹窗定位）
show.value = true;
await nextTick();
el.getBoundingClientRect();       // 基于新 DOM 的测量
```

**心智模型**：`改数据` 与 `DOM 更新` 之间隔着一次微任务——nextTick 就是「跨过这次微任务的桥」。

### 四、Vue 2 的「降级策略」往事 ⭐（加分知识点）

Vue 2 时代为了兼容不支持 Promise 的环境，nextTick 的异步载体按优先级降级：

```
Promise.then → MutationObserver → setImmediate → setTimeout(0)
```

Vue 3 已放弃降级（现代浏览器 Promise 全覆盖）——但这段历史是「微任务 vs 宏任务」的绝佳教材：**为什么 setTimeout 不行？** 宏任务排在「渲染」之后，中间可能插入一帧渲染——用户会看到「旧 DOM 闪一下」；微任务在渲染前完成，无闪烁。

### 五、与「flush: post」的关系（vue-003 呼应）

watch 的 `flush: 'post'` 本质就是「回调自动 nextTick」——回调被排到更新之后，省去手写 nextTick；`flush: 'sync'` 则放弃批量、同步触发（仅特殊场景，慎用）。

## 回看开篇

连改三次只渲染一次的机制链：**trigger 不直接执行渲染，而是 queueJob 入 Set（去重）→ 微任务里统一 flush**。同步代码的「任意位置改数据」都被合并到同一次更新里；nextTick 的回调挂在 flushPromise 之后——「数据改完 + DOM 更新完」两个条件同时满足。

## 实战延伸

**1. 面试答题骨架**：「Vue 的更新是批量异步的——数据变化时 trigger 不直接重渲染，而是把组件的渲染 job 放入基于 Set 的去重队列，并通过 Promise.resolve().then 把 flush 排到微任务，同一轮同步代码里无论改多少次数据，每个组件只在 flush 时更新一次；nextTick 把回调挂在本轮 flush 的 promise 之后，保证在 DOM 更新完成后执行。Vue 2 曾按 Promise、MutationObserver、setImmediate、setTimeout 降级，宏任务版会引入渲染闪烁。」

**2. 一道时序题**：

```js
count.value = 1;
console.log(el.textContent);        // 旧值（DOM 还没更新）
nextTick(() => console.log('A'));
setTimeout(() => console.log('B'), 0);
nextTick(() => console.log('C'));
// 旧值 → A → C → B（微任务先于宏任务；nextTick 回调按注册序在 flush 后执行）
```

**3. 快手辨析**：`await nextTick()` 与 `setTimeout(0)` 都能「等等再执行」，差异在**等的位置**：前者是渲染前的微任务（不闪烁、不丢帧），后者是渲染后的宏任务（可能跨帧）。

## 图解总结

```
同步块: count=1 → count=2 → push → name='x'
          │ trigger ×4（vue-001）
          ▼
      queueJob ×4 ──▶ Set 去重 ──▶ [渲染job] （每组件一份）
                       │
                       └ Promise.resolve().then(flushJobs)  ← 只排一次
═══ 当前同步代码结束 ═══
微任务: flushJobs ──▶ 每个job: render+diff+patch ──▶ DOM 更新完成
          └──▶ nextTick 回调们（A、C…）          ← 挂在 flush 之后 ⭐
═══ （可能的一次渲染）═══
宏任务: setTimeout 回调（B）                      ← 跨过了渲染
```

## 总结

- 批量异步更新：trigger 入 Set 去重队列，微任务统一 flush——N 次修改 1 次渲染；
- nextTick = 挂在本轮 flush 之后的回调队列，保证 DOM 已更新；
- 微任务时机的意义：渲染前完成更新，无闪烁、不丢帧（Vue 2 降级史的反面教材）；
- flush: post 的 watch 本质是自动 nextTick；
- 时序题口诀：同步 → 微任务（flush + nextTick）→ 渲染 → 宏任务。

**面试一句话回答**：Vue 修改数据后并不立即重渲染——trigger 把组件的渲染副作用放进基于 Set 的去重队列，并用 Promise.resolve().then 把统一的 flush 调度到微任务，因此同一轮同步代码里改多少次数据、每个组件都只会在微任务里更新一次，完成 render 与 patch 后再执行 nextTick 挂载的回调；nextTick 的实现就是把回调添加到本轮 flush 的 Promise 之后，从而保证回调运行时 DOM 已经更新完毕。相比挂在宏任务的 setTimeout 会跨过一次渲染造成闪烁，微任务时机在渲染之前完成更新——Vue 2 曾按 Promise、MutationObserver、setImmediate、setTimeout 降级兼容，Vue 3 已只保留 Promise。

## 思考题

1. 把调度器的微任务换成 `setTimeout(fn, 0)`，构造一个「用户看到中间状态」的具体场景（提示：同步块结束后先渲染旧帧）。
2. flush 队列执行中某组件又改了数据（updated 钩子里改）会发生什么？调度器如何防死循环（截断/再入队）？
3. `await nextTick()` 之后操作 DOM 与 `onUpdated` 里操作 DOM，两者覆盖的时机有什么差别？（自组件更新 vs 任何原因的更新）
4. 开放设计：不依赖框架，给你的渲染函数实现 `batchWrite(fn)`：一帧内的多次状态写入只触发一次 paint——用本篇调度器思路写 30 行版本。

（思考题解析将同步录入小程序题库，关联本文 id：vue-005）

## 参考文献：

- 《Vue.js 设计与实现》第 5 章（调度器与批处理）
- Vue 官方文档 — 深入响应式：批量调度
- 本课程《js-async-005 事件循环》《vue-001 响应式》（两级地基）

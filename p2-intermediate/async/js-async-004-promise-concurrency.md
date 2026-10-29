---
id: js-async-004
title: 异步编程之并发控制
series: 异步编程系列
seriesId: js-async
stage: intermediate
difficulty: 4
tags: [Promise.all, Promise.allSettled, Promise.race, Promise.any, 并发限制, 手写]
readingTime: 22
prev: js-async-003
next: js-async-005
createdAt: 2026-10-26
---

# 异步编程之并发控制

## 从一个「100 张图片该怎么发车」的问题说起

页面要加载 100 张图片，接口有限流：**同时最多 6 个请求**。直接 `Promise.all(urls.map(load))` 会同时发出 100 个请求——超限、被拒、甚至拖垮页面。

这就是**并发控制**问题。它和 Promise 的四个静态方法是同一族问题：**「一批 Promise，我要等多久、要谁的结果、谁出错了怎么办」**。⭐⭐ `Promise.all/race/any/allSettled` 的差异与手写并发限制器，都是高频面试题。

先给四个静态方法的全家福（本篇主角）：

| 方法 | 等待策略 | 成功结果 | 失败行为 |
|---|---|---|---|
| `all` | 全部 fulfilled | 值数组（**保持入参顺序**） | 任一 reject 立即 reject |
| `allSettled` | 全部落定 | `{status, value/reason}` 数组 | 永不 reject |
| `race` | 第一个落定（无论成败） | 第一个的结果 | 第一个的失败 |
| `any` | 第一个 fulfilled | 第一个的成功值 | 全部失败才 reject（AggregateError） |

## 现象与直觉解释

四个方法的命名直觉：

- **all**：一个都不能少（短板效应，一个失败全盘失败）；
- **allSettled**：都给我交卷，成败都记下来（复盘型）；
- **race**：谁先冲线算谁（超时控制）；
- **any**：有一个成功就行（多源竞速，容错型）。

## 深入原理

### 一、两个反直觉的关键细节 ⭐

**细节 1：all 的结果顺序 = 入参顺序，与完成顺序无关**

```js
const delay = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));

Promise.all([delay(300, '慢'), delay(100, '快')]).then(console.log);
// ['慢', '快'] —— 慢的先完成？不，快先完成但结果按「下标」放回
// 实现：results[i] = value，而不是 push
```

为什么必须这样？调用方按位置解构 `const [user, orders] = await Promise.all([...])`——如果按完成顺序 push，位置就乱了。

**细节 2：race 不是「取消」，只是「不再等」**

```js
Promise.race([fetchData(), timeout(3000)]);
```

3 秒先到，race 落定为超时拒绝——**但 fetchData 仍在后台跑**（结果被丢弃）。JavaScript 的 Promise 没有取消语义（AbortController 才是真正的取消方案，见第 8 篇）。同理，all 失败后其余请求也不会停。

### 二、手写四个静态方法（面试高频）

**Promise.all**：

```js
MyPromise.all = function (promises) {
  return new MyPromise((resolve, reject) => {
    const results = [];
    let count = 0;                      // 已完成计数
    const list = Array.from(promises);  // 支持可迭代对象转数组

    if (list.length === 0) return resolve([]); // 空数组直接成功

    list.forEach((p, i) => {
      MyPromise.resolve(p).then((value) => { // resolve() 包装：统一 thenable/普通值
        results[i] = value;                  // ⭐ 按下标放，不 push
        count++;
        if (count === list.length) resolve(results); // 最后一个完成才 resolve
      }, reject);                            // 任一失败：直接 reject（其余结果丢弃）
    });
  });
};
```

**为什么用计数器而不是 `results.length === list.length`**：`results[1] = x` 先完成时 length 是 2（稀疏数组），位置陷阱——这是手写题最经典的追问。

**Promise.race**（结构与 all 对比着看）：

```js
MyPromise.race = function (promises) {
  return new MyPromise((resolve, reject) => {
    Array.from(promises).forEach((p) => {
      MyPromise.resolve(p).then(resolve, reject); // 谁先落定，谁的 resolve/reject 先生效
      // 之后到达的 resolve 调用无效（状态机只落定一次——上一篇的公理在这里发力）
    });
  });
};
```

**Promise.allSettled**：

```js
MyPromise.allSettled = function (promises) {
  return new MyPromise((resolve) => {
    const results = [];
    let count = 0;
    const list = Array.from(promises);
    if (list.length === 0) return resolve([]);
    list.forEach((p, i) => {
      MyPromise.resolve(p).then(
        (value) => { results[i] = { status: 'fulfilled', value }; if (++count === list.length) resolve(results); },
        (reason) => { results[i] = { status: 'rejected', reason }; if (++count === list.length) resolve(results); }
      );
    });
  });
};
```

**Promise.any**：与 all 的镜像——收集 rejection、等第一个成功；全部失败时 `reject(new AggregateError(errors))`。

<figure style="margin:2.2em 0">
<svg viewBox="0 0 720 300" width="100%" role="img" aria-label="并发池：固定 worker 轮转认领任务">
  <defs>
    <marker id="cc-ink" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#1C1A17"/>
    </marker>
  </defs>
  <text x="150" y="28" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13.5" font-weight="700" fill="#6E675A">任务队列（100 个）</text>
  <text x="540" y="28" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13.5" font-weight="700" fill="#6E675A">3 个 worker（limit = 3）</text>
  <rect x="40" y="46" width="220" height="40" rx="6" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.4"/>
  <text x="150" y="71" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11.5" fill="#1C1A17">t1 · t2 · t3 · t4 · … · t100</text>
  <rect x="40" y="94" width="220" height="40" rx="6" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.4" opacity="0.55"/>
  <text x="150" y="119" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11.5" fill="#6E675A">在途：t1 · t2 · t3</text>
  <rect x="470" y="42" width="150" height="48" rx="8" fill="#FBF8F1" stroke="#B03A2E" stroke-width="1.8"/>
  <text x="545" y="72" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13" font-weight="700" fill="#1C1A17">Worker 1 → t4</text>
  <rect x="470" y="102" width="150" height="48" rx="8" fill="#FBF8F1" stroke="#B03A2E" stroke-width="1.8"/>
  <text x="545" y="132" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13" font-weight="700" fill="#1C1A17">Worker 2 → t2</text>
  <rect x="470" y="162" width="150" height="48" rx="8" fill="#FBF8F1" stroke="#B03A2E" stroke-width="1.8"/>
  <text x="545" y="192" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13" font-weight="700" fill="#1C1A17">Worker 3 → t1</text>
  <path d="M 262 66 C 320 56 380 56 464 64" stroke="#1C1A17" stroke-width="1.5" fill="none" marker-end="url(#cc-ink)"/>
  <path d="M 262 66 C 330 96 380 114 464 124" stroke="#1C1A17" stroke-width="1.5" fill="none" marker-end="url(#cc-ink)"/>
  <path d="M 262 66 C 330 140 380 174 464 186" stroke="#1C1A17" stroke-width="1.5" fill="none" marker-end="url(#cc-ink)"/>
  <circle r="5" fill="#B03A2E">
    <animateMotion dur="2.6s" repeatCount="indefinite" path="M 262 66 C 330 96 380 114 464 124"/>
  </circle>
  <text x="300" y="150" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#B03A2E">红点 = 一份任务被认领</text>
  <rect x="40" y="210" width="580" height="44" rx="6" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.4"/>
  <text x="330" y="238" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#1C1A17">results[i] —— 完成一个归还一个，位置跟着下标走（顺序稳定）</text>
  <text x="676" y="120" font-family="Noto Sans SC,sans-serif" font-size="12" fill="#6E675A">完工的 worker</text>
  <text x="676" y="140" font-family="Noto Sans SC,sans-serif" font-size="12" fill="#6E675A">立刻认领下一个 ⭐</text>
</svg>
<figcaption style="font-family:'Noto Sans SC',sans-serif;font-size:13px;color:#6E675A;text-align:center;margin-top:10px">图 · 并发池模型——工人数封顶了「同时在途」，队尾的完工者马上回头抢新任务</figcaption>
</figure>

### 三、并发限制器：100 张图片、最多 6 个在途 ⭐⭐

需求本质：**任务池模型**——一个「待办队列」+ 固定数量的「工人」。

```js
async function limitConcurrency(tasks, limit) {
  const results = new Array(tasks.length);
  let nextIndex = 0; // 下一个该执行的任务下标（共享游标）

  async function worker() {
    while (nextIndex < tasks.length) {
      const i = nextIndex++;       // 认领任务（JS 单线程，无竞态）
      results[i] = await tasks[i](); // 执行并按下标归还
    }
  }

  // 启动 limit 个工人，等全部「干完活」（队列为空）
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

// 使用：100 个任务，任意时刻最多 6 个在途
const tasks = urls.map((url) => () => load(url)); // ⚠️ 注意包成「函数」，调用才发起请求
const images = await limitConcurrency(tasks, 6);
```

四个精妙点（也是追问点）：

1. **worker 用 while 而不是一次取一个**：工人干完手头活继续抢下一个，直到队列空——「工人」数量恒为 limit；
2. **nextIndex++ 认领任务**：JS 单线程，`++` 不会被打断，天然免锁；
3. **`Promise.all(Array.from({length: limit}, worker))`**：启动 limit 个 worker 并等它们全部结束——all 的活用；
4. **tasks 必须是「返回 Promise 的函数」**：如果直接传 Promise 数组，`limitConcurrency` 执行前请求就全发出去了（Promise 构造即执行）——「惰性任务」是并发控制的隐含前提。

**另一种经典实现：递归补位**（每完成一个补一个新任务），思路不同、结果等价；「滑动窗口」版本见《handwritten-012 手写 LRU 缓存》同系列风格的《js-async-008 异步实战》。

### 四、四个方法的场景速配

```js
// all：批量数据齐了才能渲染
const [user, orders, coupons] = await Promise.all([getUser(), getOrders(), getCoupons()]);

// allSettled：批量上报/导入，失败的记录下来重试
const settled = await Promise.allSettled(items.map(upload));

// race：超时兜底
await Promise.race([fetchData(), timeout(5000)]);

// any：多 CDN 竞速取最快
const img = await Promise.any([loadCDN1(url), loadCDN2(url), loadCDN3(url)]);
```

## 回看开篇

100 张图片的答案：

```js
const tasks = urls.map((url) => () => fetch(url).then((r) => r.blob()));
const blobs = await limitConcurrency(tasks, 6); // 任意时刻最多 6 个在途
```

而如果「每个失败都要知道但不能中断整体」，把 worker 内部换成 allSettled 的按位记录即可——**并发限制管「宽度」，all/allSettled 管「聚合策略」，两者正交组合**。

## 实战延伸

**1. 带暂停/恢复的并发池**：把 worker 的 while 循环里加一个「暂停开关」的 await（如 `while (paused) await sleep(100)`），就能实现可暂停的下载器。

**2. 失败重试与限流的组合**：`tasks.map(task => () => withRetry(task, 3))`——重试包裹任务、并发池包裹重试，层层组合（重试实现见《js-async-008》）。

**3. 面试快手题**：`Promise.all` 中一个失败后，其他请求会怎样？——**继续跑，只是结果被丢弃**；要「全部要结果」换 allSettled，要「真正取消」用 AbortController。

## 图解总结

```
任务队列: [t1 t2 t3 t4 t5 t6 t7 t8 t9 …]   ← nextIndex 游标
            │ 认领
            ▼
工人工位:  W1(t1→t4→t7…)  W2(t2→t5→t8…)  W3(t3→t6→t9…)   ← limit = 3
            │ 各自串行 await
            ▼
结果槽位: results[0..n-1]（按下标归还，顺序稳定）
            │ 全部工人完工（Promise.all(workers)）
            ▼
          resolve(results)
```

## 总结

- 四个静态方法是四种「聚合策略」：all 全成才成、allSettled 全落定才返回、race 第一个落定、any 第一个成功；
- all 的结果**按下标归位**（顺序稳定），实现要用计数器而非 length 判断；race/all 失败都**不取消**其余任务；
- 并发限制器 = 共享游标 + 固定 worker 循环认领 + Promise.all 收尾；任务必须惰性（函数包装）；
- 并发限制（宽度）与聚合策略（语义）正交，可自由组合。

**面试一句话回答**：Promise.all 等全部成功且结果按入参下标返回、任一失败立即整体拒绝，allSettled 等全部落定并返回状态清单，race 采用第一个落定的结果，any 采用第一个成功、全败才抛 AggregateError；并发限制则用「固定数量的 worker 通过共享下标循环认领任务、结果按下标归位、Promise.all 等所有 worker 完成」的任务池模型实现，注意任务必须包装成惰性函数，且这些方法都不会真正取消未完成的请求。

## 思考题

1. 手写 `MyPromise.any`（提示：镜像 all——收集 rejection、计数器、AggregateError）。
2. 把 limitConcurrency 的 `results[i] = await tasks[i]()` 改成 `results.push(await tasks[i]())`，会出什么问题？给出一个能暴露差异的任务序列。
3. `Promise.all` 里混入普通值（`Promise.all([fetchA(), 42, fetchB()])`）会怎样？由哪个机制保证的？
4. 开放设计：实现「带并发上限的批量上传」，要求：最多 3 并发、单个失败重试 2 次、全部结束后返回成功与失败清单——用本篇哪些积木组合？画出调用结构。

（思考题解析将同步录入小程序题库，关联本文 id：js-async-004）

## 参考文献

- ECMA-262 现行版 — Promise.all / Promise.allSettled / Promise.race / Promise.any 规范步骤
- MDN — [Promise 静态方法](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise)
- 《你不知道的 JavaScript（中卷）》第 3 章
- 本系列《js-async-003 手写 Promise》（MyPromise 基座）

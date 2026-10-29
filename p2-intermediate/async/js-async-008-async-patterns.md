---
id: js-async-008
title: 异步编程之实战模式
series: 异步编程系列
seriesId: js-async
stage: intermediate
difficulty: 4
tags: [竞态, 取消, AbortController, 重试, 超时, 并发池, 实战]
readingTime: 26
prev: js-async-007
next: null
createdAt: 2026-10-26
---

# 异步编程之实战模式

## 从一个「搜索结果闪回」的线上 Bug 说起

搜索框需求：输入关键词，防抖 300ms 后请求结果。测试发现偶现怪象：**输入「前端」，结果先显示了正确的列表，随后突然被替换成上一次「前」的过期结果**。

```js
input.addEventListener('input', (e) => {
  debounceSearch(e.target.value);
});
async function search(kw) {
  const list = await fetchList(kw);
  render(list); // ⚠️ 谁后返回谁说了算 —— 不是谁新谁说了算
}
// 时序：「前」(慢, 900ms) 与 「前端」(快, 200ms) 几乎同时发出
// → 「前端」的结果先渲染 → 「前」的旧结果 700ms 后杀回来覆盖
```

这是**竞态（race condition）**——异步世界的头号实战 Bug。本篇是系列收官：把前七篇的机制组装成四个生产级模式：**竞态治理、超时与重试、真正的取消、可控并发池**。⭐ 每个模式都是「面试聊项目」时的硬通货。

## 现象与直觉解释

异步实战问题虽然形态各异，归因只有三类：

1. **不该等的东西在等**（慢请求拖住流程）→ 超时/竞速；
2. **该停的东西没停**（过期请求还在跑、还会回来污染状态）→ 取消/竞态治理；
3. **该快的没快**（串行 await、无谓重试、并发失控）→ 并发池与重试策略。

## 深入原理

### 一、竞态治理：三种武器

**武器 1：序号守卫（last-write-wins）**——通用、零依赖：

```js
let latestId = 0; // 全局递增的「请求序号」

async function search(kw) {
  const id = ++latestId;       // 发起时登记最新序号
  const list = await fetchList(kw);
  if (id !== latestId) return; // 回来时已不是最新的 —— 丢弃，不渲染
  render(list);
}
```

原理一句话：**只有「回来时发现自己仍是最新」的响应才有资格写状态**。闭包持有各自的 id（`js-deep-005` 的应用），互相对比即可判旧。

**武器 2：AbortController——从「丢弃结果」到「真正取消」⭐**

序号守卫只是不采用结果，请求本身还在跑（浪费流量、占并发）。`AbortController` 是浏览器提供的真取消：

```js
let controller = null;

async function search(kw) {
  controller?.abort();               // 取消上一个未完成请求
  controller = new AbortController();
  try {
    const list = await fetchList(kw, { signal: controller.signal });
    render(list);
  } catch (e) {
    if (e.name === 'AbortError') return; // 取消不算错误，静默处理
    throw e;
  }
}

// fetchList 内部：
fetch(url, { signal }); // fetch 原生支持 signal
```

被 abort 的请求：网络层终止（不再收发）、promise 以 `AbortError` 拒绝。它已渗透到整个 Web API 体系（addEventListener 的 signal、Array.fromAsync 等），**是「取消语义」的事实标准**——Promise 本身没有取消，取消靠的是外部信号（呼应第 4 篇「race 不取消」）。

**武器 3：把取消权交给用户层**：上拉加载分页、路由切换（`AbortSignal.any([信号A, 信号B])` 组合多个取消源）、React Query / VueUse 的竞态治理本质都是前两件武器的工程化封装。

### 二、超时：给任何异步任务加护栏

```js
function withTimeout(task, ms) {
  return Promise.race([
    task, // 注意：race 只是「不再等」，task 本身还在跑（第 4 篇）
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)
    ),
  ]);
}

const user = await withTimeout(getUser(1), 3000); // 3 秒护栏
```

升级版：超时同时取消任务（组合武器 2）：

```js
function withTimeoutAndAbort(taskFactory, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return taskFactory(controller.signal).finally(() => clearTimeout(timer));
}
// taskFactory 必须接受 signal 并传给 fetch —— 超时即真取消
```

注意参数是**任务工厂**（惰性函数）而非 promise——传 promise 的话任务早已发起，无法注入 signal（第 4 篇「惰性前提」的重现）。

### 三、重试：不是「再来一次」那么简单 ⭐

生产级重试要回答四个问题：**哪些错能重试？重试几次？间隔多久？最后怎么办？**

```js
async function withRetry(taskFactory, {
  retries = 3,
  baseDelay = 300,
} = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await taskFactory(); // 每次重试重新创建任务（惰性！）
    } catch (e) {
      lastErr = e;
      // ① 可重试判定：网络错误/5xx/超时可试；4xx（业务错误）重试无意义
      if (!isRetryable(e)) throw e;
      if (attempt === retries) break;
      // ② 指数退避：300 → 600 → 1200ms，避免雪上加霜打挂服务端
      const delay = baseDelay * 2 ** attempt;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr; // ③ 重试耗尽：抛出，让上层决定兜底
}

const data = await withRetry(() => fetchData(), { retries: 3 });
```

三个设计点（面试追问点）：

1. **幂等性前提**：GET 重试安全；POST（下单、支付）盲目重试可能重复扣款——非幂等接口要靠**幂等 token**（服务端去重）而不是客户端忍住；
2. **指数退避 + 抖动（jitter）**：`delay + Math.random() * 200`——海量客户端同频重试会造成「重试风暴」，抖动把频率打散；
3. **组合成洋葱**：`withRetry(() => withTimeout(fetchData, 2000))`——超时（快速失败）在最内层触发重试（慢速恢复），层层包裹各司其职。

### 四、并发池 2.0：一个可用的 AsyncPool 类

第 4 篇的 `limitConcurrency` 是函数式的；生产中更常用「可提交任务、可等待全部完成」的池：

```js
class AsyncPool {
  #queue = [];        // 待办任务
  #workers = 0;       // 在职工人数
  #limit;             #waiters = [];

  constructor(limit) { this.#limit = limit; }

  run(task) {         // 提交任务，返回该任务结果的 promise
    return new Promise((resolve, reject) => {
      this.#queue.push({ task, resolve, reject });
      this.#schedule();
    });
  }

  #schedule() {
    while (this.#workers < this.#limit && this.#queue.length) {
      const { task, resolve, reject } = this.#queue.shift();
      this.#workers++;
      Promise.resolve()
        .then(() => task())           // 异步启动，避免同步递归过深
        .then(resolve, reject)
        .finally(() => {
          this.#workers--;            // 工人空闲：腾出工位
          if (this.#queue.length) this.#schedule();
          else this.#notifyIdle();
        });
    }
  }

  #notifyIdle() {                     // 队列清空时唤醒所有等待者
    while (this.#waiters.length) this.#waiters.shift()();
  }

  idle() {                            // 等待池完全排空
    return this.#queue.length === 0 && this.#workers === 0
      ? Promise.resolve()
      : new Promise((r) => this.#waiters.push(r));
  }
}

// 使用：爬虫式批量抓取，恒定 5 并发
const pool = new AsyncPool(5);
urls.forEach((url) => pool.run(() => fetchPage(url)));
await pool.idle();
```

私有字段 `#`（ES2022）防止外部篡改队列；`run` 返回独立 promise，任务的成败互不影响（内部不吞错）。这就是 p-limit、p-queue 这类库的核心骨架。

## 回看开篇

搜索竞态的最终方案（三行核心）：

```js
let controller = null;
async function search(kw) {
  controller?.abort();                                  // ① 取消旧的（真取消）
  controller = new AbortController();
  const id = ++latestId;                                // ② 序号守卫（双保险）
  try {
    render(await fetchList(kw, { signal: controller.signal }));
  } catch (e) { if (e.name !== 'AbortError') throw e; } // ③ 取消静默
}
```

## 实战延伸：一张「问题 → 模式」速查表

| 症状 | 模式 | 关键 API/技巧 |
|---|---|---|
| 旧响应覆盖新结果 | 竞态治理 | 序号守卫 / AbortController |
| 慢请求拖死流程 | 超时 | Promise.race + setTimeout / signal |
| 偶发失败全链路崩 | 重试 | 指数退避 + 幂等判定 |
| 批量任务打挂服务 | 并发池 | AsyncPool / p-limit |
| 接口完成才要结果 | 串行 await | 「依赖才 await」判据 |
| 独立任务变串行 | map + all | 《js-async-007》循环陷阱 |

## 图解总结

```
                 异步任务 ──▶ 包装修配（洋葱模型）
   withRetry  ───────────── 外层：失败重试（退避+幂等判定）
     withTimeout ─────────── 中层：超时快速失败（race / abort）
       task(signal) ──────── 内层：真实任务（可接收取消信号）

 竞态治理：发起序号 id ──返回──▶ id 仍是最新？渲染 : 丢弃
           （AbortController：甚至不让它回来 —— abort 掉）
```

## 总结

- 竞态治理双保险：序号守卫（丢弃过期结果）+ AbortController（真取消请求）；
- 超时用 race 实现「不再等」，配合 signal 才是「真取消」；任务要以工厂形式传入（惰性）；
- 重试四要素：幂等判定、次数上限、指数退避加抖动、耗尽抛出；
- 并发池 = 队列 + 定员工人 + 空闲通知，p-limit/p-queue 的骨架；
- 所有模式都是前七篇机制（promise 状态机、race、微任务、惰性任务）的积木组合。

**面试一句话回答**：生产级异步要处理竞态、超时、重试与并发四类问题——竞态用递增序号丢弃过期响应、用 AbortController 真正取消旧请求；超时用 Promise.race 加定时器并配合 signal 取消；重试必须判定幂等、用指数退避加抖动并设次数上限；批量任务用定员工人的并发池控制同时在途数量——这些模式本质上是 Promise 状态机、race 语义和惰性任务工厂的组合应用。

## 思考题

1. 序号守卫方案中，如果 `render` 本身是异步的（先 render A 再 render B，B 先完成），还有竞态吗？如何加固？
2. 给 `withRetry` 增加「重试也会因取消而中止」的能力：AbortSignal 传入后，取消应立即退出循环而不是等退避。（提示：把退避的 setTimeout 也做成可取消的）
3. AsyncPool 的 `run` 在池满且队列很长时，promise 长期 pending——如何加一个「队列上限」，超限直接拒绝？（提示：类比 TCP 的背压）
4. 开放设计：设计「图片上传器」需求——最多 3 并发、单图失败重试 2 次、失败不影响其他图、页面上要展示每张图实时进度、支持用户点「暂停/继续」。列出用到的本篇积木与状态机设计。

（思考题解析将同步录入小程序题库，关联本文 id：js-async-008）

## 参考文献

- MDN — [AbortController](https://developer.mozilla.org/zh-CN/docs/Web/API/AbortController)、[fetch signal](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/fetch)
- p-limit / p-queue 源码（并发池参考实现）
- AWS 架构博客 — Exponential Backoff and Jitter（退避与抖动的经典论述）
- 本系列第 4、5、7 篇（并发、时序、await 陷阱的地基）

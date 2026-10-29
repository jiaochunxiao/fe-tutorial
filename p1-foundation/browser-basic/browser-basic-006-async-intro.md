---
id: browser-basic-006
title: 浏览器基础之异步入门：从回调到 Promise
series: 浏览器基础系列
seriesId: browser-basic
stage: foundation
difficulty: 2
tags: [异步入门, 回调, Promise, 事件驱动, 并发模型]
readingTime: 14
prev: browser-basic-005
next: null
createdAt: 2026-10-26
---

# 浏览器基础之异步入门：从回调到 Promise

## 从「为什么读文件不能直接返回值」说起

> 本篇是《浏览器基础系列》收官，也是通往《异步编程系列》（中级）的引桥——用最小的概念集，把「异步到底是什么」立住。

```js
// 同步世界的直觉（假想的 JS）
const user = fetchUserSync(1);   // ❌ 假装 JS 能这样：卡住页面直到返回

// 真实世界的 JS
const user = fetchUser(1);       // 立刻返回（但还不是数据！）
console.log(user);               // Promise {<pending>} —— 一个"凭证"
```

同步 = 「等结果，拿到值」；异步 = 「先拿凭证，结果稍后送达」。⭐ 本篇立三个概念：为什么必须异步、回调与 Promise 两种形态、事件驱动的心智模型——进阶机制（事件循环全解、手写 Promise、async/await）在《js-async》系列。

## 现象与直觉解释

### 为什么浏览器里的 JS 必须异步

回顾《browser-basic-002》：**主线程只有一条**，还身兼渲染——任何同步等待（网络 500ms、定时器 3s）都意味着**页面冻结**（不能点、不能滚、不能画）。所以浏览器把所有耗时操作设计成「异步」：

```
耗时操作（网络/定时器/读文件）→ 交给别人（其他进程/线程）
                                  └─ 完成后「排队」通知主线程
主线程：发起后立刻继续 → 空闲时处理"通知"（执行你的后续代码）
```

这就是**事件驱动**：主线程是一个不断处理消息的循环（事件循环），异步完成的「通知 + 数据」作为任务排队进入。

### 两种「稍后执行我的代码」的形态

```js
// 形态1：回调（callback）—— 老派但无处不在
setTimeout(() => console.log('1 秒后'), 1000);
btn.addEventListener('click', () => console.log('被点了'));
fetch(url, (err, data) => { /* 老式 node 风格 */ });

// 形态2：Promise —— 现代标准
fetch(url).then((res) => res.json()).then((data) => render(data));
const data = await fetch(url);   // async/await：同步的样子（js-async-007）
```

## 深入原理

### 一、回调：最小可行方案与它的天花板 ⭐

```js
function getUser(id, callback) {
  setTimeout(() => {              // 模拟异步请求
    callback({ id, name: '小明' });
  }, 100);
}

getUser(1, (user) => {
  getOrders(user.id, (orders) => {      // 第二步依赖第一步
    render(orders);                      // 嵌套开始加深……
  });
});
```

回调的问题在《js-async-001》会全面展开（控制反转、回调地狱）；入门阶段记住两点：① **错误处理要层层手传**（每层都要判断 err）；② **嵌套表达依赖**——步骤越多越深。

### 二、Promise：把「未来的值」变成对象 ⭐

```js
const p = fetch(url);        // 立刻拿到 Promise（凭证）

p.then((data) => {           // "到货后干什么"写在凭证上
  return step2(data);        // 返回新 promise → 链式
})
.then((r2) => step3(r2))
.catch((err) => {            // 任何一步失败都到这 —— 错误处理只写一次 ✅
  showError(err);
});

// async/await 是同一件事的同步写法（推荐）：
async function main() {
  try {
    const data = await fetch(url);
    const r2 = await step2(data);
    step3(r2);
  } catch (err) {
    showError(err);          // try/catch 又能用了 ✅
  }
}
```

入门三句话：**Promise 是凭证；then 是到货后的安排；await 是「等凭证兑现」的同步写法**。

### 三、事件驱动心智模型（把三篇串起来）⭐

```
主线程（唯一）：[事件循环] ← 任务队列 ← [各种完成通知]
                        ▲
   发起 fetch ─────────┘（立刻返回 promise，继续干别的）
   网络进程干活 → 完成 → IO线程 → 回调/then 排队 → 主线程空闲时执行
```

三个由此而来的日常现象：

1. `setTimeout(fn, 0)` 不是立即执行——要等当前代码跑完 + 队列轮到它；
2. 多个异步并发发起（不互相 await），总耗时 ≈ 最慢的那个，不是相加；
3. **回调/then 里的代码执行时机由「队列」决定**——这就是所有「输出顺序题」的总原理（《js-async-005》专篇）。

## 回看开篇

`fetchUser(1)` 不能直接返回数据的原因：数据 500ms 后才从网络回来，而**主线程这 500ms 必须用来渲染页面**——同步等待等于冻结。所以 JS 的选择是：**立刻返回凭证（Promise），把「到货后怎么办」登记在凭证上，事件循环在空闲时兑现**——异步不是麻烦，是单线程世界唯一的活路。

## 实战延伸

**1. 面试答题骨架（入门版）**：「JS 单线程且主线程兼任渲染，同步等待会冻结页面，因此所有耗时操作都是异步——交给其他进程线程完成，回调或 Promise 在任务队列里排队，等主线程空闲执行。Promise 是未来值的对象凭证，then 登记兑现后的处理并支持链式，错误沿链冒泡到 catch；async/await 是其同步写法。setTimeout 零延迟也不是立即执行，多个不互相依赖的异步并发发起总耗时约等于最慢者。」

**2. 一个判断「是否会异步」的小题**：

```js
console.log('1');
setTimeout(() => console.log('2'), 0);
Promise.resolve().then(() => console.log('3'));
console.log('4');
// 1 4 3 2 —— 同步先走完；微任务(then)先于宏任务(setTimeout)
// 「微任务/宏任务」的完整规则是 js-async-005 的主题，此处记住顺序即可
```

## 图解总结

```
单线程主线程 ═ 事件循环 ═ 不断取「任务」执行
   │ 发起异步（fetch/setTimeout）──▶ 别的进程/线程干活
   │        立刻返回凭证（Promise）/登记回调
   ▼
 任务队列：[then回调…（微任务）| timeout回调…（宏任务）]
   完成通知按规则排队 → 主线程空闲时执行

形态演进： 回调（嵌套+错误手传）→ Promise（链式+错误冒泡）→ async/await（同步写法）
```

## 总结

- 单线程+渲染兼任 → 同步等待 = 冻结 → 异步是必需品；
- 异步 = 把活交给别人 + 完成后排队通知主线程（事件驱动）；
- 回调是地基但嵌套深、错误层层传；Promise 用凭证+then 链+catch 修正；async/await 是同步写法；
- setTimeout(fn,0) 不立即执行；并发异步总耗时≈最慢者；
- 输出顺序题的总原理：队列与主线程的调度。

**面试一句话回答**：因为渲染进程主线程只有一条且同时负责页面渲染，任何同步等待都会冻结交互，所以浏览器中所有耗时操作都是异步的——工作交给网络进程或其他线程，完成后把回调或 then 登记的处理排入任务队列，由主线程的事件循环在空闲时执行；写法上从回调演进到 Promise 再到 async/await——Promise 把未来的值封装成可链式调用的对象凭证，错误沿链自动冒泡到 catch，await 则用同步的书写风格表达等待，而 setTimeout 零延迟也不是立即执行，多个不相互依赖的异步并发发起总耗时约等于最慢的那一个。

## 思考题

1. 画出 `fetch(url).then(render)` 的完整时序：谁在干活、通知怎么排队、render 什么时候执行。
2. 为什么 `await` 必须写在 `async` 函数里？（一句话版：await 是「暂停本函数、让出主线程」的语法，只有 async 函数能被暂停——细节在 js-async-007）
3. 三个不依赖的接口分别要 100/200/300ms——串行 await 与 `Promise.all` 并发的总耗时各是多少？为什么？
4. 开放练习：用回调与 Promise 分别实现「加载用户→加载订单→渲染」三步——体感两种写法的差异，这就是《js-async-001》的预习作业。

（思考题解析将同步录入小程序题库，关联本文 id：browser-basic-006）

## 参考文献：

- MDN — [异步 JavaScript](https://developer.mozilla.org/zh-CN/docs/Learn/JavaScript/Asynchronous)、[并发模型与事件循环](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Event_loop)
- 本课程《browser-basic-002 渲染进程线程》《js-async-001/002》（异步的进阶全篇）

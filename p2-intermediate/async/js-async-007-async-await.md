---
id: js-async-007
title: 异步编程之 async/await 的本质
series: 异步编程系列
seriesId: js-async
stage: intermediate
difficulty: 4
tags: [async/await, 语法糖, 微任务, 并发陷阱, try-catch]
readingTime: 22
prev: js-async-006
next: js-async-008
createdAt: 2026-10-26
---

# 异步编程之 async/await 的本质

## 从一道「await 的时序题」说起

```js
async function foo() {
  console.log('1 foo start');
  await bar();
  console.log('4 after await');
}

async function bar() {
  console.log('2 bar');
}

console.log('0 script');
foo().then(() => console.log('5 foo resolved'));
Promise.resolve().then(() => console.log('3 micro'));
console.log('end');
```

正确输出顺序：

```
0 script
1 foo start
2 bar
end
3 micro
4 after await
5 foo resolved
```

疑点：`4 after await` 为什么排在 `3 micro` 之后？`await` 到底「等」了什么？⭐⭐ async/await 是现代异步的日常工具，但输出顺序类题目错误率极高——因为多数人把它当黑盒。本文把盒子拆开：**它是「生成器 + 执行器」的语言内置化**（《js-async-006》的直接续集）。

## 现象与直觉解释

两条使用直觉：

1. **await = 等右边出结果，再执行下一行**——异步代码写成同步的样子；
2. **async 函数总是返回 Promise**——无论你 return 什么。

这两条直觉足以写业务代码，但解释不了：为什么 try/catch 能捕获异步错误？为什么 await 后面的代码是微任务？为什么循环里 await 会变成串行？——需要拆解本质。

## 深入原理

### 一、本质公式：脱糖（desugar）⭐

**一个 async 函数 ≈ 一个被自动驱动（执行器内置）的生成器函数**：

```js
// 你写的
async function main() {
  const user = await getUser(1);
  const orders = await getOrders(user.id);
  return orders;
}

// 概念上的脱糖（生成器表达）
function* main() {
  const user = yield getUser(1);      // await ≈ yield
  const orders = yield getOrders(user.id);
  return orders;
}
run(main); // 引擎内置的执行器，不再是用户代码里的 run
```

对应关系表：

| async/await 语法 | 生成器等价物 |
|---|---|
| `async function` | `function*` + 内置执行器 |
| `await x` | `yield x`（x 会被 `Promise.resolve(x)` 包装） |
| `return v` | 生成器结束，promise 以 v 落定 |
| 函数体抛错 | 生成器 throw，promise 拒绝 |
| 调用 async 函数 | 创建生成器 + 启动执行器（**同步执行到第一个 await**） |

现代引擎（V8）实际实现做了进一步优化（不经过真正的生成器对象，而是直接变换为 promise 链 + 寄存器恢复），但**语义与脱糖模型完全一致**——用脱糖模型推演输出题永远正确。

### 二、await 的精确时序（开篇疑案的答案）

`await x` 展开后的三步：

```js
// await x; 之后的代码
// ≈
Promise.resolve(x).then(function resume(结果) {
  // 之后的代码在这里，作为微任务执行
});
// ⚠️ 且 async 函数在「此处」同步返回一个 pending 的 promise 给调用方
```

套用开篇：

```
foo() 同步执行：log '1 foo start'
  → 遇 await bar()：bar 同步执行 log '2 bar'，返回（resolved 的 promise）
  → 把「after await 之后的部分」包装成 .then 回调，排入微任务 ①
  → foo 暂停，同步返回 pending promise
脚本继续：log 'end'
  → Promise.resolve().then 排入微任务 ②  —— ② 在 ① 之后入队
清微任务：先 ①？不——
```

等一下，① 是在调用 `foo()` 时入队的，② 是其后语句入队的，为什么输出却是 `3 micro` 在 `4 after await` 之前？

**因为 await 一个**已落定**的 promise，恢复回调也要「再等一个微任务 tick」**：`Promise.resolve(x).then(resume)` 中，若 x 本身是 promise，then 的注册要等 x 的落定「穿越一层 then 链」（thenable 采纳任务，见《js-async-002/003》），于是 resume 实际排到了 ② 之后。这正是规范中 `await` 语义的经典细节——V8 曾专门发文讨论「await 快速路径」优化，但**可观察时序保持不变**。记住结论：

> **await 之后的代码至少晚一个微任务层级执行；await pending 的值时，恢复点在落定之后的微任务里。**

（在 Node ≥ 12 / 现代浏览器的实现中，规范通过明确的 job 排队顺序固化了这一时序，输出题按「恢复回调后置一位」推即可。）

### 三、返回值与错误处理的包装

```js
async function f1() { return 42; }
f1() instanceof Promise;        // true —— 总是 promise
f1().then(console.log);         // 42（Promise.resolve 包装规则）

async function f2() { throw new Error('boom'); }
f2().catch((e) => console.log(e.message)); // boom —— 函数体抛错 = promise 拒绝
```

**try/catch 终于能捕获异步错误**——脱糖模型下就是「执行器把 reject 注入 yield 处抛出，被函数体内的 try 捕获」（第 6 篇 run 执行器的 `gen.throw` 分支）。对照第 1 篇回调时代「try 跨不过异步边界」：这是异步控制流的**完全体回归**。

```js
async function load() {
  try {
    const user = await getUser(1);     // 失败会在这里被抛出
    const orders = await getOrders(user.id);
  } catch (e) {
    // 兜住整段链路的所有错误
  }
}
```

### 四、致命陷阱：循环中的 await ⭐⭐

```js
// ① 串行：总耗时 ≈ 100 + 100 + 100 = 300ms
for (const id of ids) {
  const data = await fetchOne(id); // 每个 await 都「暂停」到完成才进下一轮
}

// ② 并发：总耗时 ≈ 100ms（三个同时发起）
const results = await Promise.all(ids.map((id) => fetchOne(id)));
```

`await` 表达的是「**下一步依赖这一步**」；如果任务彼此独立，await 循环会把并发强行压成串行——这是真实项目里最常见的性能事故之一（列表页 N 个接口逐个等待）。**判据：下一步要不要用上一步的结果？**要，串行 await；不要，map 出 promise 再 all。

### 五、async 函数的传染性

async 像「向上传染的标注」：函数内部用了 await，函数就必须 async；调用方要拿结果，就也得 await……直到最外层（事件回调、入口函数）。它是**可组合的同步化语法，但传播链上的每一环都变成了异步**——架构上意味着什么，见《architecture-002 状态管理的架构思考》的异步数据流一节。

## 回看开篇

用脱糖模型复核：`foo()` 同步跑到 `await bar()`（0→1→2），把「4 after await」作为 resume 回调排入微任务且额外让出一个层级；`3 micro` 的 then 先入队先执行；foo 的 promise 在 resume 完成后落定，`5` 最后。**没有一个数字需要背——全部由「同步执行到第一个 await + resume 是微任务 + 恢复让位一层」三条规则推出**。

## 实战延伸

**1. 超时与竞速的组合拳**

```js
const user = await Promise.race([getUser(1), timeout(3000)]); // race 保住 await 的同步书写
```

**2. 「忘了 await」不报错但致命**：`fetchOne(id)` 忘写 await，拿到的是 promise 而不是值——下游使用时才会暴雷。TypeScript 中标注返回类型可显著降低此风险（关联《ts-008》）。

**3. 顶层 await**：ES2022 起 module 顶层可直接 await（模块会等待其完成）——构建链路（配置文件加载）常用。

## 图解总结

```
async function main() {          run(内置执行器)
  A;                    ──同步──▶ 执行 A
  await p;              ──脱糖──▶ Promise.resolve(p).then(resume)
                                  main 暂停，立即返回 pending promise
  B;                    ◀─resume─ p 落定后，B 作为微任务执行
}
// 每个等待点 = 「同步段 + 微任务恢复段」的分界线
```

## 总结

- async/await = 生成器 + 内置执行器的语法糖：await≈yield、async 函数总是返回 promise；
- 调用 async 函数会**同步执行到第一个 await**，之后的代码是恢复微任务，且至少让位一层；
- try/catch 能捕获异步错误——执行器把 rejection 注入暂停点抛出；
- 独立任务禁止循环 await（串行陷阱），用 `map + Promise.all`；
- 本质是「同步书写、微任务调度」，与事件循环模型（《js-async-005》）严丝合缝。

**面试一句话回答**：async/await 是生成器加内置执行器的语法糖——async 函数调用时同步执行到第一个 await 处暂停并立即返回一个 pending 的 Promise，await 右值被 Promise.resolve 包装，落定后以微任务恢复执行后续代码并至少让位一个微任务层级，函数体抛错则对应 Promise 拒绝、可被函数体内的 try/catch 捕获；要注意独立任务在循环中 await 会退化为串行，应改用 map 加 Promise.all 并发。

## 思考题

1. 写出输出（用脱糖模型逐步标注）：
```js
async function a() {
  console.log('a1');
  await null;
  console.log('a2');
}
async function b() {
  console.log('b1');
  await a();
  console.log('b2');
}
b().then(() => console.log('end'));
Promise.resolve().then(() => console.log('p'));
```

2. 下面两段代码执行顺序差异在哪？
```js
// A
(async () => { await foo(); bar(); })();
// B
(async () => { foo().then(bar); })();
```

3. 为什么「await 一个 async 函数返回的已落定 promise」和「await 一个普通值」恢复时机可能不同？用 thenable 采纳的微任务层数解释。

4. 开放设计：把一个「回调风格 + 循环串行」的老模块改造成并发版：改写步骤、验证手段（耗时断言）、回归风险各是什么？

（思考题解析将同步录入小程序题库，关联本文 id：js-async-007）

## 参考文献

- ECMA-262 现行版 — AsyncFunction Objects、Await 算法（`Await(payload)` 的 job 排队）
- V8 官方博客 — Faster async functions and promises（await 时序与优化的官方说明）
- 《你不知道的 JavaScript（中卷）》第 5 章
- 本系列《js-async-006 Generator 与迭代器》（执行器原型）

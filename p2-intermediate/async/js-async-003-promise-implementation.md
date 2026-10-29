---
id: js-async-003
title: 异步编程之手写 Promise
series: 异步编程系列
seriesId: js-async
stage: intermediate
difficulty: 4
tags: [手写 Promise, Promises/A+, 状态机, 发布订阅, 微任务]
readingTime: 28
prev: js-async-002
next: js-async-004
createdAt: 2026-10-26
---

# 异步编程之手写 Promise

## 从「背了就忘」说起

「手写 Promise」是前端面试的手写题天花板。多数人的准备方式是背代码——结果是「面试写得出、追问答不上」：为什么回调要存数组？为什么 resolvePromise 要单独抽出来？为什么 then 里要包一层异步？

本文换个思路：**从上一篇的两条公理出发，一步步「推导」出 Promise**——每一行代码都是被需求逼出来的，而不是背出来的。⭐⭐ 读懂推导过程，比默写最终代码重要十倍。（本文产出教学简化版；逐条对齐 Promises/A+ 并跑通官方测试用例的完整版见《handwritten-004 手写 Promise/A+》。）

## 我们要实现什么（需求清单）

从《js-async-002》的两条公理 + 微任务保证，翻译成需求：

1. 三态 `pending/fulfilled/rejected`，只能 pending → 落定，落定一次后不可再变；
2. `new MyPromise(executor)`：executor 同步执行，拿到 `resolve`/`reject` 两个函数；
3. `then(onFulfilled, onRejected)`：注册回调，**返回全新 Promise**（链式调用的根基）；
4. 回调的执行时机：已落定→异步执行；未落定→等落定后执行（**这就是要存起来的原因**）；
5. 新 Promise 的状态由回调返回值决定（普通值 / Promise / 抛错）。

## 第一步：状态机与落定函数

```js
const PENDING = 'pending';
const FULFILLED = 'fulfilled';
const REJECTED = 'rejected';

class MyPromise {
  constructor(executor) {
    this.status = PENDING;
    this.value = undefined;   // 成功值
    this.reason = undefined;  // 拒绝原因

    const resolve = (value) => {
      if (this.status !== PENDING) return; // 公理：只落定一次
      this.status = FULFILLED;
      this.value = value;
    };

    const reject = (reason) => {
      if (this.status !== PENDING) return;
      this.status = REJECTED;
      this.reason = reason;
    };

    try {
      executor(resolve, reject); // executor 同步执行；抛错直接 reject
    } catch (e) {
      reject(e);
    }
  }
}
```

`if (this.status !== PENDING) return` 两行，就是「不可逆状态机」的全部实现。

## 第二步：then —— 先写同步的「错误版」

```js
then(onFulfilled, onRejected) {
  if (this.status === FULFILLED) {
    onFulfilled(this.value);
  }
  if (this.status === REJECTED) {
    onRejected(this.reason);
  }
  // 问题①：pending 时呢？—— 回调没地方放，丢了
  // 问题②：then 没有返回值，链式调用断裂
  // 问题③：同步执行违反「永远异步」公理
}
```

三个问题，对应接下来三步。**先解决「pending 时回调去哪」**——这是整个实现的心脏：

## 第三步：发布订阅——把回调「存起来等通知」

pending 时调用 then，回调必须先存起来；resolve/reject 发生时再取出执行。**典型的发布-订阅**（《js-deep-005 闭包》的又一个用武之地——数组被实例闭包持有）：

```js
constructor(executor) {
  // ...接第一步
  this.onFulfilledCallbacks = []; // ⭐ 为什么是数组不是单个？
  this.onRejectedCallbacks = [];  //    因为同一个 promise 可以 then 很多次！

  const resolve = (value) => {
    if (this.status !== PENDING) return;
    this.status = FULFILLED;
    this.value = value;
    this.onFulfilledCallbacks.forEach((fn) => fn()); // 落定时逐个通知
  };
  // reject 同理...
}

then(onFulfilled, onRejected) {
  if (this.status === PENDING) {
    this.onFulfilledCallbacks.push(() => onFulfilled(this.value)); // 存起来
    this.onRejectedCallbacks.push(() => onRejected(this.reason));
  }
  if (this.status === FULFILLED) onFulfilled(this.value);
  if (this.status === REJECTED) onRejected(this.reason);
}
```

**「为什么是数组」是手写题的第一追问**：规范允许 `p.then(a); p.then(b); p.then(c);` 多次注册，全部都要执行——单个变量只能存一个，数组才是正确模型。

## 第四步：then 返回新 Promise —— 链与复活的实现

then 返回一个**新的 MyPromise**，它的 resolve/reject 在哪被调用？**在外层回调执行完之后**，由回调的结果驱动：

```js
then(onFulfilled, onRejected) {
  const promise2 = new MyPromise((resolve, reject) => {
    const handleFulfilled = () => {
      try {
        const x = onFulfilled(this.value); // 执行回调，拿到返回值
        resolve(x);                        // 先用返回值落定 promise2（下一步再升级）
      } catch (e) {
        reject(e);                         // 回调抛错 → promise2 拒绝（冒泡的实现）
      }
    };

    if (this.status === FULFILLED) handleFulfilled();
    if (this.status === REJECTED) { /* onRejected 同构，成功路径 resolve(x) */ }
    if (this.status === PENDING) {
      this.onFulfilledCallbacks.push(handleFulfilled); // 未落定：等通知再执行
      // ...
    }
  });
  return promise2;
}
```

看两个关键设计的落地：

- **错误冒泡**：`catch (e) reject(e)`——上一环抛错直接让下一环（promise2）拒绝，而 onRejected 缺省时用 `(e) => { throw e; }` 填充，错误就一站一站「传」下去了；
- **catch 后复活**：错误处理器返回 'recovered' 时走 `resolve(x)`，链重新 fulfilled。

## 第五步：resolvePromise——「返回 Promise 就采用」的完整规则

第四步的 `resolve(x)` 有个漏洞：如果 `x` 本身是个 Promise/thanable，规范要求**等待 x 落定并采用其结果**，而现在的代码会立即把 x 当普通值落定。于是必须抽出整个实现中最难啃的函数：

```js
resolvePromise(promise2, x, resolve, reject) {
  // ① 循环引用：then 返回了自己 → 永远等不到 → 必须报错
  if (x === promise2) {
    return reject(new TypeError('Chaining cycle detected'));
  }

  // ② x 是对象或函数，才可能是 thenable
  if (x !== null && (typeof x === 'object' || typeof x === 'function')) {
    let called = false; // 防止 thenable 的 then 被恶意调多次
    try {
      const then = x.then; // 取 then 也要 try——getter 可能抛错
      if (typeof then === 'function') {
        then.call(
          x,
          (y) => {
            if (called) return; called = true;
            resolvePromise(promise2, y, resolve, reject); // y 可能还是 promise → 递归展开
          },
          (r) => {
            if (called) return; called = true;
            reject(r);
          }
        );
      } else {
        resolve(x); // 普通对象（then 不是函数）→ 当普通值
      }
    } catch (e) {
      if (called) return; called = true;
      reject(e);
    }
  } else {
    resolve(x); // ③ 原始值 → 直接落定
  }
}
```

三个必考追问都住在这里：

- **为什么有循环引用检测**：`const p = promise.then(() => p)`——promise2 的落定依赖 p，p 的落定又依赖 promise2，死锁；规范规定抛 TypeError；
- **为什么递归**：`then(() => Promise.resolve(Promise.resolve(1)))`——嵌套 promise 要展开到原始值；
- **为什么有 called 标志**：thenable 是任意的第三方对象，它的 then 可能既调 resolve 又调 reject、或调多次——又一次信任问题的防御（呼应第 1 篇）。

第四步的 `resolve(x)` 相应升级为 `resolvePromise(promise2, x, resolve, reject)`。

## 第六步：异步化——「永远异步」的最后一块

现在所有执行点还是同步的。用 `queueMicrotask`（原生微任务 API，语义最贴近）包一层：

```js
// handleFulfilled 内部改为：
queueMicrotask(() => {
  try {
    const x = onFulfilled(this.value);
    resolvePromise(promise2, x, resolve, reject);
  } catch (e) {
    reject(e);
  }
});
// 三个执行分支（已落定两处 + 订阅处）同样包 queueMicrotask
```

为什么必须异步？看这段经典验证：

```js
console.log('start');
new MyPromise((resolve) => {
  console.log('executor 同步');
  resolve(1);
}).then((v) => console.log('then 回调', v));
console.log('end');
// 期望：start → executor 同步 → end → then 回调 1（then 一定在当前同步代码之后）
// 若同步执行 then 回调，顺序就变成 start → executor → then 回调 → end —— 违反公理
```

教学版到此完成（约 90 行）。离 A+ 合规还差：then 参数非函数的穿透处理、`onRejected` 缺省转发、更精细的 thenable 边界——这些在《handwritten-004》补全并用官方 872 个测试用例验证。

## 回看整体：每个组件对应哪条公理

| 组件 | 对应需求 |
|---|---|
| status + 落定守卫 | 状态机不可逆、只落定一次 |
| 两个回调数组 | pending 时存回调 + 支持多次 then |
| then 返回 promise2 | 链式调用 |
| try/catch → reject | 抛错冒泡 |
| resolvePromise | 「返回 Promise 就采用」+ 循环引用 + 信任防御 |
| queueMicrotask | 回调永远异步 |

## 图解总结

```
       ┌────────── MyPromise 实例 ──────────┐
       │ status / value / reason            │
       │ onFulfilledCallbacks: [fn, fn, …]  │◀── 多次 then 的回调排队
       │ onRejectedCallbacks:  [fn, fn, …]  │
       └────────────────────────────────────┘
 pending 时 then ──▶ 回调入数组（订阅）
 resolve/reject ──▶ 状态定格 + 遍历数组执行（发布）
        │
        ▼  回调执行完，其返回值 x 进入
 resolvePromise(x) ──▶ 原始值：落定 promise2
                      promise：等它落定再落定（递归展开）
                      抛错：  拒绝 promise2 ──▶ 沿链冒泡
```

## 总结

- 手写 Promise 的完整推导链路：状态机 → 回调收集（发布订阅，数组支持多次 then）→ then 返回新 promise（链式）→ resolvePromise（采用/递归/循环引用/信任防御）→ 异步包装（微任务保证）；
- 每个组件都对应上一篇的一条公理——**公理记住了，代码就能推出来**；
- 高频追问 Top 3：回调为什么存数组、resolvePromise 为什么递归、为什么要异步。

**面试一句话回答**：手写 Promise 就是实现两条公理——用状态字段加落定守卫实现一次性状态机，用两个回调数组配合发布订阅实现 pending 时的 then 注册与多次绑定，then 返回新的 Promise 并把回调结果交给 resolvePromise 处理（普通值直接落定、Promise 则等待采用并递归展开、检测循环引用、防御 thenable 多次调用），最后用 queueMicrotask 保证回调永远异步执行。

## 思考题

1. 如果把 `queueMicrotask` 全部删掉，哪类测试用例会挂？构造一个具体的失败例子。
2. `then(() => { return promise2; })` 会发生什么？画出依赖环，解释为什么规范要求抛 TypeError。
3. 为什么取 `x.then` 要放在 try 里？（提示：`Object.defineProperty(x, 'then', { get() { throw … } })`）
4. 开放设计：给 MyPromise 加静态方法 `MyPromise.resolve(value)`——它和 `new MyPromise(r => r(value))` 行为一致吗？对 thenable 的处理有什么差别？

（思考题解析将同步录入小程序题库，关联本文 id：js-async-003）

## 参考文献

- Promises/A+ 规范全文（本文推导的最终依据）
- ECMA-262 现行版 — NewPromiseResolveThenableJob、HostEnqueuePromiseJob
- 《你不知道的 JavaScript（中卷）》第 3 章
- 本系列《js-async-002 Promise 基础》（公理来源）、《handwritten-004 手写 Promise/A+》（完整合规版）

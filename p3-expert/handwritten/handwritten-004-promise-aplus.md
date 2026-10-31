---
id: handwritten-004
title: 手写 Promise/A+ 并通过测试
series: 手写源码系列
seriesId: handwritten
stage: expert
difficulty: 5
tags: [Promise/A+, 手写Promise, 测试套件, 规范合规]
readingTime: 26
prev: handwritten-003
next: handwritten-005
createdAt: 2026-10-26
---

# 手写 Promise/A+ 并通过测试

## 从「推导版」到「合规版」

《js-async-003 手写 Promise》完成了教学推导（每行代码的「为什么」）；本篇交付**考场完整版**：补齐 Promises/A+ 规范的全部条款，并用**官方测试套件（872 个用例）**验证。⭐⭐ 这是手写题的天花板——写完并通过测试，你对 Promise 的理解就「有据可查」了。

## 合规清单：教学版缺了什么

对照 Promises/A+ 规范 2.2 节（then 的要求），教学版还差四条：

| 条款 | 要求 | 教学版状态 |
|---|---|---|
| 2.2.1 | onFulfilled/onRejected **不是函数时被忽略**（触发值穿透） | ❌ 直接调用会炸 |
| 2.2.2/2.2.3 | 回调必须在**执行上下文栈只含平台代码时**调用（微任务）；**不早于 then 被调用** | 部分 |
| 2.2.7.3/2.2.7.4 | onFulfilled/onRejected 抛错 → promise2 拒绝 | ✅ |
| 2.2.7.2 | 回调返回 thenable：**至多调用一次** resolve/reject（called 防护） | ✅ |

## 完整合规实现

```js
// 三态常量
const PENDING = 'pending';
const FULFILLED = 'fulfilled';
const REJECTED = 'rejected';

class MyPromise {
  constructor(executor) {
    this.status = PENDING;
    this.value = undefined;
    this.reason = undefined;
    this.onFulfilledCallbacks = [];
    this.onRejectedCallbacks = [];

    // 2.1：状态只能由 pending → fulfilled / rejected，且只变一次
    const resolve = (value) => {
      if (this.status !== PENDING) return;
      this.status = FULFILLED;
      this.value = value;
      this.onFulfilledCallbacks.forEach((fn) => fn());
    };
    const reject = (reason) => {
      if (this.status !== PENDING) return;
      this.status = REJECTED;
      this.reason = reason;
      this.onRejectedCallbacks.forEach((fn) => fn());
    };

    try {
      executor(resolve, reject);
    } catch (e) {
      reject(e); // executor 抛错 → 直接拒绝
    }
  }

  // ═══ 规范 2.3：The Promise Resolution Procedure ═══
  static resolvePromise(promise2, x, resolve, reject) {
    // 2.3.1 循环引用
    if (x === promise2) {
      return reject(new TypeError('Chaining cycle detected for promise'));
    }

    // 2.3.3 x 是对象或函数 → 才可能是 thenable
    if (x !== null && (typeof x === 'object' || typeof x === 'function')) {
      // 2.3.3.3.3 thenable 的 resolve/reject 至多生效一次
      let called = false;
      try {
        // 2.3.3.1 取 x.then 可能抛错（getter 陷阱）
        const then = x.then;
        if (typeof then === 'function') {
          // 2.3.3.3 以 x 为 this 调用 then；两个回调递归 resolvePromise
          then.call(
            x,
            (y) => {
              if (called) return;
              called = true;
              MyPromise.resolvePromise(promise2, y, resolve, reject); // 2.3.3.3.1 递归展开
            },
            (r) => {
              if (called) return;
              called = true;
              reject(r);
            }
          );
        } else {
          // 2.3.3.4 then 不是函数 → 普通对象，按值落定
          resolve(x);
        }
      } catch (e) {
        // 2.3.3.2 取 then 或调用 then 抛错
        if (called) return;
        called = true;
        reject(e);
      }
    } else {
      // 2.3.4 原始值 → 直接落定
      resolve(x);
    }
  }

  // ═══ 规范 2.2：then ═══
  then(onFulfilled, onRejected) {
    // 2.2.1 参数非函数 → 忽略并透传（值穿透的规范实现）
    const realOnFulfilled = typeof onFulfilled === 'function' ? onFulfilled : (v) => v;
    const realOnRejected =
      typeof onRejected === 'function'
        ? onRejected
        : (r) => { throw r; }; // 2.2.7.4 错误继续向后传递

    // 2.2.7 then 必须返回新 promise
    const promise2 = new MyPromise((resolve, reject) => {
      // 包装：微任务执行 + 结果决议（三个触发点共用）
      const handleFulfilled = () => {
        queueMicrotask(() => {
          try {
            const x = realOnFulfilled(this.value);
            MyPromise.resolvePromise(promise2, x, resolve, reject);
          } catch (e) {
            reject(e);
          }
        });
      };
      const handleRejected = () => {
        queueMicrotask(() => {
          try {
            const x = realOnRejected(this.reason);
            MyPromise.resolvePromise(promise2, x, resolve, reject);
          } catch (e) {
            reject(e);
          }
        });
      };

      if (this.status === FULFILLED) handleFulfilled(); // 2.2.2 已落定 → 异步执行
      if (this.status === REJECTED) handleRejected();   // 2.2.3
      if (this.status === PENDING) {                    // 2.2.2/2.2.6 未落定 → 排队
        this.onFulfilledCallbacks.push(handleFulfilled);
        this.onRejectedCallbacks.push(handleRejected);
      }
    });
    return promise2;
  }

  catch(onRejected) { return this.then(null, onRejected); }

  // 静态快捷方法（非 A+ 要求，测试与日常需要）
  static resolve(value) {
    if (value instanceof MyPromise) return value;         // promise 原样返回
    return new MyPromise((resolve) => resolve(value));
  }
  static reject(reason) { return new MyPromise((_, reject) => reject(reason)); }
}

// CommonJS 导出（跑测试用）+ 全局（页面用）
if (typeof module !== 'undefined') module.exports = MyPromise;
```

## 跑通官方测试套件 ⭐⭐

Promises/A+ 官方提供 [promises-aplus-tests](https://github.com/promises-aplus/promises-aplus-tests)（872 个用例，逐条核对 2.2/2.3 的时序与透传边界）：

```bash
npm install promises-aplus-tests -D
# package.json: "scripts": { "test:promise": "promises-aplus-tests ./my-promise.js" }
npm run test:promise
# 期望输出：
#   872 passing (…s)
#   0 failing
```

**用例在测什么**（通过的意义）：

| 用例组 | 验证点 |
|---|---|
| 2.2.2/2.2.3 时序 | 回调永远异步（微任务）、在 then 调用之后执行 |
| 2.2.4 上下文 | 栈中只含平台代码（不污染调用栈） |
| 2.2.5 传参 | 回调作为普通函数调用（无 this 注入） |
| 2.2.6 多次调用 | 同一 promise then 多次，按注册序执行 |
| 2.2.7 链式 | 返回值决议 promise2（原始值/对象/thenable/抛错四路） |
| 2.3.3 thenable | 自定义 thenable 的采用、递归、至多一次 called 防护 |
| 2.3.3.3.3 恶意 thenable | 既 resolve 又 reject、多次调用、抛错——「信任防御」条款 |

最后一组最有意思——它验证你防御了这样的对象：

```js
const evil = {
  then(res, rej) {
    res(1); res(2); rej(new Error()); rej(new Error()); // 调 4 次
    throw new Error('boom');                            // 还抛个错
  },
};
MyPromise.resolve(evil).then((v) => console.log(v)); // 1 —— 只认第一次，后续全部忽略 ✅
```

## 手动冒烟测试（考场自测三件套）

```js
// ① 值穿透 + 链式
MyPromise.resolve(1)
  .then()                                    // 非函数：穿透
  .then(Promise.resolve(9))                  // 非函数：穿透（不是你猜的 9）
  .then((v) => { console.log('A', v); })     // A 1
  .then(() => { throw new Error('x'); })
  .catch((e) => 'recovered')
  .then((v) => console.log('B', v));         // B recovered

// ② 异步 resolve + 多次 then
const p = new MyPromise((r) => setTimeout(() => r('delayed'), 100));
p.then((v) => console.log('C', v));          // C delayed
p.then((v) => console.log('D', v));          // D delayed（两次注册都执行）

// ③ 嵌套 promise 展开
MyPromise.resolve(MyPromise.resolve(MyPromise.resolve(42)))
  .then((v) => console.log('E', v));         // E 42（递归到原始值）
```

## 与《js-async-003》教学版的差异对照

| 点 | 教学版 | 合规版 |
|---|---|---|
| then 参数 | 假定是函数 | 非函数替换为透传/重抛函数（2.2.1） |
| 异步包装 | 简化 queueMicrotask | 三个执行分支统一微任务包装 |
| thenable 防护 | called 标志（雏形） | 完整：取 then 的 try、双回调双 called、递归 |
| 静态方法 | 无 | resolve（复用实例直接返回）/ reject |
| 验证 | 手动例题 | 872 用例自动化 |

## 图解总结

![then 的三段，与 resolvePromise 的三个分支](../../assets/svg/handwritten-004-promise-aplus.svg)

*图 · 参数清洗看着像防御性代码，其实是「值穿透」唯一的落点*

```
then(onFulfilled, onRejected)
  ├─ 2.2.1 参数清洗：非函数 → (v)=>v / (r)=>{throw r}   ← 值穿透的落点
  ├─ 新建 promise2
  │    ├─ 已落定 → queueMicrotask(执行回调)
  │    └─ pending → 回调推入数组（等 resolve/reject 通知）
  ├─ 回调结果 x → resolvePromise(promise2, x, resolve, reject)
  │     ├─ x === promise2 → TypeError（循环引用）
  │     ├─ x 是 thenable → called 防护 + 递归展开（至多一次决议）
  │     └─ 原始值 → resolve(x)
  └─ return promise2
        ═══ promises-aplus-tests: 872 passing ═══
```

## 总结

- 合规四补丁：参数清洗（穿透）、三分支统一微任务、完整 thenable 防护、静态方法；
- resolvePromise 是规范 2.3 的直译：循环引用检测、递归展开、called 至多一次；
- 官方测试套件 872 用例通过 = 实现有据可查；恶意 thenable 用例组验证「信任防御」；
- catch/resolve/reject 是生态便利层，A+ 只规定 then。

**面试一句话回答**：合规版 Promise 在核心骨架（状态机、回调数组、then 返回新 promise）之上补齐 A+ 四条款——then 参数不是函数时替换为值透传或重抛函数以实现值穿透与错误冒泡；所有回调执行统一包 queueMicrotask 满足异步时序；resolvePromise 按 2.3 规范处理返回值，检测循环引用抛 TypeError、thenable 用 called 标志保证 resolve/reject 至多生效一次并递归展开嵌套 promise、原始值直接落定；最后用官方 promises-aplus-tests 的 872 个用例验证合规——包括恶意 thenable 的信任防御边界。

## 思考题

1. 把 `queueMicrotask` 换成 `setTimeout(fn, 0)`，测试套件哪些组会失败？时序差异的本质是什么？
2. 规范 2.2.4 要求「栈中只含平台代码时调用回调」——给出一个能观察到「回调执行时调用栈是空」的实验（用 Error.stack 打印）。
3. `MyPromise.resolve(p)` 对已是 MyPromise 实例的 p 原样返回——省掉这个短路会发生什么？从「thenable 采纳要排队微任务」的角度分析可观察差异。
4. 开放设计：给 MyPromise 补 `MyPromise.all`（复用《js-async-004》的实现思路），并写出对应的 10 个自测用例（含空数组、非 promise 值、先失败后成功）。

（思考题解析将同步录入小程序题库，关联本文 id：handwritten-004）

## 参考文献：

- Promises/A+ 规范全文（2.2/2.3 逐条对照本文注释）
- promises-aplus-tests 仓库（872 用例与适配器写法）
- 本课程《js-async-002 Promise 基础》《js-async-003 手写 Promise》（公理与推导）

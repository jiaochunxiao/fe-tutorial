---
id: es6-009
title: ES6+ 之 Iterator 与 for...of
series: ES6+ 系列
seriesId: es6
stage: intermediate
difficulty: 3
tags: [迭代器, 迭代协议, for...of, 可迭代对象, Symbol.iterator]
readingTime: 18
prev: es6-008
next: es6-010
createdAt: 2026-10-26
---

# ES6+ 之 Iterator 与 for...of

## 从「同一个需求要为三种结构写三段代码」说起

「遍历所有元素」这个需求，在 ES5 时代是三种方言：

```js
// 数组：三种循环
for (var i = 0; i < arr.length; i++) {}
arr.forEach(function (v) {});

// 对象：另一种
for (var k in obj) { if (obj.hasOwnProperty(k)) {} }

// Map/Set：再来一种
m.forEach(function (v, k) {});
```

而 ES6 之后，**一个 for...of 通吃全部**：

```js
for (const x of arr) {}
for (const [k, v] of map) {}
for (const x of set) {}
for (const c of 'hello') {}
for (const x of myCustomThing) {}   // 你自己的结构也能进这个循环！
```

统一背后是一份**协议**：迭代协议（Iteration Protocol）。⭐ 「for...of 与 for...in 的区别」「自定义可迭代对象」是高频题，且迭代协议是 Generator（《js-async-006》）、解构（《es6-002》）、展开运算符的共同地基。

## 现象与直觉解释

协议只有两条，非常小：

**协议 1：可迭代对象（Iterable）**——对象带一个 `[Symbol.iterator]()` 方法，调用返回一个迭代器；

**协议 2：迭代器（Iterator）**——带 `next()` 方法的对象，每次调用返回 `{ value, done }`。

```
可迭代对象 ──[Symbol.iterator]()──▶ 迭代器 ──next()──▶ {value, done}
   (能被遍历的东西)                  (游标)           (一次吐一个)
```

for...of 的执行逻辑（伪代码）：

```js
const iterator = collection[Symbol.iterator]();
let result = iterator.next();
while (!result.done) {
  const value = result.value;  // 循环体
  result = iterator.next();
}
```

## 深入原理

### 一、原生内置了 [Symbol.iterator] 的结构 ⭐

数组、字符串、Map、Set、arguments、NodeList、Generator——所以它们都能 for...of；**普通对象没有**（设计决定：对象的遍历顺序与「哪些键算数」太复杂，交给 Object.keys/entries 明确表达）：

```js
const obj = { a: 1 };
obj[Symbol.iterator];             // undefined —— for...of 报 TypeError
for (const [k, v] of Object.entries(obj)) {} // ✅ 标准姿势：转数组再迭代
```

**for...of vs for...in 终极对照** ⭐⭐：

| | for...of | for...in |
|---|---|---|
| 遍历什么 | **迭代器的值** | **键（字符串）** |
| 支持对象 | 任何可迭代（数组/Map/Set/字符串/自定义） | 任何对象（含原型链上的可枚举键） |
| 原型链 | 不涉及 | ⚠️ 会遍历到继承的键（要 hasOwn 过滤） |
| 中断 | break/continue/return/throw 均可（自动调 return） | 可以 break，无清理钩子 |
| 数组上 | 直接拿值 ✅ | 拿到的是**下标字符串**（'0','1'…） |

```js
Array.prototype.extra = 'Oops';
for (const k in [1, 2]) console.log(k); // '0', '1', 'extra' ⚠️（原型污染直接进循环）
for (const v of [1, 2]) console.log(v); // 1, 2 ✅
```

### 二、手写可迭代对象：闭包迭代器与生成器两版 ⭐

**版本 1：手写 iterator（看清协议全貌）**：

```js
const range = {
  from: 1,
  to: 5,
  [Symbol.iterator]() {
    let current = this.from;
    const last = this.to;
    return {                          // 返回迭代器：一个带 next 的对象
      next() {
        return current <= last
          ? { value: current++, done: false }
          : { value: undefined, done: true };
      },
    };
  },
};

[...range];              // [1, 2, 3, 4, 5] —— 展开也走协议！
for (const n of range) {}
Math.max(...range);      // 5 —— 连函数传参展开都用它
```

**版本 2：生成器一行流**（《js-async-006》的联动）：

```js
const range2 = {
  from: 1, to: 5,
  *[Symbol.iterator]() { for (let i = this.from; i <= this.to; i++) yield i; },
};
// 生成器对象本身就是一个迭代器（自带 next），所以直接返回
```

### 三、解构与展开：协议的隐藏消费方 ⭐

「谁在用迭代协议」远不止 for...of：

```js
const [a, b] = iterable;        // 数组解构 = 按位调用 next()
[...iterable];                  // 展开数组 = 迭代到 done
new Map(iterableOfPairs);       // 构造器吃可迭代
Promise.all(iterableOfPromises); // 并发聚合也吃可迭代（《js-async-004》）
const [x = 1] = [];             // 解构默认值的判定基于 next() 的 undefined
```

**掌握了协议，你就给自定义结构解锁了整套 JS 语法**——实现了 `[Symbol.iterator]` 的队列、树、分页器，天然支持 for...of、解构、展开、yield*。

### 四、迭代器的高级特性：return() 与惰性 ⭐

**提前退出的清理钩子**：for...of 中 break/抛错/return 时，引擎调用迭代器的 `return()`（如果存在）：

```js
const lines = {
  [Symbol.iterator]() {
    let n = 0;
    return {
      next: () => ({ value: n, done: n++ >= 3 }),
      return() {                    // 提前退出时被调用
        console.log('清理资源（关闭文件/连接）');
        return { done: true };
      },
    };
  },
};
for (const l of lines) { if (l === 1) break; } // 打印「清理资源」
```

**惰性求值**：迭代器是「按需吐值」的——无限序列可以安全存在（不掏空内存），消费到哪算到哪：

```js
function* naturals() { let i = 0; while (true) yield i++; }
const first10 = [...Array(10)].map((_, i) => i); // 与生成器配合取有限片段
for (const n of naturals()) { if (n >= 5) break; console.log(n); } // 0..4，无限流安全消费
```

## 回看开篇

三段方言统一成 for...of 的原因：数组、对象条目、Map/Set 都长出了同一个接口 `[Symbol.iterator]`——**协议统一的本质是「让消费方（语法）与生产方（数据结构）解耦」**：语法只认协议，任何结构实现协议即可接入。这正是接口思想在语言层的落地。

## 实战延伸

**1. 面试答题骨架**：「迭代协议分两层——可迭代对象实现 [Symbol.iterator] 返回迭代器，迭代器提供 next 产出 {value, done}；for...of 只认协议所以数组、字符串、Map、Set、Generator 通吃，普通对象没有实现故不支持，要用 Object.entries 转换；for...in 遍历键且会带原型链可枚举属性，for...of 遍历值且支持 break 自动触发 return 清理；解构、展开、Map 构造、Promise.all 都是协议的隐藏消费者，自定义结构实现协议即可解锁整套语法。」

**2. 工程小利器**：分页迭代器——`for await (const page of paginated(url))` 用异步迭代（Symbol.asyncIterator）逐页拉取，把分页循环写成普通 for 的样子。

## 图解总结

```
                 ┌────── 消费方（只认协议）──────┐
 for...of | 解构 | 展开 | yield* | Promise.all | new Map(…)
                 └──────────────┬──────────────┘
                                │ 调 [Symbol.iterator]()
                                ▼
                 可迭代对象 ──▶ 迭代器 ──next()──▶ {value, done}×N
                 (数组/字符串/Map/Set/Generator/自定义)
                 break/throw ──▶ 迭代器.return()（清理钩子）
```

## 总结

- 协议两条：[Symbol.iterator] 返回迭代器；迭代器 next() 吐 {value, done}；
- for...of 只认协议——数组/字符串/Map/Set/Generator 通吃，普通对象不支持；
- for...of 取值、for...in 取键且涉原型链可枚举属性；
- 解构、展开、Map 构造、Promise.all 都是协议消费方——实现协议即解锁全套语法；
- 迭代器天然惰性（无限序列可行），提前退出触发 return() 清理钩子。

**面试一句话回答**：迭代协议规定可迭代对象必须实现 Symbol.iterator 方法、返回带 next 的迭代器，next 每次产出 value 与 done 组成的结果对象；for...of 只面向该协议，因此数组、字符串、Map、Set、arguments、生成器全部通吃，而普通对象没有实现所以要用 Object.entries 转换后遍历；与 for...in 的区别是它遍历值且不涉及原型链，for...in 遍历字符串键并包含继承的可枚举属性；此外数组解构、展开运算符、new Map、Promise.all 都是协议的隐藏消费者，自定义结构实现协议即可接入整套语法，break 提前退出时还会触发迭代器的 return 方法做资源清理。

## 思考题

1. `for (const x of { a: 1 })` 为什么报错？给出两种让它跑起来的方案（entries 桥接 / 实现 Symbol.iterator）。
2. 手写一个 `take(iterable, n)` 生成器：只消费前 n 项（要求支持无限流、不修改原可迭代对象）。
3. `[...arr]` 与 `Array.from(arr)` 对「类数组」的处理差异在哪？（回顾《es6-005》：谁只吃可迭代、谁还吃 length？）
4. 开放设计：设计一个二叉树的中序遍历迭代器（[Symbol.iterator] + 生成器 yield* 两版），并说明它如何被 [...tree] 与解构直接使用。

（思考题解析将同步录入小程序题库，关联本文 id：es6-009）

## 参考文献：

- ECMA-262 现行版 — The Iterable Interface、ForIn/OfBodyEvaluation（return 清理的规范出处）
- MDN — [迭代协议](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Iteration_protocols)
- 本课程《js-async-006 Generator》《es6-002 解构》《es6-006 Symbol》（协议的三条伏线）

---
id: js-async-006
title: 异步编程之 Generator 与迭代器
series: 异步编程系列
seriesId: js-async
stage: intermediate
difficulty: 4
tags: [Generator, 迭代器, 迭代协议, yield, 协程, 惰性求值]
readingTime: 22
prev: js-async-005
next: js-async-007
createdAt: 2026-10-26
---

# 异步编程之 Generator 与迭代器

## 从一段「会暂停的函数」说起

```js
function* gen() {
  console.log('开始执行');
  const a = yield 1;        // 暂停点①：交出 1，等外部传回 a
  console.log('收到:', a);
  const b = yield a + 10;   // 暂停点②：交出 a+10，等外部传回 b
  return a + b;
}

const g = gen();
console.log(g.next());     // { value: 1, done: false } —— 只打印「开始执行」就停了！
console.log(g.next(100));  // 打印「收到: 100」→ { value: 110, done: false }
console.log(g.next(5));    // { value: 105, done: true }
```

函数居然可以在中途**暂停**，暂停期间「原地待命」，等下一次 `next()` 唤醒继续执行——JavaScript 里唯一具备这种能力的用户级语法。⭐ Generator 是 async/await 的直系祖先（下一篇的核心伏笔），也是「迭代协议」的参与者。

## 现象与直觉解释

两个角色先分清：

- **迭代器（Iterator）**：一个带 `next()` 方法的对象，每次调用吐出 `{value, done}`——「按下一次出一件」的取货口；
- **生成器（Generator）**：`function*` 声明的函数，调用它不执行函数体，而是返回一个**迭代器**；函数体在每次 `next()` 时执行到下一个 `yield` 暂停。

直觉模型：**yield 是一条双向传送带**——

```
外部 ──next(v)──▶ [yield 处交货：表达式值送出] ──暂停──▶ 外部拿到 v？
                                        ▲
外部 ◀── {value: 表达式的值}──          │
下一次 next(参数) ──▶ 参数作为 yield 表达式的返回值注入 ──▶ 继续执行到下一个 yield
```

即：**`yield X` 把 X 送出去；`const a = yield X` 的 a，由下一次 `next(参数)` 的参数注入**。这就是「双向」：出的是 yield 右边的值，进的是 next 里的参数。

## 深入原理

### 一、迭代协议：Generator 的另一半身份

**迭代器协议**：对象提供 `next()`，返回 `{value, done}`。
**可迭代协议**：对象带 `[Symbol.iterator]()` 方法，返回一个迭代器。

生成器对象**天生同时满足两者**——所以它能直接进 `for...of`、展开运算符、解构：

```js
function* range(from, to) {
  for (let i = from; i <= to; i++) yield i;
}

console.log([...range(1, 5)]);        // [1, 2, 3, 4, 5]
for (const n of range(1, 3)) console.log(n); // 1 2 3
```

注意 `for...of` 会在 `done: true` 时自动停止，且**不会消费 return 的值**——`gen()` 手动 next 到底才能拿到 return 值（`{value: 返回值, done: true}`）。

**给普通对象实现可迭代**（面试常考的「让对象能用 for...of」）：

```js
const playlist = {
  songs: ['晴天', '稻香', '七里香'],
  *[Symbol.iterator]() {        // 生成器方法简写
    for (const s of this.songs) yield s;
  }
};
console.log([...playlist]); // ['晴天', '稻香', '七里香']
```

### 二、暂停的机制：协程视角

普通函数是「一口气执行完」的（栈帧连续，见《js-deep-001》）；生成器函数调用时：

1. **不执行函数体**，只创建生成器对象（函数体被冻结在起始处）；
2. 每次 `next()`：函数体从上次暂停点**恢复执行**到下一个 `yield`，然后**冻结现场**（局部变量、执行位置全部保留——本质是保存了上下文/帧的「可恢复函数」）；
3. `done: true` 后再 next，永远返回 `{value: undefined, done: true}`。

这种「可暂停、可恢复」的执行单元，学术上叫**协程（coroutine）**——JavaScript 的生成器是一种**半协程**（只能通过 yield/next 在固定点让出与恢复，不能任意跳转）。它与回调/Promise 的本质区别：**回调把「接下来做什么」交给别人，生成器把「什么时候继续」交给别人、但「继续做什么」还留在自己函数体里**——控制流的主权回到了函数自己手中。

### 三、next 传参：第一次 next 的参数去哪了？

```js
function* gen() {
  const a = yield 1; // 第一次 next 的参数没人接收！
}
const g = gen();
g.next('ignored'); // 参数被丢弃 —— 第一个 yield 之前没有任何「等待注入」的变量
g.next(100);       // 这次的 100 才是 a 的值
```

因为第一次 next 时函数刚启动、还没有 yield 表达式在等值——**第一次 next 永远不该传参**（传了也被忽略）。若一定要「启动注入」，惯用 `g = gen(initialArg)` 把参数传给生成器函数本身。

### 四、其他成员速览

```js
function* gen() {
  const x = yield 1;
  const y = yield 2;
}
const g = gen();
g.next();        // 启动
g.return(99);    // 直接终结：{value: 99, done: true} —— 提前退出的通道
const g2 = gen();
g2.next();
g2.throw(new Error('boom')); // 在暂停点抛错 —— 函数体内可 try/catch 捕获
// yield*：委托给另一个生成器/可迭代对象
function* combo() {
  yield* [1, 2];       // 委托数组
  yield* range(3, 4);  // 委托另一个生成器
}
[...combo()]; // [1, 2, 3, 4]
```

### 五、执行器：把生成器跑成异步（下一篇的桥）⭐

单靠生成器还不能写异步——它只提供了「暂停/恢复」的骨架，谁在异步完成时调 next？需要一个**执行器（driver）**：

```js
function run(generatorFn) {
  const gen = generatorFn();

  function step(nextFn, arg) {
    const { value, done } = nextFn.call(gen, arg);
    if (done) return value;
    // 关键假设：yield 出来的是 Promise —— 完成时恢复生成器
    value.then(
      (v) => step(gen.next, v),   // 成功：结果注入回 yield 处，继续执行
      (e) => step(gen.throw, e)   // 失败：在 yield 处抛出，函数体 try/catch 接住
    );
  }
  step(gen.next);
}

// 用同步的样子写异步 —— 这正是 async/await 的前身！
run(function* main() {
  try {
    const user = yield getUser(1);       // 看起来是同步赋值
    const orders = yield getOrders(user.id);
    render(orders);
  } catch (e) {
    handleError(e); // 异步错误居然能用 try/catch！
  }
});
```

社区库 co（tj 大神）当年就是干这个的；**ES2017 的 async/await 把「生成器 + 执行器」收编为语言内置**——这是下一篇的全部内容。

## 回看开篇

开篇三连 next 的时序：`gen()` 只造对象不执行 → 第一次 next 执行到 yield 1 暂停（打印「开始执行」）→ 第二次 next(100) 注入 a=100、执行到 `yield 110` 暂停（打印「收到: 100」）→ 第三次 next(5) 注入 b=5、执行到 return 返回 `{105, true}`。双向传送带 + 可恢复函数，两个模型合起来就是全部。

## 实战延伸

**1. 惰性序列：无限流**

```js
function* naturals() { let i = 0; while (true) yield i++; } // 无限自然数，不占内存
const first5 = naturals();
// 取前 5 个：[...Array(5)].map(() => first5.next().value) → [0,1,2,3,4]
// 配合 yield* 可以做 pipeline：fibo / 阶乘流 / sensor 数据流
```

**2. 状态机的新写法**：yield 天然切分状态，红绿灯、游戏回合这类「按步推进」的逻辑用生成器写，比 switch-case 清晰得多。

**3. 历史地标**：redux-saga 用生成器描述副作用（`yield takeEvery(...)`）、Koa 1.x 用生成器中间件——读懂它们，先读懂本篇的执行器。

## 图解总结

```
next(arg) ──arg 注入到当前暂停的 yield──▶ [恢复执行]
                                            │
                          ┌── 执行到下一个 yield X ──▶ 冻结现场
                          │                     │
                          ▼                     ▼
                    return/结束           {value: X, done: false} 送出
                          │
                          ▼
                  {value: 返回值, done: true}

执行器（run/co）：yield 出 Promise → then 到了再 next —— 异步完成时自动恢复
```

## 总结

- `function*` 调用不执行，返回迭代器；函数体在 next 驱动下「逐段执行、逐段暂停」；
- yield 双向传送带：出的是右侧表达式值，进的是下一次 next 的参数；第一次 next 的参数必然被丢弃；
- 生成器对象同时满足迭代器/可迭代协议，可直接进 for...of、展开、解构；
- 本质是半协程：控制流主权回到函数体内，这是它优于回调的根本；
- 执行器（next 驱动 + Promise.then 恢复）是 async/await 的直系原型。

**面试一句话回答**：Generator 是可暂停恢复的半协程——调用生成器函数只创建迭代器，函数体在每次 next 时执行到下一个 yield 冻结现场，yield 把右侧值送出、下一次 next 的参数注入到暂停的 yield 表达式处，配合 return/throw/yield* 完成整组控制原语；当 yield 的是 Promise、由执行器在 then 里恢复 next 时，就得到了 async/await 的雏形。

## 思考题

1. 写出全部输出：
```js
function* g() {
  console.log('A');
  const x = yield 1;
  console.log('B', x);
  const y = yield 2;
  console.log('C', y);
}
const it = g();
console.log(it.next());
console.log(it.next(10));
console.log(it.next(20));
```

2. 实现函数 `take(n, iterable)`：从任意可迭代对象中取前 n 项返回数组（要求支持无限流）。

3. 手写一个 mini 执行器 `run(genFn)`，支持 yield 出非 Promise 普通值时直接注入（提示：用 Promise.resolve 包装）。

4. 开放讨论：为什么说「生成器把控制流主权还给函数」？对照回调的「控制反转」（第 1 篇），从「谁来决定下一步执行」的角度分析。

（思考题解析将同步录入小程序题库，关联本文 id：js-async-006）

## 参考文献

- ECMA-262 现行版 — Generator Objects、The iteration protocol、YieldExpression
- MDN — [迭代器和生成器](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Iterators_and_generators)
- 《你不知道的 JavaScript（中卷）》第 4 章「生成器」、附录 A（co 执行器剖析）

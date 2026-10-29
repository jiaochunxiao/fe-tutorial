---
id: js-deep-007
title: JavaScript 深入之 call、apply、bind
series: JavaScript 深入系列
seriesId: js-deep
stage: foundation
difficulty: 3
tags: [call, apply, bind, this 显式绑定, 借用方法, 偏函数]
readingTime: 20
prev: js-deep-006
next: js-deep-008
createdAt: 2026-10-26
---

# JavaScript 深入之 call、apply、bind

## 从三行「借别人家方法」的代码说起

```js
// ① 类数组明明不是数组，却能用数组的方法
var arrayLike = { 0: 'a', 1: 'b', 2: 'c', length: 3 };
Array.prototype.slice.call(arrayLike);        // ['a', 'b', 'c']

// ② Math.max 不接受数组，却能算数组最大值
Math.max.apply(null, [1, 5, 3]);              // 5

// ③ 最可靠的原生类型判断
Object.prototype.toString.call([]);           // '[object Array]'
Object.prototype.toString.call(null);         // '[object Null]'
```

`slice` 是数组的方法、`toString` 是 Object 原型的方法——凭什么能操作一个「不是自己实例」的对象？

答案是上一篇《js-deep-006 this》的核心结论：**this 是调用时才传入的「隐式参数」**。而 `call`、`apply`、`bind` 就是**手动传 this** 的三件工具。⭐ 手写这三个方法是面试的保留节目，本文先把原理讲透，完整逐行实现见《handwritten-001 手写 call、apply、bind》。

## 现象与直觉解释

先给直觉版本：

> 隐式绑定是「对象.方法()」时引擎自动帮你把 this 设为对象；call/apply/bind 则是把「挂上去再调用」这件事**手动化**——你想让 this 是谁，就传谁。

三者的差异只在**怎么传**：

| 方法 | 签名 | this | 其余参数 | 返回值 |
|---|---|---|---|---|
| `call` | `fn.call(thisArg, a, b)` | 指定 | **逐个**列出 | 立即执行 fn 的结果 |
| `apply` | `fn.apply(thisArg, [a, b])` | 指定 | 打包成**数组** | 立即执行 fn 的结果 |
| `bind` | `fn.bind(thisArg, a, b)` | 指定 | 可预置 | **新函数**（不立即执行） |

`call` 与 `apply` 只差参数形态；`bind` 则是「绑定 + 预置参数 + 延迟执行」。

## 深入原理

### 一、本质：把函数临时「挂」到目标对象上

回顾隐式绑定：`obj.fn()` 的 this 是 `obj`，因为函数通过 `obj` 被调用。call/apply 的原理一模一样——**引擎（或你的手写版）做的事就是：把函数作为目标对象的一个临时属性，用「对象.属性()」的形式调用，让 this 落到目标对象上，完事再删掉这个属性**：

```js
// myCall 的最小实现（讲原理用，边界处理见后文）
Function.prototype.myCall = function (ctx, ...args) {
  ctx = ctx ?? globalThis;      // null/undefined 时回退全局（非严格行为）
  ctx.fn = this;                // this 就是「调用 myCall 的那个函数」
  var result = ctx.fn(...args); // 隐式绑定：this 指向 ctx
  delete ctx.fn;                // 清理临时属性
  return result;
};
```

三行核心，暗合了两个前序知识：

- `ctx.fn = this`——方法调用时引擎把 `myCall` 里的 `this` 设为调用者函数（this 规则的应用）；
- `ctx.fn(...args)`——「对象.方法()」的隐式绑定让原函数的 this 落在 ctx（上一篇规则二的直接运用）。

工程细节（完整版在 handwritten-001 处理）：属性名可能冲突（应使用 `Symbol` 生成临时键）、严格模式下 `ctx` 为 null 时不得回退全局、函数可能有返回值。

### 二、开篇三行代码的原理还原

**① `Array.prototype.slice.call(arrayLike)`**：slice 内部只依赖 `this.length` 和数字索引（规范定义其操作「类数组」即可），把 this 换成 arrayLike 后，它读到的就是 `{0:'a',1:'b',2:'c',length:3}`——返回真数组。**「鸭子类型」：只要有 length 和索引，就能借数组方法。**

**② `Math.max.apply(null, arr)`**：this 对 `Math.max` 无意义（传 null 退化为默认绑定）；真正的作用是把数组**展开成逐个参数** `Math.max(1,5,3)`。ES6 后它有了更优雅的替代：`Math.max(...arr)`。

**③ `Object.prototype.toString.call(x)`**：`toString` 内部读取 this 的**内部槽 `[[Symbol.toStringTag]]`（默认由原型提供）**来拼 `[object Type]` 字符串。this 指向谁，就查谁的原型链标签——所以它成了最可靠的类型判断：

```js
Object.prototype.toString.call(/a/);       // '[object RegExp]'
Object.prototype.toString.call(new Date);  // '[object Date]'
// 对比 typeof：只能区分原始类型与函数；instanceof：跨 iframe 会失灵
```

### 三、bind 的三件「赠品」

`bind` 不执行函数，它返回一个**永久的硬绑定函数**，并附带三个特性：

**1. this 一次定型**：之后 `call/apply/bind` 都改不回来（上一篇优先级已验证）。

**2. 参数预置（偏函数）**：

```js
function log(level, module, msg) {
  console.log(`[${level}] ${module}: ${msg}`);
}
var warnLog = log.bind(null, 'WARN');  // 预置第一个参数
warnLog('auth', 'token expired');      // [WARN] auth: token expired
var authWarn = log.bind(null, 'WARN', 'auth');
authWarn('token expired');             // [WARN] auth: token expired
```

**3. new 的「豁免」**：被 bind 包装的函数**作为构造函数 new 时，this 不再是 bind 的对象**，而是新实例（上一篇优先级实验的结论）。此外 bind 后的函数拿不到原函数的 `prototype` 属性——它本质是规范中的「内置绑定外来对象（bound function exotic object）」。

### 四、call/apply 与「现代替代品」

| 老写法 | 现代写法 | 说明 |
|---|---|---|
| `Math.max.apply(null, arr)` | `Math.max(...arr)` | 展开运算符替代 apply 传数组 |
| `fn.bind(obj)` 传给回调 | 回调改箭头函数 `() => obj.fn()` | 语义更直白 |
| `[].slice.call(arrayLike)` | `Array.from(arrayLike)` / `[...arrayLike]` | 标准化转数组 |

但「借方法」这一核心用途无可替代——只要一个函数内部只依赖 this 上的属性，就能跨类型借用，这依然是面试与源码阅读（如 Axios、jQuery 内部）的常见姿势。

## 回看开篇

三行代码 = 三种典型用途：**借方法操作类数组（this 换成 arrayLike）、借调用形式展开参数（this 无关紧要）、借原型标签做类型判断（this 决定查谁的标签）**。背后都是同一个机制：call/apply 把 this 从「自动隐式绑定」变成「手动指定」。

## 实战延伸

**1. 类数组的判定与转换全家桶 ⭐**

```js
function argsToArray() {
  console.log(arguments.length);          // 3
  var arr1 = Array.prototype.slice.call(arguments);
  var arr2 = Array.from(arguments);
  var arr3 = [...arguments];
}
argsToArray(1, 2, 3);
```

**2. 借用构造函数实现「组合继承」**（详见《js-deep-010 继承》）：

```js
function Child(name) {
  Parent.call(this, name); // 以 Child 的 this 执行 Parent 的初始化逻辑
}
```

**3. 面试快手题：this 输出串烧**

```js
var value = 1;
var obj = { value: 2 };

function print() { console.log(this.value); }

print.call(obj);        // 2
print.call(null);       // 1（默认绑定回退全局）
var bound = print.bind(obj);
bound();                // 2
bound.call({ value: 3 }); // 2 —— bind 优先级高于 call
```

## 图解总结

```
                 想手动指定 this
                       │
      ┌────────────────┼─────────────────┐
      ▼                ▼                 ▼
   立即执行          立即执行          返回新函数
  fn.call(ctx,a,b)  fn.apply(ctx,[a,b])  fn.bind(ctx,a,b)
      │                │                 │
      └──── 参数逐个 ───┘ 参数打包        this 永久锁定 + 参数预置
                       │
                       ▼
        机制本质：ctx.fn = 原函数 → ctx.fn(...) → 删除
                 （隐式绑定的手动版）
```

## 总结

- call/apply 立即执行、bind 返回硬绑定新函数；参数形态分别是逐个、数组、可预置；
- 机制本质是「把函数临时挂到目标对象上以隐式绑定方式调用」，this 由「自动」变「手动」；
- 三大经典用途：借方法（类数组转数组）、展开传参（已被扩展运算符替代）、类型判断（Object.prototype.toString.call 依然最可靠）；
- bind 附赠：this 永久锁定、偏函数预置、new 时豁免绑定。

**面试一句话回答**：call、apply、bind 都用于显式指定 this——前两个立即执行（apply 传参数组、call 逐个传），原理是把函数临时挂到目标对象上以隐式绑定的方式调用；bind 返回永久绑定 this 的新函数，还支持预置参数形成偏函数，且作为构造函数 new 时 this 让位于新实例；典型应用是借用原型方法、类数组转换和最可靠的 Object.prototype.toString 类型判断。

## 思考题

1. 手写 `myApply`（注意：apply 的第二个参数是数组/类数组，且可能不传），写出你能想到的全部边界。
2. 写出输出：
```js
function add(a, b) { return a + b + (this.c || 0); }
var ctx = { c: 100 };
var b1 = add.bind(ctx, 1);
console.log(b1(2));
var b2 = b1.bind({ c: 1000 }, 5);
console.log(b2(10));
```
3. 为什么 `Object.prototype.toString.call` 能判断类型，而 `[] instanceof Array` 在 iframe 场景下会失效？两者依据的机制有什么区别？
4. 开放设计：实现 `log(level, module, message)` 的三级偏函数工厂（error/warn/info 各一个预置函数），你会用 bind 还是闭包？比较两种实现的差异。

（思考题解析将同步录入小程序题库，关联本文 id：js-deep-007）

## 参考文献

- ECMA-262 现行版 — `Function.prototype.call/apply/bind`、BoundFunctionCreate 相关章节
- 《你不知道的 JavaScript（上卷）》第 2 章「显式绑定」
- MDN — [Function.prototype.call](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Function/call)、[bind](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Function/bind)
- 冴羽《JavaScript 深入之 call 和 apply 的模拟实现》

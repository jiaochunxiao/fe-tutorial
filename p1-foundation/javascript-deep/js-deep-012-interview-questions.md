---
id: js-deep-012
title: JavaScript 深入之系列综合面试题精讲
series: JavaScript 深入系列
seriesId: js-deep
stage: foundation
difficulty: 3
tags: [面试题, 综合精讲, 作用域, 闭包, this, 原型链]
readingTime: 30
prev: js-deep-011
next: null
createdAt: 2026-10-26
---

# JavaScript 深入之系列综合面试题精讲

## 为什么需要这一篇

前十一篇把机制讲透了，但面试的呈现形式是「题」。本篇是系列收官：**18 道高频真题逐题精讲**，每题都标注它真正考查的机制与对应的篇目。⭐ 建议先自己作答再看精讲；每题的「考点」行就是面试官心里的评分表。

---

## 一、作用域与提升（4 题）

### 题 1 ⭐⭐

```js
console.log(a);   // ?
console.log(b);   // ?
var a = 1;
let b = 2;
```

**答案**：`undefined`；`ReferenceError: Cannot access 'b' before initialization`。

**精讲**：`a` 走 var 登记（创建阶段登记、值为 undefined）；`b` 走 let/const——**同样被登记**（否则重复声明不会报语法错），但未初始化，处在暂时性死区（TDZ），访问直接抛错。**「let 没有提升」是错误说法，正确说法是「let 有登记、无初始化」**。考点：《js-deep-002》。

### 题 2 ⭐⭐

```js
var a = 1;
function foo() {
  console.log(a);  // ?
  var a = 2;
  console.log(a);  // ?
}
foo();
```

**答案**：`undefined`；`2`。

**精讲**：函数内有 `var a`——创建阶段在**函数环境**登记了 `a = undefined`，遮蔽外层同名变量（第 4 篇遮蔽效应）。第一次打印命中本层登记值，赋值后为 2。**考查「局部声明遮蔽全局 + 提升登记」的组合**。考点：《js-deep-002》《js-deep-004》。

### 题 3 ⭐⭐⭐

```js
foo();  // ?
var foo = function () { console.log(1); };
function foo() { console.log(2); }
foo();  // ?
```

**答案**：`2`；`1`。

**精讲**：创建阶段：函数声明 `foo` 先登记（值就绪），`var foo` 同名跳过（第 2 篇覆盖规则）→ 第一次调用执行函数声明体打印 2；执行阶段：赋值语句把 `foo` 换成函数表达式 → 第二次调用打印 1。**「函数声明整体提升、var 只提升声明」的经典双杀**。考点：《js-deep-002》。

### 题 4 ⭐⭐

```js
var x = 10;
function print() { console.log(x); }
function run(fn) { var x = 20; fn(); }
run(print);  // ?
```

**答案**：`10`。

**精讲**：词法作用域——`print` 定义在全局，查找 `x` 沿「定义处」的链（全局），与调用方 `run` 的局部 `x` 无关（第 3 篇的核心题）。追问变体：改成 `function print() { console.log(this.x) }` 则输出 20（this 看调用方式——但注意 `fn()` 是裸调用，严格模式会报错，非严格指向全局输出 10，**this 与作用域不要混**）。考点：《js-deep-003》《js-deep-006》。

---

## 二、闭包（4 题）

### 题 5 ⭐⭐⭐ for + setTimeout

```js
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i));
}
// 输出？给三种修复方案
```

**答案**：`3 3 3`。修复：① `let`（每轮新建块级环境）；② IIFE 传值拷贝；③ `setTimeout(fn, 0, i)` 第三参。

**精讲**：三个回调共享同一个全局 `i`；回调执行时循环早已结束。核心句：**闭包捕获的是环境（引用），不是值的快照**。考点：《js-deep-005》开篇。

### 题 6 ⭐⭐

```js
function make() {
  var count = 0;
  return function () { return ++count; };
}
var f1 = make(), f2 = make();
f1(); f1();
console.log(f1(), f2());  // ?
```

**答案**：`3 1`。

**精讲**：`make` 每调用一次生成**一套全新的环境记录**（count 各自独立）——「同一函数的两次调用产生两条互不相干的环境链」（第 11 篇）。f1 的 count 走 0→1→2→3，f2 保持 0→1。考点：《js-deep-005》《js-deep-011》。

### 题 7 ⭐⭐⭐ this 与闭包的正交性

```js
var name = 'G';
var obj = {
  name: 'O',
  getName: function () {
    return function () { return this.name; };
  }
};
console.log(obj.getName()());  // ?
// 改成箭头函数 return () => this.name 呢？
```

**答案**：普通函数版输出 `'G'`（内层裸调用，this 全局）；箭头函数版输出 `'O'`（内层箭头函数沿词法取**外层 getName 的 this**，而 getName 是 `obj.` 调用的隐式绑定）。

**精讲**：两层函数的嵌套里，内层普通函数的 this 与外层**无关**（各自调用点各自判断）；箭头函数打通了这堵墙。这是「闭包沿作用域、this 沿调用」正交性的最佳演示题。考点：《js-deep-005》《js-deep-006》。

### 题 8 ⭐⭐⭐ 内存语义

> 问：闭包一定会导致内存泄漏吗？

**答案要点**（先给结论）：**不会——闭包是「延长生命周期」，泄漏是「本该不可达却仍可达」**。展开三层：① 闭包让被引用变量存活，这是特性不是缺陷；② 现代引擎只保留被闭包**实际引用**的变量（未被引用的可以回收）；③ 真正的泄漏场景是「长生命周期闭包捕获大对象」，治理方法是缩小捕获范围（提前解构基本值）。追问方向：V8 的分代回收与可达性判定（《v8-005》）。考点：《js-deep-005》第六节。

---

## 三、this 绑定（3 题）

### 题 9 ⭐⭐⭐ 优先级串烧

```js
var a = 1;
function foo() { console.log(this.a); }
var obj = { a: 2, foo: foo };
var bound = foo.bind({ a: 3 });

obj.foo();            // ?
bound();              // ?
new (foo.bind({ a: 4 }))().a === undefined; // new 能抢走 bind 的 this 吗？
```

**答案**：`2`；`3`；能——new 绑定优先级高于 bind，构造出来的实例不经过 bind 对象（实例上没有 a，表达式为 true）。

**精讲**：四规则优先级 `new > 显式 > 隐式 > 默认`（第 6 篇）。`new bound()` 时规范让 bind 包装函数走 [[Construct]]，this 让位给新实例。考点：《js-deep-006》优先级实验。

### 题 10 ⭐⭐⭐ 表达式包装退化

```js
var a = 2;
var obj = { a: 3, foo: function () { console.log(this.a); } };

(obj.foo)();           // ?
(obj.foo = obj.foo)(); // ?
(false || obj.foo)();  // ?
```

**答案**：`3`；`2`；`2`。

**精讲**：第一处括号不改变引用，仍是隐式绑定；后两处——**赋值/逻辑表达式的值是函数本身**（引用已脱钩对象），调用点退化为裸调用走默认绑定。顶级变体题，本质不变：看执行调用时函数引用还挂不挂在对象上。考点：《js-deep-006》实战延伸。

### 题 11 ⭐⭐ 严格模式

```js
function foo() {
  "use strict";
  console.log(this);
}
foo();                    // ?
foo.call(undefined);      // ?
window.setTimeout(foo, 0); // 回调里的 this ?
```

**答案**：`undefined`；`undefined`；`window`（如果 foo 内部第一行是严格模式声明，回调中 this 仍是 undefined）。

**精讲**：严格模式按**函数体**生效；默认绑定与显式传 null/undefined 都得到 undefined。setTimeout 的回调机制内部对 this 的处理与被调函数自身的严格模式无关——函数自己声明了严格模式就按严格模式。考点：《js-deep-006》规则一。

---

## 四、原型与继承（4 题）

### 题 12 ⭐⭐⭐ 三角关系默写

> 问：画出 `function F() {}`、`F.prototype`、`var f = new F()` 三者的引用关系。

**答案要点**：

```
f.[[Prototype]] ─────▶ F.prototype
F.prototype.constructor ─────▶ F
F.[[Prototype]] ─────▶ Function.prototype
F.prototype.[[Prototype]] ─────▶ Object.prototype ──▶ null
```

**精讲**：追问通常有三个：`f.__proto__ === F.prototype`（true）；`F.__proto__ === Function.prototype`（true，函数也是对象）；`F.prototype.__proto__ === Object.prototype`（true，原型对象是普通对象）。考点：《js-deep-009》图。

### 题 13 ⭐⭐⭐ instanceof 手写与推演

```js
console.log([] instanceof Array);   // ?
console.log([] instanceof Object);  // ?
console.log(myInstanceof('abc', String));  // 手写版输出？
```

**答案**：`true`；`true`；`false`（原始值没有 [[Prototype]]，`Object.getPrototypeOf('abc')` 会装箱成 String 包装对象——但标准 `myInstanceof` 若直接取原始值原型，多数手写版会返回 true/false 取决于实现；严格答：原始值 instanceof 任何构造都是 false，手写版应先排除非对象）。

**精讲**：instanceof 沿**左侧原型链**找**右侧 prototype 对象**；数组链路 `[] → Array.prototype → Object.prototype`，所以两个都 true。手写时的边界：左侧原始值直接 false。考点：《js-deep-009》第四节。

### 题 14 ⭐⭐⭐ 继承演进与缺陷

> 问：说出三种继承方案及各自的缺陷，为什么寄生组合式是最优解？

**答案要点**（标准答法）：原型链继承（引用值共享 + 无法传参）→ 借用构造函数（无链、方法不共享）→ 组合继承（父构造调用两次）→ 寄生组合式：**属性用 `Parent.call(this)`，链用 `Object.create(Parent.prototype)`，父构造只调一次**。class extends 在此基础上加静态链与 super 语义。

**精讲**：答题时先立「继承 = 属性 + 方法两个问题」的框架再报方案，逻辑分会高很多。考点：《js-deep-010》五代演进。

### 题 15 ⭐⭐ constructor 陷阱

```js
function Dog() {}
Dog.prototype = { bark() {} };
var d = new Dog();
console.log(d.constructor === Dog);   // ?
console.log(d.constructor === Object); // ?
```

**答案**：`false`；`true`。

**精讲**：整体重写原型丢了 `constructor`；沿链在 `Object.prototype` 上找到 constructor（指向 Object）。两个结论：重写原型要补 `constructor` 回指；**constructor 不能当类型判断用**。考点：《js-deep-009》第三节。

---

## 五、new 与显式绑定（3 题）

### 题 16 ⭐⭐⭐ new 返回值劫持

```js
function F() {
  this.a = 1;
  return { b: 2 };
}
console.log(new F().a, new F().b);      // ?

function G() { this.a = 1; return 'str'; }
console.log(new G().a);                  // ?
```

**答案**：`undefined 2`；`1`。

**精讲**：new 第四步的返回值判定——**返回对象被采用、返回原始值被忽略**（'str' 是原始值，G 的实例照常返回，a 为 1）。追问「返回 null 呢」——null 是原始值，被忽略。考点：《js-deep-008》第④步。

### 题 17 ⭐⭐ 借方法三连

```js
var arrayLike = { 0: 'a', 1: 'b', length: 2 };
// 用三种方式把它变成真数组；解释为什么 Array 的方法能用在它身上
```

**答案**：`Array.prototype.slice.call(arrayLike)` / `Array.from(arrayLike)` / `[...arrayLike]`。原理：slice 内部只依赖 `this.length` 与数字索引（鸭子类型），call 手动把 this 指过去——**方法的可用性取决于它读什么，不取决于 this 是谁的实例**。考点：《js-deep-007》。

### 题 18 ⭐⭐⭐ 综合大题（串全部机制）

```js
function Person(name) {
  this.name = name;
}
Person.prototype.getName = function () {
  return this.name;
};
var p = new Person('小明');

// 判断输出
console.log(p.getName());                          // ① '小明'
console.log(p.getName.call({ name: '小红' }));      // ② '小红'
console.log(p.hasOwnProperty('name'));              // ③ true
console.log(Object.keys(p));                        // ④ ['name']
console.log(p instanceof Person);                   // ⑤ true
```

**精讲**：①隐式绑定 + 实例属性；②call 换 this 后沿链照样命中 getName（方法在原型上，this 换谁就查谁）；③④说明实例自身只有 name，方法全在原型（数据实例、方法原型）；⑤new 第②步的链接使 instanceof 成立。**这道题答全对，说明前 11 篇全部贯通**。

---

## 高频追问 Top 5（口述题的「评分表」）

| 追问 | 期望答到的关键词 |
|---|---|
| 「闭包是什么/怎么产生」 | 函数 + [[Environment]]；定义时锁定；环境被引用不销毁；捕获引用非快照 |
| 「this 有几种绑定」 | 四规则 + 优先级 + 箭头函数例外 + 严格模式差异 |
| 「原型链查找过程」 | 由内到外、命中即止、终点 null、遮蔽、赋值在自身 |
| 「new 做了什么」 | 四步曲 + 返回值规则 + 手写三件套 |
| 「let 有没有提升」 | 有登记无初始化、TDZ、与 var 的差异 |

## 总结

- 面试题的本质是**机制的组合考察**：一道题常横跨 2~3 篇的知识点；
- 答题套路：先给结论 → 按机制逐步推演 → 主动延伸边界情况（严格模式/原始值/重写原型）；
- 每道输出题都可以用第 11 篇的「三问法」拆解：栈怎么走、链怎么建、this 是谁。

**面试一句话回答**（关于如何准备这类题）：不要背题——把「环境登记、链查找、闭包引用、this 四规则、new 四步」五个机制吃透，任何执行类题目都是它们的不同组合，从机制出发推演，比背一百道题更可靠。

## 思考题

1. 题 5 中把 `setTimeout` 换成立即执行的 `console.log`，输出变成什么？为什么时序不影响 var 的结果？
2. 把题 9 的 `foo` 改为箭头函数 `var foo = () => console.log(this.a)`，五个判断各自还成立吗？
3. 设计一道能同时考察「提升 + 遮蔽 + 闭包 + this」的题目（给出代码与标准答案），并标注每一步对应的机制篇目。
4. 用你自己的话，把《js-deep-011》的三层模型讲给一个没读过本系列的人（检验你是否真的完成内化）。

（思考题解析将同步录入小程序题库，关联本文 id：js-deep-012）

## 参考文献

- 本系列第 1~11 篇——所有题目的机制出处
- 《JavaScript 高级程序设计（第 4 版）》第 4、8 章
- 《你不知道的 JavaScript（上卷）》全书

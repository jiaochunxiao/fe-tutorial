---
id: js-deep-006
title: JavaScript 深入之 this
series: JavaScript 深入系列
seriesId: js-deep
stage: foundation
difficulty: 3
tags: [this, 绑定规则, 箭头函数, 严格模式, 面试高频]
readingTime: 22
prev: js-deep-005
next: js-deep-007
createdAt: 2026-10-26
---

# JavaScript 深入之 this

## 从一个「同一个函数、三种结果」的现象说起

```js
var name = 'window';

var obj = {
  name: 'obj',
  getName: function () {
    return this.name;
  }
};

console.log(obj.getName()); // 'obj'

var fn = obj.getName;
console.log(fn());          // 'window' —— 怎么就变了？

setTimeout(obj.getName, 0); // 'window'（异步打印）
```

**完全同一个函数**，三次调用却拿到不同的 `this`。更「气人」的是，这和第 3 篇刚建立的认知貌似冲突：作用域是定义时确定的，那 `this` 为什么感觉是调用时才变？

答案是：**`this` 不是作用域机制的产物，而是函数调用机制的产物**。`this` 是函数的一个隐式参数，**怎么调用**决定了它传什么值。⭐⭐ this 是 JavaScript 面试出现率最高的知识点之一，本文一次讲透。

## 现象与直觉解释

直觉规则先立起来：

> 看**调用点**（call-site）——即「函数是怎么被调用的」：
> - 谁在点号前面，`this` 就指向谁（`obj.getName()` → `obj`）；
> - 光秃秃直接调用，`this` 指向全局（严格模式下是 `undefined`）；
> - 被 `call/apply/bind` 指定了，就用指定的；
> - 被 `new` 了，就指向新造的对象。

这套直觉覆盖 90% 的场景，但面试考的往往是剩下 10% 的边界。下面进入正题：四大绑定规则与优先级。

## 深入原理：四种绑定规则 ⭐

### 规则一：默认绑定（Default Binding）

函数**独立调用**（没有任何修饰、直接 `fn()`），非严格模式下 `this` 指向全局对象（浏览器 `window` / Node `globalThis`）；**严格模式下是 `undefined`**：

```js
function foo() {
  console.log(this);
}

foo();          // window（非严格模式）
// 'use strict' 下：undefined，且 this.name 会抛 TypeError
```

严格模式是按**函数体**生效的——这一点在面试里常被追问。

### 规则二：隐式绑定（Implicit Binding）

调用点有「对象.方法」的上下文时，`this` 指向**最靠近调用点的那个对象**（只有最后一层起作用）：

```js
function foo() { console.log(this.a); }

var obj2 = { a: 42, foo: foo };
var obj1 = { a: 2,  obj2: obj2 };

obj1.obj2.foo(); // 42 —— 链式调用只看最后一层 obj2
```

**隐式丢失（lost binding）**——隐式绑定最著名的坑，三种高发姿势：

```js
// 姿势一：先赋值再调用，调用点变成了裸调用
var fn = obj.getName; // 这里只是取函数引用，与 obj 无关了
fn();                 // window —— 默认绑定

// 姿势二：作为参数传入（本质同上）
setTimeout(obj.getName, 0); // 传进去的是函数引用，回调时裸调用

// 姿势三：解构
var { getName } = obj;
getName(); // window —— 默认绑定
```

开篇代码的「三种结果」正是姿势一和姿势二。

### 规则三：显式绑定（Explicit Binding）

`call`、`apply`、`bind` 直接指定 `this`（三者的差异与手写实现见《js-deep-007》）：

```js
foo.call(obj);  // this = obj
foo.apply(obj); // 同上，只是传参形式不同
var bound = foo.bind(obj); // 硬绑定：永久固定 this
bound();        // this 恒为 obj，之后再 call 也改不掉
```

两个细节：

- **传 `null`/`undefined` 会退化为默认绑定**（非严格模式指向全局）：`foo.call(null)` ≈ `foo()`。这是「借方法」写法的由来，如 `Array.prototype.slice.call(null, ...)` 实际把 this 落在全局上——能跑但不严谨；
- `bind` 是**一次性的**：`bound` 再被 `bind/call`，`this` 仍是第一次绑定的对象（思考题 3 验证）。

### 规则四：new 绑定

`new foo()` 时，`this` 指向新创建的对象（四步过程详见《js-deep-008》）：

```js
function Person(name) {
  this.name = name; // this = 新对象
}
var p = new Person('小明'); // p.name === '小明'
```

### 优先级验证 ⭐

结论：**new > 显式（bind）> 隐式 > 默认**。用代码验证关键的两层：

```js
function foo(name) { this.name = name; }

var obj = {};
var bound = foo.bind(obj);

bound('显式');
console.log(obj.name); // '显式' —— bind 生效

var bar = new bound('new');
console.log(obj.name); // '显式' —— new 没有改写 obj
console.log(bar.name); // 'new'   —— new 创建了新对象，this 指向它
```

`new` 遇到硬绑定的函数时，会绕开 `bind` 的对象、让 `this` 指向新造的实例——规范对 `bind` 返回的「内置绑定函数」有专门的 `[[Construct]]` 行为，这是最高优先级的体现。

### 特殊成员：箭头函数

箭头函数**不适用以上四条规则**——它根本没有自己的 `this`：

```js
var name = 'window';

var obj = {
  name: 'obj',
  delayed: function () {
    // 普通函数：this 取决于调用方式
    setTimeout(() => {
      // 箭头函数：沿词法作用域取「外层函数」的 this
      console.log(this.name);
    }, 100);
  },
  delayedBroken: function () {
    setTimeout(function () {
      console.log(this.name); // 'window' —— 回调裸调用
    }, 100);
  }
};

obj.delayed();        // 'obj' —— 箭头函数继承 delayed 的 this
obj.delayedBroken();  // 'window'
```

三个关键点：

1. 箭头函数的 `this` = 定义时所在外层作用域的 `this`——**像词法作用域一样「书写时锁定」**，所以有人称之为「词法 this」；
2. `call/apply/bind` **改不动**箭头函数的 `this`（传了也只当普通参数用）；
3. 箭头函数也没有 `arguments`、不能作构造函数（`new` 直接报错）。

工程建议：**回调里需要「外层的 this」用箭头函数；作为对象方法、需要动态 this 的别用箭头函数**（`obj = { getName: () => this.name }` 是经典错误——箭头函数拿到的是模块/全局的 this）。

<figure style="margin:2.2em 0">
<svg viewBox="0 0 720 380" width="100%" role="img" aria-label="this 的四条绑定规则决策流程">
  <defs>
    <marker id="t6-ink" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#1C1A17"/>
    </marker>
  </defs>
  <text x="120" y="26" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13.5" font-weight="700" fill="#6E675A">从上往下问，命中即停</text>
  <rect x="30" y="42" width="180" height="46" rx="8" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.6"/>
  <text x="120" y="70" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13.5" font-weight="700" fill="#1C1A17">箭头函数？</text>
  <path d="M 210 65 H 500" stroke="#1C1A17" stroke-width="1.6" marker-end="url(#t6-ink)"/>
  <text x="355" y="57" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#B03A2E">是</text>
  <rect x="502" y="42" width="188" height="46" rx="8" fill="#FBF8F1" stroke="#1C1A17" stroke-width="1.4"/>
  <text x="596" y="70" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13" fill="#1C1A17">外层作用域的 this（改不动）</text>
  <path d="M 120 88 V 108" stroke="#1C1A17" stroke-width="1.6" marker-end="url(#t6-ink)"/>
  <text x="134" y="102" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#6E675A">否</text>
  <rect x="30" y="110" width="180" height="46" rx="8" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.6"/>
  <text x="120" y="138" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13.5" font-weight="700" fill="#1C1A17">new 调用？</text>
  <path d="M 210 133 H 500" stroke="#1C1A17" stroke-width="1.6" marker-end="url(#t6-ink)"/>
  <text x="355" y="125" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#B03A2E">是</text>
  <rect x="502" y="110" width="188" height="46" rx="8" fill="#FBF8F1" stroke="#1C1A17" stroke-width="1.4"/>
  <text x="596" y="138" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13" fill="#1C1A17">新创建的对象</text>
  <path d="M 120 156 V 176" stroke="#1C1A17" stroke-width="1.6" marker-end="url(#t6-ink)"/>
  <text x="134" y="170" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#6E675A">否</text>
  <rect x="30" y="178" width="180" height="46" rx="8" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.6"/>
  <text x="120" y="206" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13.5" font-weight="700" fill="#1C1A17">call/apply/bind？</text>
  <path d="M 210 201 H 500" stroke="#1C1A17" stroke-width="1.6" marker-end="url(#t6-ink)"/>
  <text x="355" y="193" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#B03A2E">是</text>
  <rect x="502" y="178" width="188" height="46" rx="8" fill="#FBF8F1" stroke="#1C1A17" stroke-width="1.4"/>
  <text x="596" y="201" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13" fill="#1C1A17">指定的对象（bind 永久）</text>
  <path d="M 120 224 V 244" stroke="#1C1A17" stroke-width="1.6" marker-end="url(#t6-ink)"/>
  <text x="134" y="238" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#6E675A">否</text>
  <rect x="30" y="246" width="180" height="46" rx="8" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.6"/>
  <text x="120" y="274" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13.5" font-weight="700" fill="#1C1A17">obj.fn()？</text>
  <path d="M 210 269 H 500" stroke="#1C1A17" stroke-width="1.6" marker-end="url(#t6-ink)"/>
  <text x="355" y="261" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#B03A2E">是</text>
  <rect x="502" y="246" width="188" height="46" rx="8" fill="#FBF8F1" stroke="#1C1A17" stroke-width="1.4"/>
  <text x="596" y="269" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13" fill="#1C1A17">点号前的对象</text>
  <path d="M 120 292 V 312" stroke="#1C1A17" stroke-width="1.6" marker-end="url(#t6-ink)"/>
  <text x="134" y="306" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#6E675A">否</text>
  <rect x="30" y="314" width="180" height="46" rx="8" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.6"/>
  <text x="120" y="342" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13.5" font-weight="700" fill="#1C1A17">默认绑定</text>
  <path d="M 210 337 H 500" stroke="#1C1A17" stroke-width="1.6" marker-end="url(#t6-ink)"/>
  <text x="355" y="329" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#B03A2E">裸调用</text>
  <rect x="502" y="314" width="188" height="46" rx="8" fill="#FBF8F1" stroke="#1C1A17" stroke-width="1.4"/>
  <text x="596" y="337" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13" fill="#1C1A17">非严格: 全局 / 严格: undefined</text>
</svg>
<figcaption style="font-family:'Noto Sans SC',sans-serif;font-size:13px;color:#6E675A;text-align:center;margin-top:10px">图 · this 的判定流程——四规则自上而下命中即停，箭头函数是规则外的「词法派」</figcaption>
</figure>

### 一张决策流程图

```
调用点分析 this：
 ┌─ 是 new 调用？ ──────────────▶ this = 新创建的对象
 ├─ 是 call/apply/bind？ ───────▶ this = 指定的对象（null/undefined→默认）
 ├─ 是 对象.方法()？ ───────────▶ this = 点号前的对象
 └─ 裸调用 fn()？ ──────────────▶ 非严格: 全局 | 严格: undefined

 箭头函数？→ 以上全部跳过，this = 外层作用域的 this（书写时锁定）
```

## 回看开篇

| 调用 | 规则 | this | 输出 |
|---|---|---|---|
| `obj.getName()` | 隐式绑定 | `obj` | `'obj'` |
| `var fn = obj.getName; fn()` | 引用赋值 → 裸调用 → 默认绑定 | 全局 | `'window'` |
| `setTimeout(obj.getName, 0)` | 传引用 → 回调裸调用 → 默认绑定 | 全局 | `'window'` |

修复后两种场景的办法：`fn.call(obj)` / `obj.getName.bind(obj)` / 回调改写为 `() => obj.getName()`。

## 实战延伸

**1. 一个更「刁钻」的面试变体 ⭐**

```js
function foo() { console.log(this.a); }
var a = 2;
var obj = { a: 3, foo: foo };

(obj.foo)();          // 3 —— 括号不影响引用，仍是隐式绑定
(obj.foo = obj.foo)(); // 2 ！ 赋值表达式的返回值是「函数本身」，
                       //    调用点退化为裸调用 → 默认绑定
(false || obj.foo)();  // 2 ！ 逻辑运算符同样返回函数引用本身
```

「调用点被表达式包装后退化」是 this 题目的顶级变体，原理始终是那一条：**看最终执行调用时，函数引用是否还挂在对象上**。

**2. DOM 事件里的 this**

`addEventListener` 的普通函数回调中 `this` 指向**绑定事件的元素**——这是隐式绑定（事件系统帮你「对象.方法()」式调用）。改用箭头函数后 `this` 变成外层作用域的 this，拿不到元素——需要 `event.currentTarget`。

**3. class 中的 this**

class 函数体**默认就是严格模式**，所以方法被裸调用时 `this` 是 `undefined` 而不是全局——React 旧版类组件必须 `this.handleClick = this.handleClick.bind(this)` 的根本原因正在于此。

## 图解总结

```
                 ┌──────────────┐
                 │  调用点分析   │
                 └──────┬───────┘
        ┌───────┬───────┼────────┬─────────┐
        ▼       ▼       ▼        ▼         ▼
     new调用  bind/call  obj.fn()  fn()   箭头函数
        │       │        │        │         │
        ▼       ▼        ▼        ▼         ▼
     新对象   指定对象   obj对象  全局/undefined  外层this
        └───────┴────优先级────┴───────┘   （规则外的词法派）
```

## 总结

- `this` 是调用机制的产物：**怎么调用**决定 `this` 是什么，与定义位置无关（作用域才是定义时确定的）；
- 四规则：默认 < 隐式 < 显式（bind）< new；
- 隐式绑定三大丢失：引用赋值、传参回调、解构；
- 严格模式下默认绑定是 `undefined`；class 体内默认严格模式；
- 箭头函数没有 this，沿词法作用域取外层的 this，`call/bind` 改不动。

**面试一句话回答**：this 在函数调用时确定——new 调用指向新对象、call/apply/bind 指定谁就是谁、对象点方法指向该对象、裸调用在非严格模式指向全局（严格模式为 undefined），优先级 new > 显式 > 隐式 > 默认；箭头函数例外，它没有自己的 this，而是沿词法作用域沿用外层的 this，且无法被 call/bind 修改。

## 思考题

1. 写出全部输出：
```js
var x = 10;
var obj = {
  x: 20,
  get: function () { return this.x; },
  getArrow: () => this.x
};
console.log(obj.get());
console.log(obj.getArrow());
console.log((obj.get)());
console.log((false || obj.get)());
```

2. 下面代码如何让它输出 `obj`（至少给出三种方案并说明各自原理）：
```js
var obj = { name: 'obj', print: function () { console.log(this.name); } };
setTimeout(obj.print, 0); // 现在输出 window
```

3. `bind` 连续绑定为什么只生效第一次？写出下面代码的输出并解释：
```js
function f() { console.log(this.a); }
var o1 = { a: 1 }, o2 = { a: 2 }, o3 = { a: 3 };
f.bind(o1).bind(o2).call(o3);
```

4. 开放设计：React 类组件中为什么「事件处理函数里的 this」是经典问题？从 class 严格模式、隐式绑定丢失两个角度分析，并给出 bind、箭头函数类属性、在 render 中用箭头函数三种方案的取舍。

（思考题解析将同步录入小程序题库，关联本文 id：js-deep-006）

## 参考文献

- 《你不知道的 JavaScript（上卷）》第 2 章「this 全面解析」——绑定规则体系的最经典论述
- ECMA-262 现行版「EvaluateCall」「Function.prototype.bind」「Built-in Function Objects [[Construct]]」相关章节
- MDN — [this](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Operators/this)、[箭头函数](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Functions/Arrow_functions)
- 冴羽《JavaScript 深入之 this》

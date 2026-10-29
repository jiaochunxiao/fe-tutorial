---
id: es6-006
title: ES6+ 之 Symbol
series: ES6+ 系列
seriesId: es6
stage: intermediate
difficulty: 3
tags: [Symbol, 唯一性, 内置 Symbol, 元编程, 枚举]
readingTime: 16
prev: es6-005
next: es6-007
createdAt: 2026-10-26
---

# ES6+ 之 Symbol

## 从一个「属性名撞车」事故说起

你给第三方组件注入扩展属性，上线后组件升级——它内部也用了 `config` 这个属性名，你的配置被组件内部逻辑覆盖了。**字符串键的命名空间是全局共享的**，撞车是迟早的事。

```js
const config = Symbol('config');        // 每个 Symbol 全局唯一
obj[config] = mySettings;               // 永不与任何字符串键冲突
```

这就是 Symbol 存在的第一动机：**绝对唯一的属性键**。⭐ Symbol 的表面用法很简单，但它同时是「对象键的防撞机制」和「语言元编程的挂钩点」（内置 Symbol）——后者才是高级考点。

## 现象与直觉解释

Symbol 是 ES6 引入的**第七种原始类型**（与 undefined/null/boolean/number/string/bigint 平级）：

```js
typeof Symbol(); // 'symbol' ✅ 不是对象！
```

两个直觉特性：

1. **唯一性**：`Symbol('x') === Symbol('x')` 为 false——描述词只是「调试标签」，不参与相等性；
2. **可作对象键**：`obj[sym]`——并且**不会出现在 for...in / Object.keys 里**（对常规枚举「隐身」）。

## 深入原理

### 一、唯一性与「半隐藏」属性 ⭐

```js
const READONLY = Symbol('readonly flag');

const obj = {
  [READONLY]: true,        // 计算属性名形式定义
  name: 'x',
};

Object.keys(obj);               // ['name'] —— symbol 键不出现
JSON.stringify(obj);            // '{"name":"x"}' —— 序列化也不带
for (const k in obj) {}         // 遍历不到
Object.getOwnPropertySymbols(obj); // [Symbol(readonly flag)] ✅ 专门的读取通道
Reflect.ownKeys(obj);           // 字符串键 + symbol 键全量
```

「半隐藏」的意义：库作者挂在对象上的**内部标记**不会污染用户的遍历与序列化——比 `_internal` 前缀约定（只是君子协定）硬核得多。但注意它**不是安全机制**：`getOwnPropertySymbols` 谁都能调；真正的私有要用 class 的 `#field`（ES2022）。

### 二、Symbol.for：全局注册表（共享版）⭐

```js
Symbol.for('app.token');  // 全局注册表查找/创建
Symbol.for('app.token') === Symbol.for('app.token'); // true ✅ 跨模块共享同一个
Symbol('x') === Symbol('x');                          // false（每次新建）
Symbol.keyFor(Symbol.for('app.token'));               // 'app.token'（反查描述）
```

`Symbol()` 私有、`Symbol.for()` 公共——跨 iframe/多实例共享常量的通道（早期多 CDN 共存的库用它识别「同一个全局标记」）。

### 三、内置 Symbol：语言行为的挂钩点 ⭐⭐

规范在一组**众所周知的 Symbol（well-known symbols）**上定义了语言行为——对象实现这些方法，就能改变自身在语法中的表现，这就是**元编程**：

| 内置 Symbol | 挂钩的语言行为 | 示例 |
|---|---|---|
| `Symbol.iterator` | `for...of` / 展开是否可用 | 自定义可迭代（《es6-009》） |
| `Symbol.asyncIterator` | `for await...of` | 异步流 |
| `Symbol.toStringTag` | `Object.prototype.toString` 的类型标签 | `obj[Symbol.toStringTag]='Vec'; toString→'[object Vec]'` |
| `Symbol.hasInstance` | `instanceof` 的判定 | 自定义 instanceof 行为 |
| `Symbol.species` | 派生对象用哪个构造器 | 子类化 Array 时 map 返回类型 |
| `Symbol.toPrimitive` | 对象转原始值 | `+obj` / `${obj}` 的转换钩子 |

两个直观例子：

```js
// ① instanceof 的自定义判定（呼应《js-deep-009》）
class Even {
  static [Symbol.hasInstance](num) { return typeof num === 'number' && num % 2 === 0; }
}
4 instanceof Even;  // true ✅ 完全自定义

// ② 类型标签：Object.prototype.toString 认的就是它（《js-core-002》的原理）
class Matrix {}
Matrix.prototype[Symbol.toStringTag] = 'Matrix';
Object.prototype.toString.call(new Matrix()); // '[object Matrix]'
// 这就是为什么 null/数组/正则能被精确识别——内置构造器都设了自己的 toStringTag
```

### 四、工程应用场景清单

1. **防撞键**：库的内部标记、多实例协调（`Symbol.for`）；
2. **枚举的替代**（ES5 时代 `const COLOR = { RED: 'red' }` 的问题：值可比较、可遍历、可被字符串冒充）：

```js
const COLOR = { RED: Symbol('red'), GREEN: Symbol('green') };
switch (c) { case COLOR.RED: ... } // 唯一、不可伪造、JSON 不泄漏
// 注：现代 TS 项目更常用字面量联合类型，Symbol 枚举多见于运行时 JS 库
```

3. **React 的旧内部机制**：React.element 的 `$$typeof: Symbol.for('react.element')`——用 Symbol 防止「JSON 注入的假元素」被 React 渲染（Symbol 不能从 JSON 来）——安全设计的教科书案例；
4. **「再审题」一个细节**：对象字面量里 `{ [Symbol.iterator]: ... }` 用的是**计算属性名语法**——`Symbol.iterator` 本身是个值，不是字符串名。

## 回看开篇

属性撞车的根治：注入方用 Symbol 做键——组件的字符串键与你的 symbol 键在对象上是两个平行命名空间，物理上不可能冲突；同时它对遍历隐身，用户代码完全无感。**唯一键 + 半隐藏 + 类型识别，Symbol 的三重工程价值**。

## 实战延伸

**1. 面试答题骨架**：「Symbol 是第七种原始类型，每次调用返回全局唯一值，作对象键时不被 for...in、Object.keys 和 JSON 序列化枚举，只能通过 getOwnPropertySymbols/Reflect.ownKeys 读取；Symbol.for 走全局注册表可实现跨模块共享；更重要的是内置 Symbol 挂钩语言行为——iterator 决定可迭代性、toStringTag 决定类型标签、hasInstance 决定 instanceof，是 JS 元编程的入口。」

**2. 一个快手题**：

```js
const s1 = Symbol('a'), s2 = Symbol('a');
const o = { [s1]: 1, b: 2 };
console.log(s1 === s2, o[s2], Object.keys(o).length, Reflect.ownKeys(o).length);
// false  undefined  1  2 —— 唯一性 + 隐身性的双重体现
```

## 图解总结

```
Symbol() ─── 私有唯一键 ──▶ 防撞/内部标记（枚举隐身）
Symbol.for() ─ 全局注册表 ──▶ 跨模块共享
内置 Symbol ── 语言挂钩 ──▶ iterator / toStringTag / hasInstance / toPrimitive…
                             （定义「对象在语法中如何表现」——元编程）

安全性辨析：Symbol 键 ≠ 私有（可被 getOwnPropertySymbols 读到）
           真私有 = class #field
```

## 总结

- Symbol 是第七种原始类型，绝对唯一（描述词只是标签）；
- 作对象键时对常规枚举与 JSON 隐身，读取走 getOwnPropertySymbols / Reflect.ownKeys；
- Symbol.for 全局注册表支持跨模块共享同一 Symbol；
- 内置 Symbol 挂钩语言行为：iterator（可迭代）、toStringTag（类型标签）、hasInstance（instanceof）、toPrimitive（类型转换）——元编程的入口；
- Symbol 是防撞不是私有；私有用 #field。

**面试一句话回答**：Symbol 是 ES6 新增的第七种原始类型，每次调用都产生全局唯一、互不相等的值，用作对象属性键时不会被 for-in、Object.keys 和 JSON 序列化枚举到，只能通过 Object.getOwnPropertySymbols 或 Reflect.ownKeys 读取，因此适合做库内部标记与防撞属性；Symbol.for 通过全局注册表创建可跨模块共享的 Symbol；而 Symbol.iterator、Symbol.toStringTag、Symbol.hasInstance 等内置 Symbol 是语言行为的挂钩点，决定对象的可迭代性、类型标签与 instanceof 判定，是 JavaScript 元编程的正式入口——但 Symbol 键不等于私有，真正的私有字段是 class 的 #field。

## 思考题

1. `Symbol.for('a') === Symbol('a')` 结果是什么？为什么两者机制不同？
2. 实现一个「带隐藏元数据的对象工厂」：`wrap(data)` 返回普通对象，外部 `Object.keys` 看不到你附加的版本号与时间戳——用 Symbol 实现，并给出读取通道。
3. 用 `Symbol.hasInstance` 实现 `NonEmptyString`：`'' instanceof NonEmptyString` 为 false、`'x' instanceof NonEmptyString` 为 true。
4. 开放讨论：React 曾用 `Symbol.for('react.element')` 防 JSON 注入伪造元素——从「JSON 无法产生 symbol」这个事实出发，还有哪些「不可序列化值」可以做安全令牌？各自的边界？

（思考题解析将同步录入小程序题库，关联本文 id：es6-006）

## 参考文献：

- ECMA-262 现行版 — Well-Known Symbols、GlobalSymbolRegistry
- MDN — [Symbol](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Symbol)
- 《ES6 标准入门（第 3 版）》第 10 章
- 本课程《es6-009 Iterator》《js-core-002 类型判断》（内置 Symbol 的两处应用）

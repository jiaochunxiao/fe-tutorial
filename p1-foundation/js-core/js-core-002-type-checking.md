---
id: js-core-002
title: JavaScript 核心之类型判断的十八般武艺
series: JavaScript 核心系列
seriesId: js-core
stage: foundation
difficulty: 2
tags: [typeof, instanceof, toString, 类型判断, isNaN]
readingTime: 18
prev: js-core-001
next: js-core-003
createdAt: 2026-10-26
---

# JavaScript 核心之类型判断的十八般武艺

## 从「判断数组翻了车」说起

```js
// 判断一个值是不是数组，五个候选答案：
typeof arr === 'array'            // ❌ typeof 从不返回 'array'（给的是 'object'）
arr instanceof Array              // ⚠️ 基本对，但 iframe 场景失灵
arr.constructor === Array         // ⚠️ 原型被重写就废
Object.prototype.toString.call(arr) === '[object Array]' // ✅ 最稳
Array.isArray(arr)                // ✅ 现代首选
```

一道小题背后是一整个问题域：**每种判断手段都有它的能力边界**。⭐⭐ 「怎么判断类型」是面试基础必考，而「知道每个方法的盲区」才是差距所在。

## 现象与直觉解释

四种主流手段，各自回答不同的问题：

| 手段 | 回答的问题 | 盲区 |
|---|---|---|
| `typeof` | 这个值是哪类**原始值/函数**？ | null、所有引用类型一律 'object' |
| `instanceof` | 它的原型链上有这个构造器吗？ | 不能判原始值、跨 realm 失灵、继承会「误报」 |
| `Object.prototype.toString` | 它的**内部槽标签**是什么？ | 可被 Symbol.toStringTag 伪造 |
| `Array.isArray` / `Number.isNaN` 等 | 专项判断 | 只管自己那一类 |

## 深入原理

### 一、typeof：快而糙的初筛 ⭐

```js
typeof 1            // 'number'
typeof NaN          // 'number'      ← NaN 也是 number！
typeof 'a'          // 'string'
typeof true         // 'boolean'
typeof undefined    // 'undefined'   ← 唯一能安全判断 undefined 的方式
typeof 10n          // 'bigint'
typeof Symbol()     // 'symbol'
typeof {}           // 'object'
typeof []           // 'object'      ← 分不出数组
typeof null         // 'object'      ← 千年 bug
typeof function(){} // 'function'    ← 引用类型中唯一的专属名
```

**`typeof null === 'object'` 的由来**：早期实现用低位标签区分类型，对象标签是 `000`，而 null 在多数平台上是全零指针——被误判成对象。规范为保持兼容永不修复（提案被拒）。

**安全用法**：`typeof v !== 'undefined'`（变量可能未声明时不抛 ReferenceError——`if (v)` 会炸而 `typeof` 不会）。

### 二、instanceof：认原型，不认「血统」⭐

原理见《js-deep-009》：沿左侧原型链查找右侧的 `prototype`。

```js
[] instanceof Array    // true
[] instanceof Object   // true —— 链上所有祖先都算（「误报」其实是特性）
new Date() instanceof Date  // true

// 盲区 1：原始值
'abc' instanceof String    // false（原始值没有原型链；new String('abc') 才是 true）

// 盲区 2：跨 realm（iframe / Node vm）
const iframeArr = iframe.contentWindow.Array;
[] instanceof iframeArr   // false —— 两个 Array 构造器是两个不同的函数对象

// 盲区 3：Symbol.hasInstance 可自定义判定
class Fake { static [Symbol.hasInstance](x) { return true; } }
'任何东西' instanceof Fake  // true 😱
```

### 三、Object.prototype.toString.call：读「内部槽标签」⭐⭐

每个对象内部有 `[[Symbol.toStringTag]]` 槽（多数由内置构造器默认提供），toString 就读它拼成 `'[object Type]'`：

```js
const tag = Object.prototype.toString;

tag.call(null)       // '[object Null]'     ✅ null 有救了
tag.call(undefined)  // '[object Undefined]'
tag.call([])         // '[object Array]'
tag.call(new Date)   // '[object Date]'
tag.call(/a/)        // '[object RegExp]'
tag.call(Promise.resolve()) // '[object Promise]'
tag.call(new Map)    // '[object Map]'
```

**为什么必须 `.call`**：`[]` 自己也有 toString 方法（数组版：把元素拼字符串），必须**借 Object 原型的 toString** 并把 this 指过去——这正是《js-deep-007》「借方法」的经典应用。

**它的「伪造」边界**（也是相对 `instanceof` 的优劣互换）：

```js
const faker = {};
faker[Symbol.toStringTag] = 'Array';
tag.call(faker);  // '[object Array]' 😱 —— 标签可被自定义
// 但：跨 realm 依然准确（内部槽跟着对象走，不看构造器身份）
```

### 四、专项 API：现代代码的优先选择 ⭐

```js
Array.isArray([])          // true —— 跨 realm 稳、不是数组必 false（推荐）
Number.isNaN(NaN)          // true —— 判「值就是 NaN」
Number.isNaN('NaN')        // false（全局 isNaN 会先转换 → true ❌ 经典坑）
Number.isFinite(1)         // true —— 全局 isFinite('1') 也 true（转换了）；Number 版不转换
```

**`isNaN` 的坑**：全局 `isNaN(x)` = `Number(x)` 后是不是 NaN——`isNaN('abc')` 是 true（字符串被转成 NaN）；`Number.isNaN` 不转换，只对真正的 NaN 返回 true。

### 五、判空专题（面试高频变体）⭐⭐

```js
// undefined / null 的区分
v === undefined    // 精确
v == null          // true ⇔ v 是 null 或 undefined（利用 == 的隐式规则，js-core-004 详解）

// 「有效值」判断的段位
if (v) { … }                 // 青铜：0、''、NaN、false 全被误杀
if (v != null) { … }         // 白银：只放行 null/undefined
if (v !== undefined && v !== null)  // 黄金：显式双检

// 空对象 / 空数组
Object.keys(obj).length === 0
Array.isArray(arr) && arr.length === 0
```

**`if (x)` 的误杀名单**：`0`、`''`、`NaN`、`false`、`null`、`undefined`——「用户没传参数」和「用户传了 0」是两个语义，用 truthy 判断会把后者吞掉（参数默认值 `level = 1` 的同款陷阱，《es6-004》）。

### 六、一张决策表（终结选择题）⭐⭐

| 需求 | 首选 | 备选 |
|---|---|---|
| 判断原始类型 | `typeof` | — |
| 判断 undefined（可能未声明） | `typeof v === 'undefined'` | — |
| 判断数组 | `Array.isArray` | `toString.call` |
| 判断 NaN | `Number.isNaN` | `v !== v`（NaN 唯一不等于自己） |
| 判断 null | `v === null` | — |
| 判断 null 或 undefined | `v == null` | 双 `!==` |
| 判断自定义类实例 | `instanceof` | — |
| 判断任意对象具体类型 | `Object.prototype.toString.call` | — |

## 回看开篇

五个候选的最终排位：`Array.isArray`（首选，跨 realm 稳）> `Object.prototype.toString.call`（通用兜底，可被伪造但场景罕见）> `instanceof`（单 realm 下可接受）> `arr.constructor`（脆弱，原型可重写）> `typeof`（对数组无能为力）。**没有银弹——「按需求选工具」就是这题的标准答案。**

## 实战延伸

**1. 手写 getType 综合版**：

```js
function getType(v) {
  if (v === null) return 'null';
  const type = typeof v;
  if (type !== 'object') return type;            // 原始值 + function 一网打尽
  return Object.prototype.toString.call(v).slice(8, -1).toLowerCase();
}
getType(1); getType(null); getType([]); getType(()=>{});  // 'number' 'null' 'array' 'function'
```

**2. 面试答题骨架**：「typeof 判原始值与函数但 null 是历史 bug、引用类型一律 object；instanceof 沿原型链判定、不能判原始值且跨 iframe 失灵；Object.prototype.toString.call 读内部槽标签、null 数组日期全能判但可被 toStringTag 伪造；专项 API 里 Array.isArray 与 Number.isNaN 是现代首选，注意全局 isNaN 会隐式转换。」

## 图解总结

```
              要判断什么？
   ├─ 原始类型 ──────▶ typeof（null 例外：=== null）
   ├─ 数组 ──────────▶ Array.isArray ✅ / toString.call ✅ / instanceof ⚠️跨realm
   ├─ NaN ───────────▶ Number.isNaN ✅ / v !== v ✅ / isNaN ❌会转换
   ├─ null/undefined ▶ === 精确 / == null 合并判
   └─ 任意对象细分 ──▶ Object.prototype.toString.call（读内部槽，可伪造）
```

## 总结

- typeof：原始值初筛利器，null 是历史 bug，引用类型全归 'object'（函数除外）；
- instanceof：原型链判定，不能判原始值、跨 realm 失灵、可被 Symbol.hasInstance 劫持；
- toString.call：读内部槽标签，覆盖面最广（含 null），可被 toStringTag 伪造；
- 专项 API 现代首选：Array.isArray 跨 realm 稳、Number.isNaN 不做隐式转换；
- 判空要分清「没传」与「传了假值」：== null 是合并判空的惯用快捷方式。

**面试一句话回答**：typeof 适合判断原始类型与函数但 null 返回 object 是历史遗留、数组等引用类型都返回 object；instanceof 沿原型链查找判定自定义类与内置引用类型，但原始值直接 false、跨 iframe 的构造器不同会失灵；Object.prototype.toString.call 读取对象的内部槽标签，能精确区分 null、数组、日期、正则、Promise 等，只是标签可被 Symbol.toStringTag 自定义；现代代码优先使用 Array.isArray、Number.isNaN 等专项 API——注意全局 isNaN 会先做类型转换导致 isNaN('abc') 为 true，判空时 == null 可同时命中 null 与 undefined 两个空值。

## 思考题

1. 写出输出：`typeof typeof null`、`typeof (()=>{})`、`Object.prototype.toString.call(function(){})`。
2. 为什么 `v !== v` 能判断 NaN？这个写法相比 `Number.isNaN(v)` 有优势吗？
3. 手写 `isPlainObject(v)`：判断「纯对象」（{} 或 new Object() 创建——排除数组、函数、Date、null…）。
4. 开放设计：写一个 `assertType(v, 'array', '参数 items')` 校验工具，被校验失败时抛出含「参数名+期望类型+实际类型」的错误——把你选的判断手段组合进去。

（思考题解析将同步录入小程序题库，关联本文 id：js-core-002）

## 参考文献：

- ECMA-262 现行版 — typeof 运算符、`[[Symbol.toStringTag]]`、Number.isNaN
- MDN — [typeof](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Operators/typeof)、[Array.isArray](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray)
- 本课程《js-deep-007 call/apply/bind》（toString 借方法原理）、《js-deep-009 原型链》（instanceof 原理）

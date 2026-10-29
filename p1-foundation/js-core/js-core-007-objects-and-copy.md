---
id: js-core-007
title: JavaScript 核心之对象的创建、遍历与拷贝
series: JavaScript 核心系列
seriesId: js-core
stage: foundation
difficulty: 2
tags: [对象, 属性描述符, 遍历顺序, 浅拷贝, 属性检测]
readingTime: 18
prev: js-core-006
next: js-core-008
createdAt: 2026-10-26
---

# JavaScript 核心之对象的创建、遍历与拷贝

## 从三个「为什么」说起

```js
const o = { a: 1 };

// 为什么这个属性 for...in 遍历不到？
Object.defineProperty(o, 'hidden', { value: 42, enumerable: false });

// 为什么 in 说有、hasOwnProperty 说没有？
'toString' in o;                 // true（原型链上）
Object.hasOwn(o, 'toString');    // false（自身没有）

// 为什么两个「一样的对象」不相等？
{...o} === {...o};               // false（两个堆实体，=== 比地址 —— js-core-001）
```

对象是 JS 的「万能容器」，而容器的三个核心操作——**放东西（创建/定义）、找东西（遍历/检测）、复制（拷贝）**——每个都有精细规则。⭐ 本文把它们一次收全。

## 现象与直觉解释

对象的每个属性其实是一份**属性描述符（Property Descriptor）**——四对开关决定这个属性的「性格」：

```js
Object.getOwnPropertyDescriptor({ a: 1 }, 'a');
// { value: 1, writable: true, enumerable: true, configurable: true }
```

直觉：属性不只是「键值对」，更像一个带四个旋钮的小盒子（值、可写、可枚举、可配置）——默认全开，`Object.defineProperty` 可以逐个拧。

## 深入原理

### 一、属性描述符：四个旋钮 ⭐⭐

```js
const obj = {};

Object.defineProperty(obj, 'version', {
  value: 1,
  writable: false,      // 只读：赋值静默失败（严格模式报 TypeError）
  enumerable: false,    // 隐身：keys/遍历/JSON.stringify 全部不可见
  configurable: false,  // 锁死：不能删除、不能再用 defineProperty 改回
});
obj.version = 2;        // 静默失败（obj.version 仍是 1）
delete obj.version;     // false（不可配置：删不掉）

// 存取描述符（getter/setter）：value/writable 换成 get/set —— Vue2 响应式的地基
Object.defineProperty(obj, 'doubled', {
  get() { return this._x * 2; },
  set(v) { this._x = v / 2; },
  enumerable: true,
  configurable: true,
});
```

Vue2 的 `Object.defineProperty` 劫持正是**把 data 属性改写成 get/set 存取描述符**，在 get 里收集依赖、set 里触发更新（《es6-008》对照过它的四大缺陷）。

### 二、遍历：三种方式与顺序规则 ⭐⭐

```js
const obj = { b: 1, 2: 'x', a: 3, 1: 'y' };

for (const k in obj) { … }        // 含【原型链上】的可枚举属性 ⚠️
Object.keys(obj);                  // ['1', '2', 'b', 'a'] —— 只看自身
Object.values(obj); / Object.entries(obj);

// 遍历顺序规则（规范化的现代行为）：
// ① 类数组的整数键 → 升序（'1' 在 '2' 前）
// ② 其余字符串键 → 【插入顺序】
// ③ Symbol 键 → 插入顺序，且【不参与】以上所有遍历（es6-006）
```

**for...in 的三重过滤意识**：原型链属性（用 `Object.hasOwn` 过滤）、不可枚举属性（默认就不出现）、Symbol 键（永远不出现）——「拿不准就用 entries」。

### 三、属性存在性：in vs hasOwn vs undefined 判断 ⭐

```js
const o = Object.create({ inherited: 1 });   // 原型上有 inherited
o.own = undefined;                            // 自身有 own，但值是 undefined

'inherited' in o;               // true（沿原型链查）
Object.hasOwn(o, 'inherited');  // false（只查自身）✅ 现代首选
o.own !== undefined;            // false ❗ 自身有属性但值为 undefined —— 判断失真
Object.hasOwn(o, 'own');        // true ✅ 属性存在性与值无关
```

三段式结论：**查自身用 hasOwn；查整个链用 in；「值是否 undefined」不是存在性判断**。

### 四、创建对象的方式速览 ⭐

```js
// ① 字面量（90% 的场景）
const a = { x: 1 };

// ② 构造函数 / class（需要多实例共享方法 —— js-deep-008/010）
class Point { constructor(x) { this.x = x; } }

// ③ Object.create(proto)：指定原型创建（纯净、寄生组合式继承的核心步骤）
const b = Object.create({ greet() { return 'hi'; } });  // b 能沿链调 greet
const pure = Object.create(null);                        // 没有任何继承的「裸对象」——安全字典

// ④ Object.create(null) 的实战价值：
const dict = Object.create(null);
dict['toString'];   // undefined —— 不怕键名撞原型属性（普通对象 dict['toString'] 是函数❗）
```

### 五、拷贝：方式与深度 ⭐⭐

```js
const src = { a: 1, inner: { b: 2 }, list: [1] };

// 浅拷贝三式（第一层独立，嵌套共享）：
const c1 = { ...src };
const c2 = Object.assign({}, src);
const c3 = Object.keys(src).reduce((acc, k) => ((acc[k] = src[k]), acc), {});

c1.inner === src.inner;    // true ❗ 嵌套层是同一个柜子
c1.list.push(2);           // src.list 也变长

// 「合并 + 覆盖」的顺序语义（配置合并的经典用法）：
const defaults = { theme: 'light', retry: 1 };
const user = { theme: 'dark' };
const merged = { ...defaults, ...user };   // 后面的覆盖前面的 → { theme:'dark', retry:1 }

// 深拷贝四式：
JSON.parse(JSON.stringify(src));  // ❌ 三宗罪（handwritten-003）
structuredClone(src);             // ✅ 现代原生（原型链/Symbol 丢失）
cloneDeep(src);                   // ✅ lodash 全能
// 手写递归版 —— 《handwritten-003》的 WeakMap 方案
```

## 回看开篇

三个「为什么」的答案：hidden 不可枚举所以遍历不见（描述符旋钮）；in 查整条链而 hasOwn 只查自身；`===` 对引用值比地址——拷贝出的新对象永远是「新的柜子」。**属性描述符、查找范围、地址语义——三把钥匙各开一扇门。**

## 实战延伸

**1. 面试快手串烧**：

```js
const o = { a: 1 };
Object.defineProperty(o, 'a', { value: 2, writable: false });
o.a = 99;
console.log(o.a);          // 2（只读）
console.log(JSON.stringify(o)); // '{"a":2}'（value 型默认可枚举？不——defineProperty 全默认 false！）
// ⚠️ 陷阱：defineProperty 只传部分描述符时，未传的旋钮全部默认 false —— 上面 JSON 里 a 其实消失了
//（value:2 enumerable 未写 → false → stringify 是 '{}'）—— 这就是「旋钮默认关」的威力
```

**2. 对象冻结三档**：`preventExtensions`（禁加新属性）→ `seal`（禁加禁删）→ `freeze`（禁加禁删禁改，浅层）——配合 const 锁绑定，是「不可变配置对象」的完整姿势。

## 图解总结

```
属性描述符（每属性四个旋钮）
  value/writable │ get/set │ enumerable │ configurable
       └─ Vue2 劫持的就是 get/set 这一对

遍历：整数键升序 → 字符串键插入序 → Symbol 永不出现
存在：in 查整链 │ hasOwn 查自身 │ 值undefined ≠ 不存在
拷贝：{...}/assign 浅（嵌套共享）│ structuredClone/cloneDeep/手写 深
创建：字面量 │ class │ Object.create(proto) │ Object.create(null)=安全字典
```

## 总结

- 属性描述符四旋钮：value/writable（或 get/set）、enumerable、configurable——defineProperty 未传的默认全 false；
- 遍历顺序：整数键升序、字符串键插入序、Symbol 键缺席；for...in 含原型链；
- 存在性三段式：in 查链、hasOwn 查自身、undefined 值不是不存在；
- Object.create(null) 是无继承的安全字典；
- 浅拷贝三式共享嵌套层；深拷贝正解 structuredClone / cloneDeep / 手写 WeakMap 版。

**面试一句话回答**：对象每个属性由描述符定义，包含值与可写或存取器、可枚举与可配置四个开关，Object.defineProperty 未指定的开关默认为 false，Vue2 正是把属性改写为存取描述符实现劫持；遍历时类数组整数键按升序、其余字符串键按插入序、Symbol 键不参与，for-in 还会带出原型链上的可枚举属性；存在性检查 in 沿原型链而 Object.hasOwn 只查自身，属性值为 undefined 不代表属性不存在；浅拷贝用展开或 Object.assign 只复制第一层，深拷贝的现代答案是 structuredClone 或 cloneDeep，Object.create(null) 则能创建无原型污染的安全字典。

## 思考题

1. 写出输出并解释每个旋钮的状态：
```js
const o = {};
Object.defineProperty(o, 'x', { value: 1 });
console.log(o.x, Object.keys(o), 'x' in o, delete o.x, o.x);
```

2. 手写 `omit(obj, keys)`（返回剔除指定键的新对象）与 `pick(obj, keys)`——用 entries/filter/fromEntries 组合实现。
3. 为什么 for...in 遍历 Map 会得到什么都没有？Map 的正确遍历方式是什么？（关联《es6-007》）
4. 开放设计：实现「配置对象合并器 mergeConfig(defaults, …overrides)」：浅合并、undefined 不覆盖已有值、返回全新对象——写出实现并说明为什么深合并要慎用。

（思考题解析将同步录入小程序题库，关联本文 id：js-core-007）

## 参考文献：

- ECMA-262 现行版 — Property Descriptors、OrdinaryOwnPropertyKeys（遍历顺序）
- MDN — [Object.defineProperty](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty)、[structuredClone](https://developer.mozilla.org/zh-CN/docs/Web/API/structuredClone)
- 本课程《js-core-001 数据类型》《handwritten-003 深拷贝》

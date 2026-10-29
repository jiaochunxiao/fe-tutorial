---
id: handwritten-002
title: 手写 new 与 instanceof
series: 手写源码系列
seriesId: handwritten
stage: expert
difficulty: 4
tags: [手写new, 手写instanceof, objectFactory, 原型链, Symbol.hasInstance]
readingTime: 16
prev: handwritten-001
next: handwritten-003
createdAt: 2026-10-26
---

# 手写 new 与 instanceof

## 一对互为镜像的手写题

《js-deep-008》讲过 new 的四步曲，《js-deep-009》讲过 instanceof 沿原型链认亲——本篇把它们落成考场代码：

- **手写 new（objectFactory）**：四步曲的代码化；
- **手写 instanceof（myInstanceof）**：原型链遍历的代码化。

⭐ 两者放在一起考有深意：**new 负责「建立」原型链，instanceof 负责「查询」原型链**——写完这对镜像，原型链机制才算真正闭环。

## 手写 new

### 从四步曲到代码

```
① 创建空对象            → var obj = Object.create(Constructor.prototype)
② 原型链接             →     （Object.create 一步完成 ①②）
③ this 绑定并执行       → Constructor.apply(obj, args)
④ 返回值判定            → result 是对象/函数 ? result : obj
```

```js
function objectFactory() {
  // ① 取出第一个参数（构造函数），剩余的是实参
  const Constructor = [].shift.call(arguments); // 借用数组方法（es6-005/007 的联动）

  // ②③ 创建新对象 + 链接原型（Object.create 一步到位）
  const obj = Object.create(Constructor.prototype);

  // ④ 以 obj 为 this 执行构造函数
  const result = Constructor.apply(obj, arguments);

  // ⑤ 返回值判定：对象/函数被采用，其余（含 null/undefined/原始值）忽略
  return (typeof result === 'object' && result !== null) || typeof result === 'function'
    ? result
    : obj;
}
```

### 验证四件事（考场自测清单）⭐

```js
function Person(name) { this.name = name; }
Person.prototype.hi = function () { return 'hi ' + this.name; };

// 1. 实例属性 ✅
const p = objectFactory(Person, '小明');
p.name;                        // '小明'

// 2. 原型方法可达 ✅（原型链建立）
p.hi();                        // 'hi 小明'

// 3. instanceof 成立 ✅
p instanceof Person;           // true

// 4. 返回值劫持 ✅
function Weird() { return { x: 1 }; }
objectFactory(Weird).x;        // 1 —— 构造函数返回的对象被采用
function Return42() { this.a = 1; return 42; }
objectFactory(Return42).a;     // 1 —— 原始值被忽略，返回 this 对象
```

### 边界与追问

| 追问 | 答案 |
|---|---|
| 为什么 `Object.create(proto)` 而不是 `obj.__proto__ = ...`？ | 前者是标准 API，后者是浏览器访问器（且一次赋值两步合一） |
| 构造函数抛错怎么办？ | 异常自然向上抛（obj 被丢弃）——与原生 new 一致 |
| 用 class 构造函数测试？ | ⚠️ 原生 class 构造器**不能被 apply 调用**（必须 new），手写版对 class 会报错——原生 new 也不支持这种模拟路径，属于「手写题的极限边界」，说明这一点本身就是加分项 |
| `arguments` 换成 rest 参数？ | `function objectFactory(Constructor, ...args)` 更现代，语义等价 |

## 手写 instanceof

### 原理回顾一行版

> 沿 **左侧对象的原型链** 逐级向上，看能否找到 **右侧函数的 prototype 对象**。

### 完整实现

```js
function myInstanceof(left, right) {
  // ① 边界：原始值没有 [[Prototype]]，直接 false（原生行为）
  if (left === null || (typeof left !== 'object' && typeof left !== 'function')) {
    return false;
  }

  // ② 取右侧 prototype（right 必须是函数；Object.getPrototypeOf 是标准姿势）
  if (typeof right !== 'function') {
    throw new TypeError('Right-hand side must be a function');
  }
  let proto = Object.getPrototypeOf(left);

  // ③ 沿链上行，逐级比较
  while (proto !== null) {
    if (proto === right.prototype) return true;
    proto = Object.getPrototypeOf(proto);
  }
  return false; // 走到 null（链尽头）仍未命中
}
```

执行轨迹示例：

```js
function Animal() {}
function Dog() {}
Dog.prototype = Object.create(Animal.prototype); // 建链（new 干的活）

const d = new Dog();

myInstanceof(d, Dog);     // d.__proto__ === Dog.prototype ✅ 第1步命中
myInstanceof(d, Animal);  // 第1步 Dog.prototype ≠ Animal.prototype
                          // 第2步 Dog.prototype.__proto__ === Animal.prototype ✅
myInstanceof(d, Object);  // 第3步 Animal.prototype.__proto__ === Object.prototype ✅
myInstanceof('str', String); // false —— 原始值直接 false（注意 new String('s') 则为 true）
myInstanceof(d, {});      // TypeError —— 右侧必须是函数
```

### 进阶：Symbol.hasInstance 的自定义口子 ⭐

ES6 允许函数自定义 instanceof 行为（挂钩点见《es6-006》）：

```js
class NonEmptyString {
  static [Symbol.hasInstance](value) {
    return typeof value === 'string' && value.length > 0;
  }
}
'' instanceof NonEmptyString;     // false
'x' instanceof NonEmptyString;    // true —— 判定权完全交给你
```

**规范顺序**：instanceof 先查右侧的 `Symbol.hasInstance` 方法，没有才走默认的原型链查找——手写版要「以假乱真」就应先检查这个钩子（思考题 3）。

## 镜像对照：建立与查询

```
objectFactory（建立链）                myInstanceof（查询链）
 ┌─────────────────────────┐          ┌─────────────────────────┐
 │ Object.create(proto) ───┼──建立──▶ │ getPrototypeOf(left)     │
 │      obj 的 [[Prototype]] │         │      ↓ 循环上溯           │
 │ apply(obj, args) ────────┼─初始化─▶ │ proto === right.prototype│
 │ 返回值判定               │          │   ? true : 继续上溯       │
 └─────────────────────────┘          │ 到 null → false           │
                                      └─────────────────────────┘
```

一个精妙的自证实验：**用手写 new 造的对象，交给手写 instanceof 检验**——两条独立路径在 `Constructor.prototype` 这个对象上会师，通过即证明两者实现自洽：

```js
const list = objectFactory(Array, 1, 2, 3); // 手写 new
myInstanceof(list, Array);                  // true ✅ 链路一致
```

## 实战延伸

**1. 面试答题节奏**：先写 myInstanceof（5 行核心，快）；再写 objectFactory（对照四步曲逐步翻译）；最后主动演示「自证实验」——三步下来原型链的建立与查询全部覆盖。

**2. 快手辨析**：

```js
[] instanceof Array;   // true
[] instanceof Object; // true —— 链路上所有「祖先」都算
myInstanceof(fn, Function); // 函数也是 Function 的实例（函数也是对象）
```

## 图解总结

```
new Foo(args)                     x instanceof Foo
     │                                  │
 ①obj={} ②链接 ③apply ④返回      沿 x.[[Prototype]] 逐级上溯：
     │                          x → Foo.prototype ✅ → … → null
 Foo.prototype ◀══════ 命中点 ═══════┘
（建立的东西，正是查询要找的东西）
```

## 总结

- 手写 new = Object.create（建链）+ apply（绑 this）+ 返回值判定（对象/函数采用、原始值忽略）；
- 手写 instanceof = 沿左侧原型链上溯找右侧 prototype，原始值直接 false、右侧必须是函数；
- 自证实验：手写 new 的产物能被手写 instanceof 认出——两条路径在 prototype 对象上会师；
- class 构造器不能 apply 调用是手写 new 的极限边界；instanceof 的完整规范语义还应先检查 Symbol.hasInstance。

**面试一句话回答**：手写 new 就是把四步曲翻译成代码——用 Object.create(Constructor.prototype) 创建对象并建立原型链接、用 Constructor.apply(obj, args) 以新对象为 this 执行构造函数、最后按「返回对象或函数则采用、否则返回新对象」判定返回值；手写 instanceof 则是沿左侧对象的原型链用 getPrototypeOf 逐级上溯、与右侧函数的 prototype 严格比较，走到 null 仍未命中返回 false，原始值左侧直接返回 false——new 建立的原型链正是 instanceof 查询的对象，两者互为镜像。

## 思考题

1. 把 objectFactory 改写成 `function objectFactory(Constructor, ...args)` 的 rest 版本；再问：`[].shift.call(arguments)` 这行在原版里为什么必不可少？
2. `myInstanceof(42, Number)` 返回什么？原生 `42 instanceof Number` 呢？`new Number(42) instanceof Number` 呢？三者的差异说明什么？
3. 升级 myInstanceof：先检查 `right[Symbol.hasInstance]` 钩子并调用，存在才走原型链——写出完整版并用 NonEmptyString 验证。
4. 开放设计：实现 `typeOf(v)`，返回比 typeof 更精确的类型字符串（能区分数组/null/包装对象/DOM 节点），综合 instanceof、Object.prototype.toString.call 与 duck typing 三种手段并说明各自的覆盖范围。

（思考题解析将同步录入小程序题库，关联本文 id：handwritten-002）

## 参考文献：

- ECMA-262 现行版 — OrdinaryHasInstance（instanceof 的规范算法）、Symbol.hasInstance
- 本课程《js-deep-008 new》《js-deep-009 原型与原型链》（原理篇）
- 《JavaScript 高级程序设计（第 4 版）》第 8 章

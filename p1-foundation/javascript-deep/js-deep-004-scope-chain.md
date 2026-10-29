---
id: js-deep-004
title: JavaScript 深入之作用域链
series: JavaScript 深入系列
seriesId: js-deep
stage: foundation
difficulty: 2
tags: [作用域链, 标识符解析, 遮蔽, 词法环境, '[[Environment]]']
readingTime: 18
prev: js-deep-003
next: js-deep-005
createdAt: 2026-10-26
---

# JavaScript 深入之作用域链

## 从一次「三层寻物」说起

```js
var a = 1;

function outer() {
  var b = 2;

  function middle() {
    var c = 3;

    function inner() {
      var d = 4;
      console.log(a + b + c + d); // 10 —— 四个变量来自四个不同的层
    }

    inner();
  }

  middle();
}

outer();
```

`inner` 执行时，`a`、`b`、`c`、`d` 分别从哪里找到的？查找的**顺序和路径**由什么决定？如果 `middle` 里也有一个 `var a = 100`，结果会变吗？

把这三个问题想清楚，作用域链就懂了。⭐ 作用域链是闭包的前置知识，也是面试里「变量查找」类题目的总纲。

## 现象与直觉解释

直觉版规则：

> 函数查找一个变量时，先看自己内部有没有；没有，就看「定义我的那个函数」里有没有；还没有，就继续往外……直到全局。全程找不到，抛 `ReferenceError`。

这条「从内到外」的查找路径，就是**作用域链（scope chain）**。直觉很朴素，但有两个精确化的问题必须回答：

1. 「往外」的方向是什么时候定下来的？——第 3 篇说过：**定义时**（词法作用域）。
2. 链上的每一层是什么时候建立的？——**调用时**每层才会新建自己的环境。

「方向定义时锁定、内容运行时生成」——这两句话合起来，才是完整准确的作用域链模型。

## 深入原理

### 一、链的形状：定义时锁定

第 3 篇讲了函数对象的内部槽 `[[Environment]]`——函数创建时记住「出生地」的环境。嵌套定义时，每一层的 `[[Environment]]` 指向紧邻的外层函数环境，链条就这样随代码的书写结构**静态**地确定了：

```
书写结构：                     [[Environment]] 指向（定义时锁定）：
global                          ┐
└─ outer          outer    ────▶ global
   └─ middle       middle   ────▶ outer
      └─ inner     inner    ────▶ middle
```

### 二、链的内容：调用时生成

以 `inner` 的调用为例，完整过程是：

1. `outer()` 被调用 → 创建 outer 本次调用的**环境记录**（含 `b = 2`）；
2. 执行到 `middle()` → 创建 middle 的环境记录（含 `c = 3`），其外层引用指向 outer 本次的环境记录；
3. 执行到 `inner()` → 创建 inner 的环境记录（含 `d = 4`），外层引用经 `inner.[[Environment]]` 的路线指向 middle 本次的环境记录。

查找 `a` 时：inner（无）→ middle（无）→ outer（无）→ 全局（命中 `a = 1`）。

```
inner 环境 { d:4 }
   │ 沿 [[Environment]] 链向外
   ▼
middle 环境 { c:3 }
   │
   ▼
outer 环境 { b:2 }
   │
   ▼
全局环境   { a:1 }  ✅ 命中
   │ 再往外？
   ▼
  null      → 到头了；若全程未命中 → ReferenceError
```

注意一个重要细节：**同一个函数被调用两次，产生两条各自独立的环境链**——每次调用都有新的环境记录，互不影响。这就是为什么递归、循环里的回调各自拿到「自己那一次」的变量。

### 三、遮蔽效应（Shadowing）

查找是「由内到外、命中即止」的，所以内层同名变量会**遮蔽**外层：

```js
var a = 1;

function outer() {
  var a = 100; // 遮蔽全局的 a

  function inner() {
    console.log(a); // 100 —— middle/inner 层没有，outer 层命中，轮不到全局
  }

  inner();
}

outer();
```

这也回答了开篇的第三个问题：`middle` 里若有 `var a = 100`，`inner` 打印的就是 100。被遮蔽的外层变量依然存在，只是这一条查找路径**到不了**它。

### 四、链是单向的

查找只能从内到外，外层永远「看不见」内层的变量：

```js
function outer() {
  function inner() {
    var secret = 'inner 的私有变量';
  }

  inner();
  console.log(secret); // ReferenceError
}
```

这是函数封装性的根基——内层作用域天然是私有实现细节。

## 回看开篇

| 变量 | 命中层级 | 说明 |
|---|---|---|
| `d` | inner 自己 | 最近者优先 |
| `c` | middle 环境 | inner 没有则向外一层 |
| `b` | outer 环境 | 依此类推 |
| `a` | 全局环境 | 链的最后一站 |

输出 `1 + 2 + 3 + 4 = 10`；若 middle 声明了 `a`，则 `a` 命中于 middle，遮蔽全局。

## 实战延伸

**1. 闭包：链条在外层函数返回后依然有效**

如果 `outer` 执行完就返回了，它的环境记录按理会随上下文销毁——但只要 `inner` 还活着，它就通过 `[[Environment]]` 引用着那条链，`b` 因此继续存活。**这就是下一篇《js-deep-005 闭包》的全部机制**。

**2. 减少长链查找的老经验与新结论**

老资料常说「深层作用域链查找慢，应把外层变量缓存到局部」。历史上确有性能差异，但现代引擎（V8 等）对词法作用域做了大量优化（如《v8-002 隐藏类与内联缓存》所讲），这条优化建议如今更多是可读性问题——按需局部化即可，不必为性能过度纠结。

**3. 用 lint 管住遮蔽**

意外的同名遮蔽是隐蔽 bug 的高发区（尤其全局配置变量被局部同名覆盖）。ESLint 的 `no-shadow` 规则可以强制暴露这类风险，团队规范建议开启。

**4. IIFE 与块级作用域：主动「加一层」**

```js
for (var i = 0; i < 3; i++) {
  (function (j) {
    // 新的函数层环境，j 是本次调用的独立绑定
    setTimeout(() => console.log(j), 100);
  })(i);
}
```

IIFE（立即执行函数）和 `let` 的块级作用域，本质都是在链条上**插入一层新环境**，让每次迭代持有独立绑定——《js-deep-005 闭包》开篇的 `3 3 3` 问题正出自这里。

## 图解总结

```
定义时（形状）                 调用时（内容）
inner ──▶ middle ──▶ outer ──▶ global ──▶ null
  ▲ 每次调用新建自己的环境记录，
  │  外层方向由 [[Environment]] 在定义时锁定
  └ 查找规则：由内到外，命中即止，全程单向
```

## 总结

- 作用域链 = 从内到外的环境引用链；**形状**在函数定义时由 `[[Environment]]` 锁定，**每层的具体环境**在调用时生成；
- 查找规则：由内到外、命中即止、单向不可逆；
- 内层同名变量遮蔽外层（shadowing），被遮蔽者依然存在只是到不了；
- 链的终点是 null，找不到变量抛 ReferenceError；
- 闭包 = 外层函数返回后，链条依然被存活的内层函数引用——本篇是《闭包》的直接地基。

**面试一句话回答**：函数创建时通过内部槽 [[Environment]] 记住定义处的词法环境，调用时新建自己的环境记录并沿这条链向外查找变量，由内到外命中即止——链的形状定义时静态决定、每层内容运行时生成，这正是词法作用域下变量查找与闭包机制的共同核心。

## 思考题

1. 写出输出并标注每个变量的命中层级：
```js
var x = 'g';
function a() {
  var x = 'a';
  function b() {
    var y = 'b';
    function c() {
      console.log(x, y);
    }
    c();
  }
  b();
}
a();
```

2. 「作用域链在函数定义时就完整创建了」——这句话哪里不准确？请用「形状与内容」的区分重新表述。

3. 下面代码输出什么？为什么两次调用的 `count` 互不影响？
```js
function make() {
  var count = 0;
  return function () { return ++count; };
}
var f1 = make();
var f2 = make();
f1(); f1();
console.log(f2()); // ?
```

4. 开放设计：写一个 `counter` 模块，要求 `increment`、`getCount`、`reset` 三个方法共享同一个计数状态，且该状态不能被外部直接修改——用本篇的「链的单向性」解释它为什么安全。

（思考题解析将同步录入小程序题库，关联本文 id：js-deep-004）

## 参考文献

- ECMA-262 现行版「Lexical Environments」「ResolveBinding」相关章节
- 《JavaScript 高级程序设计（第 4 版）》第 4 章
- 《你不知道的 JavaScript（上卷）》第 1~2 章
- 冴羽《JavaScript 深入之作用域链》

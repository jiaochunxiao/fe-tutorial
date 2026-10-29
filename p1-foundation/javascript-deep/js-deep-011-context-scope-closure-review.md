---
id: js-deep-011
title: JavaScript 深入之上下文、作用域、闭包总串讲
series: JavaScript 深入系列
seriesId: js-deep
stage: foundation
difficulty: 3
tags: [执行上下文, 作用域, 闭包, 串讲, 心智模型]
readingTime: 20
prev: js-deep-010
next: js-deep-012
createdAt: 2026-10-26
---

# JavaScript 深入之上下文、作用域、闭包总串讲

## 一道「一句代码考半个系列」的题

```js
var scope = 'global scope';

function checkscope() {
  var scope = 'local scope';

  function f() {
    return scope;
  }

  return f;
}

var result = checkscope()(); // 输出什么？为什么？
```

答案是 `'local scope'`。但这句话背后，十篇内容在这一行里全部发生了：**执行上下文栈的进出（第 1 篇）、变量登记（第 2 篇）、词法作用域（第 3 篇）、作用域链（第 4 篇）、闭包（第 5 篇）**。

本篇不加新知识，只做一件事：把十篇的机制**串成一个完整的心智模型**，并用它逐步推演这道题——串讲过后，你应该能「看见」代码运行时引擎里的样子。⭐ 串讲式回答是面试高级加分项：不是背散点，而是讲机制。

## 心智模型：一台三层运转的机器

把前十篇浓缩成一张总图（建议能默画）：

```
═════════════════ 第一层：调用栈（第 1 篇）═════════════════
  执行上下文栈 ECStack：管理「谁在执行」
  全局上下文常驻栈底；函数调用压栈，执行完出栈

═════════════════ 第二层：环境与链（第 2~4 篇）═════════════
  每个上下文持有一个词法环境（环境记录 + 外层引用）：
  · 创建阶段：登记形参、函数声明、var/let/const（第 2 篇）
  · 环境的「外层引用」沿 [[Environment]]：定义时锁定形状（第 3 篇），
    调用时生成各层记录（第 4 篇）→ 作用域链
  查找规则：由内到外，命中即止，终点 null

═════════════════ 第三层：函数对象（第 5 篇及之后）═════════
  函数 = 可调用的对象 + 两个关键随身物：
  · [[Environment]]：出生地的环境引用 → 闭包的来源（第 5 篇）
  · [[Prototype]]：上线引用 → new 时接到 prototype（第 8、9 篇）
  另有 this：调用时才决定的隐式参数（第 6 篇），
  call/apply/bind/new 是改变它的四种手动开关（第 7、8 篇）
```

三层各管一件事：**栈管「执行秩序」，环境链管「变量可见性」，函数随身物管「跨时间与跨类型的连接」**。

## 逐步推演：一行代码的完整旅程

回到开篇的 `checkscope()()`，我们从引擎视角走完全程。

### 第一幕：加载脚本

```
ECStack = [ globalContext ]
全局环境记录登记：
  scope   → undefined（var，第 2 篇规则）
  checkscope → <function>（函数声明，名字+值一起登记）
  result  → undefined
```

### 第二幕：执行 `checkscope()`

```
ECStack 压入 checkscopeContext：
  [ globalContext, checkscopeContext ]

checkscope 环境创建阶段：
  · 形参：无
  · 函数声明：f → 登记，且 f.[[Environment]] ← checkscope 本次环境（第 5 篇的伏笔！）
  · var scope → undefined

执行阶段：
  scope = 'local scope'   // 本层赋值
  return f                // f 出栈带走，但 [[Environment]] 还牵着 checkscope 环境
```

`checkscope` 上下文出栈。**但它的环境记录没有销毁**——还被 `f.[[Environment]]` 引用着（这就是闭包的内存语义，第 5 篇）。

### 第三幕：`f()` 被调用

```
ECStack 压入 fContext：[ globalContext, fContext ]

f 环境创建：无自有变量，外层引用 = f.[[Environment]]
  = checkscope 那次调用的环境（含 scope = 'local scope'）

执行 return scope：
  查找 scope（第 4 篇算法）：
    f 自己      → 无
    外层环境    → checkscope 环境，命中 'local scope' ✅
  （global 的 'global scope' 被遮蔽，根本轮不到）

f 出栈。result = 'local scope'
```

### 复盘：每篇各贡献了什么

| 篇目 | 在本题中的体现 |
|---|---|
| 1 执行上下文栈 | checkscope 出栈后 f 还能执行——栈管执行，不管生存 |
| 2 变量对象 | scope 两层登记、f 函数声明提升可用 |
| 3 词法作用域 | f 定义在 checkscope 内 → 看得到的是它的变量 |
| 4 作用域链 | 由内到外查找、local 遮蔽 global |
| 5 闭包 | 环境被 [[Environment]] 引用 → 出栈不销毁 |
| 6~8 this/new | 本题未涉及（this 是调用机制，与作用域正交） |

## 第二个例子：把 this 和原型也串进来

把题目稍微升级，加入 this 与原型（完整覆盖十篇）：

```js
var name = 'G';

function Person(name) {
  this.name = name;
}
Person.prototype.getName = function () {
  var that = this; // 老代码防丢失；现代写法用箭头函数
  return function () {
    return that.name;   // 闭包捕获 that
  };
};

var p = new Person('小明');          // ①
var getName = p.getName();            // ②
console.log(getName());               // ③ '小明'
console.log(getName.call(p));         // ④ '小明'（that 是闭包死的，call 改不动）
console.log(p.getName()());           // ⑤ '小明'
```

逐步标注：

- **① `new Person('小明')`**：四步曲——建对象、链到 `Person.prototype`、this 绑定执行（`this.name = '小明'` 挂到实例）、返回实例（第 8 篇）；
- **② `p.getName()`**：隐式绑定，this = p；执行时 `that = this` 捕获 p；**返回的内层函数通过闭包引用着 that**（第 5、6 篇合作）；
- **③ `getName()`**：裸调用，this 是全局——但函数里压根没用 this，用的是闭包变量 `that`，所以不受影响（闭包与 this 是两套机制！）；
- **④ `getName.call(p)`**：显式指定 this = p，仍无济于事——**闭包捕获的是环境变量，不是 this**；
- **⑤ `p.getName()()`**：与 ③ 等价（先隐式绑定执行外层，再裸调用内层）。

这个例子揭示了一个重要区分：**作用域/闭包在定义时确定（词法），this 在调用时确定（动态）**——两者正交，是「JavaScript 变量解析」的最后一块拼图。

## 终极检查清单：三问自测

拿到任何一段代码，按这三问走，可以拆解 95% 的执行类题目：

1. **栈怎么走？**——画出调用顺序与出栈时机（谁先返回、谁还活着）；
2. **链怎么建？**——每个函数定义在哪里（决定 [[Environment]]）、每次调用新建哪层环境、同名谁遮蔽谁；
3. **this 是谁？**——每个调用点单独判断：new/显式/隐式/裸调用？箭头函数则沿词法向外找。

## 图解总结

```
代码 ──解析──▶ 引擎同时维护三样东西：

 ① ECStack（执行秩序）        ② 环境链（变量可见性）      ③ 函数随身物
 ┌────────────┐         ┌──────────────────┐       ┌────────────────┐
 │ global      │         │ f 环境            │       │ [[Environment]]│→ 出生地环境（闭包）
 │  └ check    │ 出栈后… │  └▶ check 环境    │ 依然  │ [[Prototype]] │→ 原型链（继承）
 │     └ f     │         │      └▶ global   │ 存活  │ this（调用时） │→ 四规则
 └────────────┘         └──────────────────┘       └────────────────┘
        ① 管「什么时候」      ② 管「看得到什么」           ③ 管「连到哪里」
```

## 总结

- 三层模型：**栈管执行秩序、环境链管变量可见性、函数随身物管连接**（[[Environment]]、[[Prototype]]、this）；
- 作用域与闭包是「定义时」的故事（词法），this 是「调用时」的故事（动态）——两套正交机制；
- 闭包的本质：函数出栈不销毁出生地环境，因为 [[Environment]] 还引用着它；
- 三问拆题法：栈怎么走、链怎么建、this 是谁。

**面试一句话回答**：执行上下文栈管理代码的执行秩序，词法环境链管理变量的可见性（形状定义时由 [[Environment]] 锁定），闭包是函数携带出生地环境的自然结果，而 this 由调用方式决定——四者合起来就是 JavaScript 执行模型的全部骨架，任何执行类题目都可以按「栈怎么走、链怎么建、this 是谁」三问拆解。

## 思考题

1. 用「三层模型」推演输出（写出每一步的栈与环境状态）：
```js
function create() {
  var x = 0;
  return {
    inc: function () { return ++x; },
    get: function () { return x; }
  };
}
var c1 = create(), c2 = create();
c1.inc(); c1.inc();
console.log(c1.get(), c2.get());
```

2. 把本文第二个例子中的 `var that = this` 改成箭头函数 `return () => this.name`，四个输出分别是什么？为什么 ④ 会变成 `'小明'`？

3. 「闭包和 this 都是词法作用域决定的」——指出这句话的错误，并分别给出正确的「确定时机」。

4. 开放设计：给你团队新人讲「读代码时脑子里要装哪三张图」，你会怎么设计这三个图的例子？（要求：一个例子同时触发三个机制）

（思考题解析将同步录入小程序题库，关联本文 id：js-deep-011）

## 参考文献

- 本系列第 1~10 篇（本文是其串联，各机制细节均以对应篇目为准）
- 《你不知道的 JavaScript（上卷）》第 1~2 部分整体结构
- ECMA-262 现行版 — Execution Contexts、Lexical Environments 章节总览

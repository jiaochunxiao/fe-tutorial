---
id: js-core-004
title: JavaScript 核心之隐式类型转换与 ==
series: JavaScript 核心系列
seriesId: js-core
stage: foundation
difficulty: 3
tags: [类型转换, ==, ToPrimitive, 隐式转换, 加法运算符]
readingTime: 20
prev: js-core-003
next: js-core-005
createdAt: 2026-10-26
---

# JavaScript 核心之隐式类型转换与 ==

## 从五个「离谱」输出说起

```js
[] + []          // ''            —— 两个数组加出空字符串
[] + {}          // '[object Object]'
true + true      // 2
'5' - 2          // 3             —— 减法把两边都转数字
'5' + 2          // '52'          —— 加法把右边转字符串
null == 0        // false ❗       但 null >= 0 是 true
```

每个都像 bug，其实每个都**严格遵守一套完整规则**。⭐⭐ 「== 的转换规则」「对象怎么转原始值」是面试基础区的深水区——多数人背零散案例，少数人掌握算法。本文交付算法。

## 现象与直觉解释

JavaScript 是弱类型语言：运算符对操作数类型有预期，不匹配就**自动转换**（coercion）。转换算法藏在规范里，核心只有两个：

- **ToPrimitive（对象 → 原始值）**：一切对象参与运算前的必经之门；
- **运算符各自的转换策略**：`+` 偏字符串、`-`/`*` 偏数字、`==` 有一张对照表。

掌握这两个入口，所有「离谱输出」都可以现场推导，无需背诵。

## 深入原理

### 一、ToPrimitive：对象转原始值的三步曲 ⭐⭐

对象参与 `+ - == <` 等运算时，先转原始值：

```
① 对象是否有 Symbol.toPrimitive 方法？ ──有──▶ 调用它（最高优先级）
② 没有 ──▶ 调用 valueOf()：返回原始值？ ──是──▶ 用它
③ 还不是原始值 ──▶ 调用 toString()：返回原始值 ──是──▶ 用它
④ 都失败 ──▶ TypeError: Cannot convert object to primitive value
```

**hint 参数**：调用时传入提示字符串——`default`（+、==）/ `string`（String()、模板插值）/ `number`（数值运算、比较）——内置对象据此调整 valueOf/toString 的优先顺序（string 提示时先 toString）。

```js
const obj = {
  valueOf() { return 42; },
  toString() { return '我是对象'; },
};

obj + 1        // 43        （valueOf 胜出）
`${obj}`       // '我是对象' （string 提示：toString 胜出）
// Date 是内置特例：default 提示下走 toString（所以 new Date() + '' 可读性好）
```

### 二、加法 +：唯一偏字符串的运算符 ⭐⭐

```
+ 的算法：
① 任一边是对象 ──▶ 两边各自 ToPrimitive（default 提示）
② 此时任一边是字符串 ──▶ 另一边也转字符串，拼接
③ 否则 ──▶ 两边转数字，相加
```

回推开篇：

```js
[] + []
// [] ToPrimitive：valueOf 返回自身(不是原始值) → toString 返回 ''
// '' + '' → ''

[] + {}
// '' + '[object Object]' → '[object Object]'

'5' + 2   // 有字符串 → '52'
true + true  // 无字符串 → 1 + 1 = 2
1 + '2'   // '12'；'2' + 1 同理（+ 没有交换律的输出保证！）
```

### 三、其他算术与比较：一律偏数字 ⭐

```js
'5' - 2    // 3    —— ToNumber('5') = 5
'5' * '2'  // 10
'abc' - 1  // NaN  —— ToNumber('abc') = NaN
null - 1   // -1   —— ToNumber(null) = 0
undefined - 1 // NaN —— ToNumber(undefined) = NaN
[] - 1     // -1   —— '' → 0
[5] - 1    // 4    —— '5' → 5（数组 toString 是 join）

// 关系比较 < >：两边转原始值后，若都是字符串则按字典序；否则转数字
'10' < '9'  // true ❗ 两边都是字符串：逐字符比较 '1'<'9'
'10' < 9    // false —— 转数字 10 < 9
```

**ToNumber 速查表**：`'' → 0`、`' ' → 0`、`'12' → 12`、`'12a' → NaN`、`true → 1`、`null → 0`、`undefined → NaN`。

### 四、== 的完整对照规则 ⭐⭐⭐（本文核心考点）

**第一原则：类型相同直接比 ===（注意 NaN 仍不等、+0/-0 相等）**。类型不同按下表：

| 左右类型 | 转换规则 | 示例 |
|---|---|---|
| null == undefined | **互相唯一真爱**：相等，且不与其他任何值相等 | `null == 0` false、`null == ''` false |
| 数字 == 字符串 | 字符串转数字 | `'1' == 1` true |
| 布尔 == 任何 | **布尔先转数字**（true→1）再比 | `true == 1` true、`true == '1'` true（'1'→1） |
| 对象 == 原始值 | 对象 ToPrimitive 再比 | `[] == ''` true（[]→''） |
| 对象 == 对象 | 比引用地址（不转换！） | `[] == []` false |

三个高频陷阱推导：

```js
// 陷阱 1：布尔先行
false == '';   // '' → 0；false → 0 → true ✅（很多人以为 false）
true == '2';   // true→1；'2'→2 → false

// 陷阱 2：数组连续两次转换
[] == false;   // false→0；[]→''→0 → true
[0] == false;  // [0]→'0'→0；false→0 → true

// 陷阱 3：null 的「真爱条款」
null == 0;      // false —— null 不转数字！只和 undefined 相等
null >= 0;      // true ❗ 关系运算符才走 ToNumber(null)=0 —— == 和 >= 不是一套规则
```

**工程结论**：规则可推导但成本高——**团队规范统一用 ===**，仅保留两个惯用例外：`x == null`（合并判空，《js-core-002》）。

### 五、显式转换的正规军（替代隐式的日常姿势）⭐

```js
Number('42')     // 42      —— 字符串→数字（严谨，前后空白容忍）
parseInt('42px') // 42      —— 解析前缀数字（截断式，需指定进制 parseInt(s, 10)）
parseFloat('1.5em') // 1.5
String(42)       // '42'    —— 转字符串（比 '' + 42 语义清晰）
Boolean(x)       // 或 !!x  —— 转布尔
+new Date()      // Date.now() 的老写法（valueOf 优先）—— 知道即可，勿仿
```

## 回看开篇

五连推导：`[]+[]`（ToPrimitive→''）→ `[]+{}`（'' + '[object Object]'）→ `true+true`（无字符串走数字）→ `'5'-2`（偏数字）→ `'5'+2`（加法偏字符串）→ `null==0` false 但 `null>=0` true（== 的真爱条款 vs 关系运算的 ToNumber）。**没有玄学，只有两张规则表。**

## 实战延伸

**1. 面试答题骨架**：「对象参与运算先经 ToPrimitive——依次尝试 Symbol.toPrimitive、valueOf、toString 并受 hint 提示影响；加法在任一侧为字符串时拼接、否则转数字，其他算术与比较一律偏数字；== 在类型相同时等价 ===，不同时按对照表：null 与 undefined 互相相等且不转其他、布尔先转数字、对象先转原始值——因此 [] == false 为 true 而 null == 0 为 false；工程上一律 === 保留 == null 判空。」

**2. 一道压轴综合题**：

```js
const a = {
  valueOf() { return 1; },
  toString() { return 2; },
  [Symbol.toPrimitive](hint) { return hint === 'string' ? 3 : 9; },
};
console.log(a + 1, `${a}`, a == 9);
// 10（default 走 toPrimitive→9+1）、'3'（string 提示）、true（9==9）
```

## 图解总结

```
对象进运算 ──▶ ToPrimitive ──▶ 原始值
                 │ Symbol.toPrimitive（最高优先）
                 │ valueOf → toString（按 hint 调序）

+ ：有字符串→拼接 | 无→数字          - * / < >：一律转数字
==：同类型==== | null⇄undefined 唯一相等 | 布尔先转数 | 对象先转原始
===：类型不同一律 false（零转换）
```

## 总结

- ToPrimitive 三步曲：Symbol.toPrimitive → valueOf → toString，受 hint 提示；
- 加法是唯一偏字符串的运算符（偏数字的是其余算术与比较）；
- == 对照五规则：null⇄undefined 专属、布尔先转数、对象先转原始、对象比引用；
- 隐式可推导但成本高——工程统一 ===，保留 == null 判空；
- 显式转换正规军：Number/parseInt/String/Boolean。

**面试一句话回答**：对象参与运算先通过 ToPrimitive 转成原始值——依次尝试 Symbol.toPrimitive、valueOf、toString 且受 string 或 number 提示影响顺序；加号运算符在任一侧为字符串时做拼接、否则两边转数字相加，而减乘除与比较运算一律转数字；宽松等于在类型相同时等同于严格等于，类型不同时有专属规则——null 与 undefined 彼此相等但不转换为其他值、布尔先转数字、对象先转原始值再比、两个对象比较引用地址，所以 [] == false 为 true 而 null == 0 为 false——工程实践统一使用严格等号，仅保留 == null 做合并判空。

## 思考题

1. 推导输出：`{} + []` 在控制台为什么可能输出 0？（提示：语句开头的 {} 是块还是对象？）
2. 实现一个 `Money` 类：支持 `money1 + money2` 返回分值相加、模板插值显示 '¥12.34'——用 Symbol.toPrimitive 的 hint 分流。
3. `[] == ![]` 为什么是 true？（逐步转换：![] 先算——布尔转换规则是什么？）
4. 开放讨论：TypeScript 的出现让「隐式转换之坑」消失了多少？`Number('abc')` 在 TS 里照样能编译通过——类型系统与运行时转换的边界在哪？

（思考题解析将同步录入小程序题库，关联本文 id：js-core-004）

## 参考文献：

- ECMA-262 现行版 — ToPrimitive、IsLooselyEqual、Additive Operators（规则原文）
- 《你不知道的 JavaScript（中卷）》第 1、4 章（== 与 ToPrimitive 的经典论述）
- MDN — [相等性比较](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Equality_comparisons_and_sameness)

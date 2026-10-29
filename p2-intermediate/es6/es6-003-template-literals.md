---
id: es6-003
title: ES6+ 之模板字符串与标签模板
series: ES6+ 系列
seriesId: es6
stage: intermediate
difficulty: 3
tags: [模板字符串, 标签模板, String.raw, XSS 转义, DSL]
readingTime: 16
prev: es6-002
next: es6-004
createdAt: 2026-10-26
---

# ES6+ 之模板字符串与标签模板

## 从一个「拼接出错还被注入」的例子说起

```js
// 老写法：拼错引号是日常，用户输入直接进 HTML 是事故
var html = '<div class="user">' + escapeHtml(user.name) + '</div>' +
           '<span>' + (user.vip ? 'VIP' : '普通') + '</span>';
```

模板字符串解决前半段（拼接的丑），**标签模板**解决后半段（转义的漏）：

```js
const html = safeHtml`<div class="user">${user.name}</div>`; // 转义逻辑内聚到标签里
```

⭐ 大多数人对模板字符串止步于「会插值」，而标签模板是它真正的高级形态——styled-components、gql``、sql`` 这些工业级 DSL 全建立在它之上。

## 现象与直觉解释

模板字符串三件基础能力：

```js
const user = { name: '小明', score: 59 };
const text = `你好 ${user.name}，
分数：${user.score + 1}（${user.score >= 60 ? '及格' : '不及格'}）`;
// ① 插值：${} 里放任意表达式
// ② 多行：真实换行，不用 \n 与加号
// ③ 内嵌引号不再打架
```

而「标签模板」是**函数调用的一种新形态**——在函数名后面直接跟模板字符串：

```js
tag`Hello ${a} world ${b}`
// 完全等价于函数调用：
tag(['Hello ', ' world ', ''], a, b)
//        └──── 静态片段数组（带 raw 属性）────┘   └ 所有插值 ┘
```

直觉：**模板被「切开」了——静态文本与动态值分离递交**，标签函数拿到两部分后可以任意加工（转义、高亮、缓存、编译）。

## 深入原理

### 一、标签函数的精确签名 ⭐⭐

```js
function tag(strings, ...values) {
  console.log(strings);        // ['Hello ', ' world ', '']  长度 = 插值数 + 1
  console.log(strings.raw);    // 原始转义形态（见下）
  console.log(values);         // [a, b]
  return '结果';
}

const a = 1, b = 2;
tag`Hello ${a} world ${b}`;
```

两个规范细节：

- `strings` 是**冻结的**（immutable）且各引擎会缓存复用——同一处模板多次执行，传给标签的是同一个数组对象；
- `strings.raw` 保存「未经转义处理的原始字符」：`` `\n` `` 的 strings[0] 是真实换行符，raw[0] 是两个字符 `\` `n`——这正是 `String.raw` 标签的原理。

### 二、实战 1：safeHtml——转义的收口 ⭐

用户输入直接插进 HTML 是 XSS 的标准入口（《security-001》）。转义散落在每个拼接点必然有漏，用标签模板把转义**内聚成语法的一部分**：

```js
function safeHtml(strings, ...values) {
  const escape = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  // 静态片段是可信的（开发者写的），只转义动态插值！
  return strings.reduce((acc, str, i) =>
    acc + str + (i < values.length ? escape(values[i]) : ''), '');
}

const userContent = '<script>alert(1)</script>';
safeHtml`<div>${userContent}</div>`; // <div>&lt;script&gt;…</div> ✅
```

**核心思想**：静态片段可信、动态值必转义——把「哪部分是数据」的结构信息保留了下来，这是普通字符串拼接给不了的（拼完后无法区分谁是谁）。GraphQL 的 `gql`、styled-components、lit-html 全是这一思想的工业化版本。

### 三、实战 2：语法高亮 / i18n

```js
function highlight(strings, ...values) {
  return strings.reduce((acc, s, i) =>
    acc + s + (i < values.length ? `<mark>${values[i]}</mark>` : ''), '');
}
highlight`搜索关键词 ${kw} 命中 ${n} 条`; // 动态值自动包高亮

function i18n(strings, ...values) {
  const dict = { 'Hello ': '你好 ', ' world': ' 世界' }; // 静态片段做键查词表
  return values.reduce((acc, v, i) => acc + (dict[strings[i]] ?? strings[i]) + v,
                       dict[strings.at(-1)] ?? strings.at(-1));
}
```

### 四、String.raw 与转义边界

```js
String.raw`\n`;          // '\\n'（两个字符）——要「写出什么就是什么」的路径/正则文本
`\n`;                    // 真实换行
String.raw`C:\new\test`; // 'C:\\new\\test' ✅ Windows 路径不再双反斜杠地狱
```

### 五、模板字符串的性能认知

- `${}` 求值发生在**每次模板执行时**（就是个表达式求值 + 拼接），性能与 `+` 拼接同量级，别迷信差异；
- 循环里大量拼接大字符串，`join('')` 收集仍是更优解（V8 对 join 有 rope 优化路径）；
- 标签模板的 strings 被缓存复用——这也是 lit-html 能做「模板不变部分只解析一次」的性能基石。

## 回看开篇

拼接之丑由插值与多行解决；转义之漏由标签模板收口——`safeHtml` 把「转义责任」从每个开发者的一次次手写，变成一个统一的语法入口。**模板字符串是语法糖，标签模板是元编程**。

## 实战延伸

**1. 面试加分点**：能说出「标签模板是函数调用的另一种语法形式，参数是静态片段冻结数组 + 依次排列的插值」并手写 safeHtml，基本能镇住这类题。

**2. 读懂 styled-components 的钥匙**：`styled.div`color: ${props => props.color}``——标签函数收到模板与「函数类型的插值」，运行时把 props 传入插值函数再拼装 class——本文的机制就是它的全部地基。

**3. 别忘了它还是字符串**：模板字符串结果就是普通 string，没有防注入魔法——安全来自你写的标签函数，而不是反引号本身。

## 图解总结

```
tag`A${x}B${y}C`
     │ │  │ │  │
     ▼ ▼  ▼ ▼  ▼
   tag( ['A','B','C'](含raw), x, y )
         静态片段(可信)         动态值(需处理)

标签函数的三个自由度：
 ① 只处理 values（safeHtml 转义）
 ② 只处理 strings（i18n 查词表）
 ③ 两者结合编译成新东西（styled-components / lit-html）
```

## 总结

- 模板字符串 = 插值（任意表达式）+ 多行 + 引号和谐；
- 标签模板是函数调用的新形态：`(strings(含 raw), ...values)`，strings 冻结且被引擎缓存；
- 工业价值：静态与动态分离——转义收口（safeHtml）、词表替换（i18n）、模板编译（styled-components）；
- String.raw 保留原始转义文本；性能与 `+` 同级，大量拼接仍推 join。

**面试一句话回答**：模板字符串提供插值、多行与表达式内嵌；标签模板本质是函数调用的语法形式——函数名后跟模板字面量时，收到由全部静态片段组成的冻结数组（带 raw 原始形态）和依次排列的插值参数，因此能把「可信的静态文本」与「不可信的动态数据」分开处理，实现统一的转义收口或模板编译，safeHtml、i18n、styled-components 都是这一机制的应用，而 String.raw 则用于保留反斜杠等原始转义文本。

## 思考题

1. 手写 `sql` 标签：静态部分直通、字符串类型的插值自动加引号并转义单引号、其余 String() 化——然后说明它为什么依然防不了所有注入（参数化查询的意义）。
2. `tag`${a}${b}`` 中 strings 的长度是多少？为什么不是插值数？
3. 为什么 `String.raw` 打不出真实换行？它的实现用到了标签签名的哪一部分？
4. 开放设计：用标签模板实现一个极简 `formatMoney`：`` money`总计 ${price} 元` ``，把数字插值格式化为千分位——写出标签函数并考虑非数字插值的降级。

（思考题解析将同步录入小程序题库，关联本文 id：es6-003）

## 参考文献：

- ECMA-262 现行版 — Template Literals、Tagged Templates、String.raw
- MDN — [模板字符串](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Template_literals)
- lit-html / styled-components 文档（标签模板的工业实践）

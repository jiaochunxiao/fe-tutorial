---
id: js-core-008
title: JavaScript 核心之字符串与正则入门
series: JavaScript 核心系列
seriesId: js-core
stage: foundation
difficulty: 3
tags: [字符串, 正则表达式, replace, match, exec]
readingTime: 20
prev: js-core-007
next: js-core-009
createdAt: 2026-10-26
---

# JavaScript 核心之字符串与正则入门

## 从一个「校验了个寂寞」的正则说起

需求：校验手机号。同学写了个正则上线了：

```js
/^1\d{10}$/.test('12345678901234')   // false ✅ 拦住了
/^1\d{10}$/.test('这1条12345678901消息') // false ✅
/^1\d{10}$/.test('1第2345678901方')  // true ❓ —— \d 居然匹配了汉字之间的数字？
// 不对——上面第三个其实是 false。真正的问题是：
/^1\d{10}$/.test('12345678901')      // true ✅
'1三四五六七八九01'.match(/\d{10}/)   // null
// 真正的坑在别处：
const re = /a/g;
re.test('aa'); re.test('aa');        // true, false ❗ 第二次怎么变了？！
```

`g` 标志下的 `lastIndex` 是新手最常踩的隐形状态——正则是「正则」，但**带 g 的正则对象是有状态的**。⭐ 本文覆盖字符串 API 精要 + 正则入门核心，目标是「写出常见的校验与替换，且知道坑在哪」。

## 第一部分：字符串 API 精要

### 一、不可变性回顾（一切方法返回新串）

```js
let s = 'hello';
s[0] = 'H';        // 静默失败（严格模式报错）
s.toUpperCase();   // 'HELLO'（新串）
s;                 // 'hello'
```

### 二、切片三兄弟与索引 ⭐

```js
const s = 'hello world';

s.slice(0, 5);      // 'hello' —— [start, end) 支持【负数】（-1 末位）
s.substring(0, 5);  // 'hello' —— 同区间，但【负数归 0】且参数自动换序
s.substr(1, 4);     // 'ello'  —— (start, 【长度】) 遗留 API，避免新代码使用

s.indexOf('world'); // 6（找不到 -1）
s.includes('world');// true —— 存在性判断首选
s.startsWith('he'); s.endsWith('ld');   // true true
s.at(-1);           // 'd'（ES2022 负索引）
s.charAt(0); s.charCodeAt(0);           // 'h' 104（码元值）
```

### 三、变换四件套

```js
s.split(' ');                    // ['hello', 'world']（支持正则分隔/限制数量）
s.trim();                        // 去两端空白（trimStart/trimEnd 分向）
s.repeat(3);                     // 'hello worldhello world…'
s.padStart(11, '0');             // 补齐到 11 位 —— 日期补零 '5'.padStart(2, '0') = '05'
'5'.padStart(3, 'ab');           // 'ab5'（用指定串填充）
```

### 四、替换：从字符串到正则 ⭐⭐

```js
'aaa'.replace('a', 'x');         // 'xaa' —— 只换【第一个】！
'aaa'.replace(/a/g, 'x');        // 'xxx' —— 全局替换靠 g 标志
'aaa'.replaceAll('a', 'x');      // 'xxx' —— ES2021 字符串版全替换

// 替换中的特殊符号：
'John Smith'.replace(/(\w+)\s(\w+)/, '$2 $1');  // 'Smith John'（$1 $2 反向引用分组）

// 第二参数是函数（动态替换的核心能力）：
'abc'.replace(/b/, (m, ...groups) => m.toUpperCase());  // 'aBc'
price.replace(/\d+/g, (m) => `¥${Number(m).toFixed(2)}`); // 逐个数字加工
```

## 第二部分：正则入门

### 一、元字符速查表 ⭐

| 类别 | 语法 | 含义 |
|---|---|---|
| 字符类 | `\d \w \s` | 数字 / 字母数字下划线 / 空白（大写取反：`\D \W \S`） |
| | `.` | 任意字符（除换行，除非 s 标志） |
| | `[abc] [^abc] [a-z]` | 字符集合 / 取反 / 范围 |
| 量词 | `* + ?` | 0+ / 1+ / 0 或 1 |
| | `{2} {2,} {2,5}` | 恰好 / 至少 / 区间 |
| 边界 | `^ $` | 开头 / 结尾（m 标志下按行） |
| | `\b` | 单词边界（`/\bcat\b/` 不匹配 category） |
| 分组 | `(…)` | 捕获分组（可用 $1 引用） |
| | `(?:…)` | 非捕获分组（只要分组能力，不占编号） |
| | `(?<name>…)` | 命名分组（match 结果 .groups.name） |
| 贪婪 | `.*?` `.+?` | 懒惰匹配（尽量少匹配）——HTML 提取必备 |

### 二、贪婪 vs 懒惰（HTML 提取的经典对照）⭐⭐

```js
const html = '<b>加粗</b>和<b>再加粗</b>';

html.match(/<b>.*<\/b>/);   // ['<b>加粗</b>和<b>再加粗</b>'] —— 贪婪：一口吞到最后
html.match(/<b>.*?<\/b>/g); // ['<b>加粗</b>', '<b>再加粗</b>'] —— 懒惰：够用就停 ✅
```

### 三、标志位全家福 ⭐

| 标志 | 作用 |
|---|---|
| `g` | 全局（多次匹配 + 维护 lastIndex ⚠️） |
| `i` | 忽略大小写 |
| `m` | 多行（^ $ 按行匹配） |
| `s` | dotAll：`.` 连换行也匹配 |
| `u` | Unicode 模式（`\p{Script=Han}`、正确处理代理对——emoji 校验必开） |
| `y` | 粘性（从 lastIndex 精确起步，词法分析器用） |

### 四、test / match / exec：三个入口的行为差异 ⭐⭐

```js
// ① test：返回 true/false（有没有匹配）
/^1\d{10}$/.test('13800138000');   // true

// ② match（字符串方法）：
'2026-10-26'.match(/(\d+)-(\d+)-(\d+)/);
// ['2026-10-26', '2026', '10', '26', index: 0, groups: undefined]
//  ^整串        ^$1        ^$2  ^$3 —— 无 g 时返回首个匹配 + 分组

'aaa'.match(/a/g);   // ['a', 'a', 'a'] —— 有 g 时返回所有匹配（丢了分组！）

// ③ exec（正则方法）：比 match 强在「带 g 分批推进」
const re = /(\w+)=(\d+)/g;
const s = 'w=100&h=200';
let m;
while ((m = re.exec(s)) !== null) {
  console.log(m[1], m[2]);  // w 100 → h 200（lastIndex 自动推进）
}

// ⭐ 开篇之坑：带 g 的 test 与 exec 共享 lastIndex（有状态！）
const t = /a/g;
t.test('aa');   // true（lastIndex → 1）
t.test('aa');   // true（lastIndex → 2）
t.test('aa');   // false（lastIndex=2 起没有匹配，重置为 0）——「时真时假」的真相
// 规避：① 每次新建 /a/g.test(x) ② 用完 re.lastIndex = 0 ③ String.match 替代
```

### 五、命名分组与 lookbehind（现代正则两利器）⭐

```js
// 命名分组：可读性质变
'2026-10-26'.match(/(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/).groups;
// { year: '2026', month: '10', day: '26' }

// 先行/后行断言（匹配但不消费）：
/\d+(?=px)/.exec('100px 200em');  // ['100'] —— 数字后面必须是 px（不消费 px）
/(?<=\$)\d+/.exec('价格$100');     // ['100'] —— 数字前面必须是 $
'foo.bar'.replace(/(?<!\.)bar/, 'BAZ');  // 先行断言的「排除」用法
```

## 回看开篇

`g` 标志的坑：正则对象用 `lastIndex` 记住「上次匹配到哪」——同一个正则对象反复 test/exec 就是「接着上次继续找」，找不到才归零。正则字面量每次求值会创建新对象（`/a/g.test(x)` 每次新建），而提到外部的 `const re = /a/g` 是共享一个有状态对象——**坑的根源是「复用」**。

## 实战延伸

**1. 校验三连（注意都带 ^ $ 与 u 标志的习惯）**：

```js
const isCNPhone = (v) => /^1[3-9]\d{9}$/.test(v);
const isEmail = (v) => /^[\w.+-]+@[\w-]+\.[\w.]+$/.test(v);
const hasEmoji = (v) => /\p{Extended_Pictographic}/u.test(v);
```

**2. 模板变量替换**（标签模板《es6-003》的正则近亲）：

```js
'你好{name}，已成长{level}级'.replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? '');
```

**3. 面试答题骨架**：「字符串不可变，slice 支持负索引、substring 参数换序负数归零；replace 第二参支持 $1 反向引用与函数动态替换，全替换用 g 或 replaceAll；正则元字符按字符类、量词、边界、分组记忆，贪婪加 ? 变懒惰；test/match/exec 的关键差异是带 g 的 lastIndex 状态推进——复用同一个 g 正则对象会「时真时假」，规避方式是每次新建或用完重置。」

## 图解总结

```
字符串切片: slice(负数ok) | substring(换序/负归0) | substr(按长度, 遗留)
替换: replace(默认只第一处) | g 全局 | $1/$2 分组引用 | 函数动态替换 | replaceAll
正则: [\d\w\s . []] 字符类 + [* + ? {n,m}] 量词 + [^ $ \b] 边界 + [() (?:) (?<>)] 分组
标志: g(全局+lastIndex⚠️) i m s u(emoji必开) y
匹配: test→布尔 | match(无g:首匹配+分组 / 有g:全部匹配丢分组) | exec(带g循环推进)
```

## 总结

- 字符串不可变：一切方法返回新串；slice 支持负索引；
- replace 默认只替换第一个，全局靠 g 或 replaceAll；$1 反向引用与函数替换是动态文本的两大武器；
- 正则四类语法（字符类/量词/边界/分组）+ 六个标志位；贪婪加 ? 转懒惰是 HTML 提取的关键；
- test/match/exec 的核心差异在 g 标志下的 lastIndex 有状态推进——复用正则对象必踩坑；
- 命名分组与断言是现代正则的可读性升级。

**面试一句话回答**：字符串不可变，所有方法返回新值，slice 支持负索引而 substring 会自动换序并把负数归零；replace 默认只替换第一个匹配，全局替换需要 g 标志或 replaceAll，替换串支持 $1 等分组引用、第二参数还可以是接收匹配与分组的函数；正则由字符类、量词、边界与分组构成，量词默认贪婪、加问号转懒惰匹配；test 返回布尔、match 无 g 返回首个匹配与分组、有 g 返回全部匹配但丢分组、exec 搭配 g 通过 lastIndex 分批推进——而 lastIndex 正是复用同一个 g 正则对象导致 test 时真时假的原因，规避方法是每次新建正则或用后重置 lastIndex。

## 思考题

1. 写出输出：`'a1b22c333'.match(/\d+/g)`、`'a1b22'.replace(/(\w)(\d+)/g, '$2$1')`。
2. 为什么 `t = /a/g; t.test('a'); t.test('a')` 第二次是 false？用 lastIndex 的推进轨迹画出两次调用间的状态。
3. 手写 `parseQuery('?a=1&b=2&c=3')` → `{a:'1',b:'2',c:'3'}`——用 exec 循环与 replace 两种实现。
4. 开放设计：实现 `highlight(text, keyword)`：把 text 中所有 keyword（不区分大小写）包上 `<mark>`——注意 keyword 是用户输入时如何防正则注入（提示：转义元字符）。

（思考题解析将同步录入小程序题库，关联本文 id：js-core-008）

## 参考文献：

- MDN — [正则表达式](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Regular_expressions)
- 《JavaScript 正则表达式迷你书》（老姚）—— 入门到进阶的经典中文资料
- ECMAScript 规范 — RegExp Built-in Methods（lastIndex 语义原文）

---
id: js-core-006
title: JavaScript 核心之数组 API 全解
series: JavaScript 核心系列
seriesId: js-core
stage: foundation
difficulty: 2
tags: [数组方法, 遍历, map, reduce, 可变性]
readingTime: 18
prev: js-core-005
next: js-core-007
createdAt: 2026-10-26
---

# JavaScript 核心之数组 API 全解

## 从一段「找了半小时的 bug」说起

```js
const list = [3, 1, 2];
const sorted = list.sort();              // 「我以为」拿到新数组
console.log(list);                       // [1, 2, 3] —— 原数组被改了！
// 后续所有依赖 list 顺序的逻辑全部错乱……

const backup = list.slice(0, 3);         // slice 拷贝的是「第一层」
backup[0].name = 'x';                    // 嵌套对象还是共享的……
```

数组 API 的第一课不是「有哪些方法」，而是**每个方法改不改原数组、拷贝拷几层**。⭐ 本文把 P1 阶段必会的 20+ 个方法按「可变性 × 功能」组织成地图（进阶方法与 ES6+ 新增见《es6-005》）。

## 现象与直觉解释

先立总纲（可变性地图的详细版在《es6-005》——本文是它的前置阅读，覆盖基础全集）：

```
会改原数组（9 个）── push pop shift unshift splice sort reverse fill copyWithin
返回新结果 ──────── slice concat map filter join/find/reduce 等其余全部
```

## 深入原理

### 一、增删首尾四件套 ⭐

```js
const arr = ['b', 'c'];
arr.push('d');        // 尾加：返回【新长度】4
arr.pop();            // 尾删：返回【被删元素】'd'
arr.unshift('a');     // 头加：返回新长度
arr.shift();          // 头删：返回被删元素
// ⚠️ 返回值各不相同——「返回什么」和「干什么」一样重要
// ⚠️ unshift/shift 是 O(n)（整体搬移），push/pop 是 O(1)——大量头部操作考虑队列结构
```

### 二、splice：万能但危险的手术刀 ⭐⭐

```js
const a = [1, 2, 3, 4, 5];

a.splice(2);          // 从下标 2 删到尾：返回 [3,4,5]，a 变 [1,2]
a.splice(1, 2);       // 下标 1 起，删 2 个：返回被删段
a.splice(1, 0, 'x');  // 删 0 个 + 插入 'x'（插入操作）
a.splice(1, 1, 'y');  // 替换：删 1 插 1
// 签名：splice(start, deleteCount, ...items) —— 全部原地修改，返回被删数组
```

splice vs slice 速记：**splice 有 p（劈开动刀，改原数组）；slice 是切片（只读拷贝）**。

### 三、查找与判断 ⭐

```js
const users = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }];

users.find((u) => u.id === 2);       // 元素本身 | 没找到 undefined
users.findIndex((u) => u.id === 2);  // 下标 1   | 没找到 -1
users.includes('不存在');             // false（含 NaN 判定，SameValueZero）
users.indexOf('x');                  // -1（严格相等，认不出 NaN）
users.some((u) => u.vip);            // 任一满足 → true（存在性判断）
users.every((u) => u.active);        // 全部满足 → true（不变式校验）
```

**find vs filter**：find 返回**第一个满足的元素**（没有返回 undefined），filter 返回**所有满足的数组**——「找一个」用 find、「找一批」用 filter。

### 四、遍历与转换三巨头：forEach / map / reduce ⭐⭐

```js
// forEach：纯遍历（没有 break！），返回 undefined
[1, 2].forEach((v, i, arr) => { /* v 值, i 下标, arr 原数组 */ });
// ⚠️ 中途退出：some/every/find 可以「带条件停」，forEach 只能抛异常——需要中断换 for...of

// map：一一映射，返回等长新数组（不可变更新的主力）
[1, 2, 3].map((v) => v * 2);          // [2, 4, 6]

// reduce：把数组「卷」成一个值 —— (累计值, 当前值) => 新累计值
[1, 2, 3].reduce((sum, v) => sum + v, 0);   // 6（0 是初始值——永远显式给！）
[1, 2, 3].reduce((max, v) => (v > max ? v : max), -Infinity); // 求最大值
const byId = users.reduce((acc, u) => { acc[u.id] = u; return acc; }, {}); // 转对象字典
[[1, 2], [3]].reduce((flat, part) => flat.concat(part), []);   // 拍平
```

**reduce 的两个工程红线**：① 忘写初始值——空数组直接抛 TypeError，且语义从「第二个元素起步」错位；② 回调里忘 return——累计值变 undefined（箭头函数体加了 `{}` 就必须 return）。

### 五、拷贝与合并 ⭐

```js
[1, 2].slice();            // 浅拷贝（[start, end) 左闭右开）
[1, 2].concat([3], 4);     // 合并新数组（参数里的数组会展开一层）
[...arr1, ...arr2];        // ES6 展开合并（现代首选）
Array.from(arrayLike);     // 类数组/可迭代 → 真数组（es6-005）

// ⚠️ 全部是【浅拷贝】：嵌套对象仍共享引用
const nested = [{ a: 1 }];
const copy = nested.slice();
copy[0].a = 2;
console.log(nested[0].a);  // 2 ❗（深拷贝见 handwritten-003）
```

### 六、排序 sort：三件必须知道的事 ⭐⭐

```js
// 1. 默认按【字符串】排！
[10, 1, 5].sort();            // [1, 10, 5] —— '10' < '5' 字典序
[10, 1, 5].sort((a, b) => a - b);  // [1, 5, 10] ✅ 数字升序（降序 b - a）

// 2. 原地排序！
const arr = [3, 1];
arr.sort();                   // arr 变了；想不改原数组：[...arr].sort() 或 toSorted()（ES2023）

// 3. 比较函数的返回值语义
//   负数：a 排前；正数：b 排前；0：保持（现代引擎稳定排序保证相等元素相对次序不变）

// 对象数组排序
users.sort((a, b) => a.age - b.age);              // 数字字段
items.sort((a, b) => a.name.localeCompare(b.name)); // 中文字段（按拼音）
```

## 回看开篇

sort 的「我以为」：它是原地方法，安全姿势是 `[...list].sort()`（或 ES2023 的 `toSorted()`）；slice 的「浅」：第一层拷贝、嵌套层共享——**读任何数组方法文档，先看两件事：改不改原数组、返回什么**。

## 实战延伸

**1. 面试高频组合技**：

```js
// 取成绩前 3 名的名字
scores.map((s) => ({ name: s.name, score: s.score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((s) => s.name);

// 按字段分组（reduce 的经典应用）
function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    (acc[item[key]] ||= []).push(item);
    return acc;
  }, {});
}
```

**2. for / for...of / forEach / map 选型**：需要中断或异步 await → for...of；纯遍历副作用 → forEach；产出新数组 → map；聚合 → reduce；索引参与计算 → 经典 for。

**3. 手写 map/reduce/filter** 是手写题富矿：核心是「回调 + thisArg + 跳过空位」三细节（《handwritten-006》思考题 3 同款思路）。

## 图解总结

```
                 ┌ 会改原数组 ─────────────────────────────┐
                 │ push pop shift unshift | splice | sort  │
                 │ reverse | fill copyWithin               │
数组方法 ────────┤
                 │ 读取: find findIndex indexOf includes some every
                 │ 新数组: slice concat map filter / toSorted(ES2023)
                 │ 聚合: reduce join / 遍历: forEach for...of
                 └ 拷贝一律浅；sort 默认字典序且原地 ────────┘
```

## 总结

- 可变性是第一属性：9 个原地方法，其余返回新结果；
- 增删四件套返回值各异（新长度 vs 被删元素）；splice 原地万能手术刀；
- find 找第一个元素、filter 找全部、some/every 判定存在性与不变式；
- reduce 两红线：显式初始值、回调必须 return；
- sort 三件事：默认字符串序、原地修改、比较函数返回值语义——安全姿势 `[...arr].sort(cmp)`。

**面试一句话回答**：数组方法按可变性分两类——push、pop、shift、unshift、splice、sort、reverse、fill、copyWithin 会原地修改数组，slice、concat、map、filter 等返回新结果；增删四件套的返回值分别是新长度或被删元素；splice 以起始下标、删除个数与插入项完成增删改且返回被删数组；find 返回首个满足条件的元素而 filter 返回全部；reduce 必须显式给初始值且回调必须返回累计值；sort 默认按字符串字典序排序并原地修改，数字排序要用 a-b 的比较函数——所有拷贝方法都是浅拷贝，嵌套引用仍然共享。

## 思考题

1. 写出输出：`[1,2,3,4,5].splice(1, 2)` 与 splice 后的数组各是什么？`['10','9','100'].sort()` 呢？
2. 手写 `myMap(arr, fn)`：注意返回新数组、不改动原数组；对照原生 map 还缺什么（thisArg、空位跳过）？
3. `forEach` 里 `return false` 能中断吗？说明三种「可中断」的替代方案及各自的语义。
4. 开放设计：实现 `move(arr, from, to)`（把元素从 from 移到 to，返回新数组不改原数组）——用 splice 拷贝版与 filter/reduce 版各写一版，对比可读性。

（思考题解析将同步录入小程序题库，关联本文 id：js-core-006）

## 参考文献：

- MDN — Array 各方法条目（含可变性与返回值标注）
- 《JavaScript 高级程序设计（第 4 版）》第 6 章
- 本课程《es6-005 数组与对象的新方法》（进阶篇）、《handwritten-003 深拷贝》

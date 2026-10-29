---
id: es6-007
title: ES6+ 之 Set 与 Map
series: ES6+ 系列
seriesId: es6
stage: intermediate
difficulty: 3
tags: [Set, Map, WeakSet, WeakMap, 去重, 哈希结构]
readingTime: 18
prev: es6-006
next: es6-008
createdAt: 2026-10-26
---

# ES6+ 之 Set 与 Map

## 从两段「别扭的 Object 依赖症」代码说起

```js
// 需求一：数组去重 —— filter + indexOf，O(n²)
const uniq = arr.filter((v, i) => arr.indexOf(v) === i);

// 需求二：给 DOM 节点挂元数据（节点移除后内存不释放）
const metadata = {};
element.id = generateId(); // 先给 DOM 强行造个 id！
metadata[element.id] = { clicks: 0, hoverAt: null }; // 节点删了，数据还活着
```

两个需求的正解各是一个 ES6 结构：**Set**（值的唯一集合）与 **WeakMap**（键为对象、键可被回收的映射）。⭐ 「Map 与 Object 的区别」「WeakMap 的应用」是高频考点，且直接关联 GC（《v8-005》）与框架实现（Vue3 响应式用 WeakMap 存依赖）。

## 现象与直觉解释

- **Set**：一堆**不重复的值**（可存任意类型）——判断「在不在」O(1)，天然去重；
- **Map**：键值对集合，**键可以是任意类型**（Object 的键只能是字符串/symbol）——且保持插入顺序、可直接遍历；
- **WeakSet/WeakMap**：弱引用版——**键只能是对象**，且「不阻止键被垃圾回收」。

## 深入原理

### 一、Set：唯一值集合的完整用法 ⭐

```js
const s = new Set([1, 2, 2, '2']);  // {1, 2, '2'} —— 2 与 '2' 不同（SameValueZero）
s.add(3).add(3);                     // 链式，重复添加无效
s.has(2);                            // true，O(1)
s.delete(2);                         // true
s.size;                              // 3

// 去重全家桶
[...new Set([1, 1, 2])];             // [1, 2]（数组）
Array.from(new Set('aabbc'));        // ['a','b','c']（字符串）

// 集合运算（面试常考）
const union = (a, b) => new Set([...a, ...b]);            // 并
const intersect = (a, b) => new Set([...a].filter((x) => b.has(x))); // 交
const diff = (a, b) => new Set([...a].filter((x) => !b.has(x)));     // 差
// ES2025 起原生支持：a.union(b) / a.intersection(b) / a.difference(b)

// 遍历：插入序
for (const v of new Set(['a', 'b'])) console.log(v);
```

相等判定是 **SameValueZero**（与 includes 一致）：`NaN` 等于 `NaN` ✅、`2 !== '2'`、对象永远只和自己相等（引用比较）。

### 二、Map：修正了 Object 的四个短板 ⭐⭐

| 能力 | Object | Map |
|---|---|---|
| 键的类型 | string / symbol | **任意**（对象、函数、NaN 都行） |
| 键的顺序 | 复杂规则（整数键优先排序） | **纯插入序** |
| 直接遍历 | 不行（要 entries） | **可迭代**（for...of 拿 [k, v]） |
| size | 手动算 | **O(1) 属性** |
| 原型链污染 | `'toString' in {}` → true ⚠️ | 无此问题 |

```js
const m = new Map();
const domNode = document.createElement('div');

m.set(domNode, { clicks: 0 });   // 对象作键！
m.set(1, 'number key');          // 非字符串原始值作键！
m.set(NaN, 'nan');               // NaN 作键（SameValueZero 认自己）

m.get(domNode);                  // { clicks: 0 }
m.has(1);                        // true
m.size;                          // 3
for (const [k, v] of m) {}       // 直接遍历（插入序）
new Map([['a', 1], ['b', 2]]);   // 二维数组初始化 / Object.entries(obj) 直接转 Map

// Object 的隐患示例：
const config = {};
config['toString'] = 'oops';     // 覆盖原型方法，`config + ''` 行为异常
const safe = new Map(); safe.set('toString', 'oops'); // Map 里它只是个普通键 ✅
```

**选型判据**：数据是「**字典/映射**」语义（动态键、非字符串键、频繁增删、需要遍历顺序）→ Map；是「**记录/结构**」语义（固定字段、要 JSON 序列化、解构访问）→ Object。JSON 只认 Object——需要序列化时 Map 还得转换。

### 三、WeakMap / WeakSet：弱引用与 GC 的约定 ⭐⭐

「弱引用」的含义：**WeakMap 的键不增加该对象的引用计数——除 WeakMap 外无人引用它时，GC 可以回收它，对应条目自动消失**（回顾《v8-005》可达性：GC 从根出发找引用链，弱引用不在链上）。

```js
const wm = new WeakMap();
let node = document.querySelector('#btn');
wm.set(node, { handler, data: bigArray });

node.remove();
node = null;             // 外界最后一个强引用解除
// —— GC 下次运行：node 对象被回收，wm 里那条 entry 随之蒸发（键没了值也没了）
// 没有 size、不能遍历、不能 clear（因为「哪些键还活着」只有 GC 知道）
```

**开篇需求二的根治**：DOM 元数据用 WeakMap 存——节点从文档移除且解引用后，元数据自动释放，零泄漏。

**工业级应用**（面试的高分素材）：

```js
// ① 数据缓存（对象死了缓存自动清）
const cache = new WeakMap();
function process(obj) {
  if (!cache.has(obj)) cache.set(obj, expensive(obj));
  return cache.get(obj);
}

// ② 私有数据（类库的经典模式）
const privates = new WeakMap();
class Timer {
  constructor() { privates.set(this, { id: null }); } // 外部拿不到（也无法枚举）
  start() { privates.get(this).id = setInterval(...); }
}

// ③ 框架的依赖收集（Vue3 响应式的真实结构雏形）
const targetMap = new WeakMap(); // target → depsMap；组件/对象销毁后依赖自动释放
// ④ 防抖节流存 timer（handwritten-005 的另一种实现）
```

WeakSet 同理（只能放对象、弱引用）——常见用途：标记「已处理过」的对象（`processed.add(item)`，item 被回收标记自动消失）。

## 回看开篇

需求一：`[...new Set(arr)]`，O(n) 且一行；需求二：`weakMap.set(node, metadata)`——「键的生死跟随对象本身」，这正是弱引用结构存在的意义：**让缓存/元数据的生命周期自动对齐数据的生命周期**。

## 实战延伸

**1. 面试答题骨架**：「Set 是 SameValueZero 判定的唯一值集合，has/add O(1)，天然去重与集合运算；Map 与 Object 的区别在键类型任意、插入序、可迭代、size 与无原型污染，字典语义选 Map、记录语义选 Object；WeakMap 键只能是对象且为弱引用，不影响 GC 回收，条目随键对象死亡自动消失，因此没有 size 与遍历，典型应用是 DOM 元数据、私有数据、对象级缓存与框架依赖收集。」

**2. 快手题**：

```js
const m = new Map();
m.set('a', 1).set('a', 2);  // 后值覆盖
const w = new WeakMap();
const key = {};
w.set(key, 'v');
console.log(w.get(key), w.size); // 'v' undefined —— WeakMap 没有 size
```

## 图解总结

```
Set      { 值 → 值 }        唯一性（SameValueZero）/ 去重 / 集合运算
Map      { 任意键 → 值 }    插入序 / 可迭代 / 无原型链
WeakMap  { 对象键 → 值 }    弱引用：键可被 GC ⇒ 条目自动蒸发
                          （无 size/遍历 —— 「谁活着」只有 GC 知道）

选型：字典 → Map ；记录 + JSON → Object ；生命周期跟随对象 → WeakMap
```

## 总结

- Set：SameValueZero 唯一值集合，去重 O(n)、has O(1)、并交差集合运算；
- Map 修正 Object 四短板：任意类型键、插入序、可迭代、size，且无原型键污染；字典选 Map、记录选 Object（JSON 只认 Object）；
- WeakMap/WeakSet：键仅限对象、弱引用不阻止 GC，条目随键消亡自动清理——DOM 元数据、私有数据、对象缓存、依赖收集的标准解；
- 弱引用结构的限制（无 size、不可遍历）正是其语义的自然结果。

**面试一句话回答**：Set 是基于 SameValueZero 的唯一值集合，提供 O(1) 的成员判断，是去重与集合运算的首选；Map 相比 Object 支持任意类型的键、保持插入顺序、可直接迭代、有 size 属性且不受原型链污染，适合字典语义而 Object 适合记录与序列化；WeakMap 的键只能是对象且是弱引用，不阻止键被垃圾回收，键对象死亡时条目自动消失，因此没有 size 也不能遍历，典型应用包括给 DOM 挂随节点生灭的元数据、实现类的私有数据、对象级缓存以及 Vue3 依赖收集中 target 到依赖的映射。

## 思考题

1. `new Set([{a:1}]).has({a:1})` 是 true 还是 false？对象「相等」的判定规则是什么？如果需要按内容判重的对象集合怎么做？
2. 为什么 WeakMap 故意不提供 size、keys、遍历？从「GC 何时运行不确定」的角度解释这个设计。
3. 用 Map 实现带容量上限的 LRU（提示：Map 的删除重插可刷新顺序——完整版见《handwritten-012》）。
4. 开放设计：编辑器的「画布对象 → 选中状态」映射应该用什么结构？从「对象删除后状态如何清理」「是否需要遍历全部选中项」两个需求矛盾处分析取舍。

（思考题解析将同步录入小程序题库，关联本文 id：es6-007）

## 参考文献：

- ECMA-262 现行版 — Set/Map 的规格（SameValueZero、插入序迭代）
- MDN — [Set](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Set)、[WeakMap](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/WeakMap)
- Vue3 设计与实现 — 第 4 章（WeakMap 存依赖的工业案例）

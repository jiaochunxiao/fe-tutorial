---
id: algorithm-008
title: 前端算法之手写题算法化
series: 算法与数据结构·前端向系列
seriesId: algorithm
stage: expert
difficulty: 4
tags: [手写题, 算法题, LRU, 并发调度, 拍平, 全排列]
readingTime: 20
prev: algorithm-007
next: algorithm-009
createdAt: 2026-10-26
---

# 前端算法之手写题算法化

## 「手写题」与「算法题」的边界正在消失

```
近两年的面试真题画风:
  "实现批量请求调度器（最大并发 3，尽快返回结果）"   —— 算法题穿手写题的衣服
  "实现带过期时间的 LRU"                            —— 数据结构设计题
  "深拷贝带环检测"                                  —— 图遍历
⭐ 现代手写题 = 「数据结构 × 异步编程 × 边界处理」的三合一
```

⭐⭐⭐ 本篇把课程两大线索（handwritten 系列 × algorithm 系列）焊接起来：**用手写题的皮，考算法的骨**——四道标杆题逐一下钻。

## 深入原理：四道标杆题

### 题①：数组拍平 flatDeep（树/图的 DFS）⭐⭐⭐

```js
// reduce + 递归（思维版）
function flattenDeep(arr, depth = Infinity) {
  return arr.reduce((acc, x) =>
    acc.concat(Array.isArray(x) && depth > 0 ? flattenDeep(x, depth - 1) : x), []);
}
flattenDeep([1, [2, [3, [4]]]]);          // [1,2,3,4]
flattenDeep([1, [2, [3]]], 1);            // [1,2,[3]] —— depth 版 ⭐

// ⭐ 算法化考点: 「不递归版」（防爆栈 —— 深嵌套场景）
function flattenIterative(arr) {
  const stack = [...arr];                  // 显式栈模拟 DFS（algorithm-006 的迭代版）
  const result = [];
  while (stack.length) {
    const next = stack.pop();
    Array.isArray(next) ? stack.push(...next) : result.push(next);
  }
  return result.reverse();                 // 栈的倒序修正 ⭐
}
// 追问链: 万层嵌套爆栈? → 迭代版 │ 要保持空洞? │ 生成器惰性版(yield*)?
```

### 题②：带 TTL 的 LRU（哈希+双向链表的复合）⭐⭐⭐

```js
// 在 handwritten-012 的 LRU 上加「过期」= 考「复合约束的组合能力」:
class TTLRU {
  #map = new Map(); #cap; #ttl;
  constructor(cap = 100, ttl = 60_000) { this.#cap = cap; this.#ttl = ttl; }

  get(key) {
    if (!this.#map.has(key)) return -1;
    const { value, born } = this.#map.get(key);
    if (Date.now() - born > this.#ttl) {   // 惰性过期 ⭐（取时才查——不做后台定时）
      this.#map.delete(key);
      return -1;
    }
    this.#map.delete(key);                 // Map 版刷新顺序（es6-007 的有序性）
    this.#map.set(key, { value, born });
    return value;
  }

  put(key, value) {
    if (this.#map.has(key)) this.#map.delete(key);
    else if (this.#map.size >= this.#cap) {
      const oldest = this.#map.keys().next().value;
      this.#map.delete(oldest);            // 淘汰最旧
    }
    this.#map.set(key, { value, born: Date.now() });
  }
}
// ⭐ 评分点: 惰性过期 vs 定时清扫的取舍(成本/实时性) │ 容量与过期双约束的先后
```

### 题③：批量请求调度器（异步 × 调度）⭐⭐⭐

```js
// 实现: schedule(tasks, limit) —— 最大并发 limit，尽快返回全部结果
async function schedule(tasks, limit) {
  const results = new Array(tasks.length);
  let next = 0;

  async function worker() {
    while (next < tasks.length) {
      const i = next++;                       // 单线程认领无竞态 ⭐
      results[i] = await tasks[i]();          // 按下标归还（顺序稳定）
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}
// 与 js-async-004 同源; 算法化的追问升级:
//  Q: 任务有优先级? → 小顶堆代替 next++ ⭐（下一个取"最高优先且未完成"）
//  Q: 某任务失败要重试 3 次? → worker 内 for 循环 + 退避（js-async-008）
//  Q: 可取消? → AbortSignal + 认领表
// 「调度器家族 = 数据结构选择 × 异步原语」的排列组合 ⭐
```

### 题④：无重复全排列（回溯）⭐⭐

```js
// "手写一个 shuffle/排列" 常考的回溯内核:
function permute(nums) {
  const ans = [], path = [], used = new Array(nums.length).fill(false);
  (function dfs() {
    if (path.length === nums.length) { ans.push([...path]); return; }  // 收集副本⭐
    for (let i = 0; i < nums.length; i++) {
      if (used[i]) continue;
      used[i] = true; path.push(nums[i]);   // 选择
      dfs();
      used[i] = false; path.pop();          // 撤销 ⭐（回溯三连）
    }
  })();
  return ans;
}
// 前端化身: 权限组合枚举 │ A/B 测试的全排列生成 │ SKU 规格笛卡尔积(队列法)
// 笛卡尔积: [[a,b],[1,2],[x,y]] → 每维取一的组合 —— reduce 实现 5 行 ⭐
```

### 手写题的「算法化评分表」⭐⭐

```
初级(能跑):        功能正确、基础边界(null/空/重复)
中级(结构意识):    说出所用的数据结构及其复杂度、能否替换优化
高级(边界与组合):  爆栈/竞态/过期/取消等复合约束、惰性与批量等取舍陈述
—— 面试官的隐藏评分维度: 你把题当"API 背写"还是"结构设计" ⭐
```

## 回看开篇

「边界消失」的证据：拍平考 DFS 的两副面孔（递归/迭代）、LRU+TTL 考复合约束、调度器考异步×数据结构、排列考回溯——**现代手写题的满分答案 = 数据结构选型 + 复杂度陈述 + 边界取舍**，三样正是 algorithm 系列的全部内容。

## 实战延伸

**1. 面试答题骨架**：「现代手写题考的是数据结构与异步编程的组合能力——拍平类题目递归版之外要能给出显式栈的迭代版应对深嵌套爆栈；LRU 加过期是复合约束设计，用 Map 的插入序实现刷新与淘汰，过期采用惰性检查并说明与定时清扫的取舍；批量调度器用共享游标加固定 worker 实现最大并发与顺序稳定的结果归位，追问升级到优先级堆、重试退避与取消信号；排列组合类考察回溯的选择与撤销三连以及结果副本收集。答题时主动陈述数据结构选型、复杂度与边界取舍，是区分结构设计能力的关键。」

## 图解总结

```
手写题的算法骨架:
 拍平 deepFlatten   = DFS（递归版 + 显式栈版防爆栈 ⭐）
 TTL-LRU           = 有序Map/哈希+链表 + 惰性过期(取舍陈述)
 批量调度器         = worker池×共享游标 → 升级: 堆(优先级)/重试/取消
 全排列/笛卡尔积    = 回溯(选择→递→退) / reduce 组合

评分三档: 能跑 → 结构意识(选型+复杂度) → 组合边界(爆栈/竞态/过期/取消)
隐藏维度: 你在"背API"还是在"做结构设计" ⭐
```

## 总结

- 拍平：递归与显式栈两版，深嵌套防爆栈是考点；
- TTL-LRU：复合约束；惰性过期与定时清扫的取舍要能陈述；
- 调度器：worker×游标为地基，优先级/重试/取消是升级方向；
- 排列组合：回溯三连与 SKU 笛卡尔积的 reduce 实现；
- 评分的隐藏维度：结构设计意识而非 API 背写。

**面试一句话回答**：现代前端手写题已经算法化——考的是数据结构与异步编程的组合设计能力。数组深度拍平要能写出递归与显式栈两个版本，用迭代防止万层嵌套爆栈；带过期时间的 LRU 在有序 Map 或哈希配双向链表之上叠加时间约束，采用取值时惰性过期并说明与定时清扫的成本取舍；批量请求调度器用固定数量的 worker 配共享游标实现最大并发与结果按下标归位，进一步可升级为优先级堆、指数退避重试与取消信号；全排列考察回溯的选择、递归、撤销三连与结果副本收集，SKU 规格组合则可用 reduce 求笛卡尔积。答题时应主动陈述数据结构选型、时间空间复杂度与各种边界的取舍，这比功能正确更能体现结构设计能力。

## 思考题

1. 给 flattenIterative 补 `depth` 参数（迭代版限制深度——栈元素带层级信息）。
2. TTL-LRU 的「定时清扫」版：setInterval 扫描的频率与量怎么定？（分桶到期：按 born 取整分桶 O(1) 找过期 ⭐）
3. 调度器加「优先级」：任务带 priority 字段，worker 取最高优先——用数组排序还是堆？复杂度对比。
4. 开放实战：实现「SKU 规格笛卡尔积」`combine([['红','蓝'],['S','M'],…])`——reduce 与递归两版，处理空数组边界。

（思考题解析将同步录入小程序题库，关联本文 id：algorithm-008）

## 参考文献：

- 本课程《handwritten-003 深拷贝》《handwritten-012 LRU》《js-async-004 并发控制》（三道母题）
- LeetCode 46（全排列）/ 146（LRU）
- 《算法（第 4 版）》栈与队列的迭代遍历

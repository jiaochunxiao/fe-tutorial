---
id: algorithm-007
title: 前端算法之动态规划入门
series: 算法与数据结构·前端向系列
seriesId: algorithm
stage: expert
difficulty: 4
tags: [动态规划, DP, 爬楼梯, 背包, 记忆化搜索]
readingTime: 20
prev: algorithm-006
next: algorithm-008
createdAt: 2026-10-26
---

# 前端算法之动态规划入门

## 从「斐波那契的 2ⁿ 到 n」说起

```js
// 三个版本的斐波那契（algorithm-001 埋的坑来填了）:
function fib(n) { return n < 2 ? n : fib(n - 1) + fib(n - 2); }
// ① 朴素递归: O(2ⁿ) —— fib(50) 跑不完（重复计算 fib(30) 上百万次 ⚠️）

const memo = new Map();
function fib(n) {
  if (n < 2) return n;
  if (memo.has(n)) return memo.get(n);            // 查表 ⭐
  const v = fib(n - 1) + fib(n - 2);
  memo.set(n, v);                                  // 存表
  return v;
}
// ② 记忆化搜索: O(n) —— "重复的子问题只算一次"

function fib(n) {
  const dp = [0, 1];
  for (let i = 2; i <= n; i++) dp[i] = dp[i - 1] + dp[i - 2];
  return dp[n];
}
// ③ 递推 DP: O(n) 空间 O(n) → 再压两个变量 O(1)
```

⭐⭐⭐ DP 的第一性原理：**把重复子问题的答案存起来，用空间换时间**——从「自顶向下的递归+记忆」到「自底向上的递推」是同一思想的两种视角。

## 现象与直觉解释

DP 能用的两个前提（判定式）⭐：

```
① 重叠子问题: 大问题拆出的小问题会重复出现（fib(5) 要算两次 fib(3)）
② 最优子结构: 大问题的最优解由子问题的最优解组装（最短路径的段最优）

与分治（归并/快排）的区别: 分治的子问题【不重叠】; DP 的子问题【重复】
与贪心的区别: 贪心每步做【局部最优不再回头】; DP【枚举所有选择取最优】
```

**五步设计法**（解一切 DP 题的框架）⭐⭐⭐：

```
① 定义状态: dp[i] 表示什么（最关键的一步!）
② 转移方程: dp[i] 怎么由更小的 dp 推出
③ 初始化: dp[0]/dp[1] 是什么
④ 遍历顺序: 保证算 dp[i] 时依赖已就绪
⑤ 答案在哪: dp[n] 还是 max(dp) 还是 dp 里所有之和
```

## 深入原理：三道入门题走完五步法

### 题①：爬楼梯（LC 70）——DP 的「Hello World」

```js
// 每次爬 1 或 2 阶，问 n 阶有几种爬法
// ① 状态: dp[i] = 爬到第 i 阶的方法数
// ② 转移: 最后一步要么从 i-1 迈1步，要么从 i-2 迈2步
//         dp[i] = dp[i-1] + dp[i-2]   （和 fib 同型! ⭐）
// ③ 初始: dp[0]=1, dp[1]=1
// ④⑤ 顺序自小到大，答案 dp[n]
function climbStairs(n) {
  let a = 1, b = 1;
  for (let i = 2; i <= n; i++) [a, b] = [b, a + b];
  return b;
}
// ⭐ 心法: "最后一步"分析法 —— 盯住【到达终点的最后一步】从哪来
```

<figure style="margin:2.2em 0">
<svg viewBox="0 0 720 260" width="100%" role="img" aria-label="爬楼梯 DP 表逐格填充">
  <defs>
    <marker id="dp7-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#B03A2E"/>
    </marker>
  </defs>
  <text x="30" y="34" font-family="Noto Sans SC,sans-serif" font-size="13" font-weight="700" fill="#1C1A17">dp[i] = dp[i-1] + dp[i-2]，初始 dp[0] = dp[1] = 1 —— 表格从左到右逐格点亮：</text>
  <g>
    <rect x="40" y="60" width="64" height="56" rx="6" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.5" opacity="0">
      <animate attributeName="opacity" from="0" to="1" begin="0.2s" dur="0.35s" fill="freeze"/>
    </rect>
    <text x="72" y="96" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="15" fill="#1C1A17" opacity="0">1<animate attributeName="opacity" from="0" to="1" begin="0.2s" dur="0.35s" fill="freeze"/></text>
    <rect x="112" y="60" width="64" height="56" rx="6" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.5" opacity="0">
      <animate attributeName="opacity" from="0" to="1" begin="0.6s" dur="0.35s" fill="freeze"/>
    </rect>
    <text x="144" y="96" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="15" fill="#1C1A17" opacity="0">1<animate attributeName="opacity" from="0" to="1" begin="0.6s" dur="0.35s" fill="freeze"/></text>
    <rect x="184" y="60" width="64" height="56" rx="6" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.5" opacity="0">
      <animate attributeName="opacity" from="0" to="1" begin="1s" dur="0.35s" fill="freeze"/>
    </rect>
    <text x="216" y="96" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="15" fill="#1C1A17" opacity="0">2<animate attributeName="opacity" from="0" to="1" begin="1s" dur="0.35s" fill="freeze"/></text>
    <rect x="256" y="60" width="64" height="56" rx="6" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.5" opacity="0">
      <animate attributeName="opacity" from="0" to="1" begin="1.4s" dur="0.35s" fill="freeze"/>
    </rect>
    <text x="288" y="96" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="15" fill="#1C1A17" opacity="0">3<animate attributeName="opacity" from="0" to="1" begin="1.4s" dur="0.35s" fill="freeze"/></text>
    <rect x="328" y="60" width="64" height="56" rx="6" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.5" opacity="0">
      <animate attributeName="opacity" from="0" to="1" begin="1.8s" dur="0.35s" fill="freeze"/>
    </rect>
    <text x="360" y="96" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="15" fill="#1C1A17" opacity="0">5<animate attributeName="opacity" from="0" to="1" begin="1.8s" dur="0.35s" fill="freeze"/></text>
    <rect x="400" y="60" width="64" height="56" rx="6" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.5" opacity="0">
      <animate attributeName="opacity" from="0" to="1" begin="2.2s" dur="0.35s" fill="freeze"/>
    </rect>
    <text x="432" y="96" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="15" fill="#1C1A17" opacity="0">8<animate attributeName="opacity" from="0" to="1" begin="2.2s" dur="0.35s" fill="freeze"/></text>
    <rect x="472" y="60" width="64" height="56" rx="6" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.5" opacity="0">
      <animate attributeName="opacity" from="0" to="1" begin="2.6s" dur="0.35s" fill="freeze"/>
    </rect>
    <text x="504" y="96" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="15" fill="#1C1A17" opacity="0">13<animate attributeName="opacity" from="0" to="1" begin="2.6s" dur="0.35s" fill="freeze"/></text>
    <rect x="544" y="60" width="64" height="56" rx="6" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.5" opacity="0">
      <animate attributeName="opacity" from="0" to="1" begin="3s" dur="0.35s" fill="freeze"/>
    </rect>
    <text x="576" y="96" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="15" fill="#1C1A17" opacity="0">21<animate attributeName="opacity" from="0" to="1" begin="3s" dur="0.35s" fill="freeze"/></text>
    <rect x="616" y="60" width="64" height="56" rx="6" fill="#FBF8F1" stroke="#B03A2E" stroke-width="2" opacity="0">
      <animate attributeName="opacity" from="0" to="1" begin="3.4s" dur="0.35s" fill="freeze"/>
    </rect>
    <text x="648" y="96" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="15" font-weight="700" fill="#B03A2E" opacity="0">34<animate attributeName="opacity" from="0" to="1" begin="3.4s" dur="0.35s" fill="freeze"/></text>
  </g>
  <g font-family="JetBrains Mono,monospace" font-size="11" fill="#6E675A">
    <text x="72" y="140" text-anchor="middle">dp[0]</text>
    <text x="144" y="140" text-anchor="middle">dp[1]</text>
    <text x="216" y="140" text-anchor="middle">dp[2]</text>
    <text x="288" y="140" text-anchor="middle">dp[3]</text>
    <text x="360" y="140" text-anchor="middle">dp[4]</text>
    <text x="432" y="140" text-anchor="middle">dp[5]</text>
    <text x="504" y="140" text-anchor="middle">dp[6]</text>
    <text x="576" y="140" text-anchor="middle">dp[7]</text>
    <text x="648" y="140" text-anchor="middle">dp[8]</text>
  </g>
  <path d="M 504 56 C 540 20 600 20 640 52" fill="none" stroke="#B03A2E" stroke-width="1.6" stroke-dasharray="5 4" marker-end="url(#dp7-red)"/>
  <path d="M 576 56 C 596 32 620 28 646 50" fill="none" stroke="#6E675A" stroke-width="1.4" stroke-dasharray="5 4" marker-end="url(#dp7-red)"/>
  <text x="648" y="184" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12.5" font-weight="700" fill="#B03A2E">dp[8] = dp[7] + dp[6] = 34</text>
  <text x="30" y="184" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#6E675A">初始两格直接点亮；</text>
  <text x="30" y="206" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#6E675A">之后每格 = 前两格之和</text>
</svg>
<figcaption style="font-family:'Noto Sans SC',sans-serif;font-size:13px;color:#6E675A;text-align:center;margin-top:10px">图 · DP 表的逐格点亮——红框格就是答案 dp[8]；空间可压成两个滚动变量</figcaption>
</figure>

### 题②：零钱兑换（LC 322）——「选择」型 DP

```js
// coins 数组，凑 amount 的最少硬币数
// ① 状态: dp[i] = 凑出金额 i 的最少硬币数
// ② 转移: 最后一枚硬币是哪枚? 枚举每枚 coin:
//         dp[i] = min(dp[i - coin] + 1)  for 所有 coin ≤ i ⭐
// ③ 初始: dp[0] = 0（凑 0 不用硬币）; 其余 Infinity
// ⑤ 答案: dp[amount]（Infinity → -1 不可凑）
function coinChange(coins, amount) {
  const dp = Array(amount + 1).fill(Infinity);
  dp[0] = 0;
  for (let i = 1; i <= amount; i++) {
    for (const c of coins) {
      if (c <= i && dp[i - c] + 1 < dp[i]) dp[i] = dp[i - c] + 1;
    }
  }
  return dp[amount] === Infinity ? -1 : dp[amount];
}
// 「完全背包」的原型: 外物内容/内容外物——顺序决定组合还是排列 ⭐
```

### 题③：最长上升子序列 LIS（LC 300）——双动线 DP

```js
// ① 状态: dp[i] = 以 nums[i] 结尾的 LIS 长度（⚠️ "以 i 结尾"——定义的精度!）
// ② 转移: dp[i] = max(dp[j] + 1) for j<i 且 nums[j] < nums[i]
// ③ 初始: 全 1（自己就是长度1）
// ⑤ 答案: max(dp) —— 不是 dp[n]!（可能结束在任何位置 ⭐ 经典坑）
function lengthOfLIS(nums) {
  const dp = nums.map(() => 1);
  for (let i = 0; i < nums.length; i++) {
    for (let j = 0; j < i; j++) {
      if (nums[j] < nums[i]) dp[i] = Math.max(dp[i], dp[j] + 1);
    }
  }
  return Math.max(...dp);
}
// O(n²) → 贪心+二分 O(n log n)（进阶，面试提一句即加分）
```

### DP 的高频变体速览（识别信号）⭐⭐

```
线性 DP:     爬梯/打家劫舍/单词拆分          —— "最后一步从哪来"
背包 DP:     0-1背包/完全背包(零钱)/分割      —— "选不选/选几个"
子串子序列:   LIS/最长公共子序列LCS/编辑距离    —— "双指针 i,j 的二维表" ⭐
路径 DP:     最小路径和(网格走格子)           —— "从上/从左来"
```

### 记忆化搜索 vs 递推的选型 ⭐⭐

```
记忆化(自顶向下): 递归+缓存 —— 思路自然（翻译暴力搜索），有递归栈开销
递推(自底向上): 循环填表    —— 无栈、可空间压缩，但顺序要想清楚
实战建议: 面试先写记忆化（不易错）→ 说明可优化为递推 ⭐ 展示层次
```

## 回看开篇

fib 三版本的进化即 DP 的完整叙事：**重复子问题=病根，记忆化=药引，递推=药**。五步法把「灵光一现」变成「填表流程」——状态定义是最难也最值钱的一步（题③的「以 i 结尾」就是明证）。

## 实战延伸

**1. 面试答题骨架**：「动态规划适用于有重叠子问题与最优子结构的场景，核心是把子问题答案存表避免重复计算。设计五步：定义状态——dp 数组每一位的确切含义是最关键一步；写转移方程——用最后一步分析法，枚举到达当前状态的所有来源；初始化边界；确定遍历顺序保证依赖先行；明确答案位置。爬楼梯是斐波那契同型的线性递推；零钱兑换枚举最后一枚硬币是完全背包原型；最长上升子序列以 i 结尾定义状态、答案取全表最大而非末位。实现上先写记忆化搜索不易错，再优化为递推并可做空间压缩。」

## 图解总结

```
DP = 重叠子问题(存表) + 最优子结构(可组装) —— 空间换时间
五步法: 状态定义⭐ → 转移方程(最后一步从哪来) → 初始化 → 顺序 → 答案位置

三范式:
 线性(爬楼=斐波那契): dp[i]=dp[i-1]+dp[i-2]
 选择型(零钱/背包): dp[i]=min/max(dp[i-c]+cost) 枚举"最后一步选了谁"
 双动线(LIS/LCS/编辑距离): dp[i][j] 二维表 —— 两序列对照 ⭐
坑位: "以i结尾"的答案在max(dp)不在dp[n] │ 完全背包的内外层顺序(组合vs排列)
实现: 记忆化搜索(先写·稳) → 递推(再优·省栈) → 滚动数组(压空间)
```

## 总结

- DP 两前提：重叠子问题 + 最优子结构；与分治/贪心的分界；
- 五步法是框架；状态定义是灵魂；
- 最后一步分析法写转移；三类范式（线性/选择/双动线）；
- 答案位置的坑（LIS 取 max(dp)）；背包顺序的组合/排列语义；
- 先记忆化后递推的实战路线。

**面试一句话回答**：动态规划适用于具有重叠子问题与最优子结构的题目，本质是把重复子问题的答案存入表格，以空间换时间。解题遵循五步框架：第一步定义状态即明确 dp 数组每一位的确切含义，这是最关键也最难的一步；第二步用最后一步分析法写转移方程，枚举到达当前状态的所有可能来源并取最优；第三步初始化边界值；第四步确定遍历顺序保证依赖先于使用；第五步明确答案在表中的位置。爬楼梯是线性递推、转移同斐波那契；零钱兑换枚举最后一枚硬币是完全背包原型；最长上升子序列以 i 结尾定义状态、答案取全表最大值而非末位。实现上先写记忆化搜索保证正确，再转成自底向上的递推消除递归栈并可做空间压缩。

## 思考题

1. 打家劫舍（LC198）用五步法完整走一遍——「偷不偷当前家」的选择型转移。
2. 最长公共子序列（LCS）的二维表：dp[i][j] 的定义与三种转移分支（相等/不相等取大）。
3. 零钱兑换「最少硬币」与「组合数」（LC518）的转移方程差异？（min 与求和——顺序与语义）
4. 开放实战：编辑距离太远？先做「两个关键词的搜索联想相似度」（LCS 应用）——写出评分函数。

（思考题解析将同步录入小程序题库，关联本文 id：algorithm-007）

## 参考文献：

- LeetCode 70/322/300/198/1143（本篇题单）
- 《算法图解》DP 章节（入门最佳读物）
- 本课程《algorithm-001 复杂度》（记忆化把 2ⁿ 变 n 的分析）

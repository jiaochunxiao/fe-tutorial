---
id: algorithm-002
title: 前端算法之数组与双指针
series: 算法与数据结构·前端向系列
seriesId: algorithm
stage: expert
difficulty: 4
tags: [数组, 双指针, 滑动窗口, 对撞指针, 快慢指针]
readingTime: 20
prev: algorithm-001
next: algorithm-003
createdAt: 2026-10-26
---

# 前端算法之数组与双指针

## 从「三个最值钱的指针套路」开始

```
两数之和（哈希）、盛最多水的容器（对撞）、无重复最长子串（滑窗）——
LeetCode 三道钉子户，恰好是本篇三大主角的招牌菜 ⭐
```

⭐⭐⭐ 双指针家族是前端面试算法的中坚——为什么「两个下标」能产生 O(n²)→O(n) 的魔法？本篇按「对撞 / 快慢 / 滑窗」三大套路讲透，每类都配一道经典与前端场景映射。

## 现象与直觉解释

暴力解的共同病：**两两组合的 O(n²)**。双指针的共同药：**用某种「单调性」让每步可以放心地丢弃一批候选**——两个指针各走一遍，总共 O(n)。

```
核心思想一句话:
  当"移动某个指针"的决策可以被证明"不损失最优解"时，
  就可以安全地移动它 —— 每步排除一批，n 步收场 ⭐
```

## 深入原理

### 套路一：对撞指针（两端向中间）⭐⭐⭐

**经典：有序数组两数之和 / 盛最多水**

```js
// 盛最多水的容器（LC 11）: 两条线与 x 轴围成的最大面积
function maxArea(height) {
  let l = 0, r = height.length - 1, best = 0;
  while (l < r) {
    best = Math.max(best, Math.min(height[l], height[r]) * (r - l));
    // ⭐ 决策: 移动【矮的】那端 —— 证明:
    //   面积由短板决定; 保留矮端、移动高端, 宽度-1 且高度≤短板 → 只会更差
    //   ⇒ 矮端的所有其他配对都可以丢弃 → 安全移动
    height[l] < height[r] ? l++ : r--;
  }
  return best;
}
// 暴力 O(n²) → 对撞 O(n) ⭐
```

**适用信号**：数组**有序**（或答案具有两端单调性）；「找一对/一组的边界」。

**有序数组去重/移除元素（同族题）**：

```js
// 快慢同向也常被归为双指针 —— 移除排序数组重复项（LC 26）:
function removeDuplicates(nums) {
  let slow = 0;
  for (let fast = 1; fast < nums.length; fast++) {
    if (nums[fast] !== nums[slow]) nums[++slow] = nums[fast]; // slow 收敛"保留区"
  }
  return slow + 1;   // O(n) 原地
}
```

### 套路二：快慢指针（同向不同速）⭐⭐

**经典：链表中点 / 判环（Floyd 判圈）**

```js
// 判环: 快指针每次 2 步、慢指针 1 步 —— 有环必相遇（追及问题）
function hasCycle(head) {
  let slow = head, fast = head;
  while (fast?.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) return true;   // 相遇 = 有环
  }
  return false;
}
// 同族: 找链表中点（快到尾时慢在中点）、找倒数第 k（快先走 k 步）
```

**前端映射**：数组拍平的迭代版用「显式栈」；**虚拟列表的startIndex/endIndex 本质是一对窗口指针**（performance-006 的算法血缘 ⭐）。

### 套路三：滑动窗口（同向双指针 + 窗口状态）⭐⭐⭐

**经典：无重复字符的最长子串（LC 3）**

```js
function lengthOfLongestSubstring(s) {
  const seen = new Set();          // 窗口状态
  let l = 0, best = 0;
  for (let r = 0; r < s.length; r++) {     // 右指针扩张
    while (seen.has(s[r])) {               // 不满足约束 → 收缩左边界
      seen.delete(s[l++]);
    }
    seen.add(s[r]);
    best = Math.max(best, r - l + 1);
  }
  return best;
}
// O(n): 左右指针各自最多走 n 步（看似双层循环，均摊线性 —— algorithm-001 的均摊 ⭐）
```

**滑窗的答题模板**（背下这张骨架）⭐：

```
for (右指针扩张) {
  把 s[r] 并入窗口状态
  while (窗口不满足约束) { 把 s[l] 移出状态; l++ }
  更新答案（此时窗口合法）
}
「右进左出，状态先行」—— 关键设计: 窗口状态用什么维护（Set/Map/计数数组）
```

**适用信号**：**连续子串/子数组** + 「最长/最短/计数」。

<figure style="margin:2.2em 0">
<svg viewBox="0 0 720 300" width="100%" role="img" aria-label="双指针三套路的指针运动：对撞、快慢、滑动窗口">
  <defs>
    <marker id="a2-ink" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#1C1A17"/>
    </marker>
    <marker id="a2-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#B03A2E"/>
    </marker>
  </defs>
  <style>
    .a2-l { animation: a2L 3s linear infinite; }
    .a2-r { animation: a2R 3s linear infinite; }
    .a2-w { animation: a2W 4s linear infinite; }
    @keyframes a2L { 0%{transform:translateX(0)} 45%{transform:translateX(150px)} 100%{transform:translateX(150px)} }
    @keyframes a2R { 0%{transform:translateX(0)} 45%{transform:translateX(-150px)} 100%{transform:translateX(-150px)} }
    @keyframes a2W { 0%{transform:translateX(0)} 60%{transform:translateX(120px)} 100%{transform:translateX(120px)} }
  </style>
  <text x="24" y="46" font-family="Noto Sans SC,sans-serif" font-size="13" font-weight="700" fill="#1C1A17">① 对撞：移矮板，两端向中间收</text>
  <rect x="24" y="58" width="290" height="34" rx="5" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.3"/>
  <g>
    <rect x="60" y="66" width="34" height="18" rx="3" fill="#FBF8F1" stroke="#1C1A17"/>
    <rect x="120" y="66" width="34" height="18" rx="3" fill="#FBF8F1" stroke="#1C1A17"/>
    <rect x="180" y="66" width="34" height="18" rx="3" fill="#FBF8F1" stroke="#1C1A17"/>
    <rect x="240" y="66" width="34" height="18" rx="3" fill="#FBF8F1" stroke="#1C1A17"/>
  </g>
  <g>
    <path class="a2-l" d="M 66 76 h 20 m -5 -5 l 5 5 l -5 5" stroke="#B03A2E" stroke-width="2" fill="none" marker-end="url(#a2-red)"/>
    <path class="a2-r" d="M 288 76 h -20 m 5 -5 l -5 5 l 5 5" stroke="#1C1A17" stroke-width="2" fill="none" marker-end="url(#a2-ink)"/>
  </g>
  <text x="24" y="146" font-family="Noto Sans SC,sans-serif" font-size="13" font-weight="700" fill="#1C1A17">② 滑动窗口：右扩左缩，状态随身</text>
  <rect x="24" y="158" width="290" height="34" rx="5" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.3"/>
  <g>
    <rect x="30" y="164" width="26" height="22" rx="3" fill="#FBF8F1" stroke="#1C1A17"/>
    <rect x="60" y="164" width="26" height="22" rx="3" fill="#FBF8F1" stroke="#1C1A17"/>
    <rect x="90" y="164" width="26" height="22" rx="3" fill="#FBF8F1" stroke="#1C1A17"/>
    <rect x="120" y="164" width="26" height="22" rx="3" fill="#FBF8F1" stroke="#1C1A17"/>
    <rect x="150" y="164" width="26" height="22" rx="3" fill="#FBF8F1" stroke="#1C1A17"/>
  </g>
  <g class="a2-w">
    <rect x="42" y="160" width="122" height="30" rx="5" fill="none" stroke="#B03A2E" stroke-width="2"/>
  </g>
  <path d="M 46 202 h 100 m -5 -5 l 5 5 l -5 5" stroke="#B03A2E" stroke-width="1.6" fill="none" marker-end="url(#a2-red)"/>
  <text x="160" y="206" font-family="Noto Sans SC,sans-serif" font-size="12" fill="#6E675A">窗口右扩（状态不合法时左缩）</text>
  <text x="24" y="244" font-family="Noto Sans SC,sans-serif" font-size="13" font-weight="700" fill="#1C1A17">③ 快慢：速度差制造信息</text>
  <rect x="24" y="256" width="290" height="34" rx="5" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.3"/>
  <g>
    <circle cx="60" cy="273" r="10" fill="#FBF8F1" stroke="#1C1A17" stroke-width="1.4"/>
    <circle cx="120" cy="273" r="10" fill="#FBF8F1" stroke="#1C1A17" stroke-width="1.4"/>
    <circle cx="180" cy="273" r="10" fill="#FBF8F1" stroke="#1C1A17" stroke-width="1.4"/>
  </g>
  <g>
    <path class="a2-l" d="M 54 273 h 12" stroke="#B03A2E" stroke-width="2" fill="none"/>
    <path class="a2-r" d="M 174 273 h -24" stroke="#1C1A17" stroke-width="2" fill="none"/>
  </g>
  <text x="60" y="300" font-family="Noto Sans SC,sans-serif" font-size="12" fill="#6E675A">slow 1 步 / fast 2 步——中点、倒数 k、判环全靠它</text>
</svg>
<figcaption style="font-family:'Noto Sans SC',sans-serif;font-size:13px;color:#6E675A;text-align:center;margin-top:10px">图 · 三套指针的移动方式——每一步移动都「安全地丢掉一批候选解」</figcaption>
</figure>

### 前端场景对号入座 ⭐⭐

```
对撞: 购物车两端凑满减（"从两端选商品凑到目标金额"）
快慢: 无限滚动列表找中点分割; 轮播的循环判定
滑窗: 「连续在线时长统计」「日志中连续 N 分钟错误率」—— 时间序列的连续区间是滑窗主场 ⭐
```

## 回看开篇

三个套路的共同本质：**利用问题的单调性/有序性，让指针的每一步移动都「安全地排除一批解」**——对撞排除一端的全部配对、快慢用速度差制造对称信息、滑窗用「不合法才收缩」保证窗口不重不漏。识别信号：有序→对撞、链/环→快慢、连续区间→滑窗。

## 实战延伸

**1. 面试答题骨架**：「双指针通过利用单调性把两两组合的平方复杂度降为线性——对撞指针适用于有序数组找一对目标值，两端向中间逼近，每次移动可被证明不损失最优解的那端，如盛水问题移矮板；快慢指针同向不同速，快指针先行 k 步或倍速前进，解决倒数第 k、链表中点与 Floyd 判环；滑动窗口维护一段连续区间的状态，右指针扩张并入状态、违反约束时收缩左边界，左右各走一遍均摊线性，适用于最长无重复子串这类连续子串问题。识别信号是有序找配对用对撞、链环结构用快慢、连续区间最值用滑窗。」

**2. 一道模板套用题**：长度最小的子数组（LC 209，≥target 的最短连续和）——滑窗模板直接落地（状态从 Set 换成 sum）。

## 图解总结

```
双指针 = 用单调性让每步"安全丢一批解" (n² → n)

对撞(l↔→r): 有序找配对 │ 盛水(移矮板⭐) │ 两数之和II
快慢(slow/fast 同向): 倒数k(快先k步) │ 中点 │ 判环(追及)
滑窗(l..r 窗口): 连续区间+最值/计数
  模板: for r{并入状态; while不满足{吐出l;l++} 更新答案}
  状态: Set │ Map(计数) │ 求和变量 —— 按题换"状态容器"
前端血缘: 虚拟列表的[start,end]就是窗口指针 ⭐
```

## 总结

- 对撞：有序找一对，每步移动「不损失最优」的那端；
- 快慢：速度差制造信息（倒数 k、中点、判环）；
- 滑窗：右进左出、状态先行，均摊 O(n)；模板可背；
- 识别信号：有序配对/链环/连续区间；
- 滑窗与虚拟列表同源——算法与工程的血缘。

**面试一句话回答**：双指针的核心是利用数据的单调性或有序性，让指针的每一步移动都能安全地排除一批候选解，从而把暴力枚举对的平方复杂度降为线性。对撞指针从两端向中间逼近，适用于有序数组的配对问题，移动决策要能证明不损失最优解，如盛水容器每次移动短板一端；快慢指针同向不同速，快指针先行 k 步或倍速前进，用于找倒数第 k 个、链表中点与 Floyd 判环；滑动窗口维护连续区间状态，右指针扩张并入新元素、一旦违反约束就收缩左边界，左右各遍历一次均摊线性，适合最长无重复子串、最短覆盖子串这类连续子串问题，窗口状态可用集合、计数哈希或求和变量承载。

## 思考题

1. 两数之和（无序版）为什么不能用对撞指针？最优解是什么？（无序缺乏单调性——哈希 O(n) 一次遍历，algorithm-005 主菜）
2. 滑窗「求最小值」与「求最大值」的收缩条件差异？（最大：不满足才缩；最小：满足就记录并继续缩 ⭐ 反向逻辑）
3. 把 LC209 改成「恰好等于 target 的最短」——滑窗还适用吗？（前缀和+哈希的思路预告）
4. 开放实战：给你一周的埋点事件流（时间戳数组），统计「任意 5 分钟窗口内最多事件数」——滑窗秒解，写出代码。

（思考题解析将同步录入小程序题库，关联本文 id：algorithm-002）

## 参考文献：

- LeetCode 11/26/141/209/3（本篇的例题清单）
- 《算法（第 4 版）》双指针章节
- 本课程《algorithm-001 复杂度》（均摊分析）、《performance-006 虚拟滚动》（窗口指针血缘）

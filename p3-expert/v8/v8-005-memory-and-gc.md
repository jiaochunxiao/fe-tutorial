---
id: v8-005
title: V8 之内存管理与垃圾回收
series: V8 与 JavaScript 底层系列
seriesId: v8
stage: expert
difficulty: 5
tags: [V8, 垃圾回收, GC, 内存管理, 内存泄漏, 性能优化]
readingTime: 28
prev: v8-004
next: v8-006
createdAt: 2026-10-25
---

# V8 之内存管理与垃圾回收

## 从一个「诡异」的线上问题说起

某活动页有个抽奖按钮，产品要求点击后按钮 DOM 移除、换成结果弹窗。上线几天后收到反馈：页面越用越卡，最后崩溃。开发者打开 DevTools 一看内存曲线：

```js
// 问题代码的极简复现
function bind() {
  const list = document.querySelector('#prize-list'); // 一个巨大的列表
  const btn = document.querySelector('#lucky-btn');

  btn.addEventListener('click', () => {
    document.querySelector('#panel').removeChild(list); // 从 DOM 树移除
    showResult();
  });
}
bind();
```

节点明明已经 `removeChild` 了，为什么内存不降反升？**因为 `list` 这个 DOM 树的引用还活着**——它被监听器回调形成的闭包持有，而监听器挂在 `btn` 上，`btn` 还在页面上。

要彻底解释这类问题，需要理解两件事：**V8 把对象放在哪、谁来决定它什么时候死**。这就是本文的主题。⭐ 高级岗/性能岗面试高频

## 第一层：对象的生与死——可达性

JavaScript 没有手动释放内存的语句（`delete` 只是删属性，不是释放内存），内存的回收完全交给垃圾回收器（GC）。判定一个对象「该不该死」的标准是：

> **从根（roots）出发，沿着引用链无法到达的对象，就是垃圾。**

「根」包括：全局对象、当前调用栈上的局部变量、正在执行的函数及其闭包链等。这个算法叫**可达性分析（reachability analysis）**，也叫标记-清除中的「标记」阶段的理论基础。

```
   根（全局/栈/闭包）
    │        └──────────┐
    ▼                   ▼
  objA ──▶ objB        objD ✗（从根不可达 → 垃圾）
    │
    ▼
  objC ──▶ objD        （注意：objD 只要有一条引用链可达就活着——
                         「还有地方引用它」不等于「它是活的」是错的，
                          反过来「从根可达才活着」才是对的）
```

这也解释了开篇的问题：`list` 这棵 detached DOM 树虽然脱离了文档，但从「闭包 → 变量 list」这条链依然可达，所以 GC 认为它活着。

## 第二层：对象的家和寿——V8 的堆分区

如果对所有对象用同一种策略回收，效率会很差：生命周期几毫秒的临时对象和全局常驻对象混在一起，每次都要全堆扫描。V8 基于**弱分代假说（Weak Generational Hypothesis）**做了一次关键拆分：

> **绝大多数对象朝生夕死；熬过早期的对象，往往会活很久。**

于是堆被分成两代：

```
V8 堆
├── 新生代（Young Generation）
│   ├── From 空间（正在使用）
│   └── To 空间（空闲）          ← 两者角色互换，见下文 Scavenger
├── 老生代（Old Generation）
│   ├── 老生指针区 / 老生数据区
├── 大对象空间（Large Object Space）  ← 超过阈值（约 500KB）的对象直接进入，独立分配、独立回收
└── 代码空间（Code Space）等
```

- **新生代**：容量小（MB 级别），对象先在这里分配，回收频繁、速度快；
- **老生代**：容量大，存放熬过多次回收的对象，回收频率低、单次成本高；
- 对象的「晋升（promotion）」路径：新生代 → 老生代。

<figure style="margin:2.2em 0">
<svg viewBox="0 0 720 300" width="100%" role="img" aria-label="V8 分代堆：新生代 Scavenger 复制与晋升老生代">
  <defs>
    <marker id="g5-ink" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#1C1A17"/>
    </marker>
    <marker id="g5-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#B03A2E"/>
    </marker>
  </defs>
  <text x="150" y="28" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13.5" font-weight="700" fill="#6E675A">新生代（小而快 · 半空间复制）</text>
  <text x="540" y="28" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13.5" font-weight="700" fill="#6E675A">老生代（大而稳 · 标记清除/整理）</text>
  <rect x="60" y="48" width="180" height="60" fill="#FBF8F1" stroke="#1C1A17" stroke-width="1.6"/>
  <text x="150" y="72" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#1C1A17">From（分配中）</text>
  <text x="150" y="94" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10.5" fill="#6E675A">活 a · 活 b · 死 · 死</text>
  <rect x="60" y="116" width="180" height="60" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.6"/>
  <text x="150" y="140" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#1C1A17">To（复制目标）</text>
  <text x="150" y="162" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10.5" fill="#6E675A">a · b（复制过来的活对象）</text>
  <rect x="430" y="48" width="220" height="188" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.6"/>
  <text x="540" y="76" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#1C1A17">熬过两轮的「老居民」</text>
  <rect x="450" y="90" width="80" height="26" fill="#FBF8F1" stroke="#1C1A17" stroke-width="1.2"/>
  <text x="490" y="108" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#6E675A">a'（晋升）</text>
  <rect x="540" y="90" width="80" height="26" fill="#FBF8F1" stroke="#1C1A17" stroke-width="1.2"/>
  <text x="580" y="108" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#6E675A">b'（晋升）</text>
  <rect x="450" y="126" width="170" height="26" fill="#FBF8F1" stroke="#1C1A17" stroke-width="1.2"/>
  <text x="535" y="144" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#6E675A">全局 · 缓存 · 长命闭包…</text>
  <path id="g5-promo" d="M 240 130 C 300 96 360 92 424 100" fill="none" stroke="#B03A2E" stroke-width="1.8" marker-end="url(#g5-red)"/>
  <text x="332" y="76" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#B03A2E">熬过两轮 → 晋升</text>
  <circle r="5" fill="#B03A2E">
    <animateMotion dur="2.6s" repeatCount="indefinite">
      <mpath href="#g5-promo"/>
    </animateMotion>
  </circle>
  <text x="150" y="212" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#6E675A">死对象不需要逐个处理，</text>
  <text x="150" y="232" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#6E675A">To 装满活对象后整块作废 From</text>
  <text x="540" y="212" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#6E675A">Mark-Sweep + Mark-Compact，</text>
  <text x="540" y="232" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#6E675A">增量/并发把停顿压到毫秒级</text>
</svg>
<figcaption style="font-family:'Noto Sans SC',sans-serif;font-size:13px;color:#6E675A;text-align:center;margin-top:10px">图 · 分代堆——新对象住新生代（红点演示晋升），熬过两轮回收就搬进老生代安家</figcaption>
</figure>

## 第三层：新生代回收——Scavenger 半空间复制算法

新生代使用 **Cheney 半空间复制算法**，V8 称为 **Scavenger（清道夫）**。一轮回收的流程：

```
 回收前：                          回收中（遍历复制）：
 ┌────────────┐ ┌────────────┐    从根出发遍历新生代引用
 │ From 空间   │ │ To 空间(空) │    活对象 → 复制进 To；
 │ [活][死][死] │ │            │    死对象 → 什么都不做
 │ [死][活][死] │ │            │
 └────────────┘ └────────────┘
 回收后：
 ┌────────────┐ ┌────────────┐
 │ From(可复用)│ │ To 空间     │    交换 From/To 角色；
 │            │ │ [活][活]    │    死对象的空间被「整体抛弃」
 └────────────┘ └────────────┘
```

分步描述：

1. 新对象总在 From 空间分配；
2. 回收触发时，从根出发，把 From 空间中**可达**的对象**复制**到 To 空间（复制时整理，天然无碎片）；
3. 复制完成后，From 空间整块作废，直接可复用——**死对象不需要逐个处理**，这是该算法快的原因；
4. From 与 To 角色互换。

**为什么这个「浪费一半空间」的算法反而快？** 因为新生代存活率极低，假设存活 10%，实际复制量只有 10%，而「标记每个死对象」的成本是 90%。代价是空间利用率 50%，所以新生代必须小。

**晋升（进入老生代）的两种情况** ⭐ 经典考点：

1. 对象已经经历过**一次** Scavenge 回收、这次又活了下来（即「熬过两轮」，V8 的中间代机制简化表述为熬过两次回收即晋升）；
2. To 空间占用超过 **25%**（阈值 25% 是为了保证交换后 From 空间还有足够余量承接新分配），本次存活对象直接晋升老生代。

## 第四层：老生代回收——标记清除与标记整理

对象大、存活率高，复制就不划算了（复制成本 ∝ 存活对象数量）。老生代改用两个算法组合：

### Mark-Sweep（标记-清除）

1. **标记阶段**：从根遍历，所有可达对象打上「活」标记；
2. **清除阶段**：遍历堆，未被标记的对象加入空闲列表（free list），可被后续分配复用。

### Mark-Compact（标记-整理）

Mark-Sweep 的问题：死对象散落各处，回收后内存**碎片化**——空闲块很多但都不连续，分配大对象可能失败。Mark-Compact 在清除时把所有活对象**向内存一端移动**，代价是移动对象需要更新所有指向它们的引用，更慢但换来连续空间。

### 三色标记：标记如何「分步」

标记阶段使用三色抽象：

| 颜色 | 含义 |
|---|---|
| 白 | 尚未访问（回收结束后仍为白 = 垃圾） |
| 灰 | 自身已访问，但**引用的子对象还没扫完** |
| 黑 | 自身和所有引用都已扫描完毕 |

从根出发，节点依次「白 → 灰 → 黑」，最终全堆只剩黑（活）与白（死）。三色抽象的意义在于：它让标记过程**可以暂停和恢复**——这正是下一层「增量标记」的基础。

## 第五层：让停顿变短——增量、并发、并行

GC 运行时，JS 主线程通常得停下来（Stop-The-World，STW）。全堆标记一次可能上百毫秒——对每 16.7ms 一帧的页面是灾难。V8 的 **Orinoco 项目**用三个手段压缩停顿：

| 手段 | 做法 | 效果 |
|---|---|---|
| **增量（incremental）** | 把一次标记拆成许多小步，穿插在 JS 执行间隙中 | 单次停顿从百 ms 级降到 ms 级 |
| **并发（concurrent）** | 标记/清除的大部分工作放在**后台线程**，与 JS 并行 | 主线程停顿进一步缩小 |
| **并行（parallel）** | 主线程停顿期间，**多个辅助线程**同时干同一阶段 | 压缩必须停顿的那一小段 |

名词辨析（面试易混）：**并发 = 后台线程与主线程同时跑；并行 = 同一时刻多个线程合力干一件事。**

**增量标记的核心难题——写屏障（write barrier）**：标记分步进行时，如果 JS 在间隙里执行 `black.obj = whiteObj`（黑对象新增指向白对象的引用），而黑对象已扫描完毕不会再扫，白色对象会被误判为垃圾。V8 的解法是给这种「黑 → 白」的引用写入加一道屏障代码，把白色对象重新标灰，保证不漏标。

## 第六层：回看开篇问题 + 实战排查

### 开篇问题的完整解释

`removeChild` 只把节点从文档树摘下，**不会**释放内存。判定标准始终是可达性：闭包链 `btn 的监听器 → 回调作用域 → list 变量 → 整棵列表 DOM` 全部可达，GC 正确地保留了它们。修复方式：

```js
function bind() {
  const btn = document.querySelector('#lucky-btn');

  btn.addEventListener('click', () => {
    const list = document.querySelector('#prize-list'); // 用时再取，不做长期持有
    document.querySelector('#panel').removeChild(list);
    btn.removeEventListener('click', onClick); // 用完解绑，切断整条引用链
    showResult();
  });
}
```

### 五大常见泄漏模式（按出现频率）

1. **意外全局变量**：未声明直接赋值 `result = ...`，挂在 globalThis 上永不回收（`'use strict'` 可挡住）；
2. **被遗忘的定时器**：`setInterval` 回调持有闭包，组件销毁时未 `clearInterval`；
3. **detached DOM**：开篇案例——节点脱离文档但被 JS 变量引用；
4. **闭包持有大对象**：见《闭包》篇的 `bigData` 案例，长生命周期闭包捕获取决于一个大环境；
5. **无上限缓存**：`Map` 只进不出，用 `WeakMap`（key 弱引用，不阻止回收）或 LRU 策略治理。

### DevTools 排查三板斧

1. **Heap snapshot（堆快照对比法）**：操作前后各拍一次快照，选「Comparison」视图，盯 `Delta` 为正且持续增长的对象，Summary 里搜 `Detached` 能直接揪出游离 DOM；
2. **Allocation instrumentation on timeline**：录制期间的分配蓝条，反复增长不回落的蓝色区域即泄漏点；
3. **Performance Monitor**：打开 `JS Heap Size` 曲线做长时观察，健康的曲线是「锯齿状」（涨 → GC 回落），病态曲线是「楼梯状」只涨不落。

## 图解总结

```
                    新对象
                      │ 分配
                      ▼
              ┌───────────────┐
              │ 新生代 (小,快) │ Scavenger：活对象 From→To 复制
              └───────┬───────┘ 死对象整空间作废
                      │ 熬过两轮 / To 占用>25%
                      ▼ 晋升
              ┌───────────────┐
              │ 老生代 (大,慢) │ Mark-Sweep(快,有碎片)
              └───────────────┘ + Mark-Compact(慢,无碎片)
                      │
                      ▼ 停顿优化（Orinoco）
        增量标记(写屏障) · 并发标记 · 并行清理
```

## 总结

- 回收标准是**可达性**，不是「有没有引用」——detached DOM 问题的根源；
- **弱分代假说**催生分代设计：新生代用 **Scavenger 半空间复制**（快、空间减半），老生代用 **Mark-Sweep + Mark-Compact**（省空间、防碎片）；
- 晋升条件：熬过两次 Scavenge，或 To 空间占用超 25%；
- 停顿优化三板斧：**增量（写屏障保障正确性）、并发、并行**；
- 工程实践：五大泄漏模式要形成条件反射，排查用「快照对比 + 分配时间线 + 堆曲线」三板斧。

**面试一句话回答**：V8 基于弱分代假说把堆分为新生代与老生代——新生代用半空间复制的 Scavenger 算法，速度快因为只复制少数活对象；老生代用标记-清除加标记-整理防碎片；对象熬过两轮回收或 To 空间超 25% 即晋升；GC 停顿靠增量化（写屏障保证不漏标）、并发标记与并行清理压缩到毫秒级；而业务侧的内存泄漏本质几乎都是「本该不可达的对象仍从根可达」，比如被闭包持有的 detached DOM。

## 思考题

1. 为什么 Scavenger 算法适合新生代而不适合老生代？从「算法成本与存活率的关系」角度回答。
2. `Map` 和 `WeakMap` 在 GC 行为上的本质区别是什么？举一个必须用 WeakMap 的场景（提示：给 DOM 节点挂私有数据）。
3. 增量标记期间，如果 JS 执行了 `blackObj.field = whiteObj`，会发生什么问题？写屏障如何解决？
4. 页面长时间运行后越来越卡，你会按什么步骤定位是内存泄漏还是内存膨胀（占用高但可达、确实需要这么多数据）？两者的治理思路有何不同？

（思考题解析将同步录入小程序题库，关联本文 id：v8-005）

## 参考文献

- V8 官方博客 — [Trash talk: the Orinoco garbage collector](https://v8.dev/blog/orinoco)
- V8 官方博客 — [Concurrent marking in V8](https://v8.dev/blog/concurrent-marking)
- Chrome DevTools 文档 — [Fix memory problems](https://developer.chrome.com/docs/devtools/memory-problems/)
- 《深入浅出 Node.js（第 2 版）》第 5 章「内存控制」（分代回收经典中文资料）
- 本课程关联篇目：《js-deep-005 闭包》《performance-008 内存泄漏排查实战》

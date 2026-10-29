---
id: performance-008
title: 性能优化之内存泄漏排查实战
series: 性能优化系列
seriesId: performance
stage: intermediate
difficulty: 4
tags: [内存泄漏, Heap Snapshot, Performance Monitor, 排查实战, 五大模式]
readingTime: 20
prev: performance-007
next: null
createdAt: 2026-10-26
---

# 性能优化之内存泄漏排查实战

## 从「页面开 2 小时必崩」说起

> 本篇是《性能优化系列》收官——把《v8-005》的 GC 理论变现为浏览器里的排查实操。

```
运营后台反馈：工作台挂 2 小时越来越卡，最终「页面无响应」
现象三连：
  Performance Monitor: JS Heap 曲线【楼梯状只涨不落】（健康曲线是锯齿状）
  反复进出某列表页，Heap 一路爬升
  崩溃时内存 1.5GB+
```

⭐⭐ 内存泄漏是「性能问题里最像侦探破案的一类」——本篇给完整的**排查方法论 + 五大惯犯清单**。

## 现象与直觉解释

回顾《v8-005》可达性判定：**泄漏 = 本该不可达的对象仍从根可达**。浏览器侧的翻译：

```
健康的内存曲线：涨 → GC 落 → 涨 → GC 落（锯齿）🔁
泄漏的内存曲线：涨 → 微落 → 更高涨（楼梯）📈 —— 每次「落」都回不到原位
```

第一步永远是**确认存在泄漏**（而不是内存膨胀——确实需要这么多数据的场景）：DevTools → Performance Monitor → JS Heap Size + DOM Nodes 曲线观察。

## 深入原理：三板斧排查法 ⭐⭐⭐

### 板斧一：Heap Snapshot 对比法（定位泄漏对象）

```
① Memory 面板 → Heap snapshot → 拍快照 A
② 重复执行可疑操作 N 次（如进出列表页 5 次）
③ 再拍快照 B
④ 选 Comparison 视图（B vs A）→ 按 Delta（增量）排序
⑤ 看「只增不减」的对象：
   Constructor 列找元凶类型（Object/Array/Detached DOM/String/闭包）
   Summary 搜索 "Detached" —— 游离 DOM 的直接证据 ⭐
   点开 Retainers（保留链）—— 谁拉着它不放？沿链找到源头代码
```

**Retainers 是破案的关键**：它展示「根 → … → 泄漏对象」的完整引用链——链上第一个你写的变量名，就是凶手。

### 板斧二：Allocation Timeline（定位泄漏时机）

```
Memory 面板 → Allocation instrumentation on timeline → 录制 → 执行操作
蓝色条 = 分配后仍存活 ⭐；灰色条 = 已被回收
反复操作后【蓝色条持续累积不转灰】的区域 = 每次操作泄漏的量
点蓝色条 → 直接看到分配该对象的函数（构造栈）
```

### 板斧三：Performance Monitor（确认与值守）

```
JS Heap Size 曲线 + DOM Nodes 曲线（节点只增不减 = DOM 泄漏信号）
长时间观察任务：自动化场景用 Puppeteer + heap 监控告警
```

## 五大惯犯清单（先背模式，排查时对号入座）⭐⭐⭐

```js
// ① 意外的全局变量（最常见也最冤）
function process() { result = heavy(); }   // 没声明 → 挂 globalThis 永生
// 修复：'use strict' / ESLint no-undef

// ② 被遗忘的定时器与监听
setInterval(update, 1000);                  // 组件销毁没 clear
window.addEventListener('resize', handler); // 没 removeEventListener
// 修复：卸载钩子成对清理（vue-004 卸载清单 / react useEffect cleanup）

// ③ 游离 DOM（v8-005 开篇案例）
const node = document.querySelector('#list');
wrapper.removeChild(node);                  // DOM 摘下，但 node 变量还引用着整棵子树
// 排查特征：Snapshot 里搜 "Detached"

// ④ 闭包持有大对象
const handler = () => render(hugeData.map(…));  // handler 活多久 hugeData 活多久
window.onresize = handler;                      // 挂在全局 → 永生
// 修复：提前解构基本值（js-deep-005 的 bigData 案例）

// ⑤ 无上限的缓存
const cache = new Map();                     // 只进不出
cache.set(key, bigValue);
// 修复：LRU 上限（handwritten-012）或 WeakMap（键死缓存清 es6-007）
```

**框架场景的两个高频变体**：

```jsx
// React: 闭包快照泄漏（react-005 的暗面）
useEffect(() => {
  const id = setInterval(() => setPage(p => p + 1), 1000);
  return () => clearInterval(id);   // 忘了 return cleanup → 每次挂载叠一个定时器
}, []);

// 全局状态里的「历史快照数组」无限追加（undo 栈没上限）
```

## 一个完整的排查剧本（把三板斧串起来）⭐⭐

```
现象：列表页反复进出 10 次，Heap 从 30MB 涨到 120MB

1. 确认：Performance Monitor —— 楼梯曲线 ✅ 真泄漏
2. 定位对象：Snapshot 对比（进出 3 次 vs 基线）
   → Delta 最多的是：Detached HTMLDivElement ×47、Object ×120
3. 定位源头：点开一个 Detached div 的 Retainers：
   Detached div ← element ← listeners ← Chrome 事件监听 ← refreshHandler（我们的代码！）
4. 审查代码：列表组件 mounted 时 addEventListener('scroll', refreshHandler)
   unmounted 时忘了移除 —— 每次「出」页面，监听器带着整个旧列表 DOM 活在事件系统里
5. 修复：unmounted 里 removeEventListener + handler 置 null
6. 验证：重复进出 20 次，Heap 稳定在 32MB ± 2（锯齿回归）✅ 闭环
```

## 回看开篇

「2 小时必崩」的诊断路径正是上面剧本的翻版：先 Performance Monitor 确认楼梯曲线 → Snapshot 对比定位 Detached DOM 与闭包 → Retainers 沿链找到未清理的监听/定时器 → 成对清理修复 → 曲线回归锯齿。**内存泄漏的排查不是玄学，是「可达性判定 + 三板斧工具」的标准流程。**

## 实战延伸

**1. 面试答题骨架**：「先确认是泄漏不是膨胀——Performance Monitor 看 JS Heap 是否楼梯状只涨不落。定位用 Heap Snapshot 对比法：重复可疑操作前后各拍快照，Comparison 视图按 Delta 找只增不减的对象，Detached 开头的是游离 DOM，Retainers 保留链沿引用追到源头代码；Allocation Timeline 的持续蓝色条定位分配点。惯犯五类：意外全局变量、忘清的定时器与监听、游离 DOM、闭包持大对象、无上限缓存——修复分别是严格模式、成对清理、置空引用、提前解构、LRU 或 WeakMap。」

**2. 一个快手判断**：「内存涨了就是泄漏吗？」——否：合法缓存、数据累积是膨胀（可达且必要）；泄漏的判据是「不可达仍占内存 / 反复同操作后不回落」。

## 图解总结

```
确认: Performance Monitor ── 锯齿=健康 │ 楼梯=泄漏
定位: Snapshot对比(Delta排序) ──▶ Detached DOM / 闭包 / Object
      Retainers 保留链 ──▶ 沿链找到【你写的第一个引用】⭐
时机: Allocation Timeline 蓝色条累积区
惯犯: 全局变量 │ 定时器/监听 │ 游离DOM │ 闭包持大对象 │ 无上限缓存
修复: 严格模式 │ 成对清理 │ 置null │ 提前解构 │ LRU/WeakMap
验证: 重复操作 N 次 Heap 回落 ✅
```

## 总结

- 先确认：楼梯曲线（泄漏）vs 锯齿（健康）；区分泄漏与膨胀；
- Snapshot 对比法：Delta 只增不减 + Detached 搜索 + Retainers 溯源；
- Allocation Timeline 的蓝色条给出分配时机与构造栈；
- 五大惯犯与对位修复：全局/定时器监听/游离 DOM/闭包/缓存；
- 修复必须以「重复操作后回落」验证闭环。

**面试一句话回答**：排查内存泄漏先用 Performance Monitor 确认 JS Heap 曲线呈只涨不落的楼梯状而非健康的锯齿状，并区分泄漏与正常的内存膨胀；然后用堆快照对比法——重复执行可疑操作前后各拍一次快照，在 Comparison 视图按增量排序找只增不减的对象，Summary 里搜索 Detached 可直接发现游离 DOM，点开 Retainers 保留链沿引用一路追到源头代码；Allocation Timeline 的持续蓝色条则能定位分配发生的时机与调用栈。常见泄漏源五类——未声明的意外全局变量、忘记清理的定时器与事件监听、从文档移除仍被引用的游离 DOM、持有大对象的闭包、无上限增长的缓存，分别对应严格模式与 ESLint、卸载时成对清理、置空引用、提前解构基本值、LRU 或 WeakMap 治理；修复后必须重复操作验证内存回落。

## 思考题

1. 「Detached HTMLDivElement」出现在 Snapshot 里意味着什么？它的 Retainers 里如果第一个是我们框架组件的 state——还原泄漏成因。
2. 用 Puppeteer 写一个「循环进出页面 20 次 + 采集 heapUsed」的泄漏值守脚本——断言阈值怎么定？
3. WeakMap 做「DOM → 元数据」映射为什么天然防泄漏？（键的弱引用——v8-005 与 es6-007 的联动）
4. 开放讨论：移动端 WebView 的内存上限远低于桌面（可能 ~200MB）——低内存设备上的「主动降级」策略（虚拟列表更狠、图片档位更低、缓存更小）怎么设计？

（思考题解析将同步录入小程序题库，关联本文 id：performance-008）

## 参考文献：

- Chrome DevTools 文档 — Fix memory problems（三板斧官方教程）
- web.dev — Memory 专题
- 本课程《v8-005 内存管理与垃圾回收》《es6-007 WeakMap》《js-deep-005 闭包》（三大理论地基）

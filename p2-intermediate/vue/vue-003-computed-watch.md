---
id: vue-003
title: Vue 原理之 computed 与 watch 的原理
series: Vue 原理系列
seriesId: vue
stage: intermediate
difficulty: 4
tags: [computed, watch, watchEffect, 惰性求值, dirty 标志]
readingTime: 20
prev: vue-002
next: vue-004
createdAt: 2026-10-26
---

# Vue 原理之 computed 与 watch 的原理

## 从「computed 为什么不重复计算」说起

```js
const count = ref(1);
const double = computed(() => count.value * 2);

double.value;  // 计算 1 次（count 没变）
double.value;  // 不计算！直接返回缓存 ✅
count.value = 2;
double.value;  // 计算 1 次（依赖变了）
double.value;  // 又开始缓存 ✅
```

「依赖没变就白嫖缓存、变了才算一次」——这套**惰性求值 + 缓存**是怎么用 effect 实现的？⭐⭐ computed 与 watch 的区别（以及 watchEffect 的定位）是 Vue 面试必考，而它们的原理惊人地同源：**都是 effect 的不同调度策略**。

## 现象与直觉解释

先把三者按「回答什么问题」分清：

| API | 回答的问题 | 执行时机 | 有无缓存 |
|---|---|---|---|
| `computed` | 这个**值**是什么？ | **取值时才算**（惰性）+ 依赖变才失效 | ✅ |
| `watch` | 那个数据**变了之后**干什么？ | 依赖变化后（可拿到新旧值） | — |
| `watchEffect` | 副作用依赖了谁，**自动跟着跑** | 立即执行一次 + 依赖变化后 | — |

一句话：**computed 造值（同步、纯函数、有缓存），watch/watchEffect 造副作用（回调、可异步）**。

## 深入原理

### 一、computed：dirty 标志的「缓存状态机」⭐⭐⭐

computed 本质是一个**带缓存的特殊 effect**：

```js
// 极简实现（原理同源《handwritten-009》）：
function computed(getter) {
  let value;                 // 缓存槽
  let dirty = true;          // ⭐「脏了没」标志 —— 全部魔法在这

  const effectFn = effect(getter, {
    lazy: true,              // ① 惰性：创建时不执行
    scheduler() {            // ② 依赖变化时不重算，只【标脏】
      if (!dirty) {
        dirty = true;        // 下次取值前：缓存已失效
        triggerRefValue(this); // 通知「依赖本 computed 的人」
      }
    },
  });

  return {
    get value() {
      if (dirty) {           // ③ 取值时：脏了才算，算完存缓存
        value = effectFn();
        dirty = false;       //    并标「干净」→ 后续取值直接白嫖
      }
      return value;
    },
  };
}
```

**三段逻辑闭环**：

```
取值: dirty? ──是──▶ 执行 getter 存缓存，dirty=false ──▶ 返回缓存
                    └─否──▶ 直接返回缓存（零计算）✅
依赖变化: scheduler 触发 ──▶ dirty=true（只标脏，不重算！）──▶ 通知下游
```

**关键设计：依赖变化时「不算只标」**——把计算成本推迟到「真的有人取值」那一刻；如果没人取，这次变化就白标了（省掉无用计算）。**这就是「惰性」的全部含义**。

**computed 的两个规范约束**（面试要提）：getter 必须纯（无副作用——因为「何时执行」不保证）；不能直接改它的 value（只读，set 需显式提供）。

### 二、watch：显式声明的「值变了回调我」⭐⭐

```js
watch(source, (newVal, oldVal) => { ... }, {
  immediate: false,   // 立即执行一次（拿不到旧值，oldVal 为 undefined）
  deep: false,        // 深度监听对象内部（本质：递归触发依赖）
  flush: 'pre',       // 回调时机：pre(默认,渲染前) | post(渲染后) | sync(同步)
});
```

**实现原理：也是 effect + 定制调度**——

1. source（ref/getter/数组）被一个内部 effect 读取（收集依赖）；
2. 依赖变化 → scheduler 触发 → **不重跑 source，而是调用你的回调**，并把新旧值传给它（新旧值在 job 队列里保存）；
3. 回调按 flush 配置排队（pre/post 都进组件更新前后的队列，sync 则同步执行）。

**「deep: true」的原理一句话**：遍历对象所有嵌套属性「摸一遍」——触发全部 getter，把深层属性都收进依赖（所以大对象 deep 监听有性能成本）。

### 三、watchEffect：自动依赖的副作用 ⭐⭐

```js
watchEffect(async (onCleanup) => {
  const data = await fetchUser(userId.value);  // 执行中读了什么，什么就是依赖
  render(data);
  onCleanup(() => cancelLast());               // 重新运行前清理上一次（竞态治理）
});
```

与 watch 的核心差异：**依赖不是声明的，是「跑一遍自动收集」的**（首次立即执行一次，执行期读到谁就依赖谁）——所以：

- 写「读 A 就做 A 相关的事」时它更顺手（不用重复声明 source）；
- 代价是**拿不到旧值**（没有前后对比的自然位置）；
- onCleanup 是竞态正解：重跑前清理上一次（请求取消，《js-async-008》的 AbortController 通道）。

**选型口诀**：要**新值**用 watch（显式源+旧值）；要**自动跟随**用 watchEffect（隐式依赖+清理）；要**派生数据**用 computed（缓存+纯函数）。

### 四、三级 effect 的全家福 ⭐

渲染、computed、watch/watchEffect 共用 track/trigger（vue-001 的账本），差异全在「怎么被调度」：

| | 触发时机 | 执行内容 | 缓存 |
|---|---|---|---|
| 渲染 effect | 依赖变化 → 调度队列（微任务批量） | 重新 render + diff | — |
| computed effect | 依赖变化 → 只标脏 | **取值时才算** | ✅ |
| watch effect | 依赖变化 → 回调入队（按 flush） | 用户回调 | — |

## 回看开篇

「不重复计算」的答案就一个布尔变量：`dirty`——依赖变化只把 dirty 置 true（不计算），取值时看 dirty 决定「白嫖缓存还是重算」。**缓存与惰性不是两件事，是同一个标志位的两端**。

## 实战延伸

**1. 面试答题骨架**：「computed 是带缓存的惰性 effect——内部 effect 懒执行，依赖变化不重算而是把 dirty 标脏并通知下游，取值时若脏才执行 getter 并缓存结果，因此依赖不变时多次读取零计算；watch 与 watchEffect 也是基于 effect 调度——watch 显式声明源，依赖变化时把新旧值传给回调，支持 immediate/deep/flush 配置，deep 通过递归触摸收集深层依赖；watchEffect 立即执行一次并自动收集执行期间读到的依赖，无旧值但提供 onCleanup 处理竞态。三者与渲染共用 track/trigger，区别只在调度策略。」

**2. 快手辨析**：「computed 里发请求行不行？」——不行：惰性+缓存语义下副作用时机不可控；该用 watch/watchEffect。

**3. 一个高频实战题**：搜索框防抖——`watch(kw, () => {...debounce...})` vs `watchEffect`+AbortController：后者天然每次重跑清理上次请求，竞态更稳（《js-async-008》）。

## 图解总结

```
            track/trigger（vue-001 账本）
                    │ 各自的调度策略
   ┌────────────────┼────────────────────┐
 渲染effect       computed effect      watch/watchEffect
 依赖变→批量重渲染  依赖变→只标 dirty ⭐   依赖变→回调入队(flush)
                  取值: dirty?算+存:白嫖   watch:显式源+新旧值
                  （惰性+缓存一体）       watchEffect:自动依赖+onCleanup
```

## 总结

- computed = 惰性 effect + dirty 标志 + 缓存：依赖变只标脏、取值才计算；
- computed getter 必须纯函数；不可直接赋值；
- watch 显式源 + 新旧值 + immediate/deep/flush；deep 靠递归触摸收集；
- watchEffect 自动依赖 + 立即执行 + onCleanup 清理竞态；
- 三级 effect 共用响应式账本，差异全在调度策略。

**面试一句话回答**：computed 的缓存与惰性由一个脏标志实现——内部创建懒执行的 effect，依赖变化时不重新计算而是把 dirty 置为 true 并通知依赖该计算属性的人，真正取值时若 dirty 才执行 getter、把结果写入缓存并清标志，因此依赖不变时重复读取零开销；watch 与 watchEffect 同样基于 effect 的定制调度——watch 显式声明监听源，依赖变化时把新值旧值传给回调，可配 immediate、deep（递归触摸收集深层依赖）与 flush 时机；watchEffect 则立即执行一次、自动收集执行期间访问到的依赖，虽无旧值但通过 onCleanup 在重跑前清理上一次副作用防止竞态。渲染、computed、watch 共享同一套依赖收集与触发机制，区别只在调度策略。

## 思考题

1. `computed(() => a.value + b.value)`：a、b 各改 3 次后再取值——getter 一共执行几次？（1 次：中间只标脏）
2. watch 的 `flush: 'post'` 为什么能拿到「更新后的 DOM」？回调入队的位置在渲染 effect 之后怎么实现？
3. 用 dirty 标志的思路给 computed 加「依赖从没被读过就不通知下游」的进一步优化（嵌套 computed 场景）。
4. 开放设计：表单「保存按钮禁用逻辑」= 多字段校验 + 与初始值对比——用 computed 还是 watchEffect 组织？画出依赖图。

（思考题解析将同步录入小程序题库，关联本文 id：vue-003）

## 参考文献：

- 《Vue.js 设计与实现》第 4~5 章（调度器与 computed 实现）
- Vue 3 官方文档 — computed / watch / watchEffect 指南
- 本课程《vue-001 响应式》《js-async-008 异步实战》（onCleanup 与竞态）

---
id: vue-001
title: Vue 原理之响应式：从 defineProperty 到 Proxy
series: Vue 原理系列
seriesId: vue
stage: intermediate
difficulty: 4
tags: [Vue 响应式, Proxy, defineProperty, 依赖收集, Vue3]
readingTime: 24
prev: null
next: vue-002
createdAt: 2026-10-26
---

# Vue 原理之响应式：从 defineProperty 到 Proxy

## 从「给对象加个属性，视图不更新」说起

> **系列导读**：《Vue 原理系列》共 8 篇——响应式、虚拟 DOM、computed/watch、生命周期、nextTick、路由、状态管理与组合式 API，讲透 Vue 的机制主干。

```js
// Vue 2 时代的著名场景
this.obj.newKey = '新属性';   // ❗ 视图不更新
this.$set(this.obj, 'newKey', '新属性'); // ✅ 必须用 $set
this.arr[0] = 'x';            // ❗ 也不更新（要 splice）
```

Vue 3 里这些坑**全部消失**——直接赋值就好。差异的根源：**Vue 2 用 `Object.defineProperty` 劫持属性，Vue 3 用 `Proxy` 代理整个对象**。⭐⭐⭐ Vue 响应式原理是框架面试的第一题，本文从机制本质讲清两代实现（代码级理解见《es6-008》与《handwritten-009》）。

## 现象与直觉解释

**响应式的目标**：数据变了 → 用到它的地方自动更新。实现思路三步：

```
① 劫持：拦截「读」和「写」（知道谁在读、谁在写）
② 依赖收集（读时）：记住「谁在用这个属性」
③ 派发更新（写时）：通知所有记过名的人重跑/重渲染
```

```
渲染函数读 state.count ──读──▶ [代理层] 记账：count 的依赖 += 渲染函数
state.count = 2 ────────写──▶ [代理层] 通知：把记过名的都重跑一遍 ✅
```

## 深入原理

### 一、Vue 2：defineProperty 的能力与天花板 ⭐⭐

```js
// Vue 2 响应式的极简内核（Observer）：
function defineReactive(obj, key) {
  let val = obj[key];
  Object.defineProperty(obj, key, {
    get() {
      dep.depend();       // ② 读时：登记当前 watcher（依赖收集）
      return val;
    },
    set(newVal) {
      val = newVal;
      dep.notify();       // ③ 写时：通知所有 watcher 重新求值
    },
  });
}
Object.keys(obj).forEach((k) => defineReactive(obj, k));  // ① 逐属性劫持
```

**defineProperty 的四个死穴**（正是 Vue 2 的四个坑的来源）：

| 死穴 | 用户看到的坑 |
|---|---|
| 只能劫持**已存在**的属性 | `this.obj.newKey = x` 不触发——`$set` 亡羊补牢 |
| 拦截不到 `delete` | `delete obj.k` 不触发——`$delete` |
| 数组下标与 length 无法监听 | `arr[0] = x` 不触发——Vue 2 重写 7 个数组方法（push/splice…）绕道 |
| 初始化时递归全量遍历 | 大对象初始化成本高；Map/Set 无能为力 |

Vue 2 的补丁方案：`$set/$delete` 挂钩 `ob.dep.notify`；数组「方法重写」——把原型换成劫持版，push/splice 等方法执行后手动 notify。

### 二、Vue 3：Proxy 为什么是正确答案 ⭐⭐⭐

《es6-008》的完整对照在框架场景的落点：

```js
// Vue 3 reactive 的极简内核（与 handwritten-009 同源）：
function reactive(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      track(target, key);                            // ② 依赖收集
      const res = Reflect.get(target, key, receiver);
      return typeof res === 'object' && res !== null
        ? reactive(res)                              // 惰性深代理 ⭐
        : res;
    },
    set(target, key, value, receiver) {
      const result = Reflect.set(target, key, value, receiver);
      trigger(target, key);                          // ③ 派发更新
      return result;
    },
  });
}
```

**Proxy 一次性解决四大死穴**：

| Vue 2 的坑 | Proxy 的解法 |
|---|---|
| 新增属性监听不到 | set 拦截器天然覆盖**任意 key 的写入**（含新增） |
| delete 监听不到 | `deleteProperty` 拦截器 |
| 数组下标/length | set 拦截下标赋值与 length 修改（无需重写方法） |
| 全量递归初始化 | **惰性深代理**：读到嵌套对象才包装（初始化 O(1)） |

外加 Map/Set 支持、代理整个对象一层搞定（不必逐属性定义）。

<figure style="margin:2.2em 0">
<svg viewBox="0 0 720 300" width="100%" role="img" aria-label="Vue 响应式闭环：track 收集依赖，trigger 通知更新">
  <defs>
    <marker id="v1-ink" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#1C1A17"/>
    </marker>
    <marker id="v1-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#B03A2E"/>
    </marker>
  </defs>
  <rect x="60" y="60" width="190" height="86" rx="10" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.6"/>
  <text x="155" y="92" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13.5" font-weight="700" fill="#1C1A17">组件渲染函数</text>
  <text x="155" y="118" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11" fill="#6E675A">读取 state.count</text>
  <rect x="330" y="42" width="180" height="120" rx="10" fill="#FBF8F1" stroke="#1C1A17" stroke-width="1.6"/>
  <text x="420" y="70" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13.5" font-weight="700" fill="#1C1A17">依赖账本 targetMap</text>
  <text x="420" y="96" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10.5" fill="#6E675A">state → Map{</text>
  <text x="420" y="116" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10.5" fill="#6E675A">  count → Set[渲染effect]</text>
  <text x="420" y="136" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10.5" fill="#6E675A">}</text>
  <rect x="330" y="216" width="180" height="52" rx="10" fill="#FBF8F1" stroke="#B03A2E" stroke-width="1.8"/>
  <text x="420" y="238" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13.5" font-weight="700" fill="#B03A2E">state.count++</text>
  <text x="420" y="258" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10.5" fill="#6E675A">Proxy set 拦截</text>
  <rect x="80" y="216" width="170" height="52" rx="10" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.6"/>
  <text x="165" y="238" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="13.5" font-weight="700" fill="#1C1A17">重新渲染</text>
  <text x="165" y="258" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10.5" fill="#6E675A">新 vnode → patch → DOM</text>
  <path d="M 250 96 H 324" stroke="#1C1A17" stroke-width="1.6" marker-end="url(#v1-ink)"/>
  <text x="284" y="86" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="12" fill="#1C1A17">get → track</text>
  <path d="M 420 162 V 210" stroke="#B03A2E" stroke-width="1.8" marker-end="url(#v1-red)">
    <animate attributeName="stroke-opacity" values="1;0.3;1" dur="2.2s" repeatCount="indefinite"/>
  </path>
  <text x="440" y="190" font-family="Noto Sans SC,sans-serif" font-size="12" fill="#B03A2E">set → trigger</text>
  <path d="M 330 250 C 260 262 200 274 168 272" fill="none" stroke="#1C1A17" stroke-width="1.6" marker-end="url(#v1-ink)"/>
  <text x="140" y="292" font-family="Noto Sans SC,sans-serif" font-size="12" fill="#6E675A">调度器微任务批量执行</text>
</svg>
<figcaption style="font-family:'Noto Sans SC',sans-serif;font-size:13px;color:#6E675A;text-align:center;margin-top:10px">图 · 响应式闭环——读属性记账（track），改属性放行（trigger），渲染 effect 在微任务里批量重跑</figcaption>
</figure>

### 三、依赖收集的完整图景：effect 与调度 ⭐⭐

组件渲染的本质是一个 **effect（副作用函数）**：

```
组件渲染函数执行
   └─ 模板读 state.count → get 拦截 → track：
        targetMap: WeakMap {
          state → Map { count → Set [渲染effect, computed effect, watch effect…] }
        }
state.count = 2 → set 拦截 → trigger：把 Set 里的 effects 挨个重跑
   └─ 渲染 effect 重跑 → 新 vnode → diff → 更新 DOM
```

三个必答细节：

1. **track 的「谁在读」怎么知道**——当前正在执行的 effect 存全局变量 `activeEffect`（渲染函数执行前挂上去，《handwritten-009》的探头机制）；
2. **trigger 不是同步重跑**——effects 先入调度队列，在**微任务里去重批量执行**：一个同步块里改 3 个属性，只重渲染 1 次（nextTick 的基础，《vue-005》）；
3. **同样的 track/trigger 服务三类东西**：渲染（组件更新）、computed（惰性缓存）、watch/watchEffect（用户回调）——三者的差异全在「effect 怎么被调度」（《vue-003》）。

### 四、ref：为什么还需要它 ⭐⭐

Proxy 代理不了**原始值**（`let x = 1` 的读写无法拦截）——所以需要 `ref`：

```js
const count = ref(0);
count.value++;   // ref 用 .value 的 get/set 存取器触发 track/trigger
// 本质：一个带 value 存取器的"对象壳"，把原始值的读写变成可拦截的属性访问
// 模板里自动解包（不用写 .value）是编译器加的糖
```

**reactive vs ref 选型**：对象/集合用 reactive；原始值、需要「整体替换」语义（重置表单）、避免解构失去响应式——用 ref。

### 五、两个「失去响应式」的经典场景 ⭐⭐

```js
const state = reactive({ count: 0 });

// 场景 1：解构 —— count 只是个普通数字了（读的时候才取值，之后与 state 无关）
const { count } = state;         // ❌ 失去响应式
// 修复：const { count } = toRefs(state);  // 每个 key 变成 ref

// 场景 2：整体替换 —— stateNow 是个新对象，旧代理的依赖不知道
let stateNow = reactive({ a: 1 });
stateNow = reactive({ a: 2 });   // ⚠️ 模板若绑定旧的则失联 —— 用 ref 包对象整体替换
```

## 回看开篇

`obj.newKey = x` 在 Vue 2 失效的原因：defineProperty 在初始化时只劫持了**当时存在的属性**，新 key 从未被 define；Vue 3 的 Proxy 代理**整个对象**，任何 key 的写入都过 set 拦截器——**「逐属性劫持」与「整对象代理」就是两代响应式的全部差异**。

## 实战延伸

**1. 面试答题骨架**：「Vue 响应式分三步——劫持、依赖收集、派发更新。Vue 2 用 defineProperty 逐属性劫持，读写触发 dep 的 depend/notify，但拦不到新增删除与数组下标，只能用 $set 与重写数组方法补丁；Vue 3 改用 Proxy 代理整个对象，set/deleteProperty 天然覆盖任意 key 与数组操作，配合惰性深代理降低初始化成本。依赖以 targetMap 三层结构存储，渲染、computed、watch 都是基于 track/trigger 的 effect，trigger 经调度器微任务批量执行；原始值用 ref 的 value 存取器实现，注意解构会失去响应式需 toRefs。」

**2. 现场手写价值**：把《handwritten-009》的 60 行 reactive + effect 背下来，面试时「我写过 Vue 响应式的最小实现」比任何背诵都有说服力。

## 图解总结

```
Vue2:  Object.keys(obj).forEach(defineReactive)   ——逐属性 defineProperty
        死穴: 新增key ✘ delete ✘ arr[i]= ✘ 全量递归 → $set/$delete/重写7方法/慢初始化

Vue3:  new Proxy(obj, {get: track, set: trigger})  ——整对象代理
        新增key ✓ deleteProperty ✓ 下标length ✓ 惰性深代理 ✓ Map/Set ✓

依赖:  targetMap(WeakMap) → Map(key → Set<effect>)
       effect 家族: 渲染 / computed / watch —— 全靠 track+trigger
       trigger → 调度器(微任务去重批量) → 组件重渲染
ref:   原始值的"对象壳"，.value 的 get/set 触发收集与更新
```

## 总结

- 响应式三步：劫持（读写拦截）、track（谁在读）、trigger（通知重跑）；
- Vue 2 defineProperty 四死穴：新增、删除、数组下标、全量递归——$set 与方法重写是补丁；
- Vue 3 Proxy 整对象代理 + deleteProperty + 惰性深代理，四死穴全消；
- 依赖三层账本 targetMap；渲染/computed/watch 共用 effect 机制；trigger 经调度器批量异步执行；
- ref 用 value 存取器包原始值；解构失响应用 toRefs 修。

**面试一句话回答**：Vue 的响应式由劫持、依赖收集、派发更新三步构成——Vue 2 用 Object.defineProperty 逐属性劫持读写，在 getter 里 dep.depend 收集 watcher、setter 里 dep.notify 派发更新，但它无法监听属性的新增删除与数组下标赋值，因此提供了 set、delete 并重写七个数组方法来弥补，且初始化需递归遍历全对象；Vue 3 改用 Proxy 代理整个对象，set 与 deleteProperty 拦截器天然覆盖任意键与数组操作，嵌套对象采用读到时才代理的惰性深代理，还支持 Map 与 Set。依赖关系存于 targetMap 三层结构，渲染、computed、watch 都是基于 track 与 trigger 的副作用，更新经调度器在微任务中批量执行；原始值则由 ref 通过 value 存取器实现响应式。

## 思考题

1. Vue 3 里 `reactive(obj)` 后 `reactive(obj) === reactive(obj)` 为什么必须是 true？两次代理会发生什么？（reactiveMap 缓存）
2. 「惰性深代理」与 Vue 2 的「初始化递归」在首屏大对象（1 万个嵌套属性）下的性能差异怎么量化？设计一个实验。
3. computed 的「惰性 + 缓存」用 effect 怎么实现？（dirty 标志 + 依赖变化置脏——《vue-003》预习）
4. 开放讨论：为什么 Vue 不用 Vue 2 的方式给 defineProperty 也做「新增属性」补丁（重 define 一次），而要换 Proxy？从「不知道 key 何时出现」的根本缺陷分析。

（思考题解析将同步录入小程序题库，关联本文 id：vue-001）

## 参考文献：

- 《Vue.js 设计与实现》第 2~5 章（本篇的工业完整版）
- Vue 3 官方文档 — 深入响应式系统
- 本课程《es6-008 Proxy 与 Reflect》《handwritten-009 mini-Vue 上》

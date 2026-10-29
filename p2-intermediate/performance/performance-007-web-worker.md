---
id: performance-007
title: 性能优化之 Web Worker
series: 性能优化系列
seriesId: performance
stage: intermediate
difficulty: 4
tags: [Web Worker, 多线程, 结构化克隆, Transferable, 任务卸载]
readingTime: 18
prev: performance-006
next: performance-008
createdAt: 2026-10-26
---

# 性能优化之 Web Worker

## 从「解析 50MB 的 Excel 把页面冻住 8 秒」说起

```js
// 主线程解析大文件：
const rows = parseExcel(arrayBuffer);   // 纯计算 8 秒
// 这 8 秒：页面白屏/卡死、动画停、点击无响应 —— 主线程被独占（browser-basic-002）
```

JS 是单线程的——但**渲染进程不是**：Web Worker 提供了一条**真正的后台线程**。⭐⭐ 「Worker 原理与适用边界、通信方式、Transferable」是性能优化的进阶必考。

## 现象与直觉解释

```
主线程：跑 JS + 渲染 + 响应交互（一切 UI 相关）
Worker 线程：独立的 JS 执行环境（有自己的事件循环、全局对象）
   ✅ 能做：任何纯计算（解析、加解密、图像处理、排序检索）
   ❌ 不能：碰 DOM、window 对象（alert/任何 UI API）
   📮 唯一交流方式：消息传递（postMessage / onmessage）
```

直觉：**Worker 是「只带了计算器的禁语室」**——干活很强，但只能递纸条（消息），看不见房间外（DOM）。

## 深入原理

### 一、起步：五分钟跑通一个 Worker ⭐⭐

```js
// worker.js（独立的 JS 环境）
self.onmessage = (e) => {
  const { rows } = e.data;
  const result = heavyCompute(rows);        // 大计算放这
  self.postMessage({ ok: true, result });   // 递回结果
};
```

```js
// 主线程
const worker = new Worker('./worker.js', { type: 'module' });
worker.postMessage({ rows: bigData });
worker.onmessage = (e) => render(e.data.result);
worker.terminate();                          // 用完销毁（释放线程）
```

**现代姿势：内联 Worker 与 Vite 插件**（免拆文件）：

```js
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
// Vite/webpack 自动处理打包与依赖 ⭐ 工程化无障碍
```

### 二、通信的两条路：克隆 vs 转移 ⭐⭐⭐

```js
// ① 结构化克隆（默认）：数据【深拷贝】一份过去
worker.postMessage(bigObject);
// ⚠️ 代价：10MB 对象 ≈ 几十~几百 ms 的克隆时间（主线程付）+ 内存翻倍
// 可克隆：普通对象/数组/TypedArray/Map/Set/Blob…；❌ 函数、DOM 节点、class 实例（丢方法）

// ② Transferable（可转移对象）：【所有权移交】——零拷贝 ⭐⭐
const buffer = new ArrayBuffer(50 * 1024 * 1024);   // 50MB
worker.postMessage({ data: buffer }, [buffer]);      // 第二参：转移列表
// 移交后：主线程的 buffer.byteLength === 0（不再可用）
// 适用：ArrayBuffer / OffscreenCanvas / MessagePort —— 大数据传输的正解
```

**大数据三步最佳实践**：主线程把数据装进 `ArrayBuffer`（或直接拿文件的）→ transfer 给 Worker → Worker 处理完把**结果**的 buffer transfer 回来——全程零拷贝。

### 三、共享内存进阶（SharedArrayBuffer 一句话）⭐

```js
// 多线程共享同一块内存（Atomics 原子操作配套）
const sab = new SharedArrayBuffer(1024);
// ⚠️ 门槛：页面必须跨源隔离（COOP/COEP 头）——目前多用于高性能场景（ffmpeg.wasm 等）
```

### 四、什么任务该交给 Worker（判定表）⭐⭐

```
✅ 适合（计算密集 + 可序列化输入输出）：
  大文件解析（Excel/CSV/zip）、加解密、图片像素处理、
  大数据集排序/过滤/统计、语法高亮/diff、复杂路径规划
❌ 不适合：
  小任务（通信开销 ~0.5ms 起，任务 <10ms 反而变慢）
  需要频繁操作 DOM 的（Worker 碰不了）
  强共享状态的（消息传值的成本高）——考虑状态留在主线程

经验阈值：单次执行 > 50ms（长任务标准）且输入输出可克隆/转移 → 值得搬
```

**开篇场景的正解**：文件 ArrayBuffer **transfer** 给 Worker → Worker 解析（页面全程流畅）→ 结果（行数据的紧凑格式）传回 → 主线程渲染——8 秒卡顿变 0 冻结。

### 五、Worker 家族速览 ⭐

| 类型 | 特点 |
|---|---|
| Dedicated Worker | 专属于创建它的页面（本文主角） |
| Shared Worker | 多个页面/标签页共享一个 |
| Service Worker | 独立生命周期，代理网络请求——PWA 离线核心（network-006 的缓存层） |
| Worklet | 挂进渲染/音频管线的微型 Worker（CSS Houdini） |

注意 Service Worker 与本文 Worker 的定位差异：前者是「网络代理 + 缓存」，后者是「计算卸载」。

## 回看开篇

Excel 冻结的病理与治疗：**纯计算霸占主线程 → 渲染与交互停摆**。Worker 把计算搬到后台线程，主线程只在「递纸条」（postMessage）时付出极小成本——配合 Transferable 连拷贝都省掉。**「把 CPU 时间从 UI 线程搬走」是长任务的终极解法**（任务拆分是温和解法，Worker 是根治解法）。

## 实战延伸

**1. 面试答题骨架**：「Web Worker 是渲染进程内的独立线程——有自己的事件循环与全局对象，能执行任意纯计算但不能访问 DOM 与 window，与主线程只能通过 postMessage 消息通信。默认通信是结构化克隆的深拷贝，大对象有显著开销；ArrayBuffer、OffscreenCanvas 等 Transferable 对象可通过第二参数转移所有权实现零拷贝传输。适合单次执行超过五十毫秒、输入输出可序列化的计算密集任务，如大文件解析、加解密与图像处理；小任务因通信开销反而更慢。Service Worker 是另一物种，做网络代理与离线缓存。」

**2. 一个快手题**：`postMessage({ f: () => {} })` 会怎样？（结构化克隆不支持函数——报 DataCloneError；解法：传函数字符串/算法参数，Worker 侧重建）。

## 图解总结

```
主线程 ──postMessage(克隆)──▶ Worker 线程
   ▲                            │ 独立事件循环/全局对象
   └──────postMessage(结果)─────┘ ❌DOM ❌window

大数据：ArrayBuffer ──transfer(所有权移交,零拷贝)──▶ 处理 ──transfer 回──▶ 渲染
判定：>50ms 纯计算 & 可序列化 ──▶ 值得搬；小任务/需DOM ──▶ 别搬
家族：Dedicated(计算) │ Shared(多页) │ Service(网络代理/PWA) │ Worklet(渲染管线)
```

## 总结

- Worker = 渲染进程内独立线程：能算不能摸 UI，消息通信是唯一通道；
- 通信两路：结构化克隆（默认，深拷贝有代价）与 Transferable 转移（零拷贝）；
- 判定阈值：>50ms 计算密集且输入输出可序列化才搬；
- 函数不能克隆；SharedArrayBuffer 需跨源隔离；
- Worker 家族分工：Dedicated 计算、Service 网络代理、Worklet 渲染管线。

**面试一句话回答**：Web Worker 运行在渲染进程内的独立线程上，拥有自己的事件循环和全局对象，可以执行任意纯计算但无法访问 DOM 与 window，与主线程只能通过 postMessage 与 onmessage 消息通信。默认通信采用结构化克隆算法深拷贝数据，函数与 DOM 节点无法克隆，大对象的拷贝有明显开销；对 ArrayBuffer、OffscreenCanvas 等 Transferable 对象可以在 postMessage 第二个参数中转移所有权，实现零拷贝的大数据传输。判断任务是否适合 Worker 的标准是单次执行超过约五十毫秒的计算密集型工作且输入输出可序列化——典型如大文件解析、加解密与图像像素处理；而小任务因线程通信开销反而更慢，需要操作 DOM 的任务则根本无法迁移。

## 思考题

1. 设计「Worker 任务池」：复用 N 个 Worker 轮转派发（创建 Worker 有成本）——写出调度器的核心逻辑（空闲队列 + 任务排队）。
2. 主线程传 100 万行数据给 Worker：直接传数组 vs 转成紧凑 TypedArray transfer——估算两种方式的耗时构成。
3. Comlink 库做了什么？（把 postMessage 双向握手包装成 RPC 调用——`wrap(worker).method(args)` 的魔法拆解）
4. 开放设计：前端 AI 推理（ONNX Runtime Web / WebGPU）为什么离不开 Worker 与 WASM？画出「输入张量 transfer → 推理 → 结果回传」的数据流。

（思考题解析将同步录入小程序题库，关联本文 id：performance-007）

## 参考文献：

- MDN — Web Workers API / Structured clone / Transferable
- web.dev — Workers 作为性能手段
- 本课程《browser-basic-002 渲染线程》（Worker 的线程版图）、《js-async-008》（任务调度的思想同源）

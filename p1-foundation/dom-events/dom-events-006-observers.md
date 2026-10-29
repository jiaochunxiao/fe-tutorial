---
id: dom-events-006
title: DOM 与事件之 MutationObserver 与 IntersectionObserver
series: DOM 与事件系列
seriesId: dom-events
stage: foundation
difficulty: 3
tags: [MutationObserver, IntersectionObserver, IntersectionObserverV2, 观察者API, 曝光埋点]
readingTime: 18
prev: dom-events-005
next: null
createdAt: 2026-10-26
---

# DOM 与事件之 MutationObserver 与 IntersectionObserver

## 从两个「轮询时代」的笨办法说起

> 本篇是《DOM 与事件系列》收官——从「响应用户操作」走向「观察页面自身变化」。

```js
// 需求 1：第三方脚本会改 DOM，我要监听它的变化
setInterval(() => checkDomChanged(), 1000);      // 轮询：费电、延迟高、还可能漏

// 需求 2：图片进入视口才加载（懒加载）
window.addEventListener('scroll', () => {
  // 每像素滚动都算 getBoundingClientRect —— 大量强制布局，页面卡成 PPT
  imgs.forEach((img) => checkIfVisible(img));
});
```

两个需求的现代答案是一对「观察者 API」：**MutationObserver（观察 DOM 变化）** 与 **IntersectionObserver（观察与视口的交叉）**。⭐⭐ 两者都是面试「你用过哪些高级 API」的高频答案，也是懒加载、无限滚动、曝光埋点、自动化测试的日常工具。

## 现象与直觉解释

观察者家族的共同哲学（对比事件监听）：

```
事件（addEventListener）：等「用户/系统动作」——被动响铃
观察者（Observer）：盯着「某种状态」——条件满足时异步回调
                   且浏览器把观测下推到内部线程，不占主线程轮询
```

| API | 盯什么 | 典型用途 |
|---|---|---|
| MutationObserver | 某（子）树的 DOM 变化 | 第三方脚本监控、编辑器协同、框架测试 |
| IntersectionObserver | 元素与视口/容器的**交叉状态** | 懒加载、无限滚动、曝光埋点、吸顶检测 |
| ResizeObserver | 元素尺寸变化 | 容器查询的底层、图表自适应 |
| PerformanceObserver | 性能指标事件 | LCP/CLS 采集（《performance-002》） |

## 深入原理

### 一、MutationObserver：DOM 变化的异步订阅 ⭐⭐

```js
const mo = new MutationObserver((mutations) => {
  // 批量回调：一次微任务里汇总这段时间的全部变化（不是每变一次调一次）⭐
  mutations.forEach((m) => {
    console.log(m.type);            // childList | attributes | characterData
    // childList: m.addedNodes / m.removedNodes
    // attributes: m.attributeName / m.oldValue（需开启 attributeOldValue）
  });
});

mo.observe(targetEl, {
  childList: true,                  // 子节点增删
  subtree: true,                    // 整个子树（不只直接子级）
  attributes: true,                 // 属性变化
  attributeFilter: ['class', 'style'], // 只关心这些属性
  characterData: true,              // 文本内容变化
  attributeOldValue: true,          // 回调里给旧值
});

mo.disconnect();    // 停止观察（组件卸载必调）
mo.takeRecords();   // 取走尚未回调的变更（清空队列）
```

**三个设计点**：① 回调在**微任务**时机批量执行（一帧内的多次 DOM 修改合并通知——省心的性能设计）；② observe 的配置决定「灵敏度」；③ 监听不到「无变化的读取」（那是 Proxy 的领域，《es6-008》）。

**经典应用**：水印防删（监听自己的水印元素被 remove/隐藏 → 立即恢复）、老旧第三方组件的行为监测、headless 测试断言。

### 二、IntersectionObserver：交叉观察 ⭐⭐⭐

```js
const io = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    entry.isIntersecting;        // 当前是否进入交叉区 ⭐
    entry.intersectionRatio;     // 交叉比例（0~1）
    entry.target;                // 被观察的元素
    entry.boundingClientRect;    // 元素边界（相当于 getBoundingClientRect）
    entry.rootBounds;            // 根（视口/指定容器）边界
  });
}, {
  root: null,                    // null=视口；可指定滚动容器
  rootMargin: '0px 0px 200px 0px', // 提前量：距视口还差 200px 就算"进入" ⭐懒加载必配
  threshold: [0, 0.5, 1],        // 触发回调的交叉比例档位
});

io.observe(imgEl);               // 观察
io.unobserve(imgEl);             // 停止观察单个
io.disconnect();                 // 全停
```

**懒加载的标准实现**（对比开篇 scroll 轮询）：

```js
const io = new IntersectionObserver(
  (entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.src = entry.target.dataset.src;  // 真实地址换上
        observer.unobserve(entry.target);             // 加载过就不再观察 ⭐
      }
    });
  },
  { rootMargin: '0px 0px 200px 0px' }   // 提前 200px 开始加载，用户无感
);
document.querySelectorAll('img[data-src]').forEach((img) => io.observe(img));
```

为什么它快？——**交叉计算由浏览器在内部完成**（对比 scroll + getBoundingClientRect 每次都在主线程强制布局，《performance-005》），回调只在状态变化时异步触发。

**三个进阶场景**：

```js
// ① 无限滚动：哨兵元素进入视口 → 加载下一页
io.observe(document.querySelector('.sentinel'));

// ② 曝光埋点：threshold: 0.5（露出过半算有效曝光）+ unobserve 防重复上报
// ③ 吸顶检测：rootMargin 顶部负偏移，检测标题是否滚过锚点（scroll 监听的替代）

// v2 增强一句话：IntersectionObserverV2（requireVisible + trackVisibility）
// 把「真的被看见」与「仅进入视口」区分开（display:none 的元素不再误报曝光）
```

### 三、ResizeObserver 一句话（家族补全）⭐

```js
const ro = new ResizeObserver((entries) => {
  entries[0].contentRect;   // 新尺寸
});
ro.observe(container);      // 元素自身尺寸变化（window.resize 只管窗口！）
// 图表库自适应容器、容器查询 polyfill 的底层都是它
```

### 四、观察者三纪律（工程收尾）⭐

1. **用完 disconnect**——观察者持有目标引用，忘记断开 = 内存泄漏（《v8-005》可达性）；
2. **回调里改 DOM 要防循环**——MutationObserver 回调改自己观察的树 = 无限循环（守卫标志位）；
3. **回调是异步的**——不能依赖「observe 后同步拿到状态」。

## 回看开篇

轮询的两宗罪（费电+延迟）与 scroll+rect 的卡顿，共同被「**浏览器内部观测 + 状态变化异步回调**」的观察者模型解决：MutationObserver 盯树的变化、IntersectionObserver 盯视口交叉、ResizeObserver 盯尺寸——**把「问询」变成「订阅」**，这就是观察者家族对事件模型的补充。

## 实战延伸

**1. 面试答题骨架**：「MutationObserver 以微任务批量回调的方式监听 DOM 子树的节点增删、属性与文本变化，配置里 childList/subtree/attributes/attributeFilter 控制灵敏度，适合第三方脚本监控与水印防删；IntersectionObserver 由浏览器在内部计算元素与视口或容器的交叉状态，isIntersecting 与 intersectionRatio 提供判定，rootMargin 做提前量、threshold 定档位，是懒加载、无限滚动与曝光埋点的标准工具，且不占主线程；ResizeObserver 观察元素自身尺寸变化补齐 window resize 覆盖不到的场景。三者都要用后 disconnect 防泄漏、回调异步且回调里慎改被观察对象。」

## 图解总结

```
            观察者模型：把「问询」变「订阅」
 MutationObserver ──盯──▶ DOM 树变化（微任务批量回调）
                     childList/subtree/attributes/characterData
 IntersectionObserver ──盯──▶ 与视口/容器的交叉（浏览器内部算）
                     isIntersecting / ratio / rootMargin提前量 / threshold档
 ResizeObserver ──盯──▶ 元素自身尺寸（window.resize 只管窗口）

纪律: disconnect 防泄漏 │ 回调防自触发循环 │ 异步回调勿依赖同步状态
```

## 总结

- MutationObserver：微任务批量回调监听 DOM 变化，灵敏度由 observe 配置控制；
- IntersectionObserver：浏览器内部计算交叉，懒加载/无限滚动/曝光埋点标准工具；rootMargin 提前量 + threshold 档位 + unobserve 防重；
- ResizeObserver 补齐「元素级」尺寸观察；PerformanceObserver 归性能篇；
- 三纪律：disconnect、防回调循环、认清异步。

**面试一句话回答**：MutationObserver 通过 observe 指定 childList、subtree、attributes 等配置监听 DOM 子树变化，变更以微任务批量异步回调，适合监控第三方脚本或实现水印防删；IntersectionObserver 把元素与视口或指定容器的交叉计算交给浏览器在内部完成，回调提供 isIntersecting、intersectionRatio 与边界信息，配合 rootMargin 实现提前加载、threshold 控制触发档位，是图片懒加载、无限滚动与曝光埋点的标准方案，相比 scroll 监听加 getBoundingClientRect 不再强制布局也不占主线程；ResizeObserver 则观察元素自身尺寸变化补齐窗口 resize 覆盖不到的场景——三者共同注意点是及时 disconnect 防止泄漏、回调中避免再次修改被观察目标造成循环。

## 思考题

1. 用 MutationObserver 实现「水印防删」：监听水印节点的 remove/属性隐藏，被破坏后立即恢复——注意防循环（恢复动作又触发 observer）。
2. 无限滚动的哨兵方案 vs 每项都 observe：两者回调次数与内存差异？什么列表该用哪种？
3. `threshold: [0, 1]` 与 `[0.5]` 的曝光埋点口径差异？曝光防重的完整方案（unobserve + 上报去重表）？
4. 开放设计：用 IntersectionObserver + requestIdleCallback 实现「低优先级首屏外模块的延迟初始化」——写出调度骨架并说明两个 API 各解决什么。

（思考题解析将同步录入小程序题库，关联本文 id：dom-events-006）

## 参考文献：

- MDN — [MutationObserver](https://developer.mozilla.org/zh-CN/docs/Web/API/MutationObserver)、[IntersectionObserver](https://developer.mozilla.org/zh-CN/docs/Web/API/IntersectionObserver)、[ResizeObserver](https://developer.mozilla.org/zh-CN/docs/Web/API/ResizeObserver)
- WICG — IntersectionObserver V2（可见性增强提案）
- 本课程《performance-004 图片优化》《performance-005 渲染优化》（应用场景）

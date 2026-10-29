---
id: dom-events-005
title: DOM 与事件之自定义事件与事件总线
series: DOM 与事件系列
seriesId: dom-events
stage: foundation
difficulty: 3
tags: [CustomEvent, 自定义事件, EventTarget, 事件总线, dispatchEvent]
readingTime: 16
prev: dom-events-004
next: dom-events-006
createdAt: 2026-10-26
---

# DOM 与事件之自定义事件与事件总线

## 从「组件想发通知，但没有 DOM 事件可用」说起

业务场景：弹窗组件关闭后，页面要刷新列表。弹窗不是原生控件，没有「close 事件」可监听——怎么办？

```js
// 方案：自己造一个事件
const closeEvent = new CustomEvent('modal:close', {
  detail: { reason: 'submit' },          // detail：自定义事件的数据载荷 ⭐
  bubbles: true,                          // 能不能冒泡（决定能否委托）
});
modalEl.dispatchEvent(closeEvent);

// 任意祖先/元素监听
document.addEventListener('modal:close', (e) => {
  refreshList(e.detail.reason);           // 拿到载荷
});
```

⭐ 自定义事件让「业务语义」也能走 DOM 事件系统（监听、冒泡、委托全套白嫖）；再进一步，EventTarget 还能当「无 DOM 的事件总线」用——本篇把这条路径走通。

## 现象与直觉解释

**事件系统其实是三件事的解耦**：`EventTarget`（谁能收发）、`Event`（消息格式）、`dispatchEvent`（投递动作）——DOM 元素只是 EventTarget 的一种。既然如此：

```
原生事件：浏览器在用户操作时「投递」预定义的 Event（click/input/…）
自定义事件：你自己在恰当时机「投递」自己定义的 Event
事件总线：new EventTarget() —— 一个不挂在页面上的「隐形收发室」
```

## 深入原理

### 一、Event vs CustomEvent ⭐

```js
// Event：无载荷的信号
const e1 = new Event('ready');

// CustomEvent：带 detail 数据 ⭐（业务事件的标配）
const e2 = new CustomEvent('cart:change', {
  detail: { count: 3, items: ['a', 'b'] },  // 数据放这
  bubbles: true,        // 参与冒泡 → 可被祖先委托
  cancelable: true,     // 允许 preventDefault（比如「取消关闭」场景）
  composed: false,      // shadow DOM 边界穿越（Web Components 场景）
});

target.dispatchEvent(e2);   // 同步执行所有监听（dispatchEvent 是同步的！）
```

**三个细节**：① dispatchEvent **同步**调用监听（不像 setTimeout）；② cancelable: true 时监听方可 `e.preventDefault()`，派发方检查返回值 `if (!target.dispatchEvent(e)) {}` 实现「可否决通知」；③ 命名推荐 `域:动作` 格式（modal:close、cart:change）避免撞名。

### 二、EventTarget 当事件总线（无 DOM 依赖的 Emitter）⭐⭐

```js
// EventTarget 是个「可以 new 的抽象收发器」—— 原生版 EventEmitter！
const bus = new EventTarget();

// 订阅
bus.addEventListener('user:login', (e) => {
  console.log('欢迎', e.detail.name);
});

// 发布
bus.dispatchEvent(new CustomEvent('user:login', { detail: { name: '小明' } }));

// 对比手写 EventEmitter（《handwritten-006》）：
// 原生版免费获得：once（{ once: true }）、AbortSignal 批量退订、TS 内置类型
// 手写版免费获得：on/off/emit 命名习惯、node 同款 API、参数直传（不必包 detail）
bus.addEventListener('x', fn, { once: true });   // 原生 once！

// ⭐ 批量退订的官方姿势：AbortController
const ac = new AbortController();
bus.addEventListener('a', fnA, { signal: ac.signal });
bus.addEventListener('b', fnB, { signal: ac.signal });
ac.abort();   // a、b 一次性全退订 ✅（组件卸载清理神器）
```

### 三、在 DOM 元素上派发自定义事件（组件通信）⭐

```js
// 自定义组件对外暴露事件（Web Components 的标准通信方式）：
class CoolModal extends HTMLElement {
  connectedCallback() {
    this.querySelector('.close').addEventListener('click', () => {
      // 组件内派发，bubbles 让外层也能委托监听
      this.dispatchEvent(new CustomEvent('close', {
        detail: { at: Date.now() }, bubbles: true,
      }));
    });
  }
}
customElements.define('cool-modal', CoolModal);

// 使用方（像监听原生事件一样监听组件）：
document.querySelector('cool-modal').addEventListener('close', (e) => {});
```

### 四、什么场景用什么通道（决策表）⭐⭐

| 需求 | 方案 |
|---|---|
| 用户交互 → 页面响应 | 原生事件 |
| 组件对使用方暴露语义（close/change） | DOM 元素 + CustomEvent(bubbles) |
| 跨组件/无 DOM 关系的消息 | `new EventTarget()` 总线（或 mitt） |
| 树形组件间通信 | provide/inject（Vue）、Context（React） |
| 全局状态变化 | 状态管理（响应式系统 > 事件） |

**事件总线的警告**：链路多了会变成「事件面条」（A 发 B 听、B 发 C 听……）——《architecture-002》详述何时该换状态管理。

## 回看开篇

弹窗通知的完整闭环：组件内 `dispatchEvent(CustomEvent('modal:close', {detail, bubbles}))` → 页面在任意层级 `addEventListener`（bubbles 支持，甚至可委托到 document）→ e.detail 取载荷——**业务语义复用了整套 DOM 事件基础设施**，监听、冒泡、委托、once、AbortSignal 全部免费。

## 实战延伸

**1. 面试答题骨架**：「自定义事件用 new CustomEvent 创建、detail 携带数据、bubbles 决定能否冒泡委托、cancelable 支持可否决通知，dispatchEvent 同步执行监听；EventTarget 可直接 new 出一个与 DOM 无关的事件总线，addEventListener 的 once 选项与 AbortSignal 批量退订是原生赠送的能力；组件对外的语义事件用元素上的 CustomEvent 派发，跨组件消息用 EventTarget 总线，而全局状态变化应优先用响应式状态管理而非事件。」

**2. 一个快手题**：dispatchEvent 返回 false 意味着什么？——有监听调了 preventDefault（且 cancelable: true）：「可否决通知」的官方实现。

## 图解总结

```
EventTarget（收发器）── Event/CustomEvent（消息）── dispatchEvent（同步投递）
   │                        │ detail 载荷 / bubbles / cancelable
   ├── DOM 元素（原生收发器）── 原生事件（浏览器投递）+ 自定义事件（你投递）
   └── new EventTarget() ──── 无 DOM 事件总线（once / AbortSignal 退订免费）

选型: 交互→原生事件 │ 组件语义→元素CustomEvent │ 跨组件→EventTarget总线 │ 状态→响应式
```

## 总结

- CustomEvent 三配置：detail 载荷、bubbles 委托能力、cancelable 可否决；
- dispatchEvent 同步执行；返回 false = 被 preventDefault；
- `new EventTarget()` 是零依赖事件总线：once 选项 + AbortController 批量退订；
- 组件对外的语义事件：元素派发 + bubbles；跨组件消息：总线；全局状态：状态管理；
- 命名规范 `域:动作`，防止撞名。

**面试一句话回答**：用 new CustomEvent 创建自定义事件，detail 属性携带业务数据，bubbles 设为 true 可参与冒泡从而支持祖先委托，cancelable 允许监听方 preventDefault 否决、dispatchEvent 会同步执行所有监听并可通过返回值感知是否被否决；EventTarget 可以直接实例化作为与 DOM 无关的事件总线，addEventListener 的 once 选项实现一次性订阅、配合 AbortController 的 signal 还能批量退订，组件对外暴露语义事件就在自身元素上派发带 bubbles 的 CustomEvent——但全局状态变化应优先使用响应式状态管理而非事件总线。

## 思考题

1. `dispatchEvent` 是同步的——用它实现「拦截式确认」（关闭前弹出确认，取消则不关）：派发 cancelable 事件 + 检查返回值，写出骨架。
2. EventTarget 总线 vs 手写 EventEmitter（handwritten-006）：列出各自缺失的 API，怎么互相补齐？
3. 一个第三方组件派发的自定义事件没设 bubbles——在容器上还能监听到吗？两种变通方案（改监听目标 / 组件内重派发）？
4. 开放讨论：「事件总线 + 状态管理」双轨并行是常见架构——什么时候必须迁走事件（调试困难、隐式依赖）？给出三条迁移信号。

（思考题解析将同步录入小程序题库，关联本文 id：dom-events-005）

## 参考文献：

- DOM Standard — Event constructor、CustomEvent、EventTarget（接口定义原文）
- MDN — [CustomEvent](https://developer.mozilla.org/zh-CN/docs/Web/API/CustomEvent)、[EventTarget](https://developer.mozilla.org/zh-CN/docs/Web/API/EventTarget)
- 本课程《handwritten-006 发布订阅》《dom-events-004 事件委托》

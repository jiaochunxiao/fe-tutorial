---
id: handwritten-006
title: 手写发布订阅 EventEmitter
series: 手写源码系列
seriesId: handwritten
stage: expert
difficulty: 4
tags: [发布订阅, EventEmitter, once, off, 事件总线]
readingTime: 18
prev: handwritten-005
next: handwritten-007
createdAt: 2026-10-26
---

# 手写发布订阅 EventEmitter

## 从「两个模块不能互相 import」说起

组件 A 要通知组件 B「数据变了」，但 A、B 是兄弟模块——互相 import 就成环了。解法是引入一个**中间人**：A 往中间人那里「发布」，B 在中间人那里「订阅」。

```
传统调用：A ──直接调──▶ B        （耦合）
发布订阅：A ──emit──▶ [事件中心] ──notify──▶ B   （解耦：A 不知道 B 存在）
```

这个中间人就是 **EventEmitter（事件总线）**。⭐⭐ 它是手写题里「工程价值最高」的一个：Node 的 events 模块、Vue2 的 $on/$emit、各种总线的内核全是同一套。

## 需求清单：Node events 模块的 API 面

```
on(event, listener)              订阅
off(event, listener)             退订
once(event, listener)            订阅一次（触发后自动退订）
emit(event, ...args)             发布（同步依次调用所有监听器）
listenerCount(event)             当前订阅数
removeAllListeners(event?)       清空
```

## 完整实现

```js
class EventEmitter {
  constructor() {
    // 数据结构：事件名 → 监听器数组
    // 用 Map 而非对象：键不受原型污染、有 size、可迭代（《es6-007》）
    this._events = new Map();
  }

  on(event, listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('listener must be a function');
    }
    if (!this._events.has(event)) this._events.set(event, []);
    this._events.get(event).push(listener);
    return this;                         // 链式调用（Node 同款）
  }

  off(event, listener) {
    const listeners = this._events.get(event);
    if (!listeners) return this;

    // ⭐ 从后往前找（Node 语义）：重复订阅同一函数时移除【最近一次】添加的
    const index = listeners.lastIndexOf(listener);
    if (index !== -1) listeners.splice(index, 1);
    if (listeners.length === 0) this._events.delete(event); // 清理空槽
    return this;
  }

  once(event, listener) {
    // ⭐ 核心：包装一层「执行后退订」
    // 包装函数必须能被 off 识别 —— 用闭包持有引用
    const wrapper = (...args) => {
      this.off(event, wrapper);          // 先退订，再执行（保证只触发一次）
      listener.apply(this, args);
    };
    // ⚠️ 陷阱：用户如果 off(event, listener)（原函数），按引用找不到 wrapper！
    // Node 的做法是给 wrapper 挂上原函数引用，off 时做映射（见下文「陷阱」）
    wrapper._original = listener;
    this.on(event, wrapper);
    return this;
  }

  emit(event, ...args) {
    const listeners = this._events.get(event);
    if (!listeners || listeners.length === 0) return false;

    // ⭐ 复制一份再遍历：emit 过程中监听器可能被 off（边遍历边删除的坑）
    [...listeners].forEach((fn) => fn.apply(this, args));
    return true;
  }

  listenerCount(event) {
    return this._events.get(event)?.length ?? 0;
  }

  removeAllListeners(event) {
    if (event !== undefined) this._events.delete(event);
    else this._events.clear();
    return this;
  }
}
```

## 四个关键设计点（全是追问点）⭐⭐

### 设计 1：once 的「执行后退订」顺序

```js
bus.once('init', () => console.log('A'));
bus.on('init', () => console.log('B'));
bus.emit('init'); // A B —— wrapper 先 off 自己，再执行监听器
bus.emit('init'); // B —— A 只触发了一次 ✅
```

「先退订再执行」保证即使监听器内部再 emit 同名事件，也不会重复触发自己。

### 设计 2：emit 时复制数组

```js
bus.on('tick', function offSelf() { console.log('1'); bus.off('tick', offSelf); });
bus.on('tick', () => console.log('2'));
bus.emit('tick');
// 不复制：遍历到 index 0 时移除了自己，数组塌陷 → 2 可能被跳过或行为异常
// 复制 [...listeners]：快照遍历，2 稳定执行 ✅
```

「迭代中修改被迭代集合」是经典并发陷阱——同步遍历里同样存在。

### 设计 3：once 与 off 的引用陷阱 ⭐

```js
const handler = () => {};
bus.once('x', handler);
bus.off('x', handler); // 能移除掉吗？

// on 里存的是 wrapper（包装函数）——按 handler 找不到！
// 修复：off 时对带 _original 标记的做映射查找：
```

```js
off(event, listener) {
  const listeners = this._events.get(event);
  if (!listeners) return this;
  const index = listeners.findIndex(
    (fn) => fn === listener || fn._original === listener // ⭐ 映射查找
  );
  if (index !== -1) listeners.splice(index, 1);
  return this;
}
```

### 设计 4：同步 emit 与错误隔离

emit 是**同步**调用所有监听器（Node 同款）。某监听器抛错会中断后续——要不要隔离？

```js
// 策略 A（Node 默认）：不隔离，抛给 emit 调用方
// 策略 B（浏览器事件模型）：try/catch 每个监听器，错误进 onError 通道
// 没有「正确答案」——但「能说出取舍」是高级信号
```

## 三分钟测试（考场自检）

```js
const bus = new EventEmitter();

const log = (msg) => () => console.log(msg);
bus.on('open', log('订阅1'))
   .on('open', log('订阅2'))       // 链式
   .once('open', log('一次性'));

bus.emit('open');   // 订阅1 订阅2 一次性
bus.emit('open');   // 订阅1 订阅2（once 已退订）
bus.listenerCount('open'); // 2

const temp = log('临时');
bus.on('data', temp).off('data', temp);
bus.emit('data');   // （无输出）off 生效
console.log(bus.emit('nobody')); // false —— 无监听器
```

## 实战延伸

**1. 与框架的关系**：Vue2 实例本身就是 EventEmitter（$on/$off/$emit）；Vue3 移除了它——全局总线的替代品是 mitt/tiny-emitter（本篇实现 + TS 类型 ≈ mitt 的全部）；Node 的 `events.EventEmitter` 增加 setMaxListeners（10 个以上同名监听器告警，防泄漏）。

**2. 内存泄漏的经典源头**：`on` 了却忘了 `off`——组件反复挂载就堆积监听器（「为什么点击一次触发 N 次」的标准答案）。规范：on/off 成对出现，组件卸载钩子里清理。

**3. 发布订阅 vs 观察者模式**（概念题）：观察者是「目标直接维护观察者列表、单向通知」；发布订阅多了一个**事件通道**，发布者与订阅者互不相识——中间人的有无是两者的分水岭。

## 图解总结

```
           ┌──────────── 事件中心 EventEmitter ────────────┐
           │  Map { 'open': [fn1, fn2, onceWrapper], … }   │
           └───────▲───────────────────────▲───────────────┘
        on/once    │                       │   emit('open', …args)
        （登记）    │                       │   快照遍历 → 依次同步调用
   ┌───────────────┴──┐              ┌────┴────────────┐
   │ 订阅者 B/C/D      │ ◀── 通知 ── │ 发布者 A         │
   └──────────────────┘              └─────────────────┘
   A 不知道 B 存在 —— 中间人解耦

once = wrapper(先 off 自己 → 执行原函数)
off  = lastIndexOf / _original 映射查找
```

## 总结

- 核心结构：Map（事件名 → 监听器数组），on/off/emit/once 四件套；
- once 用包装函数「先退订再执行」，off 需处理 _original 引用映射；
- emit 快照遍历防「边遍历边删」；emit 同步、无监听器返回 false；
- 返回 this 支持链式；空事件清理 Map 槽位；
- 工程要点：on/off 成对防泄漏；发布订阅与观察者的分野在「中间人」。

**面试一句话回答**：EventEmitter 用 Map 维护事件名到监听器数组的映射，on 压入数组并返回 this 支持链式，off 用 lastIndexOf 从后移除并在数组空时清理键，emit 时复制快照遍历、以 apply 同步调用所有监听器并返回是否有监听器，once 通过包装函数先退订自身再执行原函数实现一次触发，off 时通过包装函数上的 original 引用做映射查找以支持用户传原函数移除——同时要注意 on 与 off 必须成对使用以防监听器泄漏。

## 思考题

1. 给 EventEmitter 加 `onAny(listener)`：订阅所有事件（提示：emit 处拦截，参数含事件名）。
2. `once` 为什么必须用包装函数而不是「监听器里调用 off(event, listener)」？从「on 存储的是谁」解释。
3. 实现 `waitFor(event)`：返回 Promise，事件第一次触发时 resolve（提示：once + resolve）；超时变体如何设计？
4. 开放设计：跨组件通信的总线在大型应用里会演变成「事件 spaghetti」——对比 EventEmitter、状态管理、provide/inject 三种方案的适用边界与失控信号。

（思考题解析将同步录入小程序题库，关联本文 id：handwritten-006）

## 参考文献：

- Node.js 官方文档 — events 模块（API 语义与 maxListeners 告警）
- mitt 源码（Map 版极简实现，带 TS 泛型）
- 《JavaScript 设计模式与开发实践》第 6 章（发布-订阅模式）

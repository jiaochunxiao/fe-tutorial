---
id: dom-events-003
title: DOM 与事件之事件对象详解
series: DOM 与事件系列
seriesId: dom-events
stage: foundation
difficulty: 2
tags: [事件对象, target, currentTarget, preventDefault, 事件方法]
readingTime: 16
prev: dom-events-002
next: dom-events-004
createdAt: 2026-10-26
---

# DOM 与事件之事件对象详解

## 从「this、target、currentTarget 三个不一样」说起

```html
<ul id="list">
  <li data-id="1">第一项 <button>删除</button></li>
</ul>
```

```js
list.addEventListener('click', function (e) {
  console.log(this === e.currentTarget);  // true —— 但 target 可能是 button 或 li 或 ul
  console.log(e.target);                  // 实际被点的那个（可能是 button）
  console.log(e.currentTarget);           // 监听挂的那个（永远是 list）
});
```

一个 click 事件对象里同时住着三个「元素身份」——分不清它们，事件委托（下一篇）就无从写起。⭐ 事件对象是事件回调的第一个参数，承载着「谁、在哪、怎么触发、如何干预」的全部信息。

## 现象与直觉解释

事件对象 = **事件的快递单**：

- **target**：真正被点击的元素（收件地址的「门牌」——最深的那个节点）；
- **currentTarget**：当前正在处理事件的元素（快递当前到达的「中转站」）——监听里几乎总等于 this；
- **type/timestamp**：事件类型与时间；
- 各种方法：阻止默认（preventDefault）、阻止传播（stopPropagation）。

## 深入原理

### 一、target vs currentTarget vs this ⭐⭐

```js
// 结合事件流（《dom-events-002》）理解：
// 捕获/冒泡途中，事件会「路过」多个元素
//   target       —— 旅程的【终点站】，事件发生的真实源头，全程不变
//   currentTarget—— 旅程的【当前站】，随传播不断变化（哪个元素的监听正在执行，它就是谁）

list.addEventListener('click', (e) => {
  // 在这个监听里：currentTarget === list === this（箭头函数没有 this，用普通函数则 this 也相等）
  // 而 e.target 是 li、button、甚至 li 里的文本节点对应的元素
});
```

**记忆口诀**：**target 是「案发现场」，currentTarget 是「正在办案的警察局」**。

### 二、preventDefault：阻止默认行为 ⭐⭐

```js
// 默认行为 = 浏览器对事件的「标准响应」
form.addEventListener('submit', (e) => {
  e.preventDefault();            // 阻止表单提交刷新页面
});
a.addEventListener('click', (e) => {
  if (!confirm('确认离开?')) e.preventDefault();   // 阻止链接跳转
});

// ⭐ 检查是否可阻止：
e.cancelable;    // false 的事件（如 DOMContentLoaded）调 preventDefault 无效
// ⭐ 经典应用：移动端 touch 事件里 preventDefault 阻止滚动/双击缩放
```

**与 stopPropagation 的分工**（高频混淆点）：

```
preventDefault    →「别做你默认要做的」（不影响事件继续传播！）
stopPropagation   →「别再传给别人」（默认行为照做！）
两个都调          → 传播与默认都停
```

### 三、事件对象的常用字段速查 ⭐

```js
// 通用
e.type;            // 'click'
e.timeStamp;       // 触发时间戳
e.isTrusted;       // true=真实用户触发，false=JS dispatchEvent 合成 ⭐（反作弊检测）

// 鼠标
e.clientX/Y;       // 视口坐标
e.pageX/Y;         // 页面坐标（含滚动）
e.button;          // 0 左键 / 2 右键
e.ctrlKey/shiftKey/altKey/metaKey;

// 键盘
e.key;             // 'a' / 'Enter' / 'ArrowUp'（现代首选，替代过时的 keyCode）
e.code;            // 物理键位 'KeyA'（布局无关）

// 输入类
e.target.value;    // input 事件里读值的标准姿势
e.data;            // InputEvent：本次输入的字符

// 拖拽/触屏等各有专属字段（拖拽 dataTransfer / 触摸 touches）
```

**keyCode 已废弃**但存量代码常见——新代码一律 `e.key`。

### 四、合成事件：自己派发一场事件 ⭐

```js
const click = new MouseEvent('click', { bubbles: true, cancelable: true });
btn.dispatchEvent(click);      // 走完整事件流（可被委托捕获）
btn.click();                   // 元素方法捷径（同样触发监听）
// e.isTrusted 区分真实与合成 —— 自动化测试与反爬的博弈点
```

## 回看开篇

三个「元素身份」的答案：**target 永远是真实被点的源头**（可能深埋在监听元素内部）；**currentTarget 是监听所在的当前处理站**（传播途中谁在处理就是谁）；**this 在普通函数监听里恒等于 currentTarget**（addEventListener 隐式绑定，回顾《js-deep-006》）。「在容器监听、按 target 找源头」正是事件委托的全部思路。

## 实战延伸

**1. 面试答题骨架**：「事件对象中 target 是事件的真实源头、在整个传播过程不变，currentTarget 是当前正在执行监听的元素、随传播阶段变化且等于普通函数监听中的 this；preventDefault 阻止浏览器默认行为如链接跳转与表单提交但事件仍继续传播，stopPropagation 只阻止传播不影响默认行为；坐标用 clientX 视口系与 pageX 页面系，键盘用 e.key 替代废弃的 keyCode，isTrusted 区分用户真实操作与 dispatchEvent 合成事件。」

**2. 一道综合快手题**：

```js
a.addEventListener('click', (e) => {
  console.log(e.target.tagName, e.currentTarget.tagName, e.eventPhase);
});
// a 内有 <b>，点击 b：B A 3（1 捕获 2 目标 3 冒泡——此监听在冒泡段路过 a）
```

## 图解总结

```
事件对象 e = 快递单
 ├ 身份: target(案发现场,不变) | currentTarget(当前办案局,随传播变) | this===currentTarget
 ├ 信息: type/timeStamp | clientX-视口 vs pageX-页面 | key(新) vs keyCode(废)
 ├ 干预: preventDefault(禁默认,仍传播) ‖ stopPropagation(断传播,默认照做)
 │        stopImmediatePropagation(连本元素后续监听也断)
 └ 合成: new Event + dispatchEvent | isTrusted 辨真假
```

## 总结

- target 是事件源头（不变），currentTarget 是当前处理者（随传播变化）；
- preventDefault 管默认行为、stopPropagation 管传播，互不越界；
- 坐标系：client 视口 / page 含滚动；键盘用 e.key；
- isTrusted 区分真实与合成事件；
- currentTarget + this + 监听元素三者一致（普通函数监听）。

**面试一句话回答**：事件对象的 target 属性指向事件的真实触发源头、在整个捕获与冒泡过程中保持不变，currentTarget 指向当前正在执行监听器的元素、随事件传播阶段而变化，且在普通函数监听中与 this 相等——这正是事件委托能通过容器监听并用 target 定位源头的原理；preventDefault 用于阻止浏览器默认行为（如表单提交、链接跳转）但不影响事件继续传播，stopPropagation 则只阻断传播而默认行为照常执行；坐标方面 clientX 是视口坐标而 pageX 包含滚动偏移，键盘事件应使用 e.key 而非废弃的 keyCode，isTrusted 可以区分真实用户操作与 dispatchEvent 合成的事件。

## 思考题

1. 为什么 `e.target` 在「容器监听」时可能是孙子级元素？写出从 e.target 向上找到「带 data-id 的 li」的代码（提示：closest）。
2. `e.preventDefault()` 能阻止 `div` 的 click 吗？（cancelable 与「有没有默认行为」是两回事）
3. 移动端按住拖动会同时触发 touchmove 与滚动——如何用 preventDefault 实现自定义拖拽？（被动监听 passive 的关系）
4. 开放设计：实现「埋点系统」的三个钩子：全局 click 委托（target 链上找 data-track）、isTrusted 过滤合成点击、字段收集（type/pageX/timeStamp）——写出骨架。

（思考题解析将同步录入小程序题库，关联本文 id：dom-events-003）

## 参考文献：

- UI Events Specification — Event interface（字段规范）
- MDN — [Event](https://developer.mozilla.org/zh-CN/docs/Web/API/Event)、[KeyboardEvent.key](https://developer.mozilla.org/zh-CN/docs/Web/API/KeyboardEvent/key)
- 本课程《js-deep-006 this》（监听器中 this 的绑定原理）

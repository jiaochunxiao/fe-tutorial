---
id: dom-events-004
title: DOM 与事件之事件委托
series: DOM 与事件系列
seriesId: dom-events
stage: foundation
difficulty: 3
tags: [事件委托, 冒泡, closest, 动态列表, 性能]
readingTime: 16
prev: dom-events-003
next: dom-events-005
createdAt: 2026-10-26
---

# DOM 与事件之事件委托

## 从「动态加的第 101 项点不动」说起

```js
// 给每个列表项绑定点击
document.querySelectorAll('.item').forEach((li) => {
  li.addEventListener('click', handler);
});
// 后来 JS 动态插入了新的 <li class="item">……
// 新项点不动 ❗ —— 绑定发生在它存在之前
```

三种传统解法：插入时重新绑定（繁琐）、重绑全部（浪费）、**事件委托**（一个监听管所有，含未来新增）。⭐⭐ 事件委托是前两篇知识的集大成应用，也是面试里「DOM 事件」最常问的实战题。

## 现象与直觉解释

**事件委托（Event Delegation）**：不把监听挂在每个子元素上，而是**挂在共同祖先上**，利用事件冒泡（捕获也可以），在祖先的监听里通过 `e.target` 找到真实源头再分发处理。

直觉：**前台统一收发快递**——不必给每层楼配收发员，快递统一到前台，前台按地址分发。

```
传统:  li×100 各挂 1 个监听 = 100 个监听器
委托:  ul 挂 1 个监听 = 1 个监听器管 100 项（含未来新增）✅
```

## 深入原理

### 一、标准写法三步曲 ⭐⭐

```html
<ul id="list">
  <li data-id="1">第一项 <button class="del">删除</button></li>
  <li data-id="2">第二项 <button class="del">删除</button></li>
</ul>
```

```js
list.addEventListener('click', (e) => {
  // ① 找目标：从 e.target 沿 DOM 树向上找「带特征的元素」
  const delBtn = e.target.closest('.del');
  if (delBtn) {
    const id = delBtn.closest('li').dataset.id;
    removeItem(id);
    return;
  }

  // ② 第二个特征目标
  const item = e.target.closest('li');
  if (item) selectItem(item.dataset.id);
  // ③ 都不是 → 忽略（点到了 li 的缝隙等）
});
```

三个关键组件：

1. **容器单监听**（冒泡阶段）；
2. **`e.target.closest(选择器)`**：从真实源头向上匹配——解决了「点到的可能是 li 的子元素（button/span/文本）」的问题（closest 是 DOM 版的「沿原型链找」，对应 instanceof 的树版）；
3. **特征标记**：data-id 携带业务数据，class/data-* 标记可点击角色。

### 二、为什么它有效：两个前提 ⭐

1. **事件冒泡**（《dom-events-002》）——子元素的 click 必然路过 ul；
2. **target 不变**（《dom-events-003》）——无论传播到哪，源头永远可从 e.target 拿到。

**两个前提失效的场景（= 委托的边界）**：

- 不冒泡的事件（focus/blur → 换 focusin/focusout）；
- 子元素内部调了 `stopPropagation()`——事件根本到不了容器（第三方组件常见坑）。

### 三、收益清单 ⭐⭐

| 收益 | 说明 |
|---|---|
| **动态元素自动生效** | 绑定在容器，新插入的子元素天然被覆盖（开篇问题根治） |
| **内存** | 1 个监听器 vs N 个——大列表、长生命周期页面收益明显 |
| **绑定成本** | 无需循环绑/解——`removeEventListener` 的匹配噩梦消失 |
| **统一改逻辑** | 分发逻辑集中一处，改行为不用碰 DOM |

**框架里的委托**：React 合成事件全量委托到 root（17+）、Vue 的 @click 也支持在列表容器上写一个——两大框架都把本篇模式作为事件系统的底层设计。

### 四、委托的三个注意点 ⭐

```js
// ① closest 可能「越界」——匹配到容器外部结构时
if (delBtn && list.contains(delBtn)) { ... }   // 防御：确认目标在容器内

// ② mouseover/mouseout 的子元素抖动：子元素间移动也触发——
//    委托时要配合 e.relatedTarget 判断真正的进出

// ③ 大量不同事件类型分别委托 —— 一容器一事件类型一监听，别混在一个 handler 里 if 地狱
```

## 回看开篇

第 101 项点不动的原因：绑定发生在元素存在之前。委托的根治逻辑：**监听挂在「稳定的祖先」上，事件从「未来的子孙」冒泡而来**——绑定与元素的存在时间解耦，这就是「一次绑定、永久有效」的机制本质。

## 实战延伸

**1. 面试答题骨架**：「事件委托利用冒泡把监听挂到共同祖先，回调里用 e.target.closest 找到真实目标并按 class/data-* 特征分发——收益是动态新增元素自动生效、监听器数量从 N 降为 1、绑定解绑成本消失；边界是不冒泡事件（focus/blur 需换 focusin）与子元素 stopPropagation；注意 closest 可能匹配到容器外、需 contains 防御。React 把所有事件委托到 root 正是这个模式的工业化。」

**2. 手写小题**：表格行内多按钮委托（编辑/删除/复制）——一个监听 + closest('.btn-edit') 等分支，比每行每按钮绑定少两个数量级的监听器。

**3. 对比记忆**：委托 vs 发布订阅（《handwritten-006》）——委托是「DOM 事件的统一入口」，Emitter 是「自定义消息的统一入口」，思想同源：中间人收敛分发。

## 图解总结

```
        ul ══ 唯一的 addEventListener('click') ══
         ▲ 冒泡                     │ 回调里：
   ┌─────┼─────┐                    ▼
   li    li    li(未来新增也 ✅)   e.target.closest('.del') → 删除分支
   ▲btn                              closest('li')          → 选中分支
   └──真实点击源头(e.target)         都 miss                → 忽略
                                      └ contains() 防越界

前提: 冒泡 ✅ + target 恒定 ✅ → 边界: 不冒泡事件 / stopPropagation
```

## 总结

- 委托 = 容器单监听 + e.target.closest 定位 + 特征分发；
- 三大收益：动态元素自动生效、监听器 N→1、绑定解绑零成本；
- 前提是冒泡与 target 不变；边界是不冒泡事件与 stopPropagation；
- closest 防越界用 contains；mouseover 委托注意 relatedTarget；
- React/Vue 的事件系统是委托模式的工业化实现。

**面试一句话回答**：事件委托把监听器挂到列表容器等共同祖先上，利用事件冒泡让所有子元素（包括未来动态新增的）的点击统一到达祖先处理，回调中通过 e.target 配合 closest 向上查找带特定 class 或 data 属性的真实目标进行分发——它把监听器数量从 N 个降为 1 个、动态插入的元素自动被覆盖、也免去逐个绑定与解绑的成本；限制是被委托的事件必须冒泡（focus、blur 要换成会冒泡的 focusin、focusout），且子元素内部调用 stopPropagation 会截断到达容器的路径，closest 匹配后还需用 contains 确认目标仍在容器之内。

## 思考题

1. 把开篇代码改造成委托版；再问：若 li 内的 button 自己也绑了监听，谁先执行？（目标阶段注册序 vs 容器冒泡——传播顺序推演）
2. 委托 keydown 到容器做「表格快捷键」（Enter 保存、Delete 删除行）——与全局 window 委托的差异与选择依据？
3. 拖拽排序（li 内按下拖动）能纯委托吗？mousedown 委托 + mousemove/mouseup 挂 window 的混合方案怎么设计？
4. 开放讨论：React 为什么选择全量委托而不是逐元素绑定？从 1000 个列表项的内存、重渲染时的绑定维护、事件顺序可控性三个角度分析。

（思考题解析将同步录入小程序题库，关联本文 id：dom-events-004）

## 参考文献：

- MDN — [Event delegation](https://developer.mozilla.org/zh-CN/docs/Learn/JavaScript/Building_blocks/Events#事件委托)
- React 官方博客 — React 17 事件委托变更说明
- 本课程《dom-events-002 事件流》《dom-events-003 事件对象》（两大理论前提）

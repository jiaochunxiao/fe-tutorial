---
id: react-001
title: React 原理之 JSX 的本质
series: React 原理系列
seriesId: react
stage: intermediate
difficulty: 3
tags: [JSX, createElement, 虚拟DOM, 编译, React元素]
readingTime: 18
prev: null
next: react-002
createdAt: 2026-10-26
---

# React 原理之 JSX 的本质

## 从「JSX 里的注释都会报错」说起

> **系列导读**：《React 原理系列》共 8 篇——JSX、渲染流程、Fiber、Hooks、useEffect、setState、Redux 与性能优化，串起 React 的机制主干。

```jsx
<div>
  <!-- 这是一段 HTML 注释 -->     // ❌ JSX 里直接语法错误！
</div>
<div>
  {/* 这才是 JSX 的注释写法 */}
</div>
```

为什么「长得像 HTML」的 JSX 却不认 HTML 注释？——因为 **JSX 根本不是 HTML，甚至不是模板，它是 JavaScript 的语法扩展**。⭐⭐「JSX 的本质」是 React 面试第一题，正确答案一句话：**JSX 是 React.createElement 的语法糖**。

## 现象与直觉解释

```jsx
// 你写的 JSX：
const el = <h1 className="title">Hello, {name}</h1>;
```

Babel/编译器把它翻译成纯 JS：

```js
// 编译产物（React 17 之前经典版）：
const el = React.createElement(
  'h1',                    // type：标签字符串
  { className: 'title' },  // props
  'Hello, ', name          // children（依次排列）
);
// React 17+ 自动引入 jsx-runtime：
import { jsx as _jsx } from 'react/jsx-runtime';
const el = _jsx('h1', { className: 'title', children: ['Hello, ', name] });
```

**执行 createElement 得到的就是普通对象**——所谓「React 元素」：

```js
{
  $$typeof: Symbol('react.element'),   // ⭐ 防伪造标记（es6-006 的应用）
  type: 'h1',                          // 元素类型（字符串=DOM、函数=组件）
  key: null,
  ref: null,
  props: { className: 'title', children: ['Hello, ', '小明'] },
  _owner: …,
}
```

**JSX 的三层认知**：写的是类 HTML 语法 → 编译成函数调用 → 运行时得到「描述 UI 的普通对象」（vnode，《handwritten-008》同款）。

## 深入原理

### 一、JSX 与 HTML 的关键差异 ⭐⭐

| JSX | HTML | 原因（JS 本质） |
|---|---|---|
| `className` | `class` | class 是 JS 保留字；JSX 属性是 **JS 对象的 key** |
| `htmlFor` | `for` | for 是保留字 |
| `{/* */}` | `<!-- -->` | 对象里没有 HTML 注释这种语法 |
| `style={{color:'red'}}` 对象 | `style="color:red"` 字符串 | 传给 props 的是 JS 值 |
| `onClick={fn}` 函数 | `onclick="fn()"` 字符串 | 事件是 JS 回调不是字符串 |
| 布尔属性 `disabled={true}` | `disabled` | JS 布尔值 |
| **标签必须闭合** | `<br>` 可不闭合 | 语法分析的严格要求 |

一句话：**JSX 属性是 JS 对象字面量的 key，children 是函数参数**——所有差异都由此而来。

### 二、type 字段的分野：DOM 元素 vs 组件 ⭐⭐

```jsx
<div />                      // type: 'div'（小写开头 → 字符串 → DOM）
<User name="x" />            // type: User（大写开头 → 变量 → 组件）⭐
<user.name.Sub />            // 成员表达式也按组件
<user />                     // ⚠️ 小写开头被当 DOM 标签 'user' —— 著名坑
```

**大小写规则是编译约定**：小写 = 字符串（原生标签），大写/成员表达式 = 变量引用（组件）——「组件名必须大写」的机制根源。

```jsx
// 组件 JSX 的编译：
const el = <User name="x" />;
// → React.createElement(User, { name: 'x' })
//   注意：type 是【函数本身】，不是 'User' 字符串

// 而当 type 是函数时，React 渲染它 = 调用它：
// function User(props) { return <h1>{props.name}</h1>; }
// React.createElement(User, props) ──渲染──▶ 调用 User(props) ──▶ 得到下一层元素
// ── 递归直到 type 是字符串（DOM）——「组件是返回元素的函数」的全部含义
```

### 三、children 的四种形态 ⭐

```jsx
// ① 文本 / 表达式
<h1>Hello {user.name}</h1>
// ② 嵌套元素（数组）
<div><A /><B /></div>          // props.children = [<A/>, <B/>]
// ③ 函数（render props 模式）
<List render={(item) => <Row item={item} />} />  // children 可以是任意 JS 值——包括函数！
// ④ 条件与列表：JSX 里【没有】v-if/v-for —— 只能用 JS 本身
{isVip && <Badge />}                    // && 短路（注意 0 的陷阱：count && <X/> 当 count=0 会渲染 0）
{list.map((x) => <Row key={x.id} {...x} />)}   // map 生成数组
```

「JSX 没有模板语法，一切用 JS」——这既是学习门槛（没有指令可用），也是表达力的上限（任意 JS 逻辑都在语法内合法）。

### 四、编译期的安全标记：$$typeof ⭐

每个元素的 `$$typeof: Symbol('react.element')`——**JSON 无法产生 Symbol**（es6-006 讲过的特性），因此「从接口注入的 JSON 假元素」无法通过校验——React 用它防御「伪造元素的 XSS 注入」。一个字段，就是一道安全门。

### 五、JSX 不等于虚拟 DOM ⭐

精确的概念链（面试的高段位区分）：

```
JSX（语法）──编译──▶ createElement 调用（代码）
    ──执行──▶ React 元素（普通对象 / vnode）
        ──渲染流程──▶ Fiber 节点（react-003）──▶ 真实 DOM
```

JSX 是「描述」的书写形态；虚拟 DOM 是描述的数据形态；Fiber 是描述的工作形态——三者层层递进，别混用。

## 回看开篇

HTML 注释报错的答案：JSX 是 `createElement(参数1, 参数2, ...参数N)` 的语法糖——它的 body 是**函数调用的参数列表**，只接受 JS 表达式；HTML 注释不是 JS 表达式，`{/* */}`（JSX 官方妥协的注释语法）才是。**「长得像 HTML」只是 JSX 的化妆，骨子里全是 JavaScript。**

## 实战延伸

**1. 面试答题骨架**：「JSX 是 JavaScript 的语法扩展，本质是 createElement 或 jsx-runtime 函数调用的语法糖——编译器把标签翻译成 type、props、children 三要素的函数调用，运行时返回一个带 $$typeof Symbol 标记的普通对象即 React 元素。因此属性名遵循 JS 标识符规则（className/htmlFor），事件是函数对象，children 可以是任意 JS 值包括函数；小写标签编译为字符串代表 DOM，大写或成员表达式编译为变量引用代表组件——这是组件必须大写开头的机制根源。」

**2. 动手实验**：Babel 官网 repl 选 react preset，贴一段 JSX 看编译产物——五分钟建立「JSX 即函数调用」的肌肉记忆。

**3. 一个快手题**：`<User />` 与 `<user />` 的区别？——前者是组件调用，后者渲染出一个未知的 `<user>` DOM 标签（浏览器忽略或告警）。

## 图解总结

```
JSX 书写               编译产物                 运行时对象
<h1 class→className>  ──▶ _jsx('h1', {        ──▶ { $$typeof: Symbol,
  Hello {name}            className:'title',       type:'h1'|User,
</h1>                     children:['Hello',name]  props:{…,children:…},
                        })                        key, ref }
                                                  │
规则差异全部源于"参数是 JS 值"：                    ▼
 className│函数事件│对象style│必须闭合      type 是函数 ──▶ 调用它 ──▶ 递归到 DOM
 大写=组件(变量) / 小写=DOM(字符串)          $$typeof Symbol = 防JSON伪造
```

## 总结

- JSX = createElement/jsx 调用的语法糖；产物是普通对象（React 元素）；
- 属性是 JS 对象 key（className）、事件是函数、children 是任意 JS 值；
- type 小写字符串 = DOM；大写变量/成员表达式 = 组件——递归调用直到 DOM；
- JSX 无模板指令，条件与列表全靠 JS 表达式（&& 与 map，注意 0 陷阱）；
- $$typeof Symbol 防 JSON 伪造元素；JSX ≠ 虚拟 DOM ≠ Fiber——层层递进的概念链。

**面试一句话回答**：JSX 是 JavaScript 的语法扩展，本质是 React.createElement 或新版 jsx-runtime 函数调用的语法糖——编译器把 JSX 翻译成以元素类型、属性对象、子节点为参数的函数调用，执行后返回一个普通对象即 React 元素，其中 type 为字符串表示 DOM 元素、为函数则表示组件并在渲染时被调用、递归展开直到全部是 DOM。因此 JSX 属性名必须遵循 JS 标识符规范而使用 className 与 htmlFor，事件属性传入的是函数对象，children 可以是任意 JS 值包括函数与表达式；组件必须大写开头是因为编译器把小写标签编译为字符串、大写或成员表达式编译为变量引用；元素上的 Symbol 类型 $$typeof 则用于防御 JSON 注入的伪造元素。

## 思考题

1. 手写以下 JSX 的 createElement 调用形式与运行时对象：`<Card title="hi"><Button onClick={f} disabled /></Card>`。
2. `count && <Badge />` 在 count 为 0 时渲染出什么？给出三种修复（count > 0 && / !!count && / 三元）。
3. 为什么「JSX 里不能写 if 语句但能写三元与 &&」？（表达式 vs 语句——参数列表只接受表达式）
4. 开放讨论：React 17 把编译产物从 React.createElement 改为自动引入的 jsx-runtime——解决了什么问题？（不再需要每个文件 import React；编译器可优化）

（思考题解析将同步录入小程序题库，关联本文 id：react-001）

## 参考文献：

- React 官方文档 — JSX 简介 / 不使用 JSX 的 React
- Babel REPL — react preset 编译观察
- 本课程《handwritten-008 虚拟 DOM》《es6-006 Symbol》（$$typeof 与元素对象）

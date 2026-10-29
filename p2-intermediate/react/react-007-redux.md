---
id: react-007
title: React 原理之 Redux 与中间件
series: React 原理系列
seriesId: react
stage: intermediate
difficulty: 4
tags: [Redux, 单向数据流, 中间件, 洋葱模型, 状态管理]
readingTime: 20
prev: react-006
next: react-008
createdAt: 2026-10-26
---

# React 原理之 Redux 与中间件

## 从「10 个组件的状态像蜘蛛网」说起

状态在组件间流动的失控现场：A 的数据要给 C——层层 props（drilling）；C 的修改要通知 A——层层回调；再来一个 D 也要读……**状态流向成了 spaghetti**。

Redux 的方案：**把共享状态收归一处（Store），用一条唯一的修改通道（dispatch action），让变化单向流动**。⭐⭐「Redux 的核心思想」「中间件的洋葱模型」是状态管理必考。

## 现象与直觉解释

Redux 三原则（一切设计的出发点）：

1. **单一数据源**：整个应用一棵 state 树（Store）；
2. **State 只读**：唯一改法是 `dispatch(action)`（普通对象描述「发生了什么」）；
3. **纯函数变更**：reducer = `(state, action) => newState`——同输入同输出、无副作用。

单向数据流的闭环：

```
视图 dispatch(action) ──▶ reducer 算新 state ──▶ store 通知订阅者 ──▶ 视图重渲染
        ▲                                                              │
        └────────────────────── 用户交互 ──────────────────────────────┘
```

直觉：**公司只有一本总账（store）、改账必须填申请单（action）、账房按规则改（reducer）**——任何变动有据可查、可回放（时间旅行调试的根基）。

## 深入原理

### 一、极简 Redux：50 行实现核心 ⭐⭐

```js
function createStore(reducer, initialState) {
  let state = initialState;
  const listeners = new Set();                    // 订阅者（《handwritten-006》同款）

  function getState() { return state; }

  function dispatch(action) {
    state = reducer(state, action);               // ⭐ 纯函数产出新 state
    listeners.forEach((fn) => fn());              // 通知所有订阅者
    return action;
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);            // 返回退订函数
  }

  dispatch({ type: '@@INIT' });                   // 初始化：跑一遍 reducer
  return { getState, dispatch, subscribe };
}

// 使用：
const store = createStore((state = { count: 0 }, action) => {
  switch (action.type) {
    case 'ADD': return { ...state, count: state.count + action.n };  // ⭐ 不可变更新
    default: return state;                        // 未识别：原样返回
  }
});
store.subscribe(() => console.log(store.getState()));
store.dispatch({ type: 'ADD', n: 1 });
```

与 React 的接线（react-redux 做的事）：`Provider` 注入 store；`useSelector` = subscribe + 按需取片（浅比较决定重渲染）；`useDispatch` 暴露 dispatch。

### 二、中间件：dispatch 的洋葱增强 ⭐⭐⭐

「dispatch 前后想干点别的」（打日志、异步请求、错误上报）——但 dispatch 是核心 API，不能乱改。Redux 的答案：**中间件 = 高阶函数包装 dispatch**：

```js
// 中间件的签名（三层柯里化）：
const logger = (store) => (next) => (action) => {
  console.log('dispatching', action);
  const result = next(action);          // 调用「下一层 dispatch」
  console.log('next state', store.getState());
  return result;
};

// applyMiddleware 的核心逻辑（洋葱装配）：
function applyMiddleware(store, middlewares) {
  let dispatch = store.dispatch;                          // 最内层：原生 dispatch
  // ⭐ 从右到左层层包装：后注册的在外层
  middlewares.slice().reverse().forEach((mw) => {
    dispatch = mw({ ...store, dispatch })(dispatch);      // 柯里化逐层注入
  });
  return { ...store, dispatch };
}

// 装配 [logger, thunk] 后的调用链：
dispatch(action)
  → logger 外层（打印前） → next
    → thunk（判断函数则执行，否则放行） → next
      → 原生 dispatch（改 state + 通知）
    ← 返回
  ← logger 打印后
```

**洋葱模型**（与 Koa 中间件同构）：`next` 是「进入下一层」的钥匙——前半段代码在 next 之前（请求前），后半段在 next 之后（响应后）。

### 三、thunk：异步的标准入门 ⭐⭐

```js
// redux-thunk 的实现只有几行（一个中间件）：
const thunk = ({ dispatch, getState }) => (next) => (action) => {
  if (typeof action === 'function') {
    return action(dispatch, getState);   // action 是函数：执行它（异步逻辑的容器）
  }
  return next(action);                    // 普通对象：放行
};

// 于是可以 dispatch 函数：
const fetchUser = (id) => async (dispatch) => {        // thunk action
  dispatch({ type: 'USER_START' });
  try {
    const user = await api(id);
    dispatch({ type: 'USER_OK', user });               // 成功再 dispatch 普通对象
  } catch (e) {
    dispatch({ type: 'USER_FAIL', error: e });
  }
};
```

演进路线一句话：thunk（手写异步流程）→ saga（generator 描述副作用）→ RTK Query（声明式请求缓存，现代首选）。

### 四、React 时代的 Redux 定位 ⭐⭐

Redux 的强项：中大型应用的**可预测性**（时间旅行、动作日志、严格单向）与生态；代价：样板代码多、不可变更新繁琐（RTK 的 Immer 已大幅缓解）。

**现代选型光谱**：

| 场景 | 方案 |
|---|---|
| 局部/父子状态 | useState/useReducer、组件树内 |
| 中等共享 | Context（低频变化）+ useReducer |
| 复杂全局/需要时间旅行 | Redux Toolkit / Zustand / Pinia(Vue) |
| 服务端状态（缓存为主） | React Query / RTK Query —— **与服务端状态分离**是当代共识 ⭐ |

「客户端状态 vs 服务端状态分离」是 Redux 时代最重要的教训——把接口缓存塞进 Redux 导致海量样板与失效逻辑，React Query 们专治这一层。

## 回看开篇

蜘蛛网的解法：共享状态上收单一 store，修改收敛到 dispatch 单通道，reducer 纯函数保证可预测——**状态的「读」开放（subscribe），「写」收敛（dispatch）**——混乱的根源从来是「谁都能改」，Redux 把写权关进了笼子。

## 实战延伸

**1. 面试答题骨架**：「Redux 三原则是单一数据源、state 只读且只能通过 dispatch action 修改、reducer 纯函数产出新状态——由此获得可预测与时间旅行。createStore 内部是 state 加订阅者集合，dispatch 调 reducer 换新 state 再通知订阅。中间件是 dispatch 的洋葱包装，签名为 store => next => action，applyMiddleware 从右到左装配，next 进入下一层——logger 在 next 前后打日志、thunk 拦截函数型 action 执行异步逻辑。现代实践中客户端状态与服务端状态分离，接口缓存交给 React Query/RTK Query。」

**2. 一道经典题**：手写 logger 中间件 + thunk 的装配调用链，画出 dispatch 一个函数型 action 的完整穿越路径。

## 图解总结

```
单向数据流: view ──dispatch(action)──▶ reducer(纯) ──▶ 新state ──▶ 通知 ──▶ view

中间件洋葱:  dispatch ─▶ [logger] ─next─▶ [thunk] ─next─▶ 原生dispatch
                ▲ 打印前                    │ 函数action?执行它    │ 改state+通知
                └────────── 返回途中打印后 ◀─┴─────────◀──────────┘

createStore ≈ { getState, dispatch: reducer+notify, subscribe }
现代分工: 客户端状态(Redux/Zustand) ‖ 服务端状态(React Query) —— 分离共识
```

## 总结

- 三原则：单一数据源 / 只读 state（dispatch 唯一写口）/ 纯函数 reducer；
- createStore 核心：state + 订阅集合 + dispatch（reducer 换值 + 通知）；
- 中间件 = 三层柯里化包装 dispatch，洋葱模型，next 进下一层；
- thunk 拦截函数型 action 处理异步；演进 thunk→saga→RTK Query；
- 现代共识：客户端状态与服务端状态分离管理。

**面试一句话回答**：Redux 遵循三原则——全局单一 store、state 只读且只能通过 dispatch action 修改、由纯函数 reducer 根据旧状态与动作计算新状态，从而获得可预测性与时间旅行调试。createStore 的核心是内部维护 state 与订阅者集合，dispatch 时调用 reducer 产生新状态并通知所有订阅者。中间件是对 dispatch 的洋葱式增强，签名是三层柯里化的 store => next => action，applyMiddleware 从右到左装配，每层的 next 调用进入内层——logger 在 next 前后打印日志，thunk 判断 action 为函数时执行它以承载异步流程，之后再派发普通 action。现代实践把客户端状态与服务端状态分离，接口缓存交给 React Query 或 RTK Query 管理。

## 思考题

1. reducer 里直接修改 state 的字段会发生什么？为什么必须返回新对象？（订阅通知依赖引用比较——不可变是通知机制的前提）
2. 手写 `crashReporter` 中间件：捕获 next(action) 的异常并上报——画它在洋葱中的位置优势（为什么能兜住所有内层的异常）。
3. subscribe 的通知是同步遍历——某订阅者在回调里又 dispatch 会怎样？Redux 怎么防（是否在 dispatch 中标记）？
4. 开放讨论：Zustand 保留了「单一 store」但砍掉 action 类型与 reducer 样板——它放弃了 Redux 的什么能力？（强制可预测边界，换来写法自由）

（思考题解析将同步录入小程序题库，关联本文 id：react-007）

## 参考文献：

- Redux 官方文档 — Middleware 与 redux-thunk 源码
- 《React & Redux》官方教程 — Reducer 组合与不可变更新
- 本课程《handwritten-006 发布订阅》（store 订阅的原理同款）、《architecture-002 状态管理架构》

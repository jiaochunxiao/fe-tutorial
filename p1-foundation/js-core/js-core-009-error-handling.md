---
id: js-core-009
title: JavaScript 核心之错误处理与自定义错误
series: JavaScript 核心系列
seriesId: js-core
stage: foundation
difficulty: 2
tags: [错误处理, try-catch-finally, Error 类型, throw, 错误上报]
readingTime: 16
prev: js-core-008
next: null
createdAt: 2026-10-26
---

# JavaScript 核心之错误处理与自定义错误

## 从「一个 try 包住了整个页面」说起

```js
// 某页面的「保底」写法
try {
  initPage();
} catch (e) {
  console.log(e);   // 上线后页面白了，控制台只有一行 "Error: something"
}
// 排障信息量：零 —— 哪个模块？什么参数？什么状态？全部丢失
```

错误处理的两个极端都有害：**不 try**（用户看到白屏/控制台裸奔）与**乱 try**（吞掉错误、丢失上下文）。⭐ 本文讲清 try/catch/finally 的精确语义、七种内置错误类型、自定义错误的正确姿势，以及「错误边界与上报」的工程化起点（完整监控体系在《architecture-005》）。

## 现象与直觉解释

```
try {} catch (e) {} finally {}
   │       │          │
   │       │          └ 无论如何都执行（return 也拦不住它执行）
   │       └ 只有 try 【同步】抛错才进入（异步错误抓不到！）
   └ 被保护的代码段
```

直觉模型：try 是「安全网」，但**这张网只接同步的球**——setTimeout、事件回调里抛的球会从网眼漏掉（《js-async-001》的「栈不在了」问题）。

## 深入原理

### 一、try/catch/finally 的五个精确语义 ⭐⭐

```js
// ① catch 只接同步错误
try {
  setTimeout(() => { throw new Error('异步'); }, 0);  // ❌ 漏网
} catch (e) { console.log('接不到'); }
// 异步错误的正确接法：回调里自行 try，或 Promise .catch，或全局 onerror

// ② finally 永远执行——包括 try 里有 return
function f() {
  try {
    return 'from try';
  } finally {
    console.log('finally 依然跑了');   // 打印
    // ⚠️ finally 里 return 会【覆盖】try 的返回值 —— 千万别这么写
  }
}

// ③ catch 可以不写（只想要 finally 的清理语义）
try { risky(); } finally { cleanup(); }   // 错误继续向上抛，但清理已执行

// ④ 嵌套与重抛：catch 后 rethrow 保留原始堆栈
try { a(); }
catch (e) {
  if (e.code === 'RETRYABLE') return retry();
  throw e;   // 处理不了的错误【必须重抛】，别吞
}

// ⑤ throw 的不只是 Error——但永远只 throw Error（下面讲为什么）
throw '字符串错误';   // 能跑，但丢失堆栈——反模式
```

### 二、七种内置 Error 类型速查 ⭐

| 类型 | 触发场景 |
|---|---|
| `Error` | 基类 / 手动抛 |
| `TypeError` | 类型不对：`undefined.foo`、`x is not a function` |
| `ReferenceError` | 变量不存在（TDZ 也抛它） |
| `RangeError` | 值越界：栈溢出、`new Array(-1)` |
| `SyntaxError` | 语法错误 / `JSON.parse` 失败 / `new RegExp('(')` |
| `URIError` | `decodeURIComponent('%')` |
| `AggregateError` | `Promise.any` 全军覆没（ES2021） |

**按类型分流处理**是 catch 的正确姿势：

```js
try {
  JSON.parse(input);
} catch (e) {
  if (e instanceof SyntaxError) return fallbackParse(input);  // 可恢复
  throw e;                                                     // 不可恢复的重抛
}
```

### 三、Error 对象解剖：stack 才是排障的命 ⭐⭐

```js
const e = new Error('出错了');
e.message;  // '出错了' —— 人类可读的描述
e.name;     // 'Error'（子类是对应类型名）
e.stack;    // "Error: 出错了\n    at fn (app.js:12:15)\n    at …" —— 调用栈快照
e.cause;    // ES2022：错误链（包装底层错误时保留原始错误）

// ⭐ 生产排障三连问（都藏在构造时机里）：
//   哪个模块抛的？→ 在 message 里带上上下文
//   什么参数导致的？→ 把关键参数（脱敏后）进 message
//   原始错误是什么？→ 用 cause 链住
```

**为什么只 throw Error 而不 throw 字符串**：字符串没有 stack（定位不了抛出点）、`instanceof` 分流失效、监控平台无法归类——`throw 'xx'` 是错误处理的头号反模式。

### 四、自定义错误：两行继承 ⭐⭐

```js
class ApiError extends Error {
  constructor(code, message, { status, payload } = {}) {
    super(message);              // 必须调 super（this 由此诞生 —— js-deep-010 的 super 规则）
    this.name = 'ApiError';      // ⭐ 不写这句，name 还是 'Error'（原型链上的）
    this.code = code;
    this.status = status;
    this.payload = payload;
  }
}

class AuthError extends ApiError { /* 认证类细分 */ }

// 业务侧的优雅分流：
try { await fetchOrder(id); }
catch (e) {
  if (e instanceof AuthError) return redirectToLogin();
  if (e instanceof ApiError) return toast(e.message);
  throw e;                        // 未知错误重抛给全局兜底
}
```

### 五、错误链（cause）与包装的艺术 ⭐

```js
async function loadConfig() {
  try {
    return JSON.parse(await fetchText());
  } catch (e) {
    throw new ApiError('CONFIG_PARSE', '配置解析失败', { cause: e });  // 原始错误不丢
  }
}
// 上报时沿 cause 链展开 —— 「表层错误+根因」一起进监控
```

### 六、全局兜底：浏览器四张网 ⭐

```js
// ① 同步运行时错误（含资源加载错误的另一种通道）
window.addEventListener('error', (e) => report(e.error ?? e.message));

// ② Promise 未捕获拒绝（.catch 都没写的漏网之鱼）
window.addEventListener('unhandledrejection', (e) => report(e.reason));

// ③ 资源加载失败（img/script 的 src 挂了——用 capture 捕获阶段才接得到）
window.addEventListener('error', (e) => {
  if (e.target !== window) report(`资源加载失败: ${e.target.src}`);
}, true);

// ④ 框架层错误边界（React ErrorBoundary / Vue errorHandler）——组件树兜底
```

（上报策略、采样、sourcemap 还原堆栈——完整体系见《architecture-005 前端监控》。）

## 回看开篇

「一个大 try」的两个改进方向：**缩小 try 的范围到「可恢复的具体操作」**（JSON.parse、某个请求），并**用自定义错误携带 code/status/cause**——catch 里的每一行都在「分流处理或重抛」，而不是 log 完就吞。错误处理的目标不是「不报错」，而是**报错时可恢复、可定位、可归类**。

## 实战延伸

**1. finally 的经典应用**：资源清理（关闭 loading、释放锁）——try 里无论成功、失败、还是提前 return，loading 都必须关：

```js
try {
  setLoading(true);
  await submit();
} finally {
  setLoading(false);   // 不用 catch：错误继续上抛，但 UI 状态必然复位
}
```

**2. 面试答题骨架**：「try/catch 只能捕获同步错误，异步要在回调内捕获或走 Promise catch 与全局 unhandledrejection；finally 无论如何执行且其 return 会覆盖 try 的返回值；内置七种错误类型用 instanceof 分流；自定义错误继承 Error 并修正 name，用 cause 保留错误链；永远 throw Error 而非字符串以保留堆栈；全局兜底用 error 与 unhandledrejection 两个监听加捕获阶段的资源错误监听。」

## 图解总结

```
throw Error(子类) ──▶ try ──同步──▶ catch (instanceof 分流)
                        │                ├ 可恢复：处理
                        │                └ 不可恢复：rethrow
                        ▼
                    finally（清理/复位；return 会覆盖——禁用）
异步错误 ──▶ 回调内 try / Promise.catch / 全局 unhandledrejection
资源错误 ──▶ error 监听 + capture:true
错误对象 = message + name + stack + cause(链)
```

## 总结

- try/catch 只接同步错误；finally 必执行且能覆盖返回值（别那么干）；
- 七种内置类型按 instanceof 分流；处理不了必须重抛；
- Error 的 stack 是排障命脉——永远 throw Error 子类而非字符串；
- 自定义错误三件套：extends Error、super(message)、修正 this.name；cause 保留错误链；
- 全局四张网：error、unhandledrejection、捕获阶段资源错误、框架错误边界。

**面试一句话回答**：try-catch-finally 中 catch 只能捕获同步代码抛出的错误，异步错误需要在回调内部捕获或依赖 Promise 的 catch 与全局 unhandledrejection 监听；finally 无论如何都会执行且其中的 return 会覆盖原返回值；内置七种错误类型应通过 instanceof 分流处理，处理不了的必须重新抛出而不应吞掉；自定义错误要继承 Error 并调用 super 后修正 this.name，可用 cause 保留原始错误链；永远只抛出 Error 及其子类而非字符串——因为只有 Error 对象携带堆栈信息可供定位，全局兜底依靠 error 事件、unhandledrejection 与捕获阶段的资源错误监听三张网。

## 思考题

1. 写出输出顺序：try 里 return、catch 里没进、finally 里 console.log——如果 finally 改成 `return 'from finally'` 呢？
2. 为什么 `setTimeout(() => { throw … })` 在外层 try 接不到？从「catch 匹配的是同一调用栈的异常冒泡」解释（回顾《js-deep-001》）。
3. 实现 `withRetry` 的错误分流版：TypeError/ReferenceError 不重试（代码 bug 重试无意义）、网络/超时错误重试——自定义错误体系怎么设计？
4. 开放设计：上报系统会收到海量「同源错误」——在客户端做「错误指纹」（message+首个堆栈帧哈希）去重，说明指纹算法要规避什么（动态路径/随机 ID 造成指纹爆炸）。

（思考题解析将同步录入小程序题库，关联本文 id：js-core-009）

## 参考文献：

- MDN — [Error](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Error)、[try...catch](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Statements/try...catch)
- ECMA-262 现行版 — Error.prototype、AggregateError、Error cause 提案
- 本课程《js-async-001 回调函数》（异步栈问题）、《architecture-005 前端监控体系》（上报工程化）

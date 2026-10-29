---
id: ts-005
title: TypeScript 之类型收窄与类型守卫
series: TypeScript 系列
seriesId: ts
stage: expert
difficulty: 4
tags: [类型收窄, 类型守卫, 判别联合, is 断言, unknown]
readingTime: 18
prev: ts-004
next: ts-006
createdAt: 2026-10-26
---

# TypeScript 之类型收窄与类型守卫

## 从「if 判断之后类型自己变了」说起

```ts
function format(value: string | number) {
  value.toFixed(2);          // ❌ string 上没有 toFixed
  if (typeof value === 'number') {
    value.toFixed(2);        // ✅ 类型在这里自动变成 number！
  }
}
// 没有任何标注 —— TS 怎么知道 if 里是 number？
```

这就是**类型收窄（Narrowing）**——控制流分析让类型沿执行路径自动变窄。⭐⭐⭐ 收窄是「TS 为什么写起来不累」的根源，也是判别联合（前端最实用的模式）的基石。

## 现象与直觉解释

```
声明类型: string | number     （静态：可能是什么）
  │
  ▼ 控制流分析（编译器模拟执行路径）
路径类型: typeof === 'number' 分支内 → number   （动态：在这条路上一定是什么）⭐

一句话：收窄 = 编译器沿着代码路径【逐步证明】更精确的类型。
类型守卫（Type Guard）= 触发收窄的那个「证明手段」（if 判断/函数返回…）
```

## 深入原理

### 一、五类内置收窄手段 ⭐⭐⭐

```ts
// ① typeof 收窄（原始值）
if (typeof x === 'string') { x.length /* string */ }

// ② 相等性收窄（=== / !== / switch——字面量联合的杀手锏）
type Status = 'idle' | 'loading' | 'error';
if (status === 'error') { /* status: 'error' */ }

// ③ in 收窄（对象形状的粗筛）
if ('send' in transport) { transport.send() /* 有 send 的那个成员 */ }

// ④ instanceof 收窄（类的精确判定）
if (e instanceof ValidationError) { e.field /* 类实例类型 */ }

// ⑤ 真值收窄（注意坑 ⭐）
if (value) { }        // null/undefined 被剔除 ✅
// ⚠️ 但 0、''、false 也被剔除——falsy 收窄过宽，业务上区分"0 与 null"要显式 !== null
```

### 二、自定义守卫：`is` 断言（收窄的函数化）⭐⭐⭐

内置手段覆盖不了「业务形状判定」——用 `is` 声明「这个函数返回 true 时，参数是什么类型」：

```ts
// 需求：判定 ApiError（带 code 字段）
function isApiError(e: unknown): e is ApiError {     // ⭐ 返回类型是 "e is X"
  return typeof e === 'object' && e !== null && 'code' in e;
}

try { await fetchUser(); }
catch (e: unknown) {
  if (isApiError(e)) {
    e.code;        // ✅ 收窄成功：ApiError
  }
}
// ⚠️ 代价：函数体只是"承诺"——写错了 TS 不查（return true 但类型不符 = 谎报）
// 守卫函数体要【诚实】——这是 is 的纪律
```

### 三、判别联合（Discriminated Union）：前端最重要的类型模式 ⭐⭐⭐

```ts
// 状态机建模：每个状态带【不同】的数据，共享一个【判别字段】
type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string; retry: () => void }
  | { status: 'success'; data: User[] };

function render(state: State) {
  switch (state.status) {              // 判别字段: status
    case 'error':
      return `<p>${state.message}</p><button onclick=${state.retry}>`  // ✅ 有 message/retry
    case 'success':
      return state.data.map(Row)       // ✅ 有 data —— 不存在的字段编译期就拦
  }
}
// ⭐ 效果: "不可能的状态组合"在编译期绝迹（idle 状态访问 data？直接报错）
// Redux/Vuex action、异步请求状态、组件 props 的最佳建模方式
```

**与 optional 链堆字段的对照**（反模式）：

```ts
// ❌ 全部字段可选的大杂烩: 任何字段组合都合法 → 到处 if (x && y && z)
type BadState = { status: string; data?: User[]; message?: string }
// ✅ 判别联合: 非法组合不存在 → 收窄后放心访问
```

### 四、收窄的盲区与 widen-back ⭐⭐

```ts
// 盲区1: 回调里不保持收窄（编译器不能假设回调时机）
let value: string | null = get();
if (value !== null) {
  setTimeout(() => value.length);   // ❌ 回调里 value 回到 string | null
  // （闭包里别处的赋值可能发生在"现在与回调执行之间"——保守正确）
}

// 盲区2: 可变引用的收窄易失效 → 用 const 快照
if (obj.field !== null) { use(obj.field); }   // 若 obj.field 可变，函数调用后可能失效
const f = obj.field; if (f !== null) { use(f); }   // ✅ const 锁住收窄

// as const: 把值+结构都锁成最窄字面量
const config = { env: 'prod', list: [1, 2] } as const;
// config.env: 'prod'（不是 string）；list: readonly [1, 2]
```

### 五、never：收窄的终点与穷尽检查 ⭐⭐

```ts
function handle(state: State) {
  switch (state.status) {
    case 'idle': return 1;
    case 'loading': return 2;
    // 忘了 error/success
  }
  return assertNever(state);   // ⭐ 编译错误: state 还有 error|success 没处理
}
function assertNever(x: never): never { throw new Error('未穷尽: ' + x); }
// 新增联合成员时，漏改的 switch 在编译期暴露 ⭐ —— 大型状态机的守护神
```

## 回看开篇

if 里类型自动变化的机制：**控制流分析**——编译器沿路径累计「已证明的事实」（typeof 结果、相等性、in、instanceof），类型随之收窄；自定义守卫（is）把「证明」封装成可复用函数；判别联合则让「证明」一步到位（一个 switch 分支=一个精确类型）。

## 实战延伸

**1. 面试答题骨架**：「类型收窄指编译器沿控制流逐步把联合类型证明为更精确的分支——内置手段有 typeof、相等性与 switch、in、instanceof 与真值判断，其中真值收窄会把 falsy 值一并剔除需注意业务语义。自定义守卫用返回类型 e is X 把业务判定函数化，函数体诚实是纪律。判别联合用共享判别字段建模互斥状态，是状态机与请求状态的最佳模式，配合 assertNever 的 never 穷尽检查可在新增成员时编译期暴露遗漏。回调中收窄不保持、可变引用收窄易失效，用 const 快照与 as const 解决。」

**2. 一道经典题**：把「interface Result { loading; data?; error? }」的大杂烩重构为判别联合，并说明消除了哪些不可能状态。

## 图解总结

```
收窄 = 控制流分析沿路径证明更窄的类型
内置: typeof │ ===/switch │ in │ instanceof │ 真值(⚠️falsy过宽)
自定义: function is X(v): v is X —— 判定逻辑的函数化(诚实纪律)

判别联合: {status:'error', message} | {status:'success', data}
  switch(status) → 分支内精确类型 → 不可能组合绝迹 ⭐
  + assertNever(never) = 新增成员漏改即编译报错

盲区: 回调内收窄失效 │ 可变引用失效 → const 快照 / as const
```

## 总结

- 收窄是控制流类型分析；五类内置手段各有适用面；
- is 守卫把业务判定变成收窄依据，函数体必须诚实；
- 判别联合 + 穷尽检查（never）是状态建模的最佳实践；
- 回调与可变引用是收窄两大盲区——const 快照/as const；
- 大杂烩 optional 接口是判别联合要取代的反模式。

**面试一句话回答**：类型收窄是 TypeScript 的控制流分析——编译器沿执行路径累计类型证明，把联合类型逐步细化为更精确的分支。内置手段包括 typeof 判断、相等性与 switch、in 操作符、instanceof 以及真值判断，其中真值收窄会把零与空字符串等假值一并剔除，需要注意业务语义。自定义类型守卫通过返回类型「参数 is 类型」把业务形状判定封装成收窄依据，守卫函数体必须诚实。判别联合让每个状态携带各自的数据并共享判别字段，switch 判别后分支内获得精确类型，配合 never 与 assertNever 做穷尽检查，新增联合成员漏改分支会直接编译报错。收窄的盲区是回调内不保持、可变引用易失效，用 const 快照与 as const 加固。

## 思考题

1. 写守卫 `isNonEmptyString(v: unknown): v is string`（含长度>0 判定），并讨论它「承诺过头」的风险（空字符串被收窄为 string 没问题，但调用方可能误以为非空——命名如何传达语义）。
2. 把 AxiosError 处理链改写为判别联合（network/timeout/http/business 四类），每类带不同字段——对比 instanceof 链的可维护性。
3. `as const` 的三个效果（字面量化/readonly/元组化）分别在收窄中扮演什么角色？
4. 开放讨论：JSON Schema → TS 类型（backend 出 schema 前端收窄）的工程化——运行时校验（zod）与编译期类型如何用一套定义打通？

（思考题解析将同步录入小程序题库，关联本文 id：ts-005）

## 参考文献：

- TypeScript Handbook — Narrowing / Discriminated Unions
- 《Effective TypeScript》Item 22（never 与穷尽）
- 本课程《ts-001 结构化类型》《ts-007 unknown》（守卫的输入常是 unknown）

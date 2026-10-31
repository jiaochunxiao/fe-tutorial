---
id: ts-007
title: TypeScript 之 any、unknown 与类型安全思维
series: TypeScript 系列
seriesId: ts
stage: expert
difficulty: 4
tags: [any, unknown, never, 类型安全, 逃逸舱口]
readingTime: 16
prev: ts-006
next: ts-008
createdAt: 2026-10-26
---

# TypeScript 之 any、unknown 与类型安全思维

## 从「一个 any 污染整条调用链」说起

```ts
const data: any = JSON.parse(raw);
const user = data.user;        // any
render(user.name);             // any —— 任何拼写错误静默通过
countUp(user.nmae);            // ❌不报错！(拼错了) —— any 的传染性 💥
// 一处 any，下游全部失明 —— 类型系统的"溃堤效应"
```

⭐⭐ 「什么时候不得不用 any、用什么替代」是 TS 工程素养的试金石——本篇把 any/unknown/never 三兄弟讲清，建立「类型安全思维」的纪律体系。

## 现象与直觉解释

**三个「顶端与底端」成员**：

```ts
// any:    "我不看类型" —— 双向畅通（可赋任何值、可被当作任何值用）⚠️ 关闭检查
// unknown:"我不知道类型" —— 只能存、不能直接用 ⭐ 安全的 any
// never:  "不可能有值" —— 类型系统的底部（空集）
```

```
 assignable 关系:
   anything → any ✅   any → anything ✅  （双向全通 = 危险）
   anything → unknown ✅   unknown → anything ❌（必须先收窄/断言）
   never → anything ✅   anything → never ❌（空集可给一切，反之不行）
```

## 深入原理

### 一、any 的原罪：传染与静默 ⭐⭐⭐

```ts
// 罪1: 传染 —— any 与任何类型运算的结果还是 any
const x: any = 1;
const y: number = x;      // ✅（any 冒充 number）
const z = x + 1;          // z: any —— 沿调用链扩散

// 罪2: 静默 —— 拼写、null、不存在的方法全不报
x.foo.bar.baz();          // 编译通过，运行时爆炸 💥

// any 的两个"合理出生地"（明知故犯的官方逃逸口）:
// ① 渐进迁移的存量 JS 边界（tsconfig 的隐式 any 文件）
// ② 与动态性极强的库对接的局部适配层（尽快收窄离开）
```

### 二、unknown：安全的顶类型 ⭐⭐⭐

```ts
const data: unknown = JSON.parse(raw);
data.user;                // ❌ unknown 上不能访问任何属性 —— 强制你先证明

// 正确姿势1: 收窄（ts-005）
if (typeof data === 'object' && data !== null && 'user' in data) { … }

// 正确姿势2: 守卫函数
function isUser(v: unknown): v is User {
  return typeof v === 'object' && v !== null && 'id' in v && 'name' in v;
}
if (isUser(data)) { render(data.name); }   // ✅

// 正确姿势3: 泛型 + 校验器（zod 的思路：运行时校验 + 编译期类型一次到位）
const UserSchema = z.object({ id: z.string(), name: z.string() });
const user = UserSchema.parse(data);       // 类型+校验双保障 ⭐

// catch 的官方背书（TS 4.4 起 useUnknownInCatchVariables 默认）:
try { … } catch (e: unknown) {   // ⭐ catch 参数现代默认 unknown（旧版本是 any）
  if (e instanceof Error) console.error(e.message);
}
```

**一句话：unknown 把「我不知道」变成编译期义务**——要么证明（收窄/守卫）、要么显式负责（断言），不许装看不见。

### 三、never：底类型的两个正式身份 ⭐⭐

```ts
// 身份1: 穷尽检查（ts-005 的 assertNever —— 新增联合成员漏改即报错）
// 身份2: 不可能的分支标注
function fail(): never { throw new Error('停在这'); }
let x = cond ? value : fail();    // else 分支永不产出 → x 的类型不含 else 污染

// never 与 any 的相性:
type IsNever<T> = [T] extends [never] ? true : false;  // 直接 T extends never 有坑（分发）
```

### 四、类型安全思维的五条纪律 ⭐⭐⭐

```
① 边界收口: 外部输入（JSON/URL/宿主注入）一律 unknown + 守卫/校验器 ——
            any 只允许存在于"适配层内部"，出去必须是明确类型
② 禁 any 表达"不知道": 用 unknown —— 强迫后续代码证明
③ 断言最小化: as 是"我担保"，每次使用都要能说出担保理由；
            as any 双写 = 立刻重构的信号 ⭐
④ 泛型不用 any 顶: <T> + 约束（ts-002）才是正解
⑤ ESLint 站岗: @typescript-eslint/no-explicit-any 开警告，
            no-unsafe-* 系列拦截 any 的下游使用（严格团队直接 error）
```

### 五、any 的历史遗产与「逃生舱分级」⭐

```
逃生舱分级（按危险度）:
  any            → last resort（迁移期/极端动态）
  as X（单断言）  → "我有理由相信是 X"
  unknown+收窄    → 首选 ✅
  校验器(zod)     → 运行时也安全 ✅✅（外部数据的最优解）
```

## 回看开篇

any 污染链的根治：入口从 `any` 换成 `unknown` ——「user.nmae」立刻报错（unknown 上不能乱摸），逼迫在边界完成守卫或校验；**类型安全不是「不用 any」，而是把 any 关进边界内、让每次越界都必须显式签字画押。**

## 实战延伸

**1. 面试答题骨架**：「any 是双向畅通的顶类型——任何值可赋给它、它可当任何值用，且传染性强，一处 any 污染整条调用链、拼写错误静默通过；unknown 是安全的顶类型——任何值可赋给它，但使用前必须收窄或断言，是外部数据与 catch 参数的现代标准；never 是底类型，用于穷尽检查与不可能分支。工程纪律：外部输入一律 unknown 加守卫或 zod 校验器、不用 any 表达不知道、断言最小化且能说出理由、泛型用约束而非 any，配合 no-explicit-any 与 no-unsafe 系列 lint 站岗。」

**2. 一道重构题**：把「const data: any = await api();」重构为 unknown + 守卫 + 判别联合的三层防线——正好串联 ts-005。

## 图解总结

![都接受任何值，区别在于出不出得来](../../assets/svg/ts-007-any-unknown.svg)

*图 · 都接受任何值，区别在于出不出得来*

```
        unknown（安全顶: 只进不出——用前必须证明/断言）
       ↗ 任何值 → ✅ │ unknown → 具体 ❌（收窄后 ✅）
any（危险顶: 双向全通）── 传染 + 静默
       ↘ 罪: 链式扩散 │ 拼写不报 │ null 不查
never（底: 空集）── 穷尽检查 │ 不可达分支

纪律五条: 边界 unknown+守卫 │ 禁 any 表达不知道 │ 断言最小化 │
         泛型用约束 │ ESLint(no-explicit-any / no-unsafe-*)
逃生舱分级: 校验器 ✅✅ < unknown+收窄 ✅ < as X < any
```

## 总结

- any 双向畅通且传染——一处声明、整链失明；
- unknown 只进不出——使用前必须证明（收窄/守卫/校验器）；
- catch 参数现代默认 unknown；
- never 服务穷尽检查与不可达标注；
- 五条纪律 + lint 站岗；逃生舱按危险度分级。

**面试一句话回答**：any 是双向畅通的类型——任何值都能赋给 any、any 也能被当作任意类型使用，并且具有传染性，一处的 any 会让整条调用链失去检查，拼写错误与空值访问全部静默通过；unknown 是安全的顶类型——任何值可以赋给 unknown，但在使用前必须先收窄或断言，因此它是外部输入与 catch 异常的现代标准；never 是底类型，代表不可能存在的值，用于联合的穷尽检查和标注不可达分支。工程纪律包括：外部数据一律以 unknown 接收并配守卫函数或 zod 校验器、不用 any 表达不知道、断言最小化并要求能说明理由、泛型场景用约束而不是 any，并用 no-explicit-any 与 no-unsafe 系列规则让 ESLint 站岗。

## 思考题

1. `const x = obj as any as Foo`（双断言）在什么场景出现？更安全的替代（unknown 中转的语义差异）？
2. 实现一个 `safeJson<T>(raw: string, guard: (v: unknown) => v is T): T | null`——三行完成「解析+校验+类型」。
3. `noImplicitAny` 与 `strict` 家族的关系？列出 strict 打开后的五个关键子项。
4. 开放讨论：zod/valibot 这类「运行时校验 + 静态类型」双保障库会不会取代 .d.ts 手写守卫？各自的成本边界。

（思考题解析将同步录入小程序题库，关联本文 id：ts-007）

## 参考文献：

- TypeScript Handbook — any/unknown/never；TS 4.4 release notes（catch unknown）
- 《Effective TypeScript》Item 38~40（any 的治理）
- 本课程《ts-005 类型守卫》《security-004 前端数据安全》

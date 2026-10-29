---
id: ts-004
title: TypeScript 之 infer 与递归类型
series: TypeScript 系列
seriesId: ts
stage: expert
difficulty: 5
tags: [infer, 递归类型, 元组操作, Awaited, 类型体操]
readingTime: 18
prev: ts-003
next: ts-005
createdAt: 2026-10-26
---

# TypeScript 之 infer 与递归类型

## 从「ReturnType 的源码看不懂？」说起

```ts
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : any;
//                                                            ▲
//                                infer R = 「在这声明一个待推断的类型变量」⭐

// 它干了什么？
type F = () => { id: number };
ReturnType<F>;   // { id: number } —— 从"函数类型"里【抽出】了返回值类型
```

`infer` 是类型系统的**模式匹配捕获**——正则里的「捕获组」。⭐⭐⭐ 加上递归，类型系统就成了一门「可编程语言」：元组翻转、深度 Promise 解包、字符串解析……本篇从直觉到经典案例，讲透 type-level programming 的进阶双侠。

## 现象与直觉解释

```ts
// 值世界的"模式匹配 + 捕获"：正则
/(\d+)-(\d+)/.exec('2026-10')   // 捕获组 1: '2026'，组 2: '10'

// 类型世界的等价物：
type Match<T> = T extends `${infer Year}-${infer Month}` ? [Year, Month] : never;
Match<'2026-10'>;   // ['2026', '10'] —— 从字符串类型里"抽"出片段 ⭐
```

**一句话：`infer X` 在 extends 的模式里挖一个坑，让 TS 替你填上「匹配到的类型」**。

<figure style="margin:2.2em 0">
<svg viewBox="0 0 720 300" width="100%" role="img" aria-label="infer：模式匹配中的类型捕获槽">
  <defs>
    <marker id="t4-ink" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#1C1A17"/>
    </marker>
  </defs>
  <text x="30" y="34" font-family="Noto Sans SC,sans-serif" font-size="12.5" font-weight="700" fill="#6E675A">① 从函数签名捕获返回值</text>
  <rect x="30" y="48" width="150" height="60" rx="8" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.5"/>
  <text x="105" y="73" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11.5" fill="#1C1A17">type F =</text>
  <text x="105" y="93" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11.5" fill="#1C1A17">() =&gt; User</text>
  <path d="M 184 78 H 234" stroke="#1C1A17" stroke-width="1.6" marker-end="url(#t4-ink)"/>
  <rect x="240" y="44" width="250" height="68" rx="8" fill="#FBF8F1" stroke="#1C1A17" stroke-width="1.5"/>
  <text x="365" y="70" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11.5" fill="#1C1A17">(...args:any[]) =&gt;</text>
  <rect x="330" y="78" width="86" height="24" rx="5" fill="none" stroke="#B03A2E" stroke-width="1.6" stroke-dasharray="4 3"/>
  <text x="373" y="95" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11.5" fill="#B03A2E">infer R</text>
  <text x="452" y="95" font-family="JetBrains Mono,monospace" font-size="11.5" fill="#1C1A17">← 挖坑待填</text>
  <path d="M 490 78 H 540" stroke="#1C1A17" stroke-width="1.6" marker-end="url(#t4-ink)"/>
  <rect x="546" y="52" width="140" height="52" rx="8" fill="#EFE8D8" stroke="#B03A2E" stroke-width="1.8"/>
  <text x="616" y="76" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="12" font-weight="700" fill="#B03A2E">R = User</text>
  <text x="616" y="94" text-anchor="middle" font-family="Noto Sans SC,sans-serif" font-size="11" fill="#6E675A">捕获完成</text>
  <text x="30" y="178" font-family="Noto Sans SC,sans-serif" font-size="12.5" font-weight="700" fill="#6E675A">② 从字符串字面量捕获两个片段</text>
  <rect x="30" y="192" width="150" height="60" rx="8" fill="#EFE8D8" stroke="#1C1A17" stroke-width="1.5"/>
  <text x="105" y="217" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11.5" fill="#1C1A17">type S =</text>
  <text x="105" y="237" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11.5" fill="#1C1A17">'2026-10'</text>
  <path d="M 184 222 H 234" stroke="#1C1A17" stroke-width="1.6" marker-end="url(#t4-ink)"/>
  <rect x="240" y="188" width="250" height="68" rx="8" fill="#FBF8F1" stroke="#1C1A17" stroke-width="1.5"/>
  <text x="365" y="214" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11.5" fill="#1C1A17">`${infer Y}-</text>
  <rect x="300" y="222" width="78" height="24" rx="5" fill="none" stroke="#B03A2E" stroke-width="1.6" stroke-dasharray="4 3"/>
  <rect x="382" y="222" width="86" height="24" rx="5" fill="none" stroke="#B03A2E" stroke-width="1.6" stroke-dasharray="4 3"/>
  <text x="414" y="239" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11.5" fill="#B03A2E">infer M</text>
  <path d="M 490 222 H 540" stroke="#1C1A17" stroke-width="1.6" marker-end="url(#t4-ink)"/>
  <rect x="546" y="192" width="150" height="64" rx="8" fill="#EFE8D8" stroke="#B03A2E" stroke-width="1.8"/>
  <text x="621" y="218" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11.5" font-weight="700" fill="#B03A2E">Y = '2026'</text>
  <text x="621" y="240" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11.5" font-weight="700" fill="#B03A2E">M = '10'</text>
  <text x="30" y="288" font-family="Noto Sans SC,sans-serif" font-size="12.5" fill="#6E675A">两行的共同点：模式里挖一个 infer 槽，让编译器把「匹配到的类型」填进来——和正则的捕获组是同一个思想。</text>
</svg>
<figcaption style="font-family:'Noto Sans SC',sans-serif;font-size:13px;color:#6E675A;text-align:center;margin-top:10px">图 · infer = 类型层面的正则捕获组——函数签名、字符串字面量都能被模式匹配拆解</figcaption>
</figure>

## 深入原理

### 一、infer 的三个经典落点 ⭐⭐⭐

```ts
// ① 函数相关（最常用）
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;
type Parameters<T> = T extends (...args: infer P) => any ? P : never;
type FirstParam<T> = T extends (first: infer F, ...rest: any[]) => any ? F : never;

// ② Promise 解包（Awaited 的简化版）
type Awaited<T> = T extends Promise<infer V> ? Awaited<V> : T;   // 递归登场 ⭐
Awaited<Promise<Promise<number>>>;   // number —— 层层解包！

// ③ 元组操作（体操高发区）
type Head<T extends any[]> = T extends [infer F, ...any[]] ? F : never;
type Tail<T extends any[]> = T extends [any, ...infer Rest] ? Rest : [];
Head<[1, 2, 3]>;   // 1
Tail<[1, 2, 3]>;   // [2, 3]
```

### 二、递归类型：类型调用自己的两个条件 ⭐⭐⭐

```ts
// 条件1: 基例（能终止的形态）  条件2: 需要时尾随展开（TS 4.5+ 支持尾递归优化）

// 经典1: Flatten（拍平嵌套元组）
type Flatten<T extends any[]> =
  T extends [infer F, ...infer R]
    ? F extends any[] ? [...Flatten<F>, ...Flatten<R>] : [F, ...Flatten<R>]
    : [];
Flatten<[1, [2, [3, 4]], 5]>;   // [1, 2, 3, 4, 5] ✅

// 经典2: Reverse（倒序元组）
type Reverse<T extends any[]> =
  T extends [infer F, ...infer R] ? [...Reverse<R>, F] : [];
Reverse<[1, 2, 3]>;             // [3, 2, 1]

// 经典3: DeepReadonly（递归只读——映射+条件+递归三合一）
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};
```

### 三、字符串类型体操（模板字面量 + infer 的化学反应）⭐⭐

```ts
// 模板字面量类型（TS 4.1+）：字符串类型可以被"拼接"和"匹配"
type Greeting = `hello ${string}`;            // 匹配一切 'hello xxx'

// 实战1: getter 名生成（ts-003 as 重映射的强化版）
type Getters<T> = { [K in keyof T as `get${Capitalize<K>}`]: () => T[K] };

// 实战2: 解析 'a=1&b=2' —— 一条 QueryString 解析成对象类型（究极体操，欣赏即可）
type ParseQS<S extends string> =
  S extends `${infer K}=${infer V}&${infer Rest}`
    ? { [P in K]: V } & ParseQS<Rest>
    : S extends `${infer K}=${infer V}` ? { [P in K]: V } : {};
ParseQS<'page=1&size=10'>;   // { page: '1' } & { size: '10' }
```

### 四、inference 的用武之地与「过度工程」红线 ⭐⭐

```
✅ 日常值得（真实高频）:
   Awaited（await 的类型推导——官方用它）
   ReturnType/Parameters（hooks/高阶函数的签名推导）
   DeepReadonly/DeepPartial（配置与表单场景）

⚠️ 炫技区（面试题出现、生产慎用）:
   ParseQS / 元组四则运算 / 编号系统（type-challenge hard 区）

红线判据:
   类型推导报错时，团队成员能不能看懂？→ 不能 = 拆掉，写显式类型
   「编译时间显著变长」也是退信号（复杂类型计算的实测代价）
```

**type-challenge** 是本篇最好的练习场——easy 到 medium 的 infer/递归题做完，两大侠就算出师。

## 回看开篇

ReturnType 的可读化：`(...args: any[]) => infer R` 是「函数类型的模式」——infer R 在返回值的位置挖坑，TS 匹配时把真实返回类型填进去，条件分支取出。**infer 的本质是「从既有类型结构中提取子结构的类型」**——正则捕获组思维的类型版。

## 实战延伸

**1. 面试答题骨架**：「infer 在条件类型的 extends 模式中声明一个待推断的占位类型变量，编译器匹配时自动填充——相当于类型层面的正则捕获组，用于从函数签名提取返回值与参数（ReturnType 与 Parameters 的本体）、从 Promise 中提取内部值、从元组中提取首尾。配合递归可实现 Awaited 的深度解包、Flatten 拍平、Reverse 倒序与 DeepReadonly 深层变换；模板字面量类型加 infer 还能解析字符串字面量类型。工程边界是可读性与编译成本——团队读不懂或编译变慢时退回显式声明。」

**2. 一道手写题**：`Last<T extends any[]>`（取元组末位）——提示：`T extends [...any[], infer L] ? L : never`。

## 图解总结

```
infer = 类型正则的捕获组:
  T extends 模式(含 infer X) ? 用X : ...
  落点: 函数(R/P) │ Promise<V> │ 元组 [F, ...R] │ 字符串 `${infer A}-${infer B}`

递归 = 基例 + 自调用:
  Awaited: Promise<infer V> ? Awaited<V> : T     ← 深解包
  Flatten/Reverse: [infer F, ...infer R] 拆头 + 递归尾
  DeepReadonly: 映射 × 条件 × 递归 三合一

红线: 团队读不懂 / 编译变慢 → 退显式（type-challenge 是练习场）
```

## 总结

- infer 是条件类型模式中的待推断占位——类型版正则捕获组；
- 四大落点：函数签名、Promise 内值、元组首尾、字符串字面量片段；
- 递归条件：基例可终止；Awaited/Flatten/Reverse/DeepReadonly 是四大经典；
- 模板字面量 × infer 可以解析字符串类型（Query String 级体操）；
- 边界：可读性与编译成本优先——type-challenge 练功，生产克制。

**面试一句话回答**：infer 用在条件类型的 extends 模式中声明一个待推断的类型变量，编译器在模式匹配时自动把对应位置的真实类型填入——它相当于类型层面的正则捕获组。经典应用包括从函数类型提取返回值与参数（ReturnType 与 Parameters 的实现本体）、从 Promise 类型提取内部值（Awaited 递归解包）、从元组提取首尾元素，配合模板字面量类型还能解析字符串字面量类型如查询串。递归类型要求有可终止的基例，能实现元组拍平、倒序与 DeepReadonly 这类深层结构变换。工程上以团队可读性与编译成本为红线，复杂推导读不懂或拖慢编译时应当退回显式类型声明。

## 思考题

1. 手写 `Last<T>` 与 `DropLast<T>`（互为一对的元组操作）。
2. `Awaited<Promise<Promise<never>>>` 的结果？（never 在解包链中的传递——好玩的行为）
3. 实现 `UnionToTuple`？为什么它极难（联合类型无序性）——查资料并总结现有 hack 的思路。
4. 开放设计：为「路由表 → 类型安全的 params」设计推导链：`'/user/:id' → { id: string }`（模板字面量 + infer + 递归 trim）。

（思考题解析将同步录入小程序题库，关联本文 id：ts-004）

## 参考文献：

- TypeScript Handbook — Type Inference in Conditional Types / Recursive
- type-challenges 仓库（easy~medium 的 infer/递归题单）
- 本课程《ts-003 映射与条件类型》（infer 的宿主是条件类型）

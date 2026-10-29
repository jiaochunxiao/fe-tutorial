---
id: ts-008
title: TypeScript 之工程实践：配置与常见问题
series: TypeScript 系列
seriesId: ts
stage: expert
difficulty: 4
tags: [tsconfig, strict, 工程实践, 类型迁移, 治理]
readingTime: 18
prev: ts-007
next: null
createdAt: 2026-10-26
---

# TypeScript 之工程实践：配置与常见问题

## 从「两个项目的 tsconfig 差一个 strict，维护性天差地别」说起

> 本篇是《TypeScript 系列》收官——从类型语法回到工程现场：**tsconfig 怎么配、老项目怎么迁、类型质量怎么治理**。

```jsonc
// 项目A: "strict": false  —— 类型注解形同虚设，null 到处飞，any 满地走
// 项目B: "strict": true   —— 编译期拦住整类线上 bug
// 同样"用了 TS"，安全收益完全不同 —— 配置即水位 ⭐
```

⭐⭐ tsconfig 的关键字段与渐进迁移策略，是「TS 工程化」的必答题。

## 深入原理

### 一、strict 家族：一行配置背后的九道闸门 ⭐⭐⭐

```jsonc
{
  "strict": true
  // 等价于同时打开（每一道都是一类 bug 的防线）:
  // strictNullChecks      null/undefined 不再能赋给一切 ⭐（防一半的运行时崩）
  // noImplicitAny         隐式 any 报错（堵住 any 的悄悄扩散）
  // strictFunctionTypes   函数参数逆变检查
  // strictBindCallApply   bind/call 参数校验
  // strictPropertyInitialization 类属性必须初始化
  // noImplicitThis        this 隐式 any 报错
  // alwaysStrict          输出 "use strict"
  // useUnknownInCatchVariables catch 参数 unknown（ts-007）
  // noImplicitOverride    覆写必须显式 override
}
```

**strictNullChecks 是九道闸里收益最大的一道**（著名的「十亿美元错误」null 的编译期防线）——新项目无脑 strict，没有讨论空间。

### 二、必须懂的「双编译目标」⭐⭐

```jsonc
{
  "target": "ES2020",       // 语法降级目标（影响: 产物的语法形态）
  "lib": ["ES2020", "DOM"], // 类型世界的"可用面"（影响: Promise.allSettled 有没有类型）
  "module": "ESNext",
  "moduleResolution": "bundler",  // 与 Vite/webpack 对齐（esm 风格解析）
  // ⚠️ 两件分离的事: 「类型检查」(tsc --noEmit) 与「产物编译」(bundler/esbuild)
  //   现代工程: tsc 只做检查(npm run typecheck)，打包交给 Vite/esbuild/swc ⭐
}
```

### 三、路径与声明实战三件套 ⭐⭐

```jsonc
{
  "baseUrl": ".",
  "paths": { "@/*": ["src/*"] },     // ⚠️ 构建工具(vite.config)还要配同名 alias —— 双端同步
  "types": ["vite/client"],           // 环境类型（import.meta.env 等）
  "include": ["src", "typings"]       // 检查范围; exclude: dist/node_modules
}
// 常见的补丁文件 typings/*.d.ts:
//   env.d.ts: declare module '*.svg' …
//   global.d.ts: window 上的宿主注入（ts-006）
```

### 四、渐进迁移路线图（JS 老项目 → TS）⭐⭐⭐

```
阶段0: 心理建设 —— TS 迁移可以【增量】进行，不必大爆炸
阶段1: allowJs + checkJs(false): TS 能 import js —— 构建切到 tsc/bundler 无痛
阶段2: 新文件一律 .ts; 配 strictNullChecks（渐进开关）:
       // @ts-strict-ignore 注释豁免存量 ⭐（文件级/表达式级临时逃逸）
阶段3: 边界先行: 给「模块出口」补类型（.d.ts 或 JSDoc）—— 内部暂 any
阶段4: 按依赖图自底向上迁移（工具函数 → 组件 → 页面）;
       JSDoc 让老 js 零改造拿到类型（/** @param {number} n */）
阶段5: 全量 strict + lint(no-explicit-any) + CI typecheck 关卡
```

**迁移的三大纪律**：不追求一次 strict；类型跟着「修改热点」走（常改的文件优先）；每阶段可发布（保持主干可运行）。

### 五、类型质量的日常治理 ⭐⭐

```
度量: tsc --noEmit 的错误数趋势（ CI 里记录）
      grep -r ": any" src | wc -l（显式 any 计数）⭐
      @typescript-eslint 的 warning 数
关卡: CI: npm run typecheck 必须绿; PR 模板勾选"无新增 any"
工具: eslint + @typescript-eslint（no-explicit-any/no-unsafe-*）
      speed: 大项目用 tsc --incremental + 项目引用(project references)分包检查
```

### 六、高频报错速查（「这什么意思」翻译表）⭐⭐

```
"Type 'X' is not assignable to type 'Y'"
  → 结构不满足（ts-001）: 对照 Y 的每个成员逐一检查（少字段/字段类型窄了）
"Property 'x' does not exist on type 'Y | Z'"
  → 联合没收窄（ts-005）: 用判别/in/typeof 收窄后再访问
"Type 'X' is missing the following properties from type 'Y'"
  → 字面量直传触发「多余/缺失属性检查」: 先赋给变量或补齐字段
"'X' is possibly 'undefined'"
  → strictNullChecks: ?? 默认值 / if 判空 / ! 断言（要能担保）
"This expression is not callable / Not a function"
  → 类型推断成了错误的联合成员; 收窄或重签函数
```

## 回看开篇

项目 A 与 B 的差距 = `strict` 一行——它打开的是九道编译期防线（其中 null 检查拦下整类崩溃）。**TS 的收益不在「写了注解」，而在「配置的水位 + 治理的纪律」**——strict 全开、any 有数、CI 把关，三者齐备才算真正用上了 TS。

## 实战延伸

**1. 面试答题骨架**：「tsconfig 的 strict 打开九道检查，其中 strictNullChecks 与 noImplicitAny 收益最大，新项目必须全开；target 管语法降级而 lib 决定类型世界的可用面，现代工程里 tsc 只负责 --noEmit 类型检查、产物交给 bundler 编译；paths 别名要和构建工具双端同步，资源与环境类型靠 typings 补声明。老项目渐进迁移按五阶段：allowJs 先行、新文件 TS 化、边界模块先补类型、按依赖图自底向上、最后全量 strict 加 CI 关卡；治理上用显式 any 计数与 typecheck 错误趋势做度量，配 no-explicit-any 等规则让类型质量可守。」

**2. 一道配置诊断题**：「vite 项目里 `@/` 导入报错但能构建」——tsconfig 的 paths 没配/没同步 vite alias，或 include 漏了目录；「import.meta.env 无类型」——缺 types: ["vite/client"]。

## 图解总结

```
strict = 九道闸(NullChecks⭐/ImplicitAny/FunctionTypes/…)
双目标: target=语法降级 │ lib=类型可用面 │ 现代分工: tsc检查 + bundler编译
配套: paths×构建alias双端同步 │ typings补资源与环境类型

迁移五阶段: allowJs → 新文件TS → 边界先类型 → 自底向上 → strict+CI
纪律: 不大爆炸 │ 跟修改热点 │ 每阶段可发布
治理: any计数 │ typecheck错误趋势 │ eslint(no-explicit-any) │ CI关卡
报错翻译: not assignable=结构缺 │ not exist=未收窄 │ possibly undefined=判空
```

## 总结

- strict 一行开九闸，strictNullChecks 收益最大，新项目必开；
- target/lib 分管语法与类型面；tsc 检查与 bundler 编译分离是现代分工；
- paths 与构建 alias 双端同步；typings 补资源与环境声明；
- 渐进迁移五阶段 + 三纪律（不大爆、跟热点、可发布）；
- 治理度量：any 计数、错误趋势、lint 关卡。

**面试一句话回答**：tsconfig 的 strict 选项一次性开启九类检查，其中 strictNullChecks 拦截空值引发的整类运行时错误、noImplicitAny 阻止 any 静默扩散，收益最大，新项目应全部开启。target 决定语法降级目标、lib 决定类型层面的可用面，现代工程的分工是 tsc 只做 noEmit 类型检查、产物编译交给 Vite 或 esbuild；paths 别名必须与构建工具的 alias 双端同步，资源与环境类型通过 typings 目录补声明。JavaScript 老项目按五阶段渐进迁移——先开 allowJs、新文件一律 TS、给模块边界补类型、按依赖图自底向上改造、最后全量 strict 并在 CI 设 typecheck 关卡；日常治理用显式 any 计数与类型错误趋势做度量，配合 no-explicit-any 等 lint 规则守住类型质量。

## 思考题

1. `strict: true` 打开后存量报错 800 个——你的分批推进策略？（按目录开闸/ts-strict-ignore/错误分类先易后难）
2. tsc 增量检查（--incremental）与项目引用的原理差异？大仓（500+ 文件）怎么组合？
3. 为什么「tsc 做 bundler 用」逐渐式微？（编译速度与生态——esbuild/swc 的分工逻辑）
4. 开放设计：给团队写一份「TS 类型质量守则」：strict 水位、any 预算、断言规范、公共 API 的导出类型要求——列出五条可执行的硬指标。

（思考题解析将同步录入小程序题库，关联本文 id：ts-008）

## 参考文献：

- TypeScript Handbook — tsconfig 全字段文档 / Strict 检查清单
- 《Effective TypeScript》第 4 章（迁移与治理）
- 本课程《ts-001~007》——本篇是它们的工程落点

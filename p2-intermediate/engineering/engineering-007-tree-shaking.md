---
id: engineering-007
title: 前端工程化之 Tree Shaking 的原理
series: 前端工程化系列
seriesId: engineering
stage: intermediate
difficulty: 4
tags: [Tree Shaking, 静态分析, 副作用, sideEffects, ESM]
readingTime: 18
prev: engineering-006
next: engineering-008
createdAt: 2026-10-26
---

# 前端工程化之 Tree Shaking 的原理

## 从「引了一个函数，打包了整个 lodash」说起

```js
import { debounce } from 'lodash-es';
// 只用一个 debounce，产物里却躺着整个 lodash（几百个函数）？
// 「Tree Shaking（摇树）」：把没用到的导出像枯叶一样摇掉 —— 为什么有时摇得干净、有时纹丝不动？
```

⭐⭐ Tree Shaking 的成败取决于一个前提（**ESM 静态结构**）与一个声明（**sideEffects**）——这道题考的是「静态分析能力的边界」。

## 现象与直觉解释

**核心思想**：打包器在**编译期**画出「哪些导出被使用了」——没被使用的导出整体剔除。

```
一棵"模块树"：
moduleA { export a, b, c }
使用方只 import { a } ──▶ b、c 是"枯叶" ──▶ 摇掉 🍂
```

**为什么必须 ESM**——静态与动态的分水岭：

```js
// ESM：import/export 必须顶层静态书写（es6-010）
import { a } from './mod';
// → 编译期就能确定依赖图与每个导出的使用者 ✅ 可摇

// CJS：require 是【运行时】普通函数调用
const lib = './' + name + '.js';
const mod = require(lib);          // 路径拼接！
if (dev) require('./devtools');    // 条件引入！
// → 不运行代码无法知道加载了什么 ❌ 无法摇（保守全保留）
```

## 深入原理

### 一、摇树的完整判定链 ⭐⭐⭐

```
① 依赖图：从入口解析全部 import（ESM 静态）
② 标记：从入口出发"可达"的 export 被标记为【已使用】
③ 副作用检查：未使用的 export，其所在模块有副作用吗？
   ├─ package.json 声明 sideEffects: false ──▶ 模块整体无副作用 ──▶ 放心删 ✅
   ├─ 未声明 / sideEffects: ["*.css", "./polyfill.js"] ──▶ 未列出的模块才可删
   └─ 有副作用的模块 ──▶ 即使导出没人用也【保留】（删了可能改变行为）⚠️
④ 压缩期死代码消除（Terser）：无引用的变量/函数体最终物理删除
```

### 二、sideEffects：把「删了安全」显式声明出来 ⭐⭐⭐

**为什么需要它**——打包器不知道这个模块「删掉会不会出事」：

```js
// utils.js —— 有副作用的经典形态：
export function pure() { return 1; }        // 纯的，删了没事
console.log('模块加载时执行了！');            // ⚠️ 副作用：import 即执行
window.polyfill = …;                         // ⚠️ 副作用：改全局
export const side = mixin({…});              // ⚠️ 顶层执行的复杂表达式
// 若 main 只 import { pure }：console 那行删不删？
// 没有声明时打包器【不敢删】—— 保守保留整个模块
```

```json
// package.json 的声明（库作者的承诺）：
{ "sideEffects": false }                        // 全部模块都是纯的，随便删
{ "sideEffects": ["*.css", "./src/polyfill.js"] } // 这些有副作用要保留，其余可删
// ⚠️ 声明是【承诺】不是检测——声明错了（漏报副作用）会引发线上 bug（样式丢失/全局未定义）
```

### 三、摇不动的常见现场与修复 ⭐⭐

| 现场 | 原因 | 修复 |
|---|---|---|
| `import _ from 'lodash'`（CJS 版） | CJS 无静态结构 | 换 `lodash-es` 或按路径 `lodash/debounce` |
| `import { Button } from 'antd'`（老版） | 库未做 ESM 导出/未声明 sideEffects | 升级库 / babel-plugin-import |
| CSS 里的 `import './index.css'` 没了 | sideEffects: false 误伤样式 | sideEffects 数组列出 `"*.css"` ⭐经典坑 |
| `export default { a, b }` 整对象导出 | 用的是对象整体，成员分析失效 | 改具名导出 `export const a = …` |
| `import * as utils` 后动态访问 | `utils[name]()` 运行时才知道 | 静态化访问方式 |

**验证手段**：`bundle-analyzer` 看体积 + `sideEffects` 配置前后对比；库作者用 `rollup --treeshake` 或 `agadoo` 测试导出可摇性。

### 四、为什么 Tree Shaking 只对「函数/纯数据」友好 ⭐

```
class 类成员方法：导出 class 时整个类保留（运行时才知道用哪个方法——
                 除非用静态分析能证明，一般不拆类）
顶层立即执行的表达式：副作用嫌疑，保留
函数体内的代码：只要函数本身没被引用，整体删除 ✅（最理想的摇树单元）
```

这解释了现代库的最佳实践：**多出口小模块 + 具名导出 + sideEffects 声明**（lodash-es/dayjs/radix 都这么做）。

## 回看开篇

lodash 引一个函数打包全家的原因：**老 lodash 是 CJS**——require 是运行时调用，静态分析无从下手。三条路：换 lodash-es（ESM+sideEffects 声明，摇得最干净）、按路径引（`import debounce from 'lodash/debounce'` 手动定位到文件）、babel-plugin-import（编译期改写路径）。摇树的前提与边界都在「静态可分析性」一句话里。

## 实战延伸

**1. 面试答题骨架**：「Tree Shaking 依赖 ESM 的静态结构——import/export 必须顶层静态书写，打包器据此在编译期构建依赖图并标记从入口可达的导出；未使用的导出能否删除取决于副作用判定，package.json 的 sideEffects 字段是库作者对该问题的显式声明，false 表示全部纯可删、数组则保留列出的副作用文件。CSS 这类 import 即生效的模块要列入 sideEffects 数组防止误删。CJS 因 require 是运行时调用无法静态分析所以摇不动；类导出通常整体保留，函数与纯数据是理想摇树单元。」

**2. 一道排障题**：「上线后发现图标样式全丢」——排查到某工具函数包声明了 sideEffects: false，而它顺带 import 了一份全局样式——**声明的承诺与事实不符**，修复为数组排除样式文件。

## 图解总结

```
前提: ESM 静态结构（import 顶层、路径字面量）──编译期可画完整依赖图
判定: 入口可达的 export = 用到 ✅
      不可达 → 查 sideEffects:
        false/未列入 ──▶ 删除（枯叶🍂）
        列入/*.css 等  ──▶ 保留（import 即生效的都算副作用）
物理删除: Terser 死代码消除最终落地

摇不动: CJS 运行时 require │ export default 大对象 │ import * 动态访问 │ 类成员
最佳实践(库作者): 小模块+具名导出+sideEffects 声明 （lodash-es 范本）
```

## 总结

- 前提：ESM 静态结构——编译期可确定完整依赖图与导出使用关系；
- sideEffects 是库作者的安全声明：false 全删、数组保留列出的；
- CSS/全局修改类 import 属于副作用，误声明会导致线上丢样式；
- CJS 因运行时 require 摇不动；类与动态访问是摇树弱区；
- 函数与纯数据是理想单元；库的最佳实践是小模块具名导出 + sideEffects。

**面试一句话回答**：Tree Shaking 的前提是 ESM 的静态结构——import 与 export 必须在顶层以字面量书写，打包器才能在编译期构建完整依赖图，并标记从入口可达的导出；不可达的导出能否删除取决于副作用判定，package.json 的 sideEffects 字段就是库作者对此的显式承诺——false 表示全部模块纯净可删，数组形式则保留列出的文件。CSS 导入这类 import 即产生效果的情况必须列入数组，否则会因误删丢失样式。CommonJS 的 require 是运行时函数调用、路径可以拼接判断，无法静态分析所以摇不动；类导出通常整体保留，函数与纯数据是理想的摇树单元——这也解释了现代库采用小模块加具名导出加 sideEffects 声明的最佳实践。

## 思考题

1. `import './polyfill'`（无绑定引入）：这个模块会被摇掉吗？sideEffects 怎么写才对？
2. `export default { a, b }` vs `export const a=…; export const b=…`：对摇树友好度差异的机制分析。
3. Rollup 与 Webpack 的 Tree Shaking 实现差异一句话（模块级标记 vs 依赖图+压缩期 DCE 的组合）。
4. 开放讨论：如果 JS 引入「静态类型级别的纯性标注」（类似 Haskell），Tree Shaking 还能激进到什么程度？工程收益与风险评估。

（思考题解析将同步录入小程序题库，关联本文 id：engineering-007）

## 参考文献：

- Webpack 官方文档 — Tree Shaking / sideEffects
- Rollup 文档 — Tree Shaking 原理章节
- 本课程《es6-010 模块化》（ESM 静态性的地基）、《engineering-002 打包流程》

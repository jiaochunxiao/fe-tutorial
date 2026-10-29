---
id: handwritten-011
title: 手写 mini-webpack
series: 手写源码系列
seriesId: handwritten
stage: expert
difficulty: 5
tags: [webpack, 打包原理, 模块依赖图, bundle, CommonJS 运行时]
readingTime: 22
prev: handwritten-010
next: handwritten-012
createdAt: 2026-10-26
---

# 手写 mini-webpack

## 打包器到底在干什么

对着 webpack 产物（一坨自执行函数）问三个问题：

1. `import/export` 明明浏览器（旧时代）不认识，为什么产物能跑？
2. 几十个源文件是怎么变成一个文件的？顺序如何保证？
3. 模块之间「按需执行、互不污染」是怎么做到的？

答案的核心只有两件事：**构建依赖图** + **实现一个模块运行时**。⭐⭐ 用 100 行手写一个 mini-webpack，工程化系列（《engineering-002》）的全部概念会瞬间具象化。

## 现象与直觉解释

```
src/
├── index.js      import { add } from './utils.js'
├── utils.js      import { MULTIPLY } from './constant.js'
└── constant.js   export const MULTIPLY = 10
```

打包器的工作：

```
index.js ──发现依赖──▶ utils.js ──发现依赖──▶ constant.js
     └──────────── 依赖图（有向无环） ────────────┘
              │ 遍历图，每个模块转成「函数 + 依赖表」
              ▼
bundle.js = (一个自执行函数 [模块运行时] + { id: [模块函数, 依赖映射] })
```

直觉：**把每个文件包成一个函数，用一个小小的 require 实现在对象里按 id 取函数执行**——CommonJS 的模块机制被「内嵌」进了产物。

## 深入原理

### 第一步：构建依赖图 ⭐

```js
const fs = require('fs');
const path = require('path');

let ID = 0;

// 解析单个文件：源码 + 依赖列表 + 转换后的代码
function createAsset(filename) {
  const content = fs.readFileSync(filename, 'utf-8');

  // 简化版"解析依赖"：正则抓 import 语句（真实 webpack 走 AST，见下文）
  const deps = [];
  const importRe = /import\s+(?:[\w*{},\s]+from\s+)?['"](.+?)['"]/g;
  let m;
  while ((m = importRe.exec(content))) deps.push(m[1]);

  // 简化版"转译"：ESM → CommonJS（真实场景由 Babel/内置转译完成）
  const code = content
    .replace(/import\s+[\w*{},\s]+from\s+['"](.+?)['"];?/g, '')       // 删 import
    .replace(/export\s+default\s+/g, 'module.exports = ')              // export default
    .replace(/export\s+(const|let|var|function)\s+(\w+)/g, '$1 $2; exports.$2 = $2'); // 具名导出

  return { id: ID++, filename, deps, code };
}

// 递归建图：BFS 队列遍历
function createGraph(entry) {
  const mainAsset = createAsset(entry);
  const queue = [mainAsset];
  const graph = [];

  for (const asset of queue) {           // for-of 对动态增长的的可迭代对象天然继续遍历
    graph.push(asset);
    const dir = path.dirname(asset.filename);

    asset.mapping = {};
    asset.deps.forEach((relPath) => {
      const absPath = path.join(dir, relPath) + path.extname(relPath) ? path.join(dir, relPath) : path.join(dir, relPath + '.js');
      const child = createAsset(absPath);
      asset.mapping[relPath] = child.id; // 相对路径 → 模块 id 的映射表 ⭐
      queue.push(child);
    });
  }
  return graph;
}
```

`mapping` 是关键设计：**源码里写的是相对路径，运行时要的是 id**——这张表就是两者的翻译词典。

### 第二步：生成 bundle ⭐⭐

```js
function bundle(graph) {
  // 每个模块变成 "id: [函数(模块代码), 依赖映射]"
  // 函数参数就是我们注入的模块系统 API：module/exports/require
  const modules = graph
    .map((asset) => `
      ${asset.id}: [
        function (module, exports, require) {
          ${asset.code}
        },
        ${JSON.stringify(asset.mapping)},
      ],`)
    .join('');

  // 模块运行时（CommonJS 内核）：require 的手写实现
  const result = `
    (function (modules) {
      function require(id) {
        const [fn, mapping] = modules[id];

        const module = { exports: {} };
        function localRequire(relPath) {
          // 相对路径 → id → 递归 require ⭐ 循环依赖时这里天然返回「半成品」
          return require(mapping[relPath]);
        }
        fn(module, module.exports, localRequire);

        return module.exports;
      }
      require(0);   // 从入口模块启动
    })({${modules}})
  `;

  return result;
}

// 执行打包
const graph = createGraph('./src/index.js');
fs.writeFileSync('./dist/bundle.js', bundle(graph));
```

### 运行时机制逐点拆解 ⭐

**1. 模块隔离**：每个文件被包进独立函数——各自的 const/let 互不可见（作用域天然隔离，正是模块化要的效果）。

**2. 按需执行**：`require` 执行到才调用函数——入口没引用的模块**不会执行**（但代码都在 bundle 里，这是 webpack「全量打包」体积问题的根源，tree-shaking 是另一个话题，《engineering-007》）。

**3. 缓存**：真实 CommonJS（Node）的 require 有 `Module._cache`——同一模块只执行一次，后续直接取 exports。上面的简化版每次 require 都重跑（思考题 2 补全）。

**4. 循环依赖**：A require B、B require A 时——A 先执行到「require B」处挂起，B 执行到「require A」拿到 **A 当时的半成品 exports**（已定义的部分）。这正是《es6-010》讲过的 CJS 循环依赖语义——手写运行时让抽象行为变得可见。

### 与真实 webpack 的差距清单（能说出来就是加分项）

| 简化点 | 真实实现 |
|---|---|
| 正则抓依赖 | **AST 解析**（acorn/babel-parser）——正则无法处理注释、字符串、动态拼接 |
| 字符串替换转译 | Babel/内置转换管线（ESM→CJS、降级语法、polyfill） |
| 只支持相对路径 | resolve 算法（node_modules 查找、alias、extensions） |
| 无类型区分 | Loader 体系：非 JS 资源（CSS/图片）转成 JS 模块 |
| 无插件 | Tapable 事件流：每个阶段广播事件（Plugin 的挂载点） |
| 全同步全量 | code splitting / 异步 chunk / 懒加载 |

## 回看开篇

三个问题的答案：① 产物能跑，因为 bundle **自带一个 require 运行时**，把 CommonJS 语义搬进了浏览器；② 顺序由**依赖图的递归 require** 保证——先执行叶子（被依赖者），后执行引用者；③ 互不污染靠**函数包裹的作用域** + module/exports 注入。

## 实战延伸

**1. 亲手跑通**：三个文件 + 本篇代码（Node 环境）→ `node mini-webpack.js` → `node dist/bundle.js`——观察产物的自执行结构（把产物格式化打印，对照本文的运行时逐行认亲）。

**2. 面试答题骨架**：「打包器两步走——构建依赖图：从入口出发，解析每个模块的依赖（真实实现基于 AST），把相对路径映射成模块 id，BFS/DFS 收集全图；生成 bundle：每个模块包装成接收 module、exports、require 的函数，存入 id 到 [函数, 依赖映射] 的对象，再内嵌一个 require 运行时：按 id 取函数、注入局部 require（翻译相对路径）、执行并返回 exports，从入口 id 启动。模块隔离靠函数作用域，执行顺序靠递归 require，循环依赖返回当时的半成品 exports——真实 webpack 的 Loader、Plugin、代码分割都是在这幅骨架上的工程化扩展。」

## 图解总结

```
src 文件 ──readFile──▶ 源码
   │                        │
   │                        ├──正则/AST──▶ deps ──┐
   │                        └──转译(ESM→CJS)──▶ code │ 依赖图(BFS)
   ▼                                                 ▼
 graph = [ {id, filename, deps, code, mapping: {'./utils.js': 1}} … ]
   │
   ▼ generate
bundle = (function(modules){        ◀── 模块运行时（手写 require）
    function require(id){
      [fn, mapping] = modules[id]
      fn(module, exports, rel => require(mapping[rel]))
      return module.exports
    }
    require(0)
  })({ 0:[fn0,{'./utils.js':1}], 1:[fn1,{...}], 2:[fn2,{}] })
```

## 总结

- 打包器 = 依赖图构建 + 模块运行时生成，两件事各约 50 行；
- createAsset 三职责：读码、抽依赖（AST 级别的真实实现）、转译（ESM→CJS）；
- mapping 表翻译「相对路径 → 模块 id」，localRequire 完成运行时跳转；
- 函数包裹实现隔离、递归 require 实现按序执行、循环依赖返回半成品——CommonJS 语义被完整搬运；
- 与真实 webpack 的差距（Loader/Plugin/resolve/分割）正是工程化系列的入口。

**面试一句话回答**：手写 mini-webpack 分两步——第一步构建依赖图，从入口文件开始读取源码、用正则或 AST 提取 import 依赖并转译成 CommonJS 风格代码，同时建立相对路径到模块 id 的 mapping，广度优先遍历收集全部模块；第二步生成 bundle，把每个模块包装成接收 module、exports 和局部 require 的函数放进 id 映射对象，再内嵌一个 require 运行时：按 id 取出函数与映射、创建 module 对象、用局部 require 把相对路径翻译成 id 递归执行，最终从入口 id=0 启动——模块隔离靠函数作用域、执行顺序靠递归 require、循环依赖返回当时的半成品 exports，真实 webpack 的 Loader、Plugin 与代码分割都是这套骨架的工程化扩展。

## 思考题

1. 给 require 加模块缓存：`const cache = {}`——注意循环依赖场景下缓存应**在执行前登记**（为什么？）。
2. 正则抓依赖的三个翻车场景：注释里的 import、模板字符串里的 import、`import(/* webpackChunkName */ './x')`——分别说明 AST 方案如何避免。
3. 给 mini-webpack 加一个极简 loader：`.css` 文件转成 `module.exports = "注入的style文本"` 并在入口自动插 style 标签——写出 loader 的接入点。
4. 开放设计：把 `require(id)` 改成异步 `import(id)` 返回 Promise——bundle 结构要怎么变才能支持代码分割（提示：多 chunk + JSONP/动态 script 加载）？

（思考题解析将同步录入小程序题库，关联本文 id：handwritten-011）

## 参考文献：

- Ronen Amiel — Let's learn how bundlers work 系列视频（本篇思路的原型）
- webpack 官方文档 — Module Resolution、Tapable
- 本课程《engineering-002 Webpack 打包流程》《es6-010 模块化》

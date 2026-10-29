---
id: engineering-003
title: 前端工程化之 Loader 与 Plugin
series: 前端工程化系列
seriesId: engineering
stage: intermediate
difficulty: 4
tags: [Loader, Plugin, Tapable, 手写loader, 手写plugin]
readingTime: 20
prev: engineering-002
next: engineering-004
createdAt: 2026-10-26
---

# 前端工程化之 Loader 与 Plugin

## 从「面试手写：写一个 Loader / Plugin」说起

```js
// 面试官：「写一个把代码里的 console.log 清掉的 Loader」
// 再补刀：「再写一个打包完成后输出构建耗时报表的 Plugin」
```

⭐⭐⭐「Loader 与 Plugin 的区别」是必考；「手写一个」是区分度题。答案的钥匙一句话：**Loader 是文件转换器（单一职责），Plugin 是流程监听者（全周期钩子）**。

## 现象与直觉解释

| | Loader | Plugin |
|---|---|---|
| 职责 | **把文件 A 变成文件 B**（转译） | **在流程节点上做事**（干预构建过程） |
| 形态 | 一个函数 | 一个带 `apply` 方法的类 |
| 作用范围 | 单个模块（每个文件各跑一遍） | 整个构建生命周期 |
| 典型 | babel-loader、css-loader、sass-loader | HtmlWebpackPlugin、MiniCssExtract、TerserPlugin |
| 类比 | 车间的**机床**（材料进、成品出） | 工厂的**质检/调度员**（在各个节点巡逻） |

判断口诀：**「转换内容」找 Loader，「改变流程」找 Plugin**。

## 深入原理

### 一、Loader：函数 + 链式 + 上下文 ⭐⭐

```js
// Loader 本体：导出一个函数（纯转换）
module.exports = function (source) {
  // this 是 loaderContext（提供丰富 API）
  return source.replace(/console\.log\(.*?\);?/g, '');
};
// 异步场景：const callback = this.async(); … callback(err, result);
```

**链式执行：从右到左（compose）** ⭐：

```js
// 配置 use: ['style-loader', 'css-loader', 'sass-loader']
// 执行序：sass → css → style（最后一个先跑）
// 为什么？—— 函数组合的天然形态：
//   style( css( sass(source) ) )  ← 内层先执行
// 每一层的输入 = 上一层的输出：
//   sass-loader: .scss → css 文本
//   css-loader:  css 文本 → JS 模块（处理 import/url，导出样式字符串）
//   style-loader: JS 模块 → 「创建 style 标签插入 head」的 JS 代码
```

**loaderContext 常用 API**：

```js
this.async()        // 声明异步，返回 callback
this.query          // options（?key=val 或对象）
this.cacheable()    // 允许缓存
this.resourcePath   // 当前文件路径（按路径做差异化处理）
this.emitFile(name, content)  // 输出额外文件（字体/图片 loader 用）
```

**手写实战 1：markdown-loader**（.md → HTML → 渲染组件）：

```js
const marked = require('marked');
module.exports = function (source) {
  const html = marked(source);
  // 返回 JS 模块：默认导出 HTML 字符串（也可再交给 html-loader）
  return `export default ${JSON.stringify(html)}`;
};
```

**手写实战 2（开篇题）：clean-console-loader**：

```js
module.exports = function (source) {
  if (this.resourcePath.includes('node_modules')) return source; // 第三方不动
  const isProd = this.query?.prod ?? false;
  return isProd ? source.replace(/console\.log\([^)]*\);?/g, '') : source;
};
```

### 二、Plugin：类 + apply + Tapable 钩子 ⭐⭐⭐

```js
class BuildTimePlugin {
  apply(compiler) {                       // ⭐ 唯一约定：apply 接收 compiler
    compiler.hooks.run.tap('BuildTime', () => {   // tap = 注册同步钩子
      this.start = Date.now();
    });
    compiler.hooks.done.tap('BuildTime', (stats) => {   // done：构建完成
      console.log(`⏱ 构建耗时 ${Date.now() - this.start}ms`);
    });
  }
}
// 使用：plugins: [new BuildTimePlugin()]
```

**Tapable 钩子体系**（Plugin 的一切能力的入口）：

```js
compiler.hooks.environment   // 环境就绪
compiler.hooks.compile       // 编译开始
compiler.hooks.emit          // ⭐ 输出文件前（改产物内容的黄金时机）
compiler.hooks.done          // 构建完成

compilation.hooks            // 每次编译（含增量）都会产生 compilation
  .buildModule               // 每个模块构建时
  .optimizeChunkAssets       // ⭐ 处理 chunk 产物（压缩类插件的家）
  .processAssets             // 新版产物处理入口（替换 optimizeChunkAssets）
```

**钩子的四种类型**（Tapable 的精华）：

| 类型 | 行为 |
|---|---|
| `SyncHook` | 同步串行 |
| `AsyncParallelHook` | 异步并行 |
| `AsyncSeriesHook` | 异步串行 |
| `SyncBailHook` | 返回非 undefined 即「熔断」跳过后续 |

**手写实战 3（开篇题的完成版）：构建报表 Plugin**：

```js
class BuildReportPlugin {
  apply(compiler) {
    compiler.hooks.emit.tapAsync('BuildReport', (compilation, callback) => {
      const assets = Object.entries(compilation.assets);   // 全部产物
      const report = assets.map(([name, src]) =>
        `${name}: ${(src.size() / 1024).toFixed(2)}KB`).join('\n');
      // ⭐ 往产物里塞一个报表文件：
      compilation.assets['build-report.txt'] = {
        source: () => report,
        size: () => report.length,
      };
      callback();
    });
  }
}
```

**手写实战 4：版权注释 Plugin**（给每个 js 产物头部加注释）：

```js
class BannerPlugin {
  constructor(banner) { this.banner = banner; }
  apply(compiler) {
    compiler.hooks.processAssets.tap(
      { name: 'Banner', stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONS },
      (assets) => {
        Object.keys(assets).filter((n) => n.endsWith('.js')).forEach((name) => {
          assets[name] = new RawSource(`/** ${this.banner} */\n` + assets[name].source());
        });
      }
    );
  }
}
```

### 三、两者的协作现场（谁干什么）⭐

一个完整场景「引入样式」：

```
Loader 干活：sass → css → JS 模块（内容转换）
Plugin 干活：MiniCssExtractPlugin 把 JS 里的样式抽成独立 .css 文件（流程干预——
            它 hook 了 chunk 组装与产物输出阶段，这是 Loader 做不到的）
```

判断题练习：

| 需求 | 用 |
|---|---|
| 把 .vue 文件转成 JS | Loader |
| 每次 build 后自动上传 CDN | Plugin（done 钩子） |
| 给图片路径加 hash | Loader（emitFile + 路径改写） |
| 删掉产物里的注释 | Plugin（Terser 就是这么实现的） |
| 在 html 里注入 script 标签 | Plugin（HtmlWebpackPlugin） |

## 回看开篇

两个手写题的答案要点：清 console 的 Loader = 一个函数（this.resourcePath 判定 + 正则替换 + options 开关）；耗时报表 Plugin = apply 里 tap 两个钩子（run 记时 + done 输出，进阶往 compilation.assets 塞文件）。**记住两类模板，这类题就是送分题。**

## 实战延伸

**1. 面试答题骨架**：「Loader 是导出一个函数的文件转换器，按配置从右到左链式执行、前者的输出是后者的输入，通过 this 上的 loaderContext 获得异步、路径、emitFile 等能力，职责是让 Webpack 认识更多文件类型；Plugin 是实现 apply(compiler) 的类，基于 Tapable 的同步、异步并行、异步串行、熔断四类钩子挂载到从环境准备到输出完成的完整生命周期，能读取与修改 compilation.assets 产物，职责是干预流程——抽 CSS、生成 HTML、压缩、上报都是插件。转换内容用 Loader、改变流程用 Plugin。」

## 图解总结

```
Loader（机床）: fn(source) → newSource         每个【文件】跑一遍
  链: style( css( sass(src) ) )  ←右到左 compose
  this: async/query/resourcePath/emitFile

Plugin（调度员）: class { apply(compiler) }      每个【构建】挂一次
  compiler.hooks: environment/compile/emit/done
  compilation.hooks: buildModule/processAssets…
  Tapable 四型: Sync │ AsyncParallel │ AsyncSeries │ Bail(熔断)
  改产物: compilation.assets[name] = { source, size }

分工: 内容转换→Loader │ 流程干预→Plugin（抽CSS/注HTML/压缩/上报 全是后者）
```

## 总结

- Loader = 函数转换器：链式右到左、上下文 API（async/emitFile 等）；
- Plugin = apply 类 + Tapable 钩子：全生命周期监听，可改产物；
- 钩子四型：同步/异步并行/异步串行/熔断；
- 「转换内容 vs 干预流程」是分工判据；
- 手写模板各一个（替换型 Loader、双钩子 Plugin），面试直接套。

**面试一句话回答**：Loader 是导出一个函数的模块转换器——接收源文件内容、返回转换结果，多个 Loader 按配置从右到左链式执行、前一个的输出作为后一个的输入，函数内通过 this 拿到 async、query、resourcePath、emitFile 等上下文能力，职责是让 Webpack 能处理各类非 JS 资源。Plugin 是实现了 apply 方法的类，apply 接收 compiler 实例，基于 Tapable 提供的同步、异步并行、异步串行与熔断四类钩子挂载到从环境准备、编译、产物输出到构建完成的完整生命周期上，还能直接读写 compilation.assets 修改产物——抽离 CSS、生成 HTML、压缩、构建上报都是插件的工作。一句话：转换文件内容用 Loader，干预构建流程用 Plugin。

## 思考题

1. 给 markdown-loader 加「代码高亮」：在返回 JS 之前插入 highlight 处理——写出修改版；异步高亮库怎么接（this.async）？
2. SyncBailHook 的「熔断」在 Webpack 哪个场景用到？（考虑 abort 编译类插件——如检测到敏感信息立即中止）
3. 写一个「禁止产物超过 500KB 就告警」的 Plugin（emit 钩子里遍历 assets，超限 console.warn）。
4. 开放讨论：Vite/Rollup 的插件体系与 Tapable 的差异（Rollup 的 buildStart/transform/load 钩子更贴近模块语义）——为什么 Vite 的插件能同时在 dev 与 build 生效？

（思考题解析将同步录入小程序题库，关联本文 id：engineering-003）

## 参考文献：

- Webpack 官方文档 — Writing a Loader / Writing a Plugin / Tapable
- webpack 源码 — Tapable 钩子类型定义
- 本课程《engineering-002 打包流程》（两类角色在流水线中的位置）

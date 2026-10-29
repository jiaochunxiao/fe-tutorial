---
id: engineering-004
title: 前端工程化之 Webpack 性能优化
series: 前端工程化系列
seriesId: engineering
stage: intermediate
difficulty: 4
tags: [构建优化, 体积优化, splitChunks, 缓存, 首屏]
readingTime: 20
prev: engineering-003
next: engineering-005
createdAt: 2026-10-26
---

# 前端工程化之 Webpack 性能优化

## 从「两本账」开始：构建要快，产物要小

> Webpack 优化面试题的满分结构：**先分账本，再列手段，最后讲测量**。

```
账本一：构建速度（开发体验 + CI 时间）
  npm run dev 卡 30s、CI 排队 10 分钟 —— 治它

账本二：产物体积（用户加载时长）
  首包 4MB、白屏 5s —— 治它
⚠️ 两本账经常冲突（如缓存策略 vs 构建时间）—— 先明确优化对象再动手
```

⭐⭐ 本文按两本账组织全部手段，每条都带原理——面试「背清单」不如「讲因果」。

## 第一本账：构建速度 ⭐⭐

### ① 缓存：让第二次构建起飞

```js
// webpack5 内置持久化缓存（最优先做，收益最大）
module.exports = {
  cache: { type: 'filesystem', buildDependencies: { config: ['./webpack.config.js'] } },
};
// 原理：把模块的转译结果缓存到磁盘 —— 二次构建只处理变化文件（增量）
// 效果：二次构建常见 5~10 倍提速
```

### ② 收窄处理范围：别让 Loader 白跑

```js
module: {
  rules: [{
    test: /\.js$/,
    include: path.resolve('src'),     // ⭐ 只处理自己的代码
    exclude: /node_modules/,           // 第三方早就是编译过的 ES5/目标语法
    use: 'babel-loader',
  }],
},
resolve: {
  extensions: ['.jsx', '.js'],        // 限定后缀尝试列表（默认含 .json/.node…）
  alias: { '@': path.resolve('src') }, // 减少深路径解析
  modules: [path.resolve('node_modules')], // 不再逐级向上找
},
```

### ③ 并行：多核利用

```js
// babel 转译并行：thread-loader（起 worker 池）
use: ['thread-loader', 'babel-loader'],
// 压缩并行：terser-webpack-plugin 的 parallel: true（默认开）
// 注意：thread 有启动成本，小项目反而变慢 —— 测量后再上
```

### ④ 替换重型环节

```js
// esbuild/swc 替代 Terser/Babel 的压缩与转译（快 10~100 倍）
optimization: { minimizer: [new EsbuildPlugin({ target: 'es2015' })] },
// 或直接迁 Vite（engineering-005）—— dev 场景的终极答案
```

## 第二本账：产物体积 ⭐⭐⭐

### ① 代码分割：拆 + 懒加载（收益之王）

```js
// 路由级懒加载（异步 chunk）：
const Admin = () => import(/* webpackChunkName: "admin" */ './pages/Admin');
// 首屏不加载 admin —— 访问时才拉（network 省下的都是净赚）

// splitChunks：公共依赖拆分（变与不变分离）
optimization: {
  splitChunks: {
    chunks: 'all',
    cacheGroups: {
      vendors: { test: /[\\/]node_modules[\\/]/, name: 'vendors', priority: 10 },
      common:  { minChunks: 2, name: 'common' },   // 被两个以上入口共享的模块
    },
  },
},
```

### ② Tree Shaking：摇掉没用到的导出（engineering-007 专篇原理）

```js
// 前提：ESM 静态结构 + sideEffects 声明
package.json: { "sideEffects": false }   // 或列出有副作用的文件
// 效果：import { debounce } from 'lodash-es' 只打包 debounce
// ⚠️ lodash（CJS 版）摇不动 —— 换 lodash-es 是老项目经典优化点
```

### ③ 压缩与格式

```js
// JS: Terser（压缩 + 死代码消除）/ esbuild
// CSS: css-minimizer（cssnano）
// 传输: gzip/brotli 交给服务器/CDN（构建期预压缩：CompressionPlugin）
```

### ④ 按需加载替代全量引入

```js
// 反面教材：import { Button } from 'antd'（antd v1-3 全量打包）
// 正解：babel-plugin-import（老） / 组件库自身 ESM + tree shaking（现代）
// 图标库同理：按路径引入单个图标，而非整个 icon 包
```

### ⑤ 资源的极致处理

```js
// 小图内联 base64（省请求）—— url-loader/asset 的 limit
// 字体子集化（中文字体几十 MB → 只含用到的字）
// 大资源 CDN 化 + contenthash（engineering-008）
```

## 第三步：测量（没有数据的优化是玄学）⭐⭐

```bash
# 构建耗时分析：
speed-measure-webpack-plugin      # 各 Loader/Plugin 耗时排行
# 产物体积分析（必会）：
webpack-bundle-analyzer           # 可视化树状图：谁大、为什么大
```

```js
// 分析器的经典发现：
// 1. moment + 全部 locale（200KB+）→ 用 dayjs 或 IgnorePlugin 掉 locale
// 2. lodash 全量 → lodash-es + tree shaking
// 3. 重复的 polyfill（core-js 多版本）→ 锁定统一版本
// 4. 「不小心 import 的整个图标库」→ 按需
```

**优化工作流**：`bundle-analyzer 找大头 → 对症下药 → 前后对比 → 沉淀到 CI 告警（size-limit）`。

## 优先级清单（面试的「如果只做三件事」）⭐

```
构建侧：① filesystem 缓存 ② include/exclude 收窄 ③ thread/esbuild 并行
体积侧：① 路由懒加载 + splitChunks ② Tree Shaking（换 ESM 库）③ bundle-analyzer 找大头
永远：先测量，后优化，再守门（size-limit 进 CI）
```

## 回看两本账

构建快的本质是「**少做重复工作**」（缓存/收窄/并行）；产物小的本质是「**只发用户此刻需要的**」（拆分/懒加载/摇树/按需）。两句话可以概括一切手段——面试时先亮这个框架，再展开细节，层次立现。

## 图解总结

```
构建速度账                     产物体积账
├ 缓存: filesystem ⭐         ├ 分割: 路由import()懒加载 ⭐
├ 收窄: include/exclude        │       splitChunks(vendors/common)
│       resolve.alias          ├ 摇树: ESM+sideEffects→tree shaking
├ 并行: thread-loader          │       (lodash→lodash-es)
│       terser parallel        ├ 压缩: terser/cssnano/gzip
└ 替换: esbuild/swc            ├ 按需: babel-plugin-import/图标单引
                               └ 资源: 小图内联/字体子集/CDN+hash
测量: speed-measure(耗时) + bundle-analyzer(体积) + size-limit(CI守门)
```

## 总结

- 两本账：构建速度（缓存/收窄/并行/换引擎）与产物体积（拆分/摇树/压缩/按需）；
- filesystem 缓存与懒加载+splitChunks 是各自账本的最高优先级；
- Tree Shaking 依赖 ESM 与 sideEffects——CJS 库摇不动，换库是正解；
- 一切优化从 bundle-analyzer 的数据开始，以 size-limit 进 CI 收尾；
- 能答出「先分账本再讲手段」的结构，就已经赢过大多数背诵型候选人。

**面试一句话回答**：Webpack 优化分构建速度与产物体积两本账——速度上开启 filesystem 持久化缓存让二次构建增量执行、用 include 与 exclude 收窄 Loader 处理范围并配 alias 与限定 extensions 减少解析成本、用 thread-loader 与 terser 并行利用多核、用 esbuild 或 swc 替代重型转译压缩；体积上用路由级动态 import 做懒加载、用 splitChunks 把第三方与公共模块拆成独立 chunk 实现变与不变分离缓存、依赖 ESM 与 sideEffects 声明启用 Tree Shaking（把 lodash 换成 lodash-es 是经典案例）、组件库与图标按需引入、小图内联与字体子集化。所有手段先用 speed-measure 与 bundle-analyzer 测量定位，最后用 size-limit 在 CI 守门。

## 思考题

1. `splitChunks` 的 `chunks: 'initial' | 'async' | 'all'` 差异？什么场景该用 all？
2. 为什么「缓存 filesystem 开启后改了 babel 配置构建结果可能旧」？buildDependencies 是干什么用的？
3. gzip 与 brotli 的取舍？预压缩（构建期）与动态压缩（服务器）各自的适用？
4. 开放设计：给团队设计「包体守门」方案：size-limit 规则（首包 ≤300KB、单 chunk ≤200KB）、CI 流程（超限阻断 or 告警）、豁免机制。

（思考题解析将同步录入小程序题库，关联本文 id：engineering-004）

## 参考文献：

- Webpack 官方文档 — Build Performance / Caching / SplitChunksPlugin
- webpack-bundle-analyzer 与 size-limit 文档
- 本课程《engineering-002 打包流程》《engineering-007 Tree Shaking》《performance-003 加载优化》

# 前端进阶之路 · 学习路线总纲

> 三阶段、19 个系列、158 篇专题博客的完整课程设计。
> 设计理念：**循序渐进**（篇目间有依赖关系，按序阅读）· **深入原理**（不止 API，剖析规范与引擎）· **面向面试**（每篇配思考题，直接服务刷题场景）。

---

## 阶段总览

| 阶段 | 定位 | 适合人群 | 核心目标 |
|---|---|---|---|
| P1 夯实基础 | 初级 | 0~1 年 / 转行入门 | 把「会用」变成「懂原理」，JS 核心机制全通 |
| P2 知识进阶 | 中级 | 1~3 年 / 备战社招 | 异步、网络、框架原理、工程化四大板块成体系 |
| P3 高级进阶 | 高级 | 3 年+ / 冲高级岗 | 引擎与渲染底层、手写源码、架构与安全 |

---

# 第一阶段 · P1 夯实基础（5 大系列 · 43 篇）

> 阶段自检清单：能独立解释变量提升、闭包、this、原型链、事件冒泡；能不查文档手写常见 DOM 操作与事件委托。

## 1.1 css-deep · CSS 深入系列（10 篇）

| # | id | 标题 | 一句话内容 |
|---|---|---|---|
| 1 | css-deep-001 | 盒模型：content-box 与 border-box | 从标准说起，理解两种盒模型的计算差异与最佳实践 |
| 2 | css-deep-002 | 文档流与 display 的本质 | 块级/行内/行内块的真实排版行为 |
| 3 | css-deep-003 | BFC：块级格式化上下文 ⭐ | BFC 的触发条件、布局规则与经典应用（清浮动/防 margin 重叠） |
| 4 | css-deep-004 | position 与层叠上下文 | 定位体系与 z-index 失效之谜 |
| 5 | css-deep-005 | 选择器优先级与层叠规则 | specificity 计算、important 与层叠顺序 |
| 6 | css-deep-006 | 浮动与清除浮动 | 历史包袱背后的排版原理 |
| 7 | css-deep-007 | Flex 布局完全指南 | 主轴/交叉轴、收缩扩展计算、常见布局配方 |
| 8 | css-deep-008 | Grid 布局入门与实战 | 网格轨道、区域命名与二维布局 |
| 9 | css-deep-009 | 响应式设计 | 媒体查询、rem/vw 与移动端适配方案对比 |
| 10 | css-deep-010 | CSS 动画：transition 与 animation | 补间动画、关键帧与 GPU 加速初识 |

## 1.2 js-core · JavaScript 核心系列（9 篇）

| # | id | 标题 | 一句话内容 |
|---|---|---|---|
| 1 | js-core-001 | 数据类型：原始值与引用值 | 8 种类型、栈与堆的存储差异 |
| 2 | js-core-002 | 类型判断的十八般武艺 ⭐ | typeof/instanceof/toString 的能力边界与原理 |
| 3 | js-core-003 | var、let、const 与提升 | 声明提升、暂时性死区与块级作用域 |
| 4 | js-core-004 | 隐式类型转换与 == ⭐ | ToPrimitive 完整规则、== 的比较算法 |
| 5 | js-core-005 | 函数：参数、arguments 与默认值 | 参数传递、类数组与剩余参数 |
| 6 | js-core-006 | 数组 API 全解 | 会改变原数组的方法清单与不可变方法 |
| 7 | js-core-007 | 对象的创建、遍历与拷贝 | 属性描述符、遍历差异、浅拷贝方法对比 |
| 8 | js-core-008 | 字符串与正则入门 | 常用 API、正则元字符与实战 |
| 9 | js-core-009 | 错误处理与自定义错误 | try/catch/finally、Error 类型与异常上报思路 |

## 1.3 js-deep · JavaScript 深入系列（12 篇）⭐ 面试核心，风格对标冴羽深入系列

| # | id | 标题 | 一句话内容 |
|---|---|---|---|
| 1 | js-deep-001 | 执行上下文与执行上下文栈 | 代码执行的舞台：全局/函数上下文的创建与出栈 |
| 2 | js-deep-002 | 变量对象与函数声明提升 | 函数声明为什么能先调用后定义 |
| 3 | js-deep-003 | 词法作用域与动态作用域 | JS 为什么是「定义时」决定作用域 |
| 4 | js-deep-004 | 作用域链 | 变量查找的完整路径与遮蔽效应 |
| 5 | js-deep-005 | 闭包 ★例文已产出 | 函数 + 词法环境：从 [[Environment]] 到内存语义 |
| 6 | js-deep-006 | this 的绑定规则与优先级 ⭐ | 默认/隐式/显式/new 四规则与箭头函数 |
| 7 | js-deep-007 | call、apply、bind 的原理与模拟 | 三兄弟的差异与手写实现思路 |
| 8 | js-deep-008 | new 的过程与模拟实现 | 构造调用四步曲与返回值规则 |
| 9 | js-deep-009 | 从原型到原型链 ⭐ | prototype、__proto__、constructor 三角关系 |
| 10 | js-deep-010 | 继承的演进 | 原型链→借用构造→组合→寄生组合→class |
| 11 | js-deep-011 | 执行上下文、作用域、闭包总串讲 | 用一个例子把 1~5 篇串成完整心智模型 |
| 12 | js-deep-012 | 系列综合面试题精讲 | 本系列 20 道高频真题逐题拆解 |

## 1.4 dom-events · DOM 与事件系列（6 篇）

| # | id | 标题 | 一句话内容 |
|---|---|---|---|
| 1 | dom-events-001 | DOM 树、节点类型与常用 API | 节点关系查询与节点操作的性能差异 |
| 2 | dom-events-002 | 事件流：捕获、目标与冒泡 ⭐ | DOM2 事件模型三阶段与 addEventListener 第三参 |
| 3 | dom-events-003 | 事件对象详解 | target/currentTarget、默认行为与事件委托的基石 |
| 4 | dom-events-004 | 事件委托 ⭐ | 为什么给父元素绑一个监听就够了 |
| 5 | dom-events-005 | 自定义事件与事件总线 | Event/CustomEvent 与手写 emitter 雏形 |
| 6 | dom-events-006 | MutationObserver 与 IntersectionObserver | 观察者 API 家族的使用场景 |

## 1.5 browser-basic · 浏览器基础系列（6 篇）

| # | id | 标题 | 一句话内容 |
|---|---|---|---|
| 1 | browser-basic-001 | 浏览器多进程架构入门 | 进程/线程分工与站点隔离 |
| 2 | browser-basic-002 | 渲染进程的线程构成 | GUI 渲染线程与 JS 线程互斥 |
| 3 | browser-basic-003 | 从输入 URL 到页面呈现（基础版）⭐ | 全流程地图（完整版见 P2 network-010） |
| 4 | browser-basic-004 | 前端存储四件套 | Cookie/localStorage/sessionStorage/IndexedDB 的边界 |
| 5 | browser-basic-005 | 同源策略初识 | 什么是源、限制了什么 |
| 6 | browser-basic-006 | 异步入门：从回调到 Promise | 为什么需要异步、三种历史形态 |

---

# 第二阶段 · P2 知识进阶（7 大系列 · 60 篇）

> 阶段自检清单：能手写 Promise、解释事件循环的完整循环模型、说清 HTTP 缓存决策链、读懂 Vue/React 核心源码骨架、独立做一次 Lighthouse 优化。

## 2.1 js-async · 异步编程系列（8 篇）

| # | id | 标题 | 一句话内容 |
|---|---|---|---|
| 1 | js-async-001 | 回调函数与回调地狱 | 异步的问题域：控制反转与信任问题 |
| 2 | js-async-002 | Promise 基础 ⭐ | 状态机、then 链与错误穿透 |
| 3 | js-async-003 | 手写 Promise | 从零实现符合 Promises/A+ 的 mini-promise |
| 4 | js-async-004 | Promise 静态方法与并发控制 | all/allSettled/race/any 与并发限制器 |
| 5 | js-async-005 | 事件循环 Event Loop ★例文已产出 | 浏览器与 Node.js 的完整循环模型 ⭐⭐ 面试必考 |
| 6 | js-async-006 | Generator 与迭代器 | 协程思想、next 传参与执行器 |
| 7 | js-async-007 | async/await 的本质 | 语法糖拆解：await 后面到底发生了什么 |
| 8 | js-async-008 | 异步实战 | 并发限制、超时重试、可取消的异步任务 |

## 2.2 es6 · ES6+ 系列（10 篇）

| # | id | 标题 | 一句话内容 |
|---|---|---|---|
| 1 | es6-001 | let、const 与块级作用域 | 与 var 的本质差异：环境记录的变化 |
| 2 | es6-002 | 解构赋值 | 数组/对象解构的完整规则与默认值陷阱 |
| 3 | es6-003 | 模板字符串与标签模板 | 标签模板的真实用途（如防 XSS 转义） |
| 4 | es6-004 | 函数扩展 | 默认值、rest 参数与箭头函数的 this 语义 |
| 5 | es6-005 | 数组与对象的新方法 | 扩展运算符、Object.entries 等 |
| 6 | es6-006 | Symbol | 第七种原始类型与它的元编程用途 |
| 7 | es6-007 | Set 与 Map | 与 Object/Array 的取舍、WeakSet/WeakMap ⭐ |
| 8 | es6-008 | Proxy 与 Reflect ⭐ | 拦截器全家福，Vue3 响应式的基石 |
| 9 | es6-009 | Iterator 与 for...of | 迭代协议与自定义可迭代对象 |
| 10 | es6-010 | Class 与模块化 | class 的原型真相；ESM 与 CommonJS 的加载差异 ⭐ |

## 2.3 network · 网络与浏览器系列（10 篇）

| # | id | 标题 | 一句话内容 |
|---|---|---|---|
| 1 | network-001 | TCP：三次握手与四次挥手 | 前端视角的连接生命周期 |
| 2 | network-002 | HTTP 报文、方法与状态码 | 语义化方法、常用状态码与 301/302 差异 |
| 3 | network-003 | HTTP/1.1 的问题与 HTTP/2 | 队头阻塞与多路复用、服务器推送 ⭐ |
| 4 | network-004 | HTTP/3 与 QUIC | 为什么换 UDP |
| 5 | network-005 | HTTPS：TLS 握手全过程 ⭐ | 非对称交换密钥 → 对称加密通信 |
| 6 | network-006 | 浏览器缓存：强缓存与协商缓存 ⭐⭐ | 完整决策链：memory cache → disk → 协商 |
| 7 | network-007 | 跨域：CORS 与其他方案 ⭐⭐ | 简单/预检请求、携带 cookie 的条件 |
| 8 | network-008 | Cookie 深入 | 属性全集、安全标志与 SameSite |
| 9 | network-009 | WebSocket 与实时通信 | 握手升级过程、心跳与 SSE 对比 |
| 10 | network-010 | 从输入 URL 到页面呈现（完整版）⭐⭐ | 串联 P1 基础版 + 缓存 + 渲染管线 |

## 2.4 vue · Vue 原理系列（8 篇）

| # | id | 标题 | 一句话内容 |
|---|---|---|---|
| 1 | vue-001 | Vue 响应式原理 ⭐⭐ | defineProperty 的缺陷 → Proxy 方案与依赖收集 |
| 2 | vue-002 | 虚拟 DOM 与 diff 算法 ⭐ | 同层比较、key 的作用、双端/最长递增子序列 |
| 3 | vue-003 | computed 与 watch 的原理 | 惰性求值、缓存与依赖变化传播 |
| 4 | vue-004 | 生命周期钩子的触发时机 | 各钩子在渲染流程中的位置 |
| 5 | vue-005 | nextTick 的原理 ⭐ | 为什么改了数据 DOM 不立即更新 |
| 6 | vue-006 | Vue Router：hash 与 history | 两种模式的实现与监听机制 |
| 7 | vue-007 | 状态管理：Pinia 的设计 | 去掉了什么、保留了什么 |
| 8 | vue-008 | Composition API 的设计动机 | 逻辑复用与代码组织问题 |

## 2.5 react · React 原理系列（8 篇）

| # | id | 标题 | 一句话内容 |
|---|---|---|---|
| 1 | react-001 | JSX 的本质 | 从 createElement 到 React.createElement 调用树 |
| 2 | react-002 | React 渲染流程 | render 阶段与 commit 阶段 ⭐ |
| 3 | react-003 | Fiber 架构 ⭐ | 为什么需要可中断的渲染、链表结构 |
| 4 | react-004 | Hooks 原理：useState ⭐ | 链表结构、更新队列与批处理 |
| 5 | react-005 | useEffect 与闭包陷阱 ⭐ | 依赖数组、清理函数、经典坑题 |
| 6 | react-006 | setState 的更新时机 | 批处理的历史演进（React 17/18 差异） |
| 7 | react-007 | Redux 与中间件 | 单向数据流、中间件的洋葱模型 |
| 8 | react-008 | React 性能优化 | memo/useMemo/useCallback 与 re-render 分析 |

## 2.6 engineering · 前端工程化系列（8 篇）

| # | id | 标题 | 一句话内容 |
|---|---|---|---|
| 1 | engineering-001 | npm 与依赖管理 | lock 文件、semver、幽灵依赖与 pnpm 方案 ⭐ |
| 2 | engineering-002 | Webpack：打包的完整流程 | 从入口到 bundle：依赖图构建 |
| 3 | engineering-003 | Loader 与 Plugin | 时机、职责与手写示例 |
| 4 | engineering-004 | Webpack 性能优化 | 构建提速与产物瘦身两本账 ⭐ |
| 5 | engineering-005 | Vite 为什么快 | esbuild 预构建 + 按需编译 vs 全量打包 ⭐ |
| 6 | engineering-006 | Babel 与 AST | 解析→转换→生成的流水线与插件编写 |
| 7 | engineering-007 | Tree Shaking 的原理 | 静态分析的边界与副作用标记 |
| 8 | engineering-008 | 部署与缓存策略 | CDN、内容哈希与灰度发布 |

## 2.7 performance · 性能优化系列（8 篇）

| # | id | 标题 | 一句话内容 |
|---|---|---|---|
| 1 | performance-001 | 性能指标：FCP、LCP、CLS 与 INP ⭐ | Core Web Vitals 的定义与达标线 |
| 2 | performance-002 | 性能测量 | Performance API、Lighthouse 与 RUM |
| 3 | performance-003 | 加载优化 | 代码分割、预加载与关键渲染路径 ⭐ |
| 4 | performance-004 | 图片优化 | 格式选择、懒加载与响应式图片 |
| 5 | performance-005 | 渲染优化：重排与重绘 ⭐ | 触发条件与读写分离 |
| 6 | performance-006 | 长列表优化：虚拟滚动 | 原理与手写实现 |
| 7 | performance-007 | Web Worker | 主线程卸载与数据传递模式 |
| 8 | performance-008 | 内存泄漏排查实战 | DevTools Memory 三板斧（详细原理见 P3 v8 系列） |

---

# 第三阶段 · P3 高级进阶（7 大系列 · 55 篇）

> 阶段自检清单：能解释 V8 分代 GC 全流程；能手写 mini-Vue/mini-webpack；能设计一个模块的前端监控体系；能在代码评审中发现内存与性能隐患。

## 3.1 v8 · V8 与 JavaScript 底层系列（8 篇）

| # | id | 标题 | 一句话内容 |
|---|---|---|---|
| 1 | v8-001 | V8 如何执行一段 JavaScript | 源码→字节码→机器码的全链路 |
| 2 | v8-002 | 隐藏类与内联缓存 | V8 让对象访问飞快的两板斧 |
| 3 | v8-003 | JIT：解释器与优化编译器 | 热点代码、优化与反优化（deopt） |
| 4 | v8-004 | V8 的堆内存结构 | 新生代/老生代/大对象空间分区 |
| 5 | v8-005 | 内存管理与垃圾回收 ★例文已产出 | Scavenger 与 Mark-Sweep/Compact 全流程 ⭐ |
| 6 | v8-006 | Orinoco：增量、并发与并行 GC | 写屏障与停顿优化 |
| 7 | v8-007 | 常见内存泄漏模式与排查 | 五大泄漏模式 + DevTools 实战 |
| 8 | v8-008 | 从一段代码看优化与反优化 | 用 --trace-opt 观察函数的优化旅程 |

## 3.2 rendering · 浏览器渲染原理系列（6 篇）

| # | id | 标题 | 一句话内容 |
|---|---|---|---|
| 1 | rendering-001 | 渲染管线：从 DOM 到像素 ⭐ | Parse→Style→Layout→Paint→Composite 全流程 |
| 2 | rendering-002 | 层叠上下文与绘制顺序 | stacking context 的生成规则 |
| 3 | rendering-003 | 合成层与 GPU 加速 ⭐ | transform/opacity 为什么不触发重排 |
| 4 | rendering-004 | requestAnimationFrame 与渲染时机 | rAF 在循环中的位置与帧对齐 |
| 5 | rendering-005 | 事件循环与渲染的交错 | task→microtask→render 的完整节拍 ⭐ |
| 6 | rendering-006 | 渲染性能案例复盘 | 长任务、掉帧与工具定位方法 |

## 3.3 handwritten · 手写源码系列（12 篇）⭐ 面试实战

| # | id | 标题 | 一句话内容 |
|---|---|---|---|
| 1 | handwritten-001 | 手写 call、apply、bind | 三种实现的边界处理 |
| 2 | handwritten-002 | 手写 new 与 instanceof | 与 js-deep-007/008 原理篇联动 |
| 3 | handwritten-003 | 手写深拷贝 | 循环引用、特殊对象与结构化克隆 |
| 4 | handwritten-004 | 手写 Promise/A+ ⭐⭐ | 含官方测试用例通过方法 |
| 5 | handwritten-005 | 手写防抖与节流 | immediate/leading 变体全家桶 |
| 6 | handwritten-006 | 手写发布订阅 EventEmitter | on/off/once/emit 完整实现 |
| 7 | handwritten-007 | 手写 Ajax 与 fetch 封装 | XHR 状态机与拦截器设计 |
| 8 | handwritten-008 | 手写虚拟 DOM 与 diff | h/vnode/patch 三件套 |
| 9 | handwritten-009 | 手写 mini-Vue（上）：响应式与渲染 | reactive + effect + 渲染函数 |
| 10 | handwritten-010 | 手写 mini-Vue（下）：模板编译 | parser → transformer → codegen |
| 11 | handwritten-011 | 手写 mini-webpack | 依赖图构建与 bundle 拼接 |
| 12 | handwritten-012 | 手写 LRU 缓存 | Map 有序性解法与链表解法 |

## 3.4 typescript · TypeScript 系列（8 篇）

| # | id | 标题 | 一句话内容 |
|---|---|---|---|
| 1 | ts-001 | 结构化类型系统 | 与 Java 泛型体系的根本差异 |
| 2 | ts-002 | 泛型与类型约束 | 泛型函数/类、keyof 与 extends |
| 3 | ts-003 | 映射类型与条件类型 | 类型体操的地基 ⭐ |
| 4 | ts-004 | infer 与递归类型 | 深入 Partial/ReturnType 的实现 |
| 5 | ts-005 | 类型收窄与类型守卫 | is/in/instanceof 与判别联合 |
| 6 | ts-006 | 声明文件与 @types | 为 JS 库补类型的正确姿势 |
| 7 | ts-007 | any、unknown 与类型安全 | 逃逸舱口的纪律 |
| 8 | ts-008 | TS 工程实践 | tsconfig 关键项与常见报错治理 |

## 3.5 architecture · 前端架构系列（6 篇）

| # | id | 标题 | 一句话内容 |
|---|---|---|---|
| 1 | architecture-001 | 组件设计模式 | 容器/展示、受控/非受控、组合优于继承 |
| 2 | architecture-002 | 状态管理的架构思考 | 状态分层：服务端/URL/全局/局部 |
| 3 | architecture-003 | 微前端：qiankun 原理与实践 ⭐ | JS 沙箱、样式隔离与路由分发 |
| 4 | architecture-004 | Monorepo 与代码复用 | workspace 协议与包管理演进 |
| 5 | architecture-005 | 前端监控体系 ⭐ | 错误、性能、行为三支柱的采集与上报 |
| 6 | architecture-006 | 复杂页面的设计权衡 | 性能、可维护性与交付速度的三角 |

## 3.6 security · 前端安全系列（5 篇）

| # | id | 标题 | 一句话内容 |
|---|---|---|---|
| 1 | security-001 | XSS：类型、防御与 CSP ⭐⭐ | 存储型/反射型/DOM 型与转义策略 |
| 2 | security-002 | CSRF：SameSite 与 Token ⭐ | 攻击链路与双重防御 |
| 3 | security-003 | 点击劫持与防御 | X-Frame-Options 与 frame-ancestors |
| 4 | security-004 | 前端数据安全 | 不可信任的客户端：加密与脱敏边界 |
| 5 | security-005 | 供应链安全 | 依赖审计、锁定与 lockfile 攻击面 |

## 3.7 algorithm · 算法与数据结构·前端向（10 篇）

| # | id | 标题 | 一句话内容 |
|---|---|---|---|
| 1 | algorithm-001 | 复杂度分析 | 大 O 的直觉与均摊分析 |
| 2 | algorithm-002 | 数组与双指针 | 快慢指针、滑动窗口经典题 |
| 3 | algorithm-003 | 链表 | 反转、环检测与合并 |
| 4 | algorithm-004 | 栈与队列 | 括号匹配、单调栈 |
| 5 | algorithm-005 | 哈希表 | 两数之和家族与设计类题 |
| 6 | algorithm-006 | 树与 DFS/BFS | 遍历、路径与序列化 |
| 7 | algorithm-007 | 动态规划入门 | 从爬楼梯到背包的状态设计 |
| 8 | algorithm-008 | 手写题算法化 | LRU、并发调度等「前端算法题」串讲 |
| 9 | algorithm-009 | 大厂前端真题解析（一） | 字节/腾讯风格真题 |
| 10 | algorithm-010 | 大厂前端真题解析（二） | 阿里/美团风格真题 |

---

# 三条学习路径（按人群）

## 路径 A：校招速通（约 25 篇 / 6~8 周）

目标是拿 offer，按面试权重精读：

1. **js-deep 全系列 12 篇**（闭包、this、原型链是校招必考）
2. js-async-005 事件循环 → js-async-002/003 Promise（含手写）
3. network-006 缓存 → network-007 跨域 → network-003 HTTP2
4. es6-008 Proxy → es6-007 Map/Set
5. 框架二选一：vue-001/002/005 或 react-002/003/004/005
6. handwritten-001~006（六大手写题）
7. browser-basic-003 与 network-010 二选一（URL 到页面）

## 路径 B：1~3 年进阶（社招跳槽，约 30 篇 / 3 个月）

在路径 A 基础上追加：

1. js-async 全系列 + network 全系列
2. 所用框架的全系列（vue 或 react 8 篇）
3. engineering 全系列（社招必问工程化）
4. performance-001~006
5. rendering-001~003（渲染三件套）

## 路径 C：系统学习（全 158 篇 / 长期）

按 roadmap 顺序从 P1 到 P3 完整学习，适合从初级培养到高级的全周期成长，建议每个系列读完后完成该系列思考题再进入下一系列。

---

# 已产出文章索引

**全部 158 篇已产出完毕（2026-10-26）**——完整机读索引（id / 标题 / 难度 / 时长 / 文件路径）见 **[INDEX.md](./INDEX.md)**，按阶段与系列分组的总目录同本文件各系列表格。

全量校验通过：frontmatter 字段完整、id 唯一且与文件名一致、prev/next 链可达、每篇含思考题与参考文献。

// 系列元数据：图标、阶段、一句话简介（摘自 SERIES-INTROS）
export type IconSpec =
  | { type: 'logo'; file: string; name: string }
  | { type: 'mono'; char: string };

export interface SeriesMeta {
  id: string;
  stage: 'P1' | 'P2' | 'P3';
  icon: IconSpec;
  en: string;
  blurb: string;
  intro: string;
}

export const SERIES: SeriesMeta[] = [
  { id: 'js-deep', stage: 'P1', icon: { type: 'logo', file: 'javascript', name: 'JavaScript' }, en: 'INTERVIEW CORE', blurb: '面试权重最高的机制题', intro: '把闭包、this、原型链、继承这些必考机制，从「背结论」变成「能推演」——JavaScript 面试的主战场。' },
  { id: 'js-core', stage: 'P1', icon: { type: 'logo', file: 'javascript', name: 'JavaScript' }, en: 'LANGUAGE BASE', blurb: '以为会了的语言地基', intro: '类型系统、类型转换、数组对象 API、错误处理——补齐那些「天天在用却讲不清」的地基。' },
  { id: 'css-deep', stage: 'P1', icon: { type: 'mono', char: 'C' }, en: 'LAYOUT & RENDER', blurb: '能用的 CSS → 能解释的 CSS', intro: '盒模型、BFC、层叠、Flex/Grid 到动画性能阶梯——每条规则都讲出为什么。' },
  { id: 'dom-events', stage: 'P1', icon: { type: 'mono', char: 'D' }, en: 'INTERACTION', blurb: '页面交互的地基', intro: '事件流、事件委托、观察者 API——把 DOM 操作从「抄代码」变成「懂机制」。' },
  { id: 'browser-basic', stage: 'P1', icon: { type: 'mono', char: 'B' }, en: 'BIG PICTURE', blurb: '浏览器全景心智模型', intro: '多进程、渲染线程、存储、同源策略与异步入门——一切上层知识的地基。' },
  { id: 'js-async', stage: 'P2', icon: { type: 'logo', file: 'javascript', name: 'JavaScript' }, en: 'EVENT LOOP', blurb: '事件循环与异步演进', intro: '从回调地狱到 async/await，沿历史演进讲透异步机制，并交付生产级模式。' },
  { id: 'es6', stage: 'P2', icon: { type: 'mono', char: '6+' }, en: 'SYNTAX EVOLUTION', blurb: '高价值语法的为什么', intro: '逐个拆解高价值语法——不只记住 API，更讲清它们为什么这样设计。' },
  { id: 'network', stage: 'P2', icon: { type: 'mono', char: 'N' }, en: 'FULL PIPELINE', blurb: '前端网络问题的总答案', intro: 'TCP、HTTPS、缓存、跨域与渲染，串成一条从「握手」到「像素」的完整线。' },
  { id: 'vue', stage: 'P2', icon: { type: 'logo', file: 'vuedotjs', name: 'Vue.js' }, en: 'FRAMEWORK INTERNALS', blurb: 'Vue 机制主干', intro: '响应式、diff、nextTick、路由与状态管理——讲透 Vue 的机制主干。' },
  { id: 'react', stage: 'P2', icon: { type: 'logo', file: 'react', name: 'React' }, en: 'FRAMEWORK INTERNALS', blurb: 'React 机制主干', intro: 'JSX、渲染流程、Fiber、Hooks、setState 与 memo——React 的机制主干。' },
  { id: 'engineering', stage: 'P2', icon: { type: 'mono', char: 'W' }, en: 'BUILD & SHIP', blurb: '代码之外的半壁江山', intro: '依赖管理、打包、Vite、Babel、Tree Shaking 到部署缓存——工程化全链。' },
  { id: 'performance', stage: 'P2', icon: { type: 'mono', char: 'P' }, en: 'METRICS & TACTICS', blurb: '指标、测量与专项弹药', intro: '先立指标与测量，再交付加载、渲染、内存三大方向的优化手段。' },
  { id: 'v8', stage: 'P3', icon: { type: 'mono', char: 'V8' }, en: 'ENGINE VIEW', blurb: '引擎视角的底层真相', intro: '执行流水线、JIT、隐藏类、垃圾回收与内存泄漏——引擎不是黑盒。' },
  { id: 'rendering', stage: 'P3', icon: { type: 'mono', char: 'R' }, en: 'PIXELS', blurb: '像素的诞生', intro: '渲染五站管线、层叠、GPU 合成与性能病例复盘——原理都能在火焰图上指认。' },
  { id: 'handwritten', stage: 'P3', icon: { type: 'mono', char: 'H' }, en: 'INTERVIEW ARSENAL', blurb: '手写题武器库', intro: 'call/bind、Promise/A+、深拷贝、LRU、mini-Vue——每篇都是完整实现与边界清单。' },
  { id: 'ts', stage: 'P3', icon: { type: 'logo', file: 'typescript', name: 'TypeScript' }, en: 'TYPE SYSTEM', blurb: '从写注解到懂类型系统', intro: '结构化类型、泛型体操、类型守卫与工程治理——TS 的系统级理解。' },
  { id: 'architecture', stage: 'P3', icon: { type: 'mono', char: 'A' }, en: 'DECISIONS', blurb: '从写代码到做决策', intro: '组件设计、状态分层、微前端、Monorepo、监控与复杂页面权衡。' },
  { id: 'security', stage: 'P3', icon: { type: 'mono', char: 'S' }, en: 'DEFENSE IN DEPTH', blurb: '纵深防御的安全观', intro: 'XSS、CSRF、点击劫持、数据安全与供应链——攻击面、防御体系与工程清单。' },
  { id: 'algorithm', stage: 'P3', icon: { type: 'mono', char: '∑' }, en: 'FRONTEND ALGOS', blurb: '前端向算法路线', intro: '复杂度、双指针、哈希、树、DP 到手写题算法化与大厂真题演练。' },
];

export const STAGES = [
  { key: 'P1', name: '夯实基础', en: 'STAGE 1' },
  { key: 'P2', name: '知识进阶', en: 'STAGE 2' },
  { key: 'P3', name: '高级进阶', en: 'STAGE 3' },
] as const;

// 首页路径流（精选节点，链接到文章页或系列页）
export interface PathNode { label: string; sub: string; href: string }
export const PATH_FLOWS: { stage: 'P1' | 'P2' | 'P3'; nodes: PathNode[] }[] = [
  {
    stage: 'P1',
    nodes: [
      { label: '执行上下文栈', sub: 'js-deep · 001', href: '/articles/js-deep-001/' },
      { label: '变量对象与提升', sub: 'js-deep · 002', href: '/articles/js-deep-002/' },
      { label: '作用域链', sub: 'js-deep · 004', href: '/articles/js-deep-004/' },
      { label: '闭包 ★', sub: 'js-deep · 005', href: '/articles/js-deep-005/' },
      { label: 'this 与原型链', sub: 'js-deep · 006-009', href: '/articles/js-deep-006/' },
      { label: 'DOM 与事件流', sub: 'dom-events · 6 篇', href: '/series/dom-events/' },
    ],
  },
  {
    stage: 'P2',
    nodes: [
      { label: '回调 → Promise', sub: 'js-async · 001-002', href: '/articles/js-async-001/' },
      { label: '事件循环 ★', sub: 'js-async · 005', href: '/articles/js-async-005/' },
      { label: 'HTTPS 与缓存', sub: 'network · 005-006', href: '/articles/network-005/' },
      { label: 'Vue 响应式', sub: 'vue · 001', href: '/articles/vue-001/' },
      { label: 'Fiber 架构', sub: 'react · 003', href: '/articles/react-003/' },
      { label: 'Vite 为什么快', sub: 'engineering · 005', href: '/articles/engineering-005/' },
    ],
  },
  {
    stage: 'P3',
    nodes: [
      { label: 'V8 执行流水线', sub: 'v8 · 001', href: '/articles/v8-001/' },
      { label: '隐藏类与 IC', sub: 'v8 · 002', href: '/articles/v8-002/' },
      { label: '内存与 GC', sub: 'v8 · 005', href: '/articles/v8-005/' },
      { label: '渲染管线', sub: 'rendering · 001', href: '/articles/rendering-001/' },
      { label: '微前端沙箱', sub: 'architecture · 003', href: '/articles/architecture-003/' },
    ],
  },
];

export const FEATURED = {
  id: 'js-deep-005',
  title: 'JavaScript 深入之闭包',
  kind: '本周精读 · JS-DEEP-005',
  meta: '18 分钟 · ★★★★★ 面试高频 · 闭包 / 作用域链 / 内存管理',
  desc: '从一段 for + setTimeout 的输出题切入，用 [[Environment]] 内部槽讲清闭包的机制本质，再到内存代价与四大应用——读完能把它讲给面试官听。',
};

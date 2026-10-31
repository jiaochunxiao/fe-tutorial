// 系列名称与阶段文案统一从这里读取，避免各页面维护重复的三元表达式。
const SERIES_NAMES: Record<string, string> = {
  'js-deep': 'JavaScript 深入系列',
  'js-core': 'JavaScript 核心系列',
  'css-deep': 'CSS 深入系列',
  'dom-events': 'DOM 与事件系列',
  'browser-basic': '浏览器基础系列',
  'js-async': '异步编程系列',
  es6: 'ES6+ 系列',
  network: '网络与浏览器系列',
  vue: 'Vue 原理系列',
  react: 'React 原理系列',
  engineering: '前端工程化系列',
  performance: '性能优化系列',
  v8: 'V8 与底层系列',
  rendering: '渲染原理系列',
  handwritten: '手写源码系列',
  ts: 'TypeScript 系列',
  architecture: '前端架构系列',
  security: '前端安全系列',
  algorithm: '算法与数据结构',
};

export const STAGE_NAMES = {
  P1: '夯实基础',
  P2: '知识进阶',
  P3: '高级进阶',
} as const;

export const STAGE_HAN = {
  P1: '壹',
  P2: '贰',
  P3: '叁',
} as const;

export const CHAPTER_HAN = ['壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'] as const;

export function seriesName(id: string): string {
  return SERIES_NAMES[id] ?? id;
}

export function padNo(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

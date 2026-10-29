// 全量回归验证：23 篇含 SVG 的文章，对比源文与构建产物的 <rect>/<circle> 数量是否一致
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('.', import.meta.url).pathname;
const ids = ['js-deep-009','js-deep-001','js-deep-005','js-deep-006','js-deep-010',
  'css-deep-007','dom-events-002','js-async-005','js-async-004','network-001','network-006',
  'vue-001','react-003','v8-005','rendering-001','algorithm-002','ts-004','architecture-003',
  'security-001','js-core-001','network-005','handwritten-012','algorithm-007'];

const count = (s, re) => (s.match(re) || []).length;
let bad = 0;
for (const id of ids) {
  const hit = (function walk(dir) {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) { const r = walk(p); if (r) return r; }
      else if (f === `${id}.md` || f.startsWith(`${id}-`)) return p;
    }
    return null;
  })(root);
  const src = fs.readFileSync(hit, 'utf8');
  const fig = src.match(/<figure[\s\S]*?<\/figure>/)?.[0] ?? '';
  const srcShapes = count(fig, /<(rect|circle|ellipse|path|text|line)[\s>]/g);
  const distPath = path.join(root, 'website/dist/articles', id, 'index.html');
  const dist = fs.readFileSync(distPath, 'utf8');
  const distShapes = count(dist, /<(rect|circle|ellipse|path|text|line)[\s>]/g);
  const svgOpen = count(dist, /<svg[\s>]/g);
  const ok = srcShapes === distShapes && svgOpen >= 1;
  if (!ok) { bad++; console.log('MISMATCH', id, '源', srcShapes, '≠ 产物', distShapes, '| svg:', svgOpen); }
}
console.log(bad === 0 ? `✓ 23 篇全部一致，SVG 完整进入产物` : `✗ ${bad} 篇不一致`);

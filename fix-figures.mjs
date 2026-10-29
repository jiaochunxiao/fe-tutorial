// 一次性修复：移除 md 中 <figure>…</figure> 块内部的空行（Astro markdown 会因空行切断 HTML 块导致 svg 提前闭合）
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('.', import.meta.url).pathname;
const dirs = ['p1-foundation', 'p2-intermediate', 'p3-expert'];
let scanned = 0, fixed = 0;

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { walk(p); continue; }
    if (!p.endsWith('.md')) continue;
    scanned++;
    let c = fs.readFileSync(p, 'utf8');
    const figs = [...c.matchAll(/<figure[\s\S]*?<\/figure>/g)];
    if (!figs.length) continue;
    let changed = false;
    for (const m of figs) {
      if (/\n\s*\n/.test(m[0])) {
        c = c.replace(m[0], m[0].replace(/\n\s*\n/g, '\n'));
        changed = true;
      }
    }
    if (changed) {
      fs.writeFileSync(p, c);
      fixed++;
      console.log('FIXED', path.relative(root, p));
    }
  }
}

for (const d of dirs) walk(path.join(root, d));
console.log('扫描', scanned, '篇，修复', fixed, '篇');

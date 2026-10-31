// 外部 SVG 回归验证：检查 Markdown 引用、共享图库与构建产物是否一致
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const contentRoots = ['p1-foundation', 'p2-intermediate', 'p3-expert'];
const assetDir = path.join(root, 'assets/svg');
const distRoot = path.join(root, 'website/dist');
const bridgeRoot = path.join(root, 'workbuddy/frontend-mastery');

const walk = (dir) => {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(full);
  }
  return files;
};

// 同时覆盖 Markdown 图片语法与常见 HTML img 写法
const collectReferences = (source) => {
  const references = [];
  for (const match of source.matchAll(/!\[([^\]]*)\]\(([^)]+\.svg)\)/g)) {
    references.push({ alt: match[1], src: match[2] });
  }
  for (const match of source.matchAll(/<img\b[^>]*\bsrc=["']([^"']+\.svg)["'][^>]*>/g)) {
    const alt = match[0].match(/\balt=["']([^"']*)["']/)?.[1] ?? '';
    references.push({ alt, src: match[1] });
  }
  return references;
};

const markdownFiles = contentRoots.flatMap((dir) => walk(path.join(root, dir)));
let articleCount = 0;
let referenceCount = 0;
let bad = 0;
const referencedAssets = new Set();

for (const file of markdownFiles.sort()) {
  const source = fs.readFileSync(file, 'utf8');
  if (/<svg\b/.test(source)) {
    bad++;
    console.error(`✗ 仍有内联 SVG：${path.relative(root, file)}`);
  }

  const references = collectReferences(source);
  if (!references.length) continue;

  articleCount++;
  const articleId = source.match(/^id:\s*(.+)$/m)?.[1]?.trim();
  if (!articleId) {
    bad++;
    console.error(`✗ 缺少文章 id：${path.relative(root, file)}`);
    continue;
  }

  const htmlPath = path.join(distRoot, 'articles', articleId, 'index.html');
  if (!fs.existsSync(htmlPath)) {
    bad++;
    console.error(`✗ 构建页面不存在：${path.relative(root, htmlPath)}`);
    continue;
  }

  const html = fs.readFileSync(htmlPath, 'utf8');
  const images = [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+\.svg)"[^>]*>/g)];
  if (images.length !== references.length) {
    bad++;
    console.error(`✗ 图片数量不一致：${articleId} 源文 ${references.length} / 产物 ${images.length}`);
    continue;
  }

  for (let index = 0; index < references.length; index++) {
    const { alt, src: relativeSrc } = references[index];
    referenceCount++;
    const sourceAsset = path.resolve(path.dirname(file), relativeSrc);
    referencedAssets.add(sourceAsset);
    if (!fs.existsSync(sourceAsset)) {
      bad++;
      console.error(`✗ SVG 不存在：${path.relative(root, sourceAsset)}`);
      continue;
    }

    const sourceBuffer = fs.readFileSync(sourceAsset);
    const sourceSvg = sourceBuffer.toString('utf8');
    if (!/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(sourceSvg) || !/viewBox="/.test(sourceSvg)) {
      bad++;
      console.error(`✗ SVG 缺少 xmlns 或 viewBox：${path.relative(root, sourceAsset)}`);
    }

    // Markdown 引用与页面图片均保持源文顺序，逐项配对后直接比较原始字节。
    const [, distSrc] = images[index];
    const builtAsset = distSrc.startsWith('/')
      ? path.join(distRoot, decodeURIComponent(distSrc.slice(1)))
      : path.resolve(path.dirname(htmlPath), decodeURIComponent(distSrc));
    if (!fs.existsSync(builtAsset)) {
      bad++;
      console.error(`✗ 构建 SVG 不存在：${distSrc}`);
      continue;
    }
    if (!fs.readFileSync(builtAsset).equals(sourceBuffer)) {
      bad++;
      console.error(`✗ 图形内容不一致：${articleId} | ${alt}`);
    }
  }
}

// assets/svg 是共享图库，并非每个文件都必须被根目录文章直接引用；
// 但所有文件都应具备 SVG 命名空间和 viewBox，保证移动端可稳定渲染。
const assetFiles = fs.existsSync(assetDir)
  ? fs.readdirSync(assetDir).filter((name) => name.endsWith('.svg')).sort()
  : [];
const referencedNames = new Set([...referencedAssets].map((file) => path.basename(file)));
for (const name of assetFiles) {
  const file = path.join(assetDir, name);
  const svg = fs.readFileSync(file, 'utf8');
  if (!/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(svg) || !/viewBox="/.test(svg)) {
    bad++;
    console.error(`✗ 图库 SVG 缺少 xmlns 或 viewBox：${name}`);
  }
}
const unusedAssets = assetFiles.filter((name) => !referencedNames.has(name));
if (unusedAssets.length) {
  bad++;
  console.error(`✗ 图库存在未被根目录文章引用的 SVG：${unusedAssets.join(', ')}`);
}

// workbuddy 三阶段文章使用的 /diagrams/ 资源应全部沉淀到根目录图库
const bridgeMarkdown = contentRoots.flatMap((dir) => walk(path.join(bridgeRoot, dir)));
const bridgeNames = new Set();
for (const file of bridgeMarkdown) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/\/diagrams\/([^)\"'\s<>]+?\.svg)/g)) {
    bridgeNames.add(match[1]);
  }
}
const bridgeMissing = [...bridgeNames].filter((name) => !fs.existsSync(path.join(assetDir, name))).sort();
if (bridgeMissing.length) {
  bad++;
  console.error(`✗ workbuddy 引用未复制到图库：${bridgeMissing.join(', ')}`);
}
const bridgeUnused = [...bridgeNames].filter((name) => !referencedNames.has(name)).sort();
if (bridgeUnused.length) {
  bad++;
  console.error(`✗ workbuddy 引用未进入根目录文章：${bridgeUnused.join(', ')}`);
}

if (bad === 0) {
  console.log(`✓ ${articleCount} 篇根目录文章、${referenceCount} 幅引用与构建产物一致`);
  console.log(`✓ 共享图库 ${assetFiles.length} 幅 SVG 均被引用且格式合法，workbuddy ${bridgeNames.size} 幅图已进入文章`);
} else {
  process.exitCode = 1;
}

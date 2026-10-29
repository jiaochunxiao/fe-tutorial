# 前端进阶之路 · 学习网站

《前端进阶之路》158 篇文章的官方网站。**UI 混合方案已选定**：夜航路径（暗底 + 琥珀路径节点）做主视觉，墨纸书卷（暖纸衬线 + 朱砂一点）做文章阅读页——设计稿与选型过程见 `design-demos/` 与 [PROPOSAL.md](./PROPOSAL.md)。

## 快速开始

```bash
npm install
npm run dev        # 开发：http://localhost:4321
npm run build      # 构建：179 个静态页面 → dist/
npm run preview    # 预览构建产物
```

## 架构

- **Astro 5 · 内容零拷贝**：`src/content.config.ts` 的 glob loader 直接读取 `../`（frontend-mastery 根）下的 158 篇源文，frontmatter 经 zod schema 编译期校验——修改博客原文即改站点，无需迁移。
- **双页面语言**：
  - `src/layouts/Chrome.astro` + `styles/chrome.css` → 夜航路径（首页 / 系列页 / 导航页脚）
  - `src/layouts/Reading.astro` + `styles/reading.css` → 墨纸书卷（文章页 / 关于页）
  - 设计令牌集中在 `styles/tokens.css` 的 `:root`
- **页面**：`/`（路径总览）· `/path`（学习路线：校招速通/社招/全量）· `/series/[seriesId]` · `/articles/[id]` · `/search`（Pagefind 全文搜索）· `/about`
- **小程序联动 API**（构建期生成）：
  - `/api/index.json` —— 158 篇文章元数据（题库/目录同步源）
  - `/api/questions.json` —— 158 篇的思考题语料（raw markdown + 题数）
- **SVG 图解**：重点文章内联 15 幅原理图（5 幅 SMIL 动效），清单与制作规范见 [DIAGRAMS.md](../DIAGRAMS.md)
- **SEO/运维**：sitemap + `/rss.xml` + `public/_headers` 安全响应头；部署见 `DEPLOY.md`
- **技术 logo**：`public/logos/`（simple-icons v13 官方源，见 `brand-spec.md`）

## 目录

```
website/
├── src/
│   ├── content.config.ts      # 内容集合 + zod schema（读 ../ 源文）
│   ├── data/series.ts         # 19 系列元数据 + 首页路径流
│   ├── layouts/               # Base / Chrome（夜航）/ Reading（书卷）
│   ├── pages/                 # index · series/[id] · articles/[id] · about · api/*
│   └── styles/                # tokens.css · chrome.css · reading.css
├── design-demos/              # 三方向初稿与缩略图（设计过程存档）
├── refs/                      # 现实参照截图板
├── design-spec.md · directions.md · direction-approved.md · brand-spec.md · PROPOSAL.md
└── shot.py                    # Playwright 截图工具（验证用）
```

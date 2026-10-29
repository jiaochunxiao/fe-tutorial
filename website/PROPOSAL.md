# 《前端进阶之路》学习网站 · 技术选型与 UI 方案

> 状态：**✅ 方向已选定并进入实施（2026-10-27）**——混合方案「夜航路径做主视觉 + 墨纸书卷做阅读页」，选型过程见 `direction-approved.md`；实施进度见文末「实施记录」。
> 配套文件：design-spec.md（需求 spec）· directions.md（六张方向卡）· brand-spec.md（logo 资产）· design-demos/（缩略图与三版初稿）

## 一、需求与约束

- 内容：158 篇 Markdown 文章（frontmatter 含 id/series/stage/tags/readingTime/prev/next），19 系列 × 3 阶段，每篇含原理图与思考题。
- 受众：准备校招/社招的前端开发者（assumption，可推翻）。
- 核心体验：**长文阅读 > 检索 > 路径导航 > 进度追踪**。
- 无后端需求、无登录体系（一期）；个人项目，零成本托管优先。

## 二、技术选型

### 2.1 内容引擎：Astro 5（推荐）✅

| 方案 | 判语 |
|---|---|
| **Astro 5（自建主题）** | ✅ 首选。Content Collections 对 frontmatter 做类型校验（我们的 id/series/prev/next 直接变成编译期约束）；默认零 JS，阅读页极快；Shiki 原生代码高亮；设计自由度最大，huashu-design 选定的方向可 1:1 落地 |
| VitePress | 备选。文档 UX 开箱即用（侧栏/搜索/prev-next），但主题定制受 Vue 生态约束，自定义设计要对抗它的默认壳 |
| Docusaurus | 备选。React 系文档站，功能全但体感重、设计同质化明显 |
| Next.js + MDX | 不推荐。SSR/ISR 的运行时复杂度对纯静态内容是负资产 |

### 2.2 配套

| 层 | 选型 | 理由 |
|---|---|---|
| 样式 | 原生 CSS 设计令牌（`:root` 变量，实施调整） | 双页面语言（夜航/书卷）各自成体系，语义化 class + 令牌的定制度高于工具类；原计划 Tailwind v4，实施时评估后移除 |
| 代码高亮 | Shiki（Astro 内建） | 与 VS Code 同源，158 篇的代码块直接受益 |
| 站内搜索 | Pagefind | 构建期生成静态索引，零后端、零成本、中文可用 |
| 托管 | Cloudflare Pages（或 Vercel） | 免费额度充足、全球边缘——engineering-008 的哈希缓存策略直接落地 |
| 监控 | Cloudflare Web Analytics / umami | 无 Cookie、轻量；呼应 architecture-005 的监控体系 |
| 评论（可选） | giscus | GitHub Discussions 驱动，无自建存储 |
| 小程序联动 | 构建期产出 `/api/index.json`（文章元数据）| 供「上岸offer」小程序同步题库与文章目录 |

### 2.3 内容迁移脚本（一次性）

```
frontend-mastery/*.md ──脚本──▶ src/content/articles/
  · frontmatter → content collection schema（zod 校验）
  · 「## 思考题」段抽取 → 题库 JSON（小程序同步源）
  · ASCII 原理图 → 保留 <pre> 并套专用样式组件
```

### 2.4 里程碑（选定方向后）

1. **M1（2~3 天）**：Astro 骨架 + 内容迁移脚本 + 选定方向的 token/组件落地（首页/系列页/文章页）
2. **M2（2 天）**：Pagefind 搜索 + prev/next + TOC + 思考题折叠组件
3. **M3（1~2 天）**：路径总览页 + 深色模式（若方向含）+ 上线 + 监控
4. **M4（持续）**：题库联动接口、思考题解析回填

## 三、UI 方案（三方向，待选定）

### 方向一 · 墨纸书卷（吕敬人 · 最佳设计师）

- **气质**：暖纸底、巨字扉页（「进」+ 朱砂「上岸」印）、版心呼吸、书式目录——安静、可信、阅读优先。
- **最适合**：把「读」做到极致；长文阅读体验是核心资产；个人品牌的书卷气。
- **风险**：视觉冲击力三版中最弱（安静不是缺点，但传播截图不占优）。
- 文件：`design-demos/dir-1.html`（截图 dir-1.png）

### 方向二 · 夜航路径（roadmap.sh · 现实参照）

- **气质**：深夜书桌的屏幕（暖灰黑）+ 琥珀节点路径图——19 系列排成三段可点击的路径，进度语义内建。
- **最适合**：把「体系与路径」做成首屏主角——站名「进阶之路」与视觉同构；学习进度天然入画。
- **风险**：路径图的信息密度对首访者有学习成本；暗色长文的排版要额外打磨。
- 文件：`design-demos/dir-2.html`（截图 dir-2.png）

### 方向三 · 上字海报（中文实验字体 · 秒数轮盘）

- **气质**：米灰海报、手工 SVG 搭的巨字「上」（一笔朱红）、三笔画=三阶段——大胆、品牌语义最强。
- **最适合**：个人品牌的记忆点与传播截图；把「上岸offer」的字面变成视觉资产。
- **风险**：海报式首页的信息密度低，日常使用要靠内页撑；巨字资产需要一次性手工投入。
- 文件：`design-demos/dir-3.html`（截图 dir-3.png）

### 缩略图总览（含三张落选备选）

- `design-demos/thumbs.html` / `thumbs.png`：T1 清单系统（Jetset）· T3 彩虹文档（Tailwind）· T5 像素闯关（轮盘）为落选备选——看中备选可说，我做成完整版。

## 四、选定后的流程

1. `direction-approved.md` 落档（展示版本/截图路径/你的原话）；品味表态逐字记入偏好档案
2. Astro M1 开工：把选定方向的色板/字阶/组件做成 design tokens + 页面骨架
3. 内容迁移脚本跑 158 篇 → 本地预览 → 按engineering-008 的发布清单上线
4. 收工三件事：lint 复查 + 外观账本记一笔 + learn.py harvest

## 实施记录

- **2026-10-27 · M1 完成**：Astro 5 骨架 + 内容零拷贝接入（glob loader 直读 ../ 源文，无迁移拷贝）+ 双页面语言落地（Chrome/Reading 双布局 + tokens.css 令牌）。
  - 页面：`/`（夜航路径总览）· `/series/[id]`（19 个）· `/articles/[id]`（158 个）· `/about` · 构建产物 **179 页**
  - API：`/api/index.json`（文章元数据）· `/api/questions.json`（思考题语料，158/158 篇抽取成功，供小程序同步）
  - 修复记录：源文 frontmatter 两处 YAML 保留字符（`!important`、`@types`）加引号；首页暗色画布作用域化（`.chrome-root`）；阅读页隐藏 md 自带 h1、正文切衬线
  - 验证：build 通过 + preview 四路由 200 + 三页 Playwright 截图目检通过
- **2026-10-28 · M2/M3 完成**：
  - **Pagefind 搜索**：构建期索引 158 页/11099 词（中文分词）；`/search` 页用 pagefind JS API + 夜航 qrow 渲染（excerpt 琥珀高亮、两行截断），支持 `/search?q=xxx` 直达
  - **文章页 TOC**：render headings 取 h2/h3 生成右侧 sticky 目录（≤1200px 收起），锚点跳转实测
  - **思考题折叠**：渐进增强 `<details>`（无 JS 保持展开），运行时实测 details=1、默认闭合、展开后四题完整
  - **路径总览页 `/path`**：校招速通约 25 篇（可点击 node 流，含两个二选一）+ 社招追加清单 + 系统学习全量 158 篇
  - **SEO/上线**：sitemap + RSS（`/rss.xml`）+ `public/_headers` 安全响应头 + DEPLOY.md（Cloudflare Pages 两种方式与检查清单）
  - **监控接入点**：Base.astro 错误/unhandledrejection 监听（console 留痕，接上报时替换一处）+ Web Analytics token 占位
  - **决策记录**：阅读页不做反色深色模式——纸面是书卷语言的核心（M3「若需要」判定为不需要）
  - **SVG 图解批次**：**23 幅**内联 SVG 插入重点文章——首批 15 幅（js-deep×5 / css-deep / dom-events / js-async×2 / network×2 / vue / react / v8 / rendering / algorithm，5 幅 SMIL 微动效）+ 候补批次 8 幅（react-003 双缓冲动效升级 / ts-004 infer 捕获槽 / architecture-003 Proxy 沙箱 / security-001 三道墙地图 / js-core-001 栈与堆 / network-005 TLS 时序 / handwritten-012 LRU 联动 / algorithm-007 DP 逐格点亮）——统一墨/纸/朱砂视觉语言，清单见 `../DIAGRAMS.md`
  - **SVG 回归修复**：发现 Astro markdown 会在 figure 内部空行处切断 HTML 块（svg 被提前闭合、图形退化为文本）——脚本清理全部 23 篇 figure 内部空行，并以 verify-svg.mjs 做「源文 vs 产物」图形元素数全量回归（23/23 一致）
  - 验证：build 通过 + 全路由遍历 0 页面错误 + 搜索/折叠/TOC 运行时断言通过 + SVG 渲染目检（原型三角/事件循环）
- **待办（M2/M3）**：无——M1/M2/M3 全部完成。后续增量：思考题解析回填、Pagefind filter（按系列/阶段筛选）

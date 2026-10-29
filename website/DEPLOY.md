# 部署指南

> 构建产物为纯静态 `dist/`（含 Pagefind 索引），无后端。
> **当前方案：Vercel**（仓库根已含 `vercel.json`，导入即部署）；Cloudflare Pages 为备选（见文末）。

## Vercel（当前方案）

仓库根的 `vercel.json` 已声明全部构建配置，**导入仓库后无需任何设置**：

```json
{
  "installCommand": "npm install --prefix website",
  "buildCommand": "cd website && npm run build",
  "outputDirectory": "website/dist"
}
```

### 方式 A：CLI 部署（已验证）

```bash
cd frontend-mastery                # 仓库根（vercel.json 所在）
vercel link --yes --project fe-tutorial
vercel deploy --prod --yes
```

### 方式 B：Git 连接（push 即部署）

1. Vercel Dashboard → Add New Project → Import `jiaochunxiao/fe-tutorial`
2. Framework 与其他设置保持默认（根级 vercel.json 已声明 install/build/output）
3. Deploy —— 之后每次 push 自动重新部署

### 注意

- `astro.config.mjs` 的 `site` 替换为实际 Vercel 域名后重发（影响 sitemap/RSS 的绝对链接）
- 监控接入点：`src/layouts/Base.astro`（Web Analytics token 占位 + 错误监听）

## Cloudflare Pages（备选方案）

## 方式 A：Git 连接（推荐，push 即部署）

1. 把 `frontend-mastery` 推到 GitHub/GitLab
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git
3. 配置：
   - **Root directory**: `website`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - Node 版本：环境变量 `NODE_VERSION` = `20`
4. 首次部署后绑定自定义域名（Custom domains）

## 方式 B：Wrangler 直传

```bash
npm run build                        # astro build + pagefind 索引 dist/
npx wrangler pages deploy dist --project-name frontend-mastery
```

## 上线前检查清单（engineering-008）

- [ ] `astro.config.mjs` 的 `site` 替换为实际域名（影响 sitemap 与 RSS 绝对链接）
- [ ] 资源为 contenthash 命名（Astro 默认）→ 强缓存生效；HTML no-cache 由托管默认协商
- [ ] `/api/index.json`、`/api/questions.json` 可访问（小程序联动的两个数据源）
- [ ] Pagefind 索引存在：`dist/pagefind/pagefind-entry.json`
- [ ] 安全响应头（可选，`public/_headers`）：

```
/*
  X-Frame-Options: SAMEORIGIN
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
```

## 监控（architecture-005 的落点）

- **访问统计**：Cloudflare Web Analytics（Dashboard 开启后拿 token，填入
  `src/layouts/Base.astro` 中标注的占位 script）
- **错误监控**：一期用 `Base.astro` 里的 error/unhandledrejection 监听
  （console 上报，见 TODO 注释）；接 Sentry/自建时替换上报函数即可
- **性能指标**：LCP/CLS/INP 采集已在 architecture-005 成文，接入时用
  PerformanceObserver 上报到同一通道

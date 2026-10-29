// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// 内容零拷贝：content collection 直接从 ../（frontend-mastery/ 根）读取 158 篇源文
// site 为 Cloudflare Pages 部署占位域名，上线时替换为实际域名（见 DEPLOY.md）
export default defineConfig({
  site: 'https://frontend-mastery.pages.dev',
  integrations: [sitemap()],
  build: {
    inlineStylesheets: 'auto',
  },
});

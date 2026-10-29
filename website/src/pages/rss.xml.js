import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const entries = (await getCollection('articles'))
    .sort((a, b) => b.data.createdAt.localeCompare(a.data.createdAt));
  return rss({
    title: '前端进阶之路',
    description: '19 个系列 · 158 篇 · 300+ 张原理图——一套体系化的前端进阶课程，从执行上下文走到架构权衡。',
    site: context.site,
    items: entries.map((e) => ({
      title: e.data.title,
      pubDate: new Date(e.data.createdAt),
      link: `/articles/${e.data.id}/`,
      description: `${e.data.series} · ${e.data.readingTime} 分钟阅读 · ${e.data.tags.join(' / ')}`,
    })),
    customData: '<language>zh-CN</language>',
  });
}

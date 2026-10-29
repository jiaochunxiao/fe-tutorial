import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 内容零拷贝：直接从 frontend-mastery/ 根读取 158 篇源文
// frontmatter schema = 课程写作规范（README.md）的编译期落地
const articles = defineCollection({
  loader: glob({
    pattern: '{p1-foundation,p2-intermediate,p3-expert}/**/*.md',
    base: '../',
  }),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    series: z.string(),
    seriesId: z.string(),
    stage: z.enum(['foundation', 'intermediate', 'expert']),
    difficulty: z.number().min(1).max(5),
    tags: z.array(z.string()),
    readingTime: z.number(),
    prev: z.string().nullable(),
    next: z.string().nullable(),
    createdAt: z
      .union([z.string(), z.date()])
      .transform((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v)),
  }),
});

export const collections = { articles };

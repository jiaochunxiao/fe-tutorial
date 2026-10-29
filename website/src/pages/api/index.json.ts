import { getCollection } from 'astro:content';

export const prerender = true;

export async function GET() {
  const entries = await getCollection('articles');
  const data = entries
    .map((e) => ({
      id: e.data.id,
      title: e.data.title,
      series: e.data.series,
      seriesId: e.data.seriesId,
      stage: e.data.stage,
      difficulty: e.data.difficulty,
      tags: e.data.tags,
      readingTime: e.data.readingTime,
      createdAt: e.data.createdAt,
      url: `/articles/${e.data.id}/`,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return new Response(JSON.stringify({ total: data.length, articles: data }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

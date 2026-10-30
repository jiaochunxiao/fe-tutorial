import { getCollection } from 'astro:content';

export const prerender = true;

// 思考题抽取：从每篇文章 body 中截取「## 思考题」小节的原始 Markdown，
// 供小程序「前端面试刷题助手 上岸offer」题库同步（本站与小程序共享同一份内容真相）。
function extractQuestions(body: string): { raw: string; count: number } {
  const head = body.indexOf('## 思考题');
  if (head === -1) return { raw: '', count: 0 };
  const start = body.indexOf('\n', head) + 1;
  const nextH = body.indexOf('\n## ', start);
  const raw = body.slice(start, nextH === -1 ? body.length : nextH).trim();
  const count = (raw.match(/^\s*\d+[.、）)]/gm) || []).length;
  return { raw, count };
}

export async function GET() {
  const entries = await getCollection('articles');
  const data = entries
    .map((e) => {
      const q = extractQuestions(e.body ?? '');
      return {
        id: e.data.id,
        title: e.data.title,
        seriesId: e.data.seriesId,
        count: q.count,
        raw: q.raw,
        url: `/articles/${e.data.id}/`,
      };
    })
    .filter((x) => x.count > 0)
    .sort((a, b) => a.id.localeCompare(b.id));
  return new Response(JSON.stringify({ total: data.length, questions: data }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

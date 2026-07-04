import matter from 'gray-matter';
import { EntitySchema, type Entity } from '../../src/data/schema';
import { stripWikilinks, extractArea } from './text';

export function parseEntity(
  category: Entity['category'],
  filename: string,
  raw: string,
): Entity {
  const id = `${category}/${filename.replace(/\.md$/, '')}`;
  try {
    const { data, content } = matter(raw);
    const body = stripWikilinks(content.trim());

    const fields: Record<string, string> = {};
    const section = body.match(/## 基本資訊\n([\s\S]*?)(?=\n## |$)/);
    if (section) {
      for (const line of section[1].split('\n')) {
        const m = line.match(/^- (.+?)[：:]\s*(.*)$/);
        if (m) fields[m[1].trim()] = m[2].trim();
      }
    }

    let rating: number | null = null;
    const rawRating = fields['評分'];
    if (rawRating && !['N/A', '-', '—', ''].includes(rawRating)) {
      rating = Number.parseFloat(rawRating);
      if (Number.isNaN(rating)) throw new Error(`評分不是數字：「${rawRating}」`);
    }

    const paragraphs = body.split(/\n{2,}/);
    const summary = paragraphs.find((p) => p.trim() && !p.startsWith('#'))?.trim() ?? '';

    const tags: string[] = Array.isArray(data.tags) ? data.tags.map(String) : [];
    const areaSource = `${fields['位置'] ?? ''} ${fields['區域'] ?? ''} ${tags.join(' ')}`;

    return EntitySchema.parse({
      id,
      category,
      name: String(data.title ?? '').trim() || raiseMissingTitle(),
      tags,
      updated: data.updated ? String(data.updated) : '',
      favorite: data.favorite === true,
      fields,
      summary,
      body,
      area: extractArea(areaSource),
      rating,
    });
  } catch (err) {
    throw new Error(`[${id}] 解析失敗：${err instanceof Error ? err.message : err}`);
  }
}

function raiseMissingTitle(): never {
  throw new Error('frontmatter 缺 title');
}
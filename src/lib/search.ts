import { entities, guides } from '../data';
import type { Entity, Guide } from '../data/schema';

const SEARCHABLE_CATEGORIES: readonly Entity['category'][] = ['餐廳', '景點', '購物', '交通'];
const MAX_ENTITIES = 6;
const MAX_GUIDES = 4;

function entityHaystack(e: Entity): string {
  return [e.name, e.summary, e.area, e.tags.join(' '), Object.values(e.fields).join(' ')]
    .join(' ')
    .toLowerCase();
}

function guideHaystack(g: Guide): string {
  return `${g.title} ${g.body}`.toLowerCase();
}

export function searchAll(query: string): { entities: Entity[]; guides: Guide[] } {
  const q = query.trim().toLowerCase();
  if (!q) return { entities: [], guides: [] };

  const matchedEntities = entities
    .filter((e) => SEARCHABLE_CATEGORIES.includes(e.category))
    .filter((e) => entityHaystack(e).includes(q))
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, MAX_ENTITIES);

  const matchedGuides = guides
    .filter((g) => guideHaystack(g).includes(q))
    .slice(0, MAX_GUIDES);

  return { entities: matchedEntities, guides: matchedGuides };
}

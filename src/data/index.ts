import type { Entity, Day, TodoItem, Meta } from './schema';
import entitiesJson from './entities.json';
import daysJson from './days.json';
import todosJson from './todos.json';
import overviewJson from './overview.json';
import metaJson from './meta.json';

export const entities = entitiesJson as Entity[];
export const days = daysJson as Day[];
export const todos = todosJson as TodoItem[];
export const overview = overviewJson as { fields: Record<string, string>; transportNotes: string[] };
export const meta = metaJson as Meta;

export const byCategory = (cat: Entity['category']) => entities.filter((e) => e.category === cat);
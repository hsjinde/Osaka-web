import { z } from 'zod';

export const CATEGORIES = ['餐廳', '景點', '購物', '交通', '住宿', '區域'] as const;

export const EntitySchema = z.object({
  id: z.string().min(1),
  category: z.enum(CATEGORIES),
  name: z.string().min(1),
  tags: z.array(z.string()),
  updated: z.string(),
  favorite: z.boolean(),
  fields: z.record(z.string(), z.string()),
  summary: z.string(),
  body: z.string(),
  area: z.string(),
  rating: z.number().min(0).max(5).nullable(),
});
export type Entity = z.infer<typeof EntitySchema>;

export const DaySlotSchema = z.object({
  time: z.string().min(1),
  title: z.string().min(1),
  note: z.string(),
  pending: z.boolean(),
});
export const DaySchema = z.object({
  label: z.string().regex(/^Day \d+$/),
  date: z.string().min(1),
  theme: z.string().min(1),
  areas: z.array(z.string()),
  slots: z.array(DaySlotSchema).min(1),
});
export type Day = z.infer<typeof DaySchema>;
export type DaySlot = z.infer<typeof DaySlotSchema>;

export const TodoItemSchema = z.object({
  key: z.string().startsWith('todo:'),
  text: z.string().min(1),
  checkedInVault: z.boolean(),
});
export type TodoItem = z.infer<typeof TodoItemSchema>;

export const MetaSchema = z.object({
  builtAt: z.string(),
  tripStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tripEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type Meta = z.infer<typeof MetaSchema>;
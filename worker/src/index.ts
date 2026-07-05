import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = { DB: D1Database; DASH_TOKEN: string };
const app = new Hono<{ Bindings: Bindings }>();

app.use('/api/*', cors({
  origin: ['https://osaka.19980803.xyz', 'https://hsjinde.github.io', 'http://localhost:5173'],
  allowMethods: ['GET', 'PUT', 'OPTIONS'],
  allowHeaders: ['Authorization', 'Content-Type'],
}));

app.use('/api/*', async (c, next) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.DASH_TOKEN}`) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  await next();
});

app.get('/api/state', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT key, value FROM state').all<{ key: string; value: string }>();
  const map: Record<string, boolean> = {};
  for (const r of results) map[r.key] = r.value === '1';
  return c.json(map);
});

app.put('/api/state/:key', async (c) => {
  const key = decodeURIComponent(c.req.param('key'));
  const { value } = await c.req.json<{ value: boolean }>();
  await c.env.DB
    .prepare('INSERT INTO state (key, value, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ?3')
    .bind(key, value ? '1' : '0', new Date().toISOString())
    .run();
  return c.json({ ok: true });
});

export default app;
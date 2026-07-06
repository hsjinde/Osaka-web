import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = { DB: D1Database; DASH_TOKEN: string; DASH_PASSWORD: string };
const app = new Hono<{ Bindings: Bindings }>();

app.use('/api/*', cors({
  origin: ['https://osaka.19980803.xyz', 'https://hsjinde.github.io', 'http://localhost:5173'],
  allowMethods: ['GET', 'PUT', 'POST', 'OPTIONS'],
  allowHeaders: ['Authorization', 'Content-Type'],
}));

app.use('/api/*', async (c, next) => {
  // 公開：讀取(GET)、預檢(OPTIONS)、登入(POST /api/login)；其餘寫入需 DASH_TOKEN。
  const open = c.req.method === 'GET' || c.req.method === 'OPTIONS' || c.req.path === '/api/login';
  if (!open && c.req.header('Authorization') !== `Bearer ${c.env.DASH_TOKEN}`) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  await next();
});

// 以共用密碼換取寫入用的 token。
app.post('/api/login', async (c) => {
  const { password } = await c.req.json<{ password: string }>();
  if (password !== c.env.DASH_PASSWORD) {
    return c.json({ error: 'invalid password' }, 401);
  }
  return c.json({ token: c.env.DASH_TOKEN });
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

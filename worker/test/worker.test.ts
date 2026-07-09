import { describe, it, expect, vi, afterEach } from 'vitest';
import app from '../src/index';

/** 極簡 in-memory D1 假件，只支援本 Worker 用到的語法 */
function fakeD1() {
  const rows = new Map<string, { key: string; value: string; updated_at: string }>();
  return {
    prepare(_sql: string) {
      return {
        bind(...args: string[]) {
          return {
            async run() {
              rows.set(args[0], { key: args[0], value: args[1], updated_at: args[2] });
              return { success: true };
            },
          };
        },
        async all() {
          return { results: [...rows.values()] };
        },
      };
    },
  };
}

const env = { DB: fakeD1() as unknown, DASH_TOKEN: 'secret123', DASH_PASSWORD: '0509' };
const auth = { Authorization: 'Bearer secret123' };

describe('worker API', () => {
  it('GET 免驗證，公開讀取', async () => {
    const res = await app.request('/api/state', {}, env);
    expect(res.status).toBe(200);
  });

  it('PUT 無 token 拒絕', async () => {
    const res = await app.request('/api/state/x', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: true }),
    }, env);
    expect(res.status).toBe(401);
  });

  it('PUT 錯 token 拒絕', async () => {
    const res = await app.request('/api/state/x', {
      method: 'PUT', headers: { Authorization: 'Bearer wrong', 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: true }),
    }, env);
    expect(res.status).toBe(401);
  });

  it('PUT 後 GET 讀得回來', async () => {
    const put = await app.request('/api/state/' + encodeURIComponent('fav:餐廳/測試'), {
      method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: true }),
    }, env);
    expect(put.status).toBe(200);
    const res = await app.request('/api/state', { headers: auth }, env);
    const map = await res.json() as Record<string, boolean>;
    expect(map['fav:餐廳/測試']).toBe(true);
  });

  it('value:false 覆寫', async () => {
    await app.request('/api/state/' + encodeURIComponent('fav:餐廳/測試'), {
      method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: false }),
    }, env);
    const res = await app.request('/api/state', { headers: auth }, env);
    const map = await res.json() as Record<string, boolean>;
    expect(map['fav:餐廳/測試']).toBe(false);
  });

  it('POST /api/login 密碼正確回傳 token', async () => {
    const res = await app.request('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: '0509' }),
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { token: string };
    expect(body.token).toBe('secret123');
  });

  it('POST /api/login 密碼錯誤回 401', async () => {
    const res = await app.request('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: '9999' }),
    }, env);
    expect(res.status).toBe(401);
  });
});

function b64(str: string) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const x of bytes) bin += String.fromCharCode(x);
  return btoa(bin);
}
function unb64(s: string) {
  const bin = atob(s.replace(/\n/g, ''));
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

const itinEnv = {
  DB: fakeD1() as unknown,
  DASH_TOKEN: 'secret123', DASH_PASSWORD: '0509',
  GH_OWNER: 'o', GH_REPO: 'r', GH_BRANCH: 'main',
  GH_ITINERARY_PATH: 'wiki/dashboard/每日行程.md',
  GITHUB_TOKEN: 'ghtok',
};

describe('worker itinerary API', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('PUT /api/itinerary 無 token 拒絕', async () => {
    const res = await app.request('/api/itinerary', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ daySectionsMarkdown: '## Day 0｜x｜y\n- a｜b\n' }),
    }, itinEnv);
    expect(res.status).toBe(401);
  });

  it('PUT /api/itinerary 保留前言、換行程區塊、帶 sha', async () => {
    const current =
      '---\ntitle: 每日行程\n---\n\n# 每日行程\n\n> 格式規則：略\n\n' +
      '## Day 0｜09/30｜舊\n> 區域：難波\n\n- 上午｜舊行程\n';
    let putBody: { content: string; sha: string } | null = null;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (!init || init.method !== 'PUT') {
        return new Response(JSON.stringify({ content: b64(current), sha: 'sha123' }), { status: 200 });
      }
      putBody = JSON.parse(init.body as string);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }));

    const newSections = '## Day 0｜09/30｜新主題\n> 區域：梅田\n\n- 上午｜新行程｜備註\n';
    const res = await app.request('/api/itinerary', {
      method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ daySectionsMarkdown: newSections }),
    }, itinEnv);

    expect(res.status).toBe(200);
    expect(putBody!.sha).toBe('sha123');
    const decoded = unb64(putBody!.content);
    expect(decoded).toContain('> 格式規則：略');       // 前言保留
    expect(decoded).toContain('## Day 0｜09/30｜新主題'); // 新行程進去
    expect(decoded).not.toContain('## Day 0｜09/30｜舊'); // 舊行程被替換
  });

  it('PUT /api/itinerary GitHub 回 409 → 回 409', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (!init || init.method !== 'PUT') {
        return new Response(JSON.stringify({ content: b64('# x\n\n## Day 0｜a｜b\n- t｜x\n'), sha: 's' }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'conflict' }), { status: 409 });
    }));
    const res = await app.request('/api/itinerary', {
      method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ daySectionsMarkdown: '## Day 0｜a｜b\n- t｜x\n' }),
    }, itinEnv);
    expect(res.status).toBe(409);
  });
});

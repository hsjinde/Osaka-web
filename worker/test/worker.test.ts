import { describe, it, expect } from 'vitest';
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

const env = { DB: fakeD1() as unknown, DASH_TOKEN: 'secret123' };
const auth = { Authorization: 'Bearer secret123' };

describe('worker API', () => {
  it('無 token 拒絕', async () => {
    const res = await app.request('/api/state', {}, env);
    expect(res.status).toBe(401);
  });

  it('錯 token 拒絕', async () => {
    const res = await app.request('/api/state', { headers: { Authorization: 'Bearer wrong' } }, env);
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
});
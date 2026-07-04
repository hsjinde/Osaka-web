// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queuePut, flushQueue, setToken } from '../state';

describe('offline queue', () => {
  beforeEach(() => {
    localStorage.clear();
    setToken('t');
  });

  it('queuePut 累積、flushQueue 送出並清空', async () => {
    queuePut('fav:a', true);
    queuePut('fav:b', false);
    queuePut('fav:a', false); // 同 key 後蓋前
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(String(url));
      return new Response('{"ok":true}', { status: 200 });
    }));
    const n = await flushQueue();
    expect(n).toBe(2); // a、b 各一筆（a 取最後值）
    expect(localStorage.getItem('osaka-state-queue')).toBeNull();
  });

  it('送出失敗保留佇列', async () => {
    queuePut('fav:a', true);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('err', { status: 500 })));
    await expect(flushQueue()).resolves.toBe(0);
    expect(JSON.parse(localStorage.getItem('osaka-state-queue')!)).toHaveProperty('fav:a');
  });
});
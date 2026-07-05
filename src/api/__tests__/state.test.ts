// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queuePut, flushQueue, setToken, getToken, consumeSetupToken, setupLink } from '../state';

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

describe('setup 連結', () => {
  beforeEach(() => localStorage.clear());

  it('有 setup 參數：存 token、從網址移除、保留 hash', () => {
    history.replaceState(null, '', '/Osaka-web/?setup=abc123&x=1#food');
    expect(consumeSetupToken()).toBe(true);
    expect(getToken()).toBe('abc123');
    expect(location.search).toBe('?x=1');
    expect(location.hash).toBe('#food');
  });

  it('無參數或空值：不動作、不覆寫既有 token', () => {
    setToken('keep');
    history.replaceState(null, '', '/Osaka-web/');
    expect(consumeSetupToken()).toBe(false);
    history.replaceState(null, '', '/Osaka-web/?setup=');
    expect(consumeSetupToken()).toBe(false);
    expect(getToken()).toBe('keep');
  });

  it('setupLink 產生含 encode 過 token 的連結', () => {
    history.replaceState(null, '', '/Osaka-web/');
    expect(setupLink('a b')).toBe(`${location.origin}/Osaka-web/?setup=a%20b`);
  });
});
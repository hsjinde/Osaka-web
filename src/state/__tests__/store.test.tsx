// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { TripStateProvider, useTripState } from '../store';

const wrapper = TripStateProvider;

describe('useTripState (localStorage)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  it('toggleFav 切換並持久化', () => {
    const { result } = renderHook(() => useTripState(), { wrapper });
    act(() => result.current.toggleFav('餐廳/測試店'));
    expect(result.current.isFav('餐廳/測試店')).toBe(true);
    expect(result.current.favCount).toBeGreaterThanOrEqual(1);
    expect(JSON.parse(localStorage.getItem('osaka-trip-state')!)['fav:餐廳/測試店']).toBe(true);
    act(() => result.current.toggleFav('餐廳/測試店'));
    expect(result.current.isFav('餐廳/測試店')).toBe(false);
  });

  it('toggleTodo 切換', () => {
    const { result } = renderHook(() => useTripState(), { wrapper });
    act(() => result.current.toggleTodo('todo:abc'));
    expect(result.current.todosState['todo:abc']).toBe(true);
  });

  it('vault favorite: true 作為預設收藏', () => {
    localStorage.setItem('osaka-trip-state', JSON.stringify({ 'fav:餐廳/A': true }));
    const { result } = renderHook(() => useTripState(), { wrapper });
    expect(result.current.isFav('餐廳/A')).toBe(true);
  });
});

describe('切回前景重抓', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.stubEnv('VITE_API_BASE', 'http://api.test');
    localStorage.setItem('osaka-dash-token', 'tok');
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('visible 時重抓合併，15 秒內不重複', async () => {
    let getCount = 0;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') return new Response('{"ok":true}', { status: 200 });
      getCount++;
      return new Response(JSON.stringify(getCount >= 2 ? { 'fav:遠端/新增': true } : {}), { status: 200 });
    }));
    const { result } = renderHook(() => useTripState(), { wrapper });
    await act(async () => {}); // 等啟動同步完成
    expect(getCount).toBe(1);

    vi.setSystemTime(Date.now() + 16000);
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(getCount).toBe(2);
    expect(result.current.isFav('遠端/新增')).toBe(true); // 遠端優先合併

    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(getCount).toBe(2); // 最小間隔內不重抓
  });
});

describe('同步中旗標', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv('VITE_API_BASE', 'http://api.test');
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('syncRemote 進行中 syncing 為 true，結束後為 false', async () => {
    let release!: (r: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((r) => { release = r; })));
    const { result } = renderHook(() => useTripState(), { wrapper });
    await act(async () => {}); // 啟動同步開跑，fetch 尚未 resolve
    expect(result.current.syncing).toBe(true);
    await act(async () => { release(new Response('{}', { status: 200 })); });
    expect(result.current.syncing).toBe(false);
  });
});

describe('無 token 唯讀模式', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv('VITE_API_BASE', 'http://api.test');
    // 不設定 osaka-dash-token
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('無 token 時仍然拉取遠端狀態，但點擊 toggle 不寫入遠端', async () => {
    let getCount = 0;
    let putCount = 0;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        putCount++;
        return new Response('{"ok":true}', { status: 200 });
      }
      getCount++;
      return new Response(JSON.stringify({ 'fav:唯讀/遠端項目': true }), { status: 200 });
    }));
    const { result } = renderHook(() => useTripState(), { wrapper });
    await act(async () => {}); // 等啟動同步完成

    expect(getCount).toBe(1);
    expect(result.current.isFav('唯讀/遠端項目')).toBe(true);

    // 點擊 toggle
    act(() => result.current.toggleFav('餐廳/測試店'));
    expect(result.current.isFav('餐廳/測試店')).toBe(true);
    expect(putCount).toBe(0); // 應該不觸發寫入
  });
});
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { putItinerary } from '../itinerary';

beforeEach(() => {
  localStorage.setItem('osaka-dash-token', 'tok');
  vi.stubEnv('VITE_API_BASE', 'https://api.test');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); localStorage.clear(); });

describe('putItinerary', () => {
  it('成功時帶 Bearer token 與正確 body', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await putItinerary('## Day 0｜a｜b\n- t｜x\n');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test/api/itinerary');
    expect((init as RequestInit).method).toBe('PUT');
    expect((init as any).headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse((init as any).body).daySectionsMarkdown).toContain('## Day 0');
  });

  it('409 拋出重新整理訊息', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 409 })));
    await expect(putItinerary('## Day 0｜a｜b\n')).rejects.toThrow('重新整理');
  });
});

// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useCondensedHeader } from '../useCondensedHeader';

function setScrollY(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
  window.dispatchEvent(new Event('scroll'));
}

describe('useCondensedHeader', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0; });
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('初始在頂部為 false', () => {
    const { result } = renderHook(() => useCondensedHeader());
    expect(result.current).toBe(false);
  });

  it('捲超過 collapseAt 變 true', () => {
    const { result } = renderHook(() => useCondensedHeader());
    act(() => setScrollY(100));
    expect(result.current).toBe(true);
  });

  it('遲滯區（expandAt~collapseAt 之間）維持原值', () => {
    const { result } = renderHook(() => useCondensedHeader());
    act(() => setScrollY(100));
    act(() => setScrollY(60));
    expect(result.current).toBe(true);
    act(() => setScrollY(30));
    expect(result.current).toBe(false);
    act(() => setScrollY(60));
    expect(result.current).toBe(false);
  });

  it('掛載時已捲下去（重整）直接 true', () => {
    Object.defineProperty(window, 'scrollY', { value: 200, configurable: true });
    const { result } = renderHook(() => useCondensedHeader());
    expect(result.current).toBe(true);
  });
});

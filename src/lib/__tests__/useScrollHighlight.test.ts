// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useScrollHighlight } from '../useScrollHighlight';

describe('useScrollHighlight', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="target"></div>';
    Element.prototype.scrollIntoView = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('捲動到目標節點並加上高亮 class', () => {
    renderHook(() => useScrollHighlight('target'));
    const el = document.getElementById('target')!;
    expect(el.scrollIntoView).toHaveBeenCalled();
    expect(el.classList.contains('search-highlight')).toBe(true);
  });

  it('1.6 秒後移除高亮 class', () => {
    renderHook(() => useScrollHighlight('target'));
    const el = document.getElementById('target')!;
    vi.advanceTimersByTime(1600);
    expect(el.classList.contains('search-highlight')).toBe(false);
  });

  it('沒有 highlightId 時不動作', () => {
    renderHook(() => useScrollHighlight(undefined));
    const el = document.getElementById('target')!;
    expect(el.scrollIntoView).not.toHaveBeenCalled();
  });

  it('找不到節點時不丟錯誤', () => {
    expect(() => renderHook(() => useScrollHighlight('missing'))).not.toThrow();
  });
});

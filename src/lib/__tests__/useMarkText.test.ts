// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useMarkText } from '../useMarkText';
import type { RefObject } from 'react';

function makeContainer(html: string): RefObject<HTMLElement | null> {
  document.body.innerHTML = `<div id="c">${html}</div>`;
  return { current: document.getElementById('c') };
}

describe('useMarkText', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  afterEach(() => cleanup());

  it('把命中文字包進 mark.search-hit（大小寫不敏感）', () => {
    const ref = makeContainer('<p>推薦 Takoyaki 章魚燒與大阪燒</p>');
    renderHook(() => useMarkText(ref, ['takoyaki', '大阪燒'], true));
    const marks = ref.current!.querySelectorAll('mark.search-hit');
    expect([...marks].map((m) => m.textContent)).toEqual(['Takoyaki', '大阪燒']);
  });

  it('同一文字節點多次命中都包到', () => {
    const ref = makeContainer('<p>拉麵店旁邊還是拉麵店</p>');
    renderHook(() => useMarkText(ref, ['拉麵'], true));
    expect(ref.current!.querySelectorAll('mark.search-hit').length).toBe(2);
  });

  it('unmount 後 mark 全部還原、文字內容不變', () => {
    const ref = makeContainer('<p>推薦章魚燒</p>');
    const { unmount } = renderHook(() => useMarkText(ref, ['章魚燒'], true));
    expect(ref.current!.querySelector('mark')).toBeTruthy();
    unmount();
    expect(ref.current!.querySelector('mark')).toBeNull();
    expect(ref.current!.textContent).toBe('推薦章魚燒');
  });

  it('enabled=false 不動作', () => {
    const ref = makeContainer('<p>推薦章魚燒</p>');
    renderHook(() => useMarkText(ref, ['章魚燒'], false));
    expect(ref.current!.querySelector('mark')).toBeNull();
  });

  it('tokens 變更時重新標記', () => {
    const ref = makeContainer('<p>章魚燒與大阪燒</p>');
    const { rerender } = renderHook(
      ({ tokens }) => useMarkText(ref, tokens, true),
      { initialProps: { tokens: ['章魚燒'] } },
    );
    expect(ref.current!.querySelector('mark')!.textContent).toBe('章魚燒');
    rerender({ tokens: ['大阪燒'] });
    const marks = ref.current!.querySelectorAll('mark');
    expect(marks.length).toBe(1);
    expect(marks[0].textContent).toBe('大阪燒');
  });
});

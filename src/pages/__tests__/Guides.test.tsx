// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import Guides from '../Guides';

const useScrollHighlight = vi.hoisted(() => vi.fn());
vi.mock('../../lib/useScrollHighlight', () => ({ useScrollHighlight }));

vi.mock('../../data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data')>();
  return {
    ...actual,
    guides: [
      { id: 'g1', title: '大阪美食攻略', source: '', sourceUrl: '', body: '推薦章魚燒' },
      { id: 'g2', title: '交通懶人包', source: '', sourceUrl: '', body: 'ICOCA 卡使用方式' },
    ],
  };
});

describe('Guides 接上搜尋高亮', () => {
  afterEach(() => cleanup());

  it('卡片有 guide-<id> 的 DOM id，預設收合', () => {
    const { container } = render(<Guides />);
    expect(container.querySelector('#guide-g1')).toBeTruthy();
    expect(screen.queryByText('推薦章魚燒')).toBeNull();
  });

  it('highlightId 對應攻略時自動展開並呼叫 useScrollHighlight', () => {
    render(<Guides highlightId="guide-g1" />);
    expect(screen.getByText('推薦章魚燒')).toBeTruthy();
    expect(useScrollHighlight).toHaveBeenCalledWith('guide-g1');
  });
});

// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { TripStateProvider } from '../../state/store';
import Food from '../Food';

vi.mock('../../state/auth', () => ({ useAuth: () => ({ canEdit: true, openLogin: vi.fn() }) }));

const useScrollHighlight = vi.hoisted(() => vi.fn());
vi.mock('../../lib/useScrollHighlight', () => ({ useScrollHighlight }));

vi.mock('../../data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data')>();
  return {
    ...actual,
    byCategory: (cat: string) => (cat === '餐廳' ? [{
      id: 'e1', category: '餐廳', name: '章魚燒本舖', tags: [], updated: '', favorite: false,
      fields: {}, summary: '道頓堀人氣小吃', body: '', area: '道頓堀', rating: 4.5,
    }] : []),
  };
});

describe('Food 接上搜尋高亮', () => {
  afterEach(() => cleanup());

  it('卡片有 entity-<id> 的 DOM id', () => {
    const { container } = render(<TripStateProvider><Food /></TripStateProvider>);
    expect(container.querySelector('#entity-e1')).toBeTruthy();
  });

  it('把 highlightId 傳給 useScrollHighlight', () => {
    render(<TripStateProvider><Food highlightId="entity-e1" /></TripStateProvider>);
    expect(useScrollHighlight).toHaveBeenCalledWith('entity-e1');
  });
});

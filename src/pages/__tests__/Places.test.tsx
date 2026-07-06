// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { TripStateProvider } from '../../state/store';
import Places from '../Places';

vi.mock('../../state/auth', () => ({ useAuth: () => ({ canEdit: true, openLogin: vi.fn() }) }));

const useScrollHighlight = vi.hoisted(() => vi.fn());
vi.mock('../../lib/useScrollHighlight', () => ({ useScrollHighlight }));

vi.mock('../../data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data')>();
  return {
    ...actual,
    byCategory: (cat: string) => {
      if (cat === '景點') return [{
        id: 'p1', category: '景點', name: '大阪城', tags: [], updated: '', favorite: false,
        fields: {}, summary: '天守閣景觀', body: '', area: '大阪城公園', rating: 4.2,
      }];
      if (cat === '購物') return [{
        id: 's1', category: '購物', name: '心齋橋筋商店街', tags: [], updated: '', favorite: false,
        fields: {}, summary: '', body: '', area: '心齋橋', rating: null,
      }];
      return [];
    },
  };
});

describe('Places 接上搜尋高亮', () => {
  afterEach(() => cleanup());

  it('景點與購物卡片都有 entity-<id> 的 DOM id', () => {
    const { container } = render(<TripStateProvider><Places /></TripStateProvider>);
    expect(container.querySelector('#entity-p1')).toBeTruthy();
    expect(container.querySelector('#entity-s1')).toBeTruthy();
  });

  it('把 highlightId 傳給 useScrollHighlight', () => {
    render(<TripStateProvider><Places highlightId="entity-s1" /></TripStateProvider>);
    expect(useScrollHighlight).toHaveBeenCalledWith('entity-s1');
  });
});

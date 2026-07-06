// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TripStateProvider } from '../../state/store';
import Places from '../Places';

vi.mock('../../state/auth', () => ({ useAuth: () => ({ canEdit: true, openLogin: vi.fn() }) }));

vi.mock('../../data', () => ({
  byCategory: (cat: string) => {
    if (cat === '景點') return [{
      id: 'p1', category: '景點', name: '大阪城', tags: [], updated: '', favorite: false,
      fields: {}, summary: '天守閣景觀', body: '', area: '大阪城公園', rating: 4.2,
    }];
    if (cat === '購物') return [{
      id: 's1', category: '購物', name: '心齋橋筋商店街', tags: [], updated: '', favorite: false,
      fields: {}, summary: '藥妝與伴手禮', body: '', area: '心齋橋', rating: null,
    }];
    return [];
  },
  entities: [], // TripStateProvider（store.tsx）需要
  todos: [], // TripStateProvider（store.tsx）需要
}));

describe('Places', () => {
  afterEach(() => cleanup());

  it('渲染景點與購物卡片', () => {
    render(<TripStateProvider><Places /></TripStateProvider>);
    expect(screen.getByText('大阪城')).toBeTruthy();
    expect(screen.getByText('心齋橋筋商店街')).toBeTruthy();
  });
});

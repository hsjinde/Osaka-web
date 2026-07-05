// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TripStateProvider } from '../../state/store';
import WishList from '../WishList';
import type { Entity } from '../../data/schema';

// WishList 內含 Heart，Heart 需要 auth context；以已登入（canEdit）情境驗證 WishList 本身行為
vi.mock('../../state/auth', () => ({ useAuth: () => ({ canEdit: true, openLogin: vi.fn() }) }));

const ent = (id: string, category: Entity['category'], name: string, area = '難波'): Entity => ({
  id, category, name, tags: [], updated: '', favorite: false, fields: {}, summary: '', body: '', area, rating: null,
});

describe('WishList', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  it('依分類分組，顯示名稱、區域與地圖連結', () => {
    render(
      <TripStateProvider>
        <WishList items={[ent('餐廳/一蘭', '餐廳', '一蘭拉麵'), ent('景點/通天閣', '景點', '通天閣', '新世界')]} />
      </TripStateProvider>,
    );
    expect(screen.getByText('一蘭拉麵')).toBeTruthy();
    expect(screen.getByText('通天閣')).toBeTruthy();
    expect(screen.getByText('新世界')).toBeTruthy();
    expect(screen.getAllByTitle(/在 Google 地圖搜尋/)).toHaveLength(2);
    // 分組標題：餐廳在景點前（CATEGORIES 順序）
    const headers = screen.getAllByText(/^(餐廳|景點)/).map((el) => el.textContent?.trim());
    expect(headers).toEqual(['餐廳 1', '景點 1']);
  });

  it('點 ♥ 取消標記（寫回 state）', () => {
    localStorage.setItem('osaka-trip-state', JSON.stringify({ 'fav:餐廳/一蘭': true }));
    render(
      <TripStateProvider>
        <WishList items={[ent('餐廳/一蘭', '餐廳', '一蘭拉麵')]} />
      </TripStateProvider>,
    );
    fireEvent.click(screen.getAllByLabelText('收藏')[0]);
    expect(JSON.parse(localStorage.getItem('osaka-trip-state')!)['fav:餐廳/一蘭']).toBe(false);
  });

  it('空清單顯示提示', () => {
    render(<TripStateProvider><WishList items={[]} /></TripStateProvider>);
    expect(screen.getByText(/還沒有標記/)).toBeTruthy();
  });
});

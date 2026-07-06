// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TripStateProvider } from '../../state/store';
import Food from '../Food';

vi.mock('../../state/auth', () => ({ useAuth: () => ({ canEdit: true, openLogin: vi.fn() }) }));

vi.mock('../../data', () => ({
  byCategory: (cat: string) => (cat === '餐廳' ? [{
    id: 'e1', category: '餐廳', name: '章魚燒本舖', tags: [], updated: '', favorite: false,
    fields: { 類型: '小吃' }, summary: '道頓堀人氣小吃', body: '', area: '道頓堀', rating: 4.5,
  }] : []),
  entities: [], // TripStateProvider（store.tsx）需要
  todos: [], // TripStateProvider（store.tsx）需要
}));

describe('Food', () => {
  afterEach(() => cleanup());

  it('渲染店家卡片', () => {
    render(<TripStateProvider><Food /></TripStateProvider>);
    expect(screen.getByText('章魚燒本舖')).toBeTruthy();
  });
});

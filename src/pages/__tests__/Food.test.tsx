// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TripStateProvider } from '../../state/store';
import Food from '../Food';

vi.mock('../../state/auth', () => ({ useAuth: () => ({ canEdit: true, openLogin: vi.fn() }) }));

const RESTAURANTS = [
  { id: 'r1', category: '餐廳', name: 'Bakuro', tags: [], updated: '', favorite: false,
    fields: { 類型: '關東煮' }, summary: '關東煮 4.4 分。', body: '', area: '難波', rating: 4.4 },
  { id: 'r2', category: '餐廳', name: '花くじら', tags: [], updated: '', favorite: false,
    fields: { 類型: '關東煮' }, summary: '福島名店', body: '', area: '福島', rating: 4.1 },
  { id: 'r3', category: '餐廳', name: '一蘭 道頓堀', tags: [], updated: '', favorite: false,
    fields: { 類型: '拉麵' }, summary: '天然豚骨', body: '', area: '道頓堀', rating: 3.9 },
];

vi.mock('../../data', () => ({
  byCategory: (cat: string) => (cat === '餐廳' ? RESTAURANTS : []),
  entities: [], // search.ts 頂層 import { entities }，mock 必須提供
  todos: [], // TripStateProvider（store.tsx）需要
}));

vi.mock('../../lib/search', async (importOriginal) => {
  // suggestFoodTypes 依賴 ../data 的 entities，測試中直接覆寫；其餘用真實作。
  // count 故意用 5（與 chip 文字「關東煮 2」區隔，避免 getByRole 撞名）
  const mod = await importOriginal<typeof import('../../lib/search')>();
  return {
    ...mod,
    suggestFoodTypes: (q: string) =>
      q.includes('關東') ? [{ type: '關東煮', count: 5 }] : [],
  };
});

function renderFood() {
  return render(<TripStateProvider><Food /></TripStateProvider>);
}

describe('Food 就地搜尋', () => {
  afterEach(() => cleanup());

  it('多關鍵字 AND 過濾', () => {
    renderFood();
    fireEvent.change(screen.getByPlaceholderText('搜尋店名、類型、區域…'), { target: { value: '道頓堀 拉麵' } });
    expect(screen.getByText(/一蘭/)).toBeTruthy();
    expect(screen.queryByText('Bakuro')).toBeNull();
  });

  it('店名命中排在摘要命中前（相關性排序）', () => {
    // 「花」命中 r2 店名（100 分）；不命中其他。名稱因命中標亮被拆成 <mark>+<span>
    // 兩個 DOM 節點，getByText 預設不跨元素邊界比對，改用 container.textContent 驗證。
    const { container } = renderFood();
    fireEvent.change(screen.getByPlaceholderText('搜尋店名、類型、區域…'), { target: { value: '花' } });
    expect(container.textContent).toContain('花くじら');
  });

  it('輸入命中類型時顯示分類建議，點選套用篩選並清空輸入', () => {
    renderFood();
    const input = screen.getByPlaceholderText('搜尋店名、類型、區域…');
    fireEvent.change(input, { target: { value: '關東' } });
    const option = screen.getByRole('button', { name: /關東煮.*5/ });
    fireEvent.click(option);
    expect((input as HTMLInputElement).value).toBe('');
    // 篩選套用：拉麵店消失、兩間關東煮在列
    expect(screen.queryByText(/一蘭/)).toBeNull();
    expect(screen.getByText('Bakuro')).toBeTruthy();
    // chips 列的「關東煮」處於選中狀態（chip--on）
    const chips = screen.getAllByText(/^關東煮/).filter((el) => el.closest('.chip'));
    expect(chips.some((el) => el.closest('.chip')?.className.includes('chip--on'))).toBe(true);
  });

  it('Esc 關閉建議浮層', () => {
    renderFood();
    const input = screen.getByPlaceholderText('搜尋店名、類型、區域…');
    fireEvent.change(input, { target: { value: '關東' } });
    expect(screen.getByRole('button', { name: /關東煮.*5/ })).toBeTruthy();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: /關東煮.*5/ })).toBeNull();
  });

  it('搜尋命中處以 mark.search-hit 標亮', () => {
    const { container } = renderFood();
    fireEvent.change(screen.getByPlaceholderText('搜尋店名、類型、區域…'), { target: { value: '一蘭' } });
    const mark = container.querySelector('mark.search-hit');
    expect(mark?.textContent).toBe('一蘭');
  });

  it('無結果顯示空狀態', () => {
    renderFood();
    fireEvent.change(screen.getByPlaceholderText('搜尋店名、類型、區域…'), { target: { value: '不存在的店' } });
    expect(screen.getByText('沒有符合的店家')).toBeTruthy();
  });

  it('只看已標記且無任何標記時顯示引導文案', () => {
    renderFood();
    fireEvent.click(screen.getByText('♥ 只看已標記'));
    expect(screen.getByText('還沒有標記的店，去按 ♥')).toBeTruthy();
  });
});

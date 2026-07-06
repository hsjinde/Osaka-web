// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import Guides from '../Guides';

vi.mock('../../data', () => ({
  guides: [
    { id: 'g1', title: '大阪美食攻略', source: '', sourceUrl: '', body: '本文開頭。中段推薦章魚燒與大阪燒名店。' },
    { id: 'g2', title: '交通懶人包', source: '', sourceUrl: '', body: 'ICOCA 卡使用方式' },
  ],
  entities: [], // search.ts 頂層 import { entities }，mock 必須提供
}));

const PLACEHOLDER = '搜尋攻略內容…';

describe('Guides 就地搜尋', () => {
  afterEach(() => cleanup());

  it('預設收合，點擊標題展開內文', () => {
    render(<Guides />);
    expect(screen.queryByText(/中段推薦章魚燒/)).toBeNull();
    fireEvent.click(screen.getByText('大阪美食攻略'));
    expect(screen.getByText(/中段推薦章魚燒/)).toBeTruthy();
  });

  it('查詢過濾攻略並顯示符合篇數', () => {
    render(<Guides />);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '章魚燒' } });
    expect(screen.getByText('大阪美食攻略')).toBeTruthy();
    expect(screen.queryByText('交通懶人包')).toBeNull();
    expect(screen.getByText('符合 1 篇')).toBeTruthy();
  });

  it('命中卡片標題下顯示 snippet 且命中處標亮', () => {
    const { container } = render(<Guides />);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '章魚燒' } });
    const mark = container.querySelector('mark.search-hit');
    expect(mark?.textContent).toBe('章魚燒');
  });

  it('標題命中但內文未命中時不顯示 snippet', () => {
    // 「懶人包」只命中標題後半，標題因標亮被拆成 <span>交通</span><mark>懶人包</mark>
    // 兩個 DOM 節點，getByText 預設不跨元素邊界比對，改用 container.textContent 驗證。
    const { container } = render(<Guides />);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '懶人包' } });
    expect(container.textContent).toContain('交通懶人包');
    // body「ICOCA 卡使用方式」不含「懶人包」→ 無 snippet 元素
    expect(screen.queryByTestId('guide-snippet')).toBeNull();
  });

  it('展開命中卡片後內文以 mark 標亮', () => {
    const { container } = render(<Guides />);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '章魚燒' } });
    fireEvent.click(screen.getByText('大阪美食攻略'));
    // snippet 的 mark + 內文的 mark 至少各一
    const marks = [...container.querySelectorAll('mark.search-hit')].map((m) => m.textContent);
    expect(marks.filter((t) => t === '章魚燒').length).toBeGreaterThanOrEqual(2);
  });

  it('無結果顯示空狀態', () => {
    render(<Guides />);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '不存在' } });
    expect(screen.getByText('沒有符合的攻略')).toBeTruthy();
  });
});

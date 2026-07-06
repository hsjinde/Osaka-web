// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import SearchBar from '../SearchBar';

vi.mock('../../lib/search', () => ({
  searchAll: (q: string) => {
    if (q === '章魚燒') {
      return {
        entities: [{ id: 'e1', category: '餐廳', name: '章魚燒本舖', summary: '道頓堀人氣小吃' }],
        guides: [],
      };
    }
    if (q === '攻略') {
      return { entities: [], guides: [{ id: 'g1', title: '大阪美食攻略' }] };
    }
    return { entities: [], guides: [] };
  },
}));

const PLACEHOLDER = '搜尋餐廳、景點、購物、交通、攻略…';

describe('SearchBar', () => {
  beforeEach(() => { location.hash = ''; });
  afterEach(() => cleanup());

  it('輸入關鍵字顯示分組下拉結果', () => {
    render(<SearchBar />);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '章魚燒' } });
    expect(screen.getByText('章魚燒本舖')).toBeTruthy();
  });

  it('點選實體結果會設定 location.hash', () => {
    render(<SearchBar />);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '章魚燒' } });
    fireEvent.click(screen.getByText('章魚燒本舖'));
    expect(location.hash).toBe('#food:entity-e1');
  });

  it('點選攻略結果會設定 location.hash', () => {
    render(<SearchBar />);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '攻略' } });
    fireEvent.click(screen.getByText('大阪美食攻略'));
    expect(location.hash).toBe('#guides:guide-g1');
  });

  it('按 Esc 關閉下拉選單', () => {
    render(<SearchBar />);
    const input = screen.getByPlaceholderText(PLACEHOLDER);
    fireEvent.change(input, { target: { value: '章魚燒' } });
    expect(screen.getByText('章魚燒本舖')).toBeTruthy();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByText('章魚燒本舖')).toBeNull();
  });

  it('點擊外部關閉下拉選單', () => {
    render(<div><SearchBar /><div data-testid="outside" /></div>);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '章魚燒' } });
    expect(screen.getByText('章魚燒本舖')).toBeTruthy();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByText('章魚燒本舖')).toBeNull();
  });

  it('查無結果顯示提示文字', () => {
    render(<SearchBar />);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '不存在的東西' } });
    expect(screen.getByText('找不到符合「不存在的東西」的結果')).toBeTruthy();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import Guides from '../Guides';

vi.mock('../../data', () => ({
  guides: [
    { id: 'g1', title: '大阪美食攻略', source: '', sourceUrl: '', body: '推薦章魚燒' },
    { id: 'g2', title: '交通懶人包', source: '', sourceUrl: '', body: 'ICOCA 卡使用方式' },
  ],
}));

describe('Guides', () => {
  afterEach(() => cleanup());

  it('預設收合，點擊標題展開內文', () => {
    render(<Guides />);
    expect(screen.queryByText('推薦章魚燒')).toBeNull();
    fireEvent.click(screen.getByText('大阪美食攻略'));
    expect(screen.getByText('推薦章魚燒')).toBeTruthy();
  });
});

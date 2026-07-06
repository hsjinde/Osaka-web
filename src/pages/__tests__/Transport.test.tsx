// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import Transport from '../Transport';

const useScrollHighlight = vi.hoisted(() => vi.fn());
vi.mock('../../lib/useScrollHighlight', () => ({ useScrollHighlight }));

vi.mock('../../data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data')>();
  return {
    ...actual,
    byCategory: () => [{
      id: 't1', category: '交通', name: 'ICOCA 卡', tags: [], updated: '', favorite: false,
      fields: {}, summary: '西日本 IC 卡', body: '## 基本資訊\n備註\n## 來源\nx', area: '', rating: null,
    }],
  };
});

describe('Transport 接上搜尋高亮', () => {
  afterEach(() => cleanup());

  it('卡片有 entity-<id> 的 DOM id', () => {
    const { container } = render(<Transport />);
    expect(container.querySelector('#entity-t1')).toBeTruthy();
  });

  it('把 highlightId 傳給 useScrollHighlight', () => {
    render(<Transport highlightId="entity-t1" />);
    expect(useScrollHighlight).toHaveBeenCalledWith('entity-t1');
  });
});

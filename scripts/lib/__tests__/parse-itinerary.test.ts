import { describe, it, expect } from 'vitest';
import { parseItinerary } from '../parse-itinerary';

const OK = `---
title: 每日行程
updated: 2026-07-05
---

## Day 0｜09/30 週三｜抵達日
> 區域：難波、心齋橋

- 下午｜關西機場 → 難波｜南海 Rapi:t 最快 34 分
- 傍晚｜心齋橋格蘭多酒店 Check-in｜長堀橋站步行 5 分
- 宵夜｜（待安排）

## Day 1｜10/01 週四｜環球影城 USJ
> 區域：此花區

- 全日｜日本環球影城｜Express Pass 建議先買
`;

describe('parseItinerary', () => {
  it('解析天數、標頭、區域、時段', () => {
    const days = parseItinerary(OK);
    expect(days).toHaveLength(2);
    expect(days[0]).toMatchObject({
      label: 'Day 0', date: '09/30 週三', theme: '抵達日',
      areas: ['難波', '心齋橋'],
    });
    expect(days[0].slots[0]).toEqual({
      time: '下午', title: '關西機場 → 難波', note: '南海 Rapi:t 最快 34 分', pending: false,
    });
  });

  it('（待安排）標成 pending 且 note 為空', () => {
    const days = parseItinerary(OK);
    expect(days[0].slots[2]).toEqual({ time: '宵夜', title: '（待安排）', note: '', pending: true });
  });

  it('備註可省略', () => {
    const days = parseItinerary(OK.replace('｜南海 Rapi:t 最快 34 分', ''));
    expect(days[0].slots[0].note).toBe('');
  });

  it('Day 標頭格式錯誤時報錯並含該行', () => {
    expect(() => parseItinerary(OK.replace('## Day 1｜10/01 週四｜環球影城 USJ', '## Day 1 環球影城')))
      .toThrow(/Day 1 環球影城/);
  });

  it('沒有任何 Day 時報錯', () => {
    expect(() => parseItinerary('---\ntitle: x\n---\n沒內容')).toThrow(/找不到任何/);
  });
});
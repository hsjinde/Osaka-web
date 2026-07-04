import { describe, it, expect } from 'vitest';
import { parseEntity } from '../parse-entity';

const REST = `---
title: DOTONBORI KUROFUNE Higashishinsaibashi
tags: [餐廳, 大阪]
updated: 2026-06-09
---

道頓堀區域的鰻魚飯專賣店。

## 基本資訊
- 類型：鰻魚
- 評分：4.9
- 價位：¥3,000-4,000
- 備註：-

## 來源
- [[原始資料/餐廳/DOTONBORI KUROFUNE]]
`;

describe('parseEntity', () => {
  it('解析餐廳頁完整欄位', () => {
    const e = parseEntity('餐廳', 'DOTONBORI-KUROFUNE.md', REST);
    expect(e.id).toBe('餐廳/DOTONBORI-KUROFUNE');
    expect(e.name).toBe('DOTONBORI KUROFUNE Higashishinsaibashi');
    expect(e.rating).toBe(4.9);
    expect(e.fields['類型']).toBe('鰻魚');
    expect(e.fields['價位']).toBe('¥3,000-4,000');
    expect(e.summary).toBe('道頓堀區域的鰻魚飯專賣店。');
    expect(e.favorite).toBe(false);
  });

  it('位置欄位含 wikilink 時清掉並抽出區域', () => {
    const raw = REST.replace('- 備註：-', '- 位置：[[梅田|梅田]]・天保山');
    const e = parseEntity('景點', 'X.md', raw);
    expect(e.fields['位置']).toBe('梅田・天保山');
    expect(e.area).toBe('梅田');
  });

  it('tags 含區域時可補抽區域', () => {
    const raw = REST.replace('tags: [餐廳, 大阪]', 'tags: [購物, 大阪, 梅田]');
    const e = parseEntity('購物', 'X.md', raw);
    expect(e.area).toBe('梅田');
  });

  it('評分為 N/A 或缺欄時 rating 為 null', () => {
    const raw = REST.replace('- 評分：4.9', '- 評分：N/A');
    expect(parseEntity('餐廳', 'X.md', raw).rating).toBeNull();
  });

  it('評分非數字時報錯且訊息含檔名', () => {
    const raw = REST.replace('- 評分：4.9', '- 評分：很好吃');
    expect(() => parseEntity('餐廳', 'BAD.md', raw)).toThrow(/餐廳\/BAD/);
  });

  it('frontmatter 缺 title 報錯', () => {
    const raw = REST.replace('title: DOTONBORI KUROFUNE Higashishinsaibashi', 'foo: bar');
    expect(() => parseEntity('餐廳', 'BAD.md', raw)).toThrow(/餐廳\/BAD/);
  });

  it('favorite: true 生效', () => {
    const raw = REST.replace('updated: 2026-06-09', 'updated: 2026-06-09\nfavorite: true');
    expect(parseEntity('餐廳', 'X.md', raw).favorite).toBe(true);
  });
});
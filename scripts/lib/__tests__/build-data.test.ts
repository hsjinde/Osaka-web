import { describe, it, expect } from 'vitest';
import { buildOverview, isEntityFile } from '../../build-data';

const OV = `---
title: 總覽
---

## 基本資訊
- 出發：2026-09-30
- 回程：2026-10-04
- 飯店：大阪心齋橋格蘭多酒店

## 交通備註
- 駅｜長堀橋站 步行 5 分
- 早｜LAWSON
`;

describe('buildOverview', () => {
  it('抽 fields 與交通備註', () => {
    const o = buildOverview(OV);
    expect(o.fields['出發']).toBe('2026-09-30');
    expect(o.fields['飯店']).toBe('大阪心齋橋格蘭多酒店');
    expect(o.transportNotes).toEqual(['駅｜長堀橋站 步行 5 分', '早｜LAWSON']);
  });
  it('缺出發日期報錯', () => {
    expect(() => buildOverview(OV.replace('- 出發：2026-09-30', ''))).toThrow(/出發/);
  });
});

describe('isEntityFile', () => {
  it('排除分類總覽索引頁（如 餐廳總覽.md、住宿總覽.md）', () => {
    expect(isEntityFile('餐廳', '餐廳總覽.md')).toBe(false);
    expect(isEntityFile('住宿', '住宿總覽.md')).toBe(false);
  });

  it('一般實體檔案照樣通過', () => {
    expect(isEntityFile('餐廳', '一蘭.md')).toBe(true);
  });

  it('非 md 檔案排除', () => {
    expect(isEntityFile('餐廳', 'notes.txt')).toBe(false);
  });

  it('其他分類的總覽檔名不會誤判（跨分類不比對）', () => {
    expect(isEntityFile('餐廳', '住宿總覽.md')).toBe(true);
  });
});
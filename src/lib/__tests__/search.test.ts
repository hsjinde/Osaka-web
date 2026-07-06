import { describe, it, expect, vi } from 'vitest';
import {
  tokenize, matchesTokens, scoreEntity, suggestFoodTypes, makeSegments, makeSnippet,
} from '../search';
import type { Entity } from '../../data/schema';

vi.mock('../../data', () => ({
  entities: [
    { id: 'r1', category: '餐廳', name: 'Bakuro', tags: [], updated: '', favorite: false,
      fields: { 類型: '關東煮' }, summary: '', body: '', area: '', rating: 4.4 },
    { id: 'r2', category: '餐廳', name: '花',  tags: [], updated: '', favorite: false,
      fields: { 類型: '關東煮' }, summary: '', body: '', area: '', rating: 4.1 },
    { id: 'r3', category: '餐廳', name: '鳥貴族', tags: [], updated: '', favorite: false,
      fields: { 類型: '日式串燒' }, summary: '', body: '', area: '', rating: 3.9 },
    { id: 'r4', category: '餐廳', name: '無類型店', tags: [], updated: '', favorite: false,
      fields: {}, summary: '', body: '', area: '', rating: null },
    { id: 'p1', category: '景點', name: '大阪城', tags: [], updated: '', favorite: false,
      fields: { 類型: '關東煮' }, summary: '', body: '', area: '', rating: null },
  ],
}));

function ent(over: Partial<Entity>): Entity {
  return {
    id: 'x', category: '餐廳', name: '', tags: [], updated: '', favorite: false,
    fields: {}, summary: '', body: '', area: '', rating: null, ...over,
  };
}

describe('tokenize', () => {
  it('半形與全形空白分詞並小寫化', () => {
    expect(tokenize('道頓堀　Ramen 拉麵')).toEqual(['道頓堀', 'ramen', '拉麵']);
  });
  it('空字串與全空白回空陣列', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('  　 ')).toEqual([]);
  });
});

describe('matchesTokens', () => {
  it('AND：全部命中才 true', () => {
    expect(matchesTokens('道頓堀的一蘭拉麵', ['道頓堀', '拉麵'])).toBe(true);
    expect(matchesTokens('道頓堀的一蘭拉麵', ['道頓堀', '燒肉'])).toBe(false);
  });
  it('大小寫不敏感', () => {
    expect(matchesTokens('ICOCA 卡', ['icoca'])).toBe(true);
  });
});

describe('scoreEntity', () => {
  it('名稱命中權重最高', () => {
    const byName = scoreEntity(ent({ name: '一蘭拉麵' }), ['拉麵']);
    const bySummary = scoreEntity(ent({ summary: '拉麵名店' }), ['拉麵']);
    const byField = scoreEntity(ent({ fields: { 類型: '拉麵' } }), ['拉麵']);
    expect(byName).toBe(100);
    expect(bySummary).toBe(30);
    expect(byField).toBe(20);
    expect(byName).toBeGreaterThan(bySummary);
    expect(bySummary).toBeGreaterThan(byField);
  });
  it('多 token 分數加總', () => {
    const e = ent({ name: '一蘭拉麵', area: '道頓堀' });
    expect(scoreEntity(e, ['拉麵', '道頓堀'])).toBe(150);
  });
  it('任一 token 未命中回 0', () => {
    expect(scoreEntity(ent({ name: '一蘭拉麵' }), ['拉麵', '燒肉'])).toBe(0);
  });
  it('特殊字元不會炸', () => {
    expect(scoreEntity(ent({ name: 'a(b)c' }), ['(b)'])).toBe(100);
  });
});

describe('suggestFoodTypes', () => {
  it('子字串命中類型並計數、依數量排序', () => {
    expect(suggestFoodTypes('關東')).toEqual([{ type: '關東煮', count: 2 }]);
  });
  it('多類型命中時依 count 降冪', () => {
    expect(suggestFoodTypes('煮 串')).toEqual([]); // AND：沒有類型同時含「煮」「串」
    expect(suggestFoodTypes('日式')).toEqual([{ type: '日式串燒', count: 1 }]);
  });
  it('只算餐廳分類', () => {
    // p1 是景點但類型也是關東煮，不能算進 count
    expect(suggestFoodTypes('關東煮')[0].count).toBe(2);
  });
  it('空查詢回空陣列', () => {
    expect(suggestFoodTypes('  ')).toEqual([]);
  });
});

describe('makeSegments', () => {
  it('命中片段標 hit，其餘不標', () => {
    expect(makeSegments('道頓堀拉麵店', ['拉麵'])).toEqual([
      { text: '道頓堀', hit: false },
      { text: '拉麵', hit: true },
      { text: '店', hit: false },
    ]);
  });
  it('多 token 與重疊範圍合併', () => {
    expect(makeSegments('AABBA', ['aab', 'bb'])).toEqual([
      { text: 'AABB', hit: true },
      { text: 'A', hit: false },
    ]);
  });
  it('無命中回單一非 hit 片段', () => {
    expect(makeSegments('大阪城', ['拉麵'])).toEqual([{ text: '大阪城', hit: false }]);
  });
  it('空 tokens 回單一非 hit 片段', () => {
    expect(makeSegments('大阪城', [])).toEqual([{ text: '大阪城', hit: false }]);
  });
});

describe('makeSnippet', () => {
  it('擷取命中前後文並標亮，前後截斷加省略號', () => {
    const text = 'A'.repeat(30) + '拉麵' + 'B'.repeat(30);
    const segs = makeSnippet(text, ['拉麵'], 5)!;
    expect(segs[0]).toEqual({ text: '…', hit: false });
    expect(segs.some((s) => s.hit && s.text === '拉麵')).toBe(true);
    expect(segs[segs.length - 1]).toEqual({ text: '…', hit: false });
  });
  it('markdown 語法清乾淨', () => {
    const md = '## 標題\n![圖](http://x/i.png)\n[一蘭拉麵](http://x)推薦 | 表格';
    const segs = makeSnippet(md, ['拉麵'])!;
    const joined = segs.map((s) => s.text).join('');
    expect(joined).not.toContain('##');
    expect(joined).not.toContain('](');
    expect(joined).not.toContain('|');
    expect(joined).toContain('一蘭拉麵');
  });
  it('無命中回 null', () => {
    expect(makeSnippet('大阪城', ['拉麵'])).toBeNull();
  });
  it('空 tokens 回 null', () => {
    expect(makeSnippet('大阪城', [])).toBeNull();
  });
});

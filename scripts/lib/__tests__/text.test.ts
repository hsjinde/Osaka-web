import { describe, it, expect } from 'vitest';
import { stripWikilinks, extractArea, todoKey } from '../text';

describe('stripWikilinks', () => {
  it('別名連結取別名', () => {
    expect(stripWikilinks('去 [[梅田|梅田站]] 逛')).toBe('去 梅田站 逛');
  });
  it('一般連結取最後路徑段', () => {
    expect(stripWikilinks('[[原始資料/景點/通天閣]]方向')).toBe('通天閣方向');
    expect(stripWikilinks('[[大丸百貨]] 13F')).toBe('大丸百貨 13F');
  });
  it('無連結原樣返回', () => {
    expect(stripWikilinks('普通文字')).toBe('普通文字');
  });
});

describe('extractArea', () => {
  it('從位置文字找到區域', () => {
    expect(extractArea('梅田・天保山（大阪港）')).toBe('梅田');
    expect(extractArea('心齋橋 PARCO B2')).toBe('心齋橋');
  });
  it('找不到回空字串', () => {
    expect(extractArea('池田市')).toBe('');
  });
});

describe('todoKey', () => {
  it('同文字同 key、不同文字不同 key', () => {
    const a = todoKey('確認機票');
    expect(a).toMatch(/^todo:[0-9a-f]+$/);
    expect(todoKey('確認機票')).toBe(a);
    expect(todoKey('評估周遊券')).not.toBe(a);
  });
});
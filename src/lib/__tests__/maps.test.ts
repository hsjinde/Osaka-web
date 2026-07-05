import { describe, it, expect } from 'vitest';
import { googleMapsUrl } from '../maps';

const PREFIX = 'https://www.google.com/maps/search/?api=1&query=';

describe('googleMapsUrl', () => {
  it('用 name + area 組查詢並正確編碼', () => {
    expect(googleMapsUrl('海遊館', '梅田')).toBe(PREFIX + encodeURIComponent('海遊館 梅田'));
  });

  it('area 為空字串時補「大阪」', () => {
    expect(googleMapsUrl('Bakuro', '')).toBe(PREFIX + encodeURIComponent('Bakuro 大阪'));
  });

  it('area 為 undefined 時補「大阪」', () => {
    expect(googleMapsUrl('Bakuro')).toBe(PREFIX + encodeURIComponent('Bakuro 大阪'));
  });

  it('空白與特殊字元被編碼（結果不含原始空白）', () => {
    const url = googleMapsUrl('Pokémon Center (DX)', '心齋橋');
    expect(url.startsWith(PREFIX)).toBe(true);
    expect(url).not.toContain(' ');
  });
});

import { describe, it, expect, vi } from 'vitest';
import { searchAll } from '../search';

vi.mock('../../data', () => ({
  entities: [
    {
      id: 'e1', category: '餐廳', name: '章魚燒本舖', tags: ['Octopus'], updated: '',
      favorite: false, fields: { 類型: '小吃' }, summary: '道頓堀人氣章魚燒', body: '',
      area: '道頓堀', rating: 4.5,
    },
    {
      id: 'e2', category: '景點', name: '大阪城', tags: [], updated: '', favorite: false,
      fields: {}, summary: '天守閣景觀', body: '', area: '大阪城公園', rating: 4.2,
    },
    {
      id: 'e3', category: '住宿', name: '心齋橋飯店', tags: [], updated: '', favorite: false,
      fields: {}, summary: '住宿地點', body: '', area: '心齋橋', rating: null,
    },
    {
      id: 'e4', category: '區域', name: '梅田區域', tags: [], updated: '', favorite: false,
      fields: {}, summary: '梅田周邊', body: '', area: '梅田', rating: null,
    },
  ],
  guides: [
    { id: 'g1', title: '大阪美食攻略', source: '', sourceUrl: '', body: '推薦章魚燒與大阪燒' },
    { id: 'g2', title: '交通懶人包', source: '', sourceUrl: '', body: 'ICOCA 卡使用方式' },
  ],
}));

describe('searchAll', () => {
  it('依 name 比對成功', () => {
    expect(searchAll('章魚燒').entities.map((e) => e.id)).toEqual(['e1']);
  });

  it('依 summary 比對成功', () => {
    expect(searchAll('天守閣').entities.map((e) => e.id)).toEqual(['e2']);
  });

  it('依 tags 比對且大小寫不敏感', () => {
    expect(searchAll('octopus').entities.map((e) => e.id)).toEqual(['e1']);
  });

  it('依 fields 值比對成功', () => {
    expect(searchAll('小吃').entities.map((e) => e.id)).toEqual(['e1']);
  });

  it('排除住宿與區域分類', () => {
    expect(searchAll('心齋橋飯店').entities).toEqual([]);
    expect(searchAll('梅田區域').entities).toEqual([]);
  });

  it('查詢字串為空或只有空白回傳空陣列', () => {
    expect(searchAll('')).toEqual({ entities: [], guides: [] });
    expect(searchAll('   ')).toEqual({ entities: [], guides: [] });
  });

  it('攻略依 title 比對成功', () => {
    expect(searchAll('美食攻略').guides.map((g) => g.id)).toEqual(['g1']);
  });

  it('攻略依 body 比對成功', () => {
    expect(searchAll('ICOCA').guides.map((g) => g.id)).toEqual(['g2']);
  });
});

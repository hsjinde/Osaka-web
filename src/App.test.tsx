import { describe, it, expect } from 'vitest';
import { parseHash } from './App';

describe('parseHash', () => {
  it('純 tab（無冒號）', () => {
    expect(parseHash('#food')).toEqual({ tab: 'food' });
  });

  it('tab:anchor 格式', () => {
    expect(parseHash('#food:entity-abc')).toEqual({ tab: 'food', anchor: 'entity-abc' });
  });

  it('anchor 會 decodeURIComponent（還原中文與斜線）', () => {
    const encoded = encodeURIComponent('entity-餐廳/Bakuro');
    expect(parseHash(`#food:${encoded}`)).toEqual({ tab: 'food', anchor: 'entity-餐廳/Bakuro' });
  });

  it('不合法 tab 預設回 home', () => {
    expect(parseHash('#not-a-tab')).toEqual({ tab: 'home' });
  });

  it('空 hash 預設回 home', () => {
    expect(parseHash('')).toEqual({ tab: 'home' });
  });
});

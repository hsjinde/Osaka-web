import { describe, it, expect } from 'vitest';
import { countdownDays } from '../App';

describe('countdownDays', () => {
  it('以 JST 零時起算、無條件進位', () => {
    expect(countdownDays('2026-09-30', new Date('2026-09-28T00:00:00+09:00'))).toBe(2);
    expect(countdownDays('2026-09-30', new Date('2026-09-29T23:00:00+09:00'))).toBe(1);
  });
  it('過期歸零', () => {
    expect(countdownDays('2026-09-30', new Date('2026-10-05T00:00:00+09:00'))).toBe(0);
  });
});
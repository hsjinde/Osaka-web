// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import Heart from '../Heart';
import { TripStateProvider } from '../../state/store';

const openLogin = vi.fn();
let canEdit = false;
vi.mock('../../state/auth', () => ({
  useAuth: () => ({ canEdit, openLogin }),
}));

function renderHeart() {
  return render(<TripStateProvider><Heart entityId="餐廳/測試" /></TripStateProvider>);
}

describe('Heart 依登入狀態上鎖', () => {
  beforeEach(() => { localStorage.clear(); openLogin.mockReset(); });
  afterEach(() => cleanup());

  it('未登入：點擊開登入、不切換、不寫本機', () => {
    canEdit = false;
    renderHeart();
    const btn = screen.getByRole('button', { name: '收藏' });
    fireEvent.click(btn);
    expect(openLogin).toHaveBeenCalledTimes(1);
    expect(btn.textContent).toBe('♡');
    expect(localStorage.getItem('osaka-trip-state')).toBeNull();
  });

  it('已登入：點擊切換收藏、不開登入', () => {
    canEdit = true;
    renderHeart();
    const btn = screen.getByRole('button', { name: '收藏' });
    fireEvent.click(btn);
    expect(openLogin).not.toHaveBeenCalled();
    expect(btn.textContent).toBe('♥');
  });
});

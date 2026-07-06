// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TripStateProvider } from '../../state/store';
import Header from '../Header';

vi.mock('../../state/auth', () => ({
  useAuth: () => ({ canEdit: false, openLogin: vi.fn(), logout: vi.fn() }),
}));

const h = vi.hoisted(() => ({ condensed: false }));
vi.mock('../../lib/useCondensedHeader', () => ({ useCondensedHeader: () => h.condensed }));

function renderHeader(onNavigate = vi.fn()) {
  return render(
    <TripStateProvider>
      <Header tab="home" onNavigate={onNavigate} />
    </TripStateProvider>,
  );
}

describe('Header', () => {
  afterEach(() => { cleanup(); h.condensed = false; });

  it('完整態顯示標題與倒數、無迷你 logo', () => {
    renderHeader();
    expect(screen.getByText(/大阪旅券/)).toBeTruthy();
    expect(screen.getByText('出發倒數')).toBeTruthy();
    expect(screen.queryByLabelText('回到頂部')).toBeNull();
  });

  it('收合態顯示迷你 logo、完整區塊加上隱藏 class', () => {
    h.condensed = true;
    const { container } = renderHeader();
    expect(screen.getByLabelText('回到頂部')).toBeTruthy();
    expect(container.querySelector('.hdr-collapse--hidden')).toBeTruthy();
  });

  it('點 tab chip 呼叫 onNavigate 並捲回頂部', () => {
    const onNavigate = vi.fn();
    window.scrollTo = vi.fn();
    renderHeader(onNavigate);
    fireEvent.click(screen.getByText('每日行程'));
    expect(onNavigate).toHaveBeenCalledWith('plan');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('迷你 logo 點擊平滑捲頂', () => {
    h.condensed = true;
    window.scrollTo = vi.fn();
    renderHeader();
    fireEvent.click(screen.getByLabelText('回到頂部'));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});

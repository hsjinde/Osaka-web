// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { TripStateProvider, useTripState } from '../store';

const wrapper = TripStateProvider;

describe('useTripState (localStorage)', () => {
  beforeEach(() => localStorage.clear());

  it('toggleFav 切換並持久化', () => {
    const { result } = renderHook(() => useTripState(), { wrapper });
    act(() => result.current.toggleFav('餐廳/測試店'));
    expect(result.current.isFav('餐廳/測試店')).toBe(true);
    expect(result.current.favCount).toBeGreaterThanOrEqual(1);
    expect(JSON.parse(localStorage.getItem('osaka-trip-state')!)['fav:餐廳/測試店']).toBe(true);
    act(() => result.current.toggleFav('餐廳/測試店'));
    expect(result.current.isFav('餐廳/測試店')).toBe(false);
  });

  it('toggleTodo 切換', () => {
    const { result } = renderHook(() => useTripState(), { wrapper });
    act(() => result.current.toggleTodo('todo:abc'));
    expect(result.current.todosState['todo:abc']).toBe(true);
  });

  it('vault favorite: true 作為預設收藏', () => {
    localStorage.setItem('osaka-trip-state', JSON.stringify({ 'fav:餐廳/A': true }));
    const { result } = renderHook(() => useTripState(), { wrapper });
    expect(result.current.isFav('餐廳/A')).toBe(true);
  });
});
import { useEffect, useState, type RefObject } from 'react';

/**
 * 收合後的最大可捲動距離是否仍 >= collapseAt。
 *
 * header 收合會把 collapseRef 這塊（自然高度 removable）移出正常流，文件因此變矮。
 * 若變矮後 scrollY 超出可捲動範圍，瀏覽器會把 scrollY 夾（clamp）回門檻以下，
 * 觸發展開→又變高→又能收合的無限來回（header 抽搐）。
 * 因此頁面太矮、收合撐不住時就不收合（短頁面本來也不需要收合）。
 *
 * 量測不到（SSR / 測試 / 尚未掛載 ref）時回傳 true，維持原本行為。
 */
function canSustainCondensed(
  el: HTMLElement | null,
  condensed: boolean,
  collapseAt: number,
): boolean {
  const vh = window.innerHeight;
  const removable = el?.scrollHeight ?? 0;
  if (!vh || !removable) return true;
  const docH = document.documentElement.scrollHeight;
  // docH 是「當前狀態」的高度：已收合時它已不含 removable。換算成收合後高度。
  const collapsedDocH = condensed ? docH : docH - removable;
  return collapsedDocH - vh >= collapseAt;
}

export function useCondensedHeader(
  collapseRef?: RefObject<HTMLElement | null>,
  collapseAt = 80,
  expandAt = 40,
): boolean {
  const decide = (prev: boolean): boolean => {
    const y = window.scrollY;
    const want = y > collapseAt ? true : y < expandAt ? false : prev;
    if (!want) return false;
    return canSustainCondensed(collapseRef?.current ?? null, prev, collapseAt);
  };

  const [condensed, setCondensed] = useState(() => decide(false));

  useEffect(() => {
    let ticking = false;
    const update = () => {
      ticking = false;
      setCondensed(decide);
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update(); // 掛載後用實際的 ref 與版面尺寸重算一次
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapseAt, expandAt]);

  return condensed;
}

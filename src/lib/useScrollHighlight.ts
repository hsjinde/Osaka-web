import { useEffect } from 'react';

export function useScrollHighlight(highlightId?: string): void {
  useEffect(() => {
    if (!highlightId) return;
    const el = document.getElementById(highlightId);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('search-highlight');
    const timer = setTimeout(() => el.classList.remove('search-highlight'), 1600);
    return () => clearTimeout(timer);
  }, [highlightId]);
}

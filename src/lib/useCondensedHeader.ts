import { useEffect, useState } from 'react';

export function useCondensedHeader(collapseAt = 80, expandAt = 40): boolean {
  const [condensed, setCondensed] = useState(() => window.scrollY > collapseAt);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      ticking = false;
      const y = window.scrollY;
      setCondensed((prev) => (y > collapseAt ? true : y < expandAt ? false : prev));
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [collapseAt, expandAt]);

  return condensed;
}

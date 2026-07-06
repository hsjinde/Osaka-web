import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { searchAll } from '../lib/search';
import type { Entity } from '../data/schema';
import type { TabKey } from '../App';

const CATEGORY_TAB: Partial<Record<Entity['category'], TabKey>> = {
  餐廳: 'food', 景點: 'places', 購物: 'places', 交通: 'trans',
};

const PLACEHOLDER = '搜尋餐廳、景點、購物、交通、攻略…';

function goTo(tab: TabKey, anchorId: string) {
  location.hash = `${tab}:${encodeURIComponent(anchorId)}`;
}

export default function SearchBar() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { entities, guides } = useMemo(() => searchAll(q), [q]);
  const hasQuery = q.trim().length > 0;

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  function select(tab: TabKey, anchorId: string) {
    goTo(tab, anchorId);
    setQ('');
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') setOpen(false);
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', padding: '0 20px 10px' }}>
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={PLACEHOLDER}
        style={{
          width: '100%', maxWidth: 420, background: 'var(--card)',
          border: '1px solid var(--line-dark)', borderRadius: 8, padding: '10px 14px',
          fontSize: 14, fontFamily: 'inherit', color: 'var(--ink)', outline: 'none',
        }}
      />
      {open && hasQuery && (
        <div style={{
          position: 'absolute', top: '100%', left: 20, right: 20, maxWidth: 420,
          marginTop: 6, background: 'var(--card)', border: '1px solid var(--line-dark)',
          borderRadius: 8, boxShadow: '0 6px 18px rgba(41,35,26,.14)', zIndex: 60,
          maxHeight: 360, overflowY: 'auto', padding: '6px 0',
        }}>
          {entities.length === 0 && guides.length === 0 && (
            <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--brown)' }}>
              找不到符合「{q}」的結果
            </div>
          )}
          {entities.length > 0 && (
            <div>
              <div style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, color: 'var(--brown)', letterSpacing: '.06em' }}>實體</div>
              {entities.map((e) => (
                <button key={e.id} className="btn-plain" style={{ display: 'block', width: '100%', padding: '8px 14px', cursor: 'pointer' }}
                  onClick={() => select(CATEGORY_TAB[e.category]!, `entity-${e.id}`)}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{e.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--navy)' }}>{e.category}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--brown)', marginTop: 2 }}>{e.summary}</div>
                </button>
              ))}
            </div>
          )}
          {guides.length > 0 && (
            <div>
              <div style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, color: 'var(--brown)', letterSpacing: '.06em' }}>攻略</div>
              {guides.map((g) => (
                <button key={g.id} className="btn-plain" style={{ display: 'block', width: '100%', padding: '8px 14px', cursor: 'pointer' }}
                  onClick={() => select('guides', `guide-${g.id}`)}>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{g.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

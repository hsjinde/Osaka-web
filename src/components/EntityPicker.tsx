import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { Entity } from '../data/schema';
import { tokenize, rankEntities, makeSegments } from '../lib/search';
import { useTripState } from '../state/store';
import HitText from './HitText';

const fieldStyle: CSSProperties = {
  width: '100%', fontFamily: 'inherit', fontSize: 13, padding: '6px 8px',
  border: '1px solid var(--line-dark)', borderRadius: 6, background: 'var(--card)', color: 'var(--ink)',
};

export default function EntityPicker({ value, disabled, placeholder, onChangeTitle, onPick }: {
  value: string;
  disabled?: boolean;
  placeholder: string;
  onChangeTitle: (title: string) => void;
  onPick: (entity: Entity) => void;
}) {
  const { favs } = useTripState();
  const favIds = useMemo(
    () => new Set(Object.keys(favs).filter((k) => favs[k]).map((k) => k.slice(4))),
    [favs],
  );
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tokens = useMemo(() => tokenize(value), [value]);
  const results = useMemo(() => rankEntities(value, favIds), [value, favIds]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  useEffect(() => { setHi(0); }, [value, open]);

  const pick = (e: Entity) => { onPick(e); setOpen(false); };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open) { if (e.key === 'ArrowDown') setOpen(true); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { if (results[hi]) { e.preventDefault(); pick(results[hi]); } }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        style={{ ...fieldStyle, opacity: disabled ? .5 : 1 }}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => { onChangeTitle(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 260, overflowY: 'auto',
          background: 'var(--card)', border: '1px solid var(--line-dark)', borderRadius: 8,
          boxShadow: '0 6px 18px rgba(41,35,26,.14)', zIndex: 50, padding: '4px 0',
        }}>
          {results.map((e, i) => (
            <button key={e.id} type="button" className="btn-plain"
              onMouseDown={(ev) => { ev.preventDefault(); pick(e); }}
              style={{
                display: 'flex', width: '100%', alignItems: 'baseline', gap: 8, textAlign: 'left',
                padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                background: i === hi ? 'rgba(178,58,30,.08)' : 'transparent',
              }}>
              {favIds.has(e.id) && <span style={{ color: 'var(--red)', fontSize: 11 }}>♥</span>}
              <span style={{ fontWeight: 600, flex: 1, minWidth: 0 }}>
                <HitText segments={makeSegments(e.name, tokens)} />
              </span>
              <span style={{ fontSize: 11, color: 'var(--brown)', flex: 'none' }}>{e.category}・{e.area}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

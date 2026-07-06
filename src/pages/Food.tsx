import { useMemo, useState } from 'react';
import { byCategory } from '../data';
import Chip from '../components/Chip';
import Heart from '../components/Heart';
import Stamp from '../components/Stamp';
import MapLink from '../components/MapLink';
import { useTripState } from '../state/store';
import { useScrollHighlight } from '../lib/useScrollHighlight';

export default function Food({ highlightId }: { highlightId?: string }) {
  const { favs } = useTripState();
  useScrollHighlight(highlightId);
  const all = useMemo(() => byCategory('餐廳'), []);
  const [cat, setCat] = useState('全部');
  const [q, setQ] = useState('');
  const [favOnly, setFavOnly] = useState(false);

  const cats = useMemo(
    () => ['全部', ...Array.from(new Set(all.map((r) => r.fields['類型'] ?? '未分類')))],
    [all],
  );

  const list = all
    .filter((r) =>
      (cat === '全部' || (r.fields['類型'] ?? '未分類') === cat) &&
      (!favOnly || favs[`fav:${r.id}`]) &&
      (!q || `${r.name}${r.fields['備註'] ?? ''}${r.fields['類型'] ?? ''}${r.summary}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋店名或備註…" style={{
          flex: 1, minWidth: 200, maxWidth: 340, background: 'var(--card)',
          border: '1px solid var(--line-dark)', borderRadius: 8, padding: '10px 14px',
          fontSize: 14, fontFamily: 'inherit', color: 'var(--ink)', outline: 'none',
        }} />
        <Chip on={favOnly} red onClick={() => setFavOnly(!favOnly)}>♥ 只看已標記</Chip>
        <span style={{ fontSize: 12.5, color: 'var(--brown)' }}>共 {list.length} 間</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {cats.map((c) => {
          const n = c === '全部' ? all.length : all.filter((r) => (r.fields['類型'] ?? '未分類') === c).length;
          return <Chip key={c} on={cat === c} onClick={() => setCat(c)}>{c} {n}</Chip>;
        })}
      </div>
      <div className="cards-grid">
        {list.map((r) => {
          const note = r.fields['備註'] && r.fields['備註'] !== '-' ? r.fields['備註'] : r.summary;
          return (
            <div key={r.id} id={`entity-${r.id}`} className="card" style={{ padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <Stamp rating={r.rating} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="serif" style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.35 }}>{r.name}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--navy)', border: '1px solid rgba(46,58,82,.4)', borderRadius: 4, padding: '1.5px 7px' }}>{r.fields['類型'] ?? '未分類'}</span>
                  <span style={{ fontSize: 12, color: 'var(--brown)' }}>{r.fields['價位'] && r.fields['價位'] !== '-' ? r.fields['價位'] : '價位未記'}</span>
                  {r.area && <span style={{ fontSize: 12, color: 'var(--brown)' }}>{r.area}</span>}
                  <MapLink name={r.name} area={r.area} />
                </div>
                {note && (
                  <div style={{ fontSize: 12.5, color: 'var(--brown-dk)', marginTop: 7, borderTop: '1px dashed rgba(41,35,26,.16)', paddingTop: 7 }}>{note}</div>
                )}
              </div>
              <Heart entityId={r.id} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
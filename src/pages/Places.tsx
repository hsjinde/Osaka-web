import { byCategory } from '../data';
import Heart from '../components/Heart';
import Stamp from '../components/Stamp';
import MapLink from '../components/MapLink';
import { useScrollHighlight } from '../lib/useScrollHighlight';

export default function Places({ highlightId }: { highlightId?: string }) {
  const spots = byCategory('景點');
  const shops = byCategory('購物');
  useScrollHighlight(highlightId);

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <section>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
          <span className="serif" style={{ fontSize: 20, fontWeight: 800, borderLeft: '4px solid var(--red)', paddingLeft: 12 }}>景點</span>
          <span style={{ fontSize: 12, color: 'var(--brown)' }}>{spots.length} 處</span>
        </div>
        <div className="cards-grid">
          {spots.map((p) => (
            <div key={p.id} id={`entity-${p.id}`} className="card" style={{ padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <Stamp rating={p.rating} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="serif" style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.35 }}>{p.name}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--navy)', border: '1px solid rgba(46,58,82,.4)', borderRadius: 4, padding: '1.5px 7px' }}>{p.fields['類型'] ?? ''}</span>
                  <span style={{ fontSize: 12, color: 'var(--brown)' }}>
                    {[p.fields['位置'], p.fields['門票']].filter(Boolean).join('・')}
                  </span>
                  <MapLink name={p.name} area={p.area} />
                </div>
                {p.summary && (
                  <div style={{ fontSize: 12.5, color: 'var(--brown-dk)', marginTop: 7, borderTop: '1px dashed rgba(41,35,26,.16)', paddingTop: 7 }}>{p.summary}</div>
                )}
              </div>
              <Heart entityId={p.id} />
            </div>
          ))}
        </div>
      </section>
      <section>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
          <span className="serif" style={{ fontSize: 20, fontWeight: 800, borderLeft: '4px solid var(--navy)', paddingLeft: 12 }}>購物</span>
          <span style={{ fontSize: 12, color: 'var(--brown)' }}>{shops.length} 處・梅田 vs 心齋橋雙主場</span>
        </div>
        <div className="cards-grid">
          {shops.map((p) => (
            <div key={p.id} id={`entity-${p.id}`} className="card" style={{ padding: '16px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span className="serif" style={{ fontSize: 15.5, fontWeight: 700 }}>{p.name}</span>
                  {p.rating != null && <span style={{ fontSize: 11.5, color: 'var(--red)', fontWeight: 700 }}>★ {p.rating.toFixed(1)}</span>}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7, alignItems: 'center' }}>
                  {p.area && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--navy)', border: '1px solid rgba(46,58,82,.4)', borderRadius: 4, padding: '1.5px 7px' }}>{p.area}</span>}
                  <span style={{ fontSize: 12, color: 'var(--brown)' }}>{p.fields['類型'] ?? ''}</span>
                  <MapLink name={p.name} area={p.area} />
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--brown-dk)', marginTop: 7 }}>{p.summary}</div>
              </div>
              <Heart entityId={p.id} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
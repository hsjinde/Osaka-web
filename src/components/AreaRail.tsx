import { entities } from '../data';
import { useTripState } from '../state/store';

const ROWS = [
  { name: '梅田', en: 'UMEDA', badge: '', pts: '阪急・阪神・大丸・LUCUA・Grand Front・Nintendo OSAKA', match: ['梅田'] },
  { name: '本町・南船場', en: 'HOMMACHI', badge: '', pts: '本町製麵所・Yakiniku KITAN', match: [] as string[] },
  { name: '心齋橋', en: 'SHINSAIBASHI', badge: '🏨 住這裡', pts: 'PARCO・寶可夢中心DX・南堀江選品・道頓堀北岸', match: ['心齋橋'] },
  { name: '難波', en: 'NAMBA', badge: '', pts: '道頓堀・千日前・高島屋・南海往關西機場', match: ['難波'] },
  { name: '天王寺', en: 'TENNOJI', badge: '', pts: 'Harukas300・通天閣・新世界・動物園', match: ['天王寺'] },
];

export default function AreaRail({ highlightAreas, showCounts }: {
  highlightAreas: string[] | null; showCounts: boolean;
}) {
  const { favs } = useTripState();
  const favIn = (area: string) =>
    entities.filter((e) => e.area === area && favs[`fav:${e.id}`]).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {ROWS.map((r) => {
        const hl = !!highlightAreas && r.match.some((m) => highlightAreas.includes(m));
        const count = r.match.reduce((n, m) => n + favIn(m), 0);
        return (
          <div key={r.name} style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
            <div style={{ flex: 'none', width: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 3, flex: 1, background: 'var(--red-lt)' }} />
              <div style={{
                flex: 'none', width: r.badge ? 16 : 12, height: r.badge ? 16 : 12, borderRadius: '50%',
                background: hl ? 'var(--red)' : 'var(--card)',
                border: `3px solid ${r.badge ? 'var(--red)' : 'var(--red-lt)'}`,
              }} />
              <div style={{ width: 3, flex: 1, background: 'var(--red-lt)' }} />
            </div>
            <div style={{
              flex: 1, margin: '6px 0', padding: '12px 16px', borderRadius: 8,
              border: hl ? '1px solid var(--red)' : '1px solid rgba(41,35,26,.12)',
              background: hl ? 'rgba(178,58,30,.06)' : 'rgba(255,255,255,.4)',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span className="serif" style={{ fontSize: 16, fontWeight: 800 }}>{r.name}</span>
                <span style={{ fontSize: 10.5, letterSpacing: '.18em', color: 'var(--brown)' }}>{r.en}</span>
                {r.badge && <span style={{ fontSize: 12 }}>{r.badge}</span>}
                {showCounts && count > 0 && (
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--red)', border: '1px solid rgba(178,58,30,.4)', borderRadius: 999, padding: '1px 8px' }}>♥ {count}</span>
                )}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--brown-dk)', marginTop: 2 }}>{r.pts}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
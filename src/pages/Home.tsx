import { useState } from 'react';
import { countdownDays } from '../lib/countdown';
import { byCategory, entities, meta, overview, todos } from '../data';
import { useTripState } from '../state/store';
import { useAuth } from '../state/auth';
import WishList from '../components/WishList';
import GuideFavCard from '../components/GuideFavCard';

export default function Home() {
  const { todosState, toggleTodo, favCount, favs } = useTripState();
  const { canEdit, openLogin } = useAuth();
  const [wishOpen, setWishOpen] = useState(false);
  const favEntities = entities.filter((e) => favs[`fav:${e.id}`]);
  const f = overview.fields;
  const cd = countdownDays(meta.tripStart);
  const done = todos.filter((t) => todosState[t.key]).length;

  const quick: { count: number; label: string; sub: string; hash: string }[] = [
    { count: byCategory('餐廳').length, label: '美食庫', sub: '分類齊全・可篩選', hash: 'food' },
    { count: byCategory('景點').length, label: '景點', sub: 'USJ・展望台・水族館', hash: 'places' },
    { count: byCategory('購物').length, label: '購物', sub: '梅田 vs 心齋橋', hash: 'places' },
    { count: byCategory('交通').length, label: '交通票券', sub: 'Rapi:t・近鐵 PASS', hash: 'trans' },
  ];

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="ov-grid">
        {/* 倒數卡 */}
        <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -14, top: -14, width: 110, height: 110, border: '2px solid rgba(178,58,30,.12)', borderRadius: '50%' }} />
          <div className="label-en">DEPARTURE COUNTDOWN</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
            <span className="serif" style={{ fontSize: 72, fontWeight: 800, color: 'var(--red)', lineHeight: 1 }}>{cd}</span>
            <span className="serif" style={{ fontSize: 20, fontWeight: 700 }}>日</span>
          </div>
          <div className="dash-top" style={{ display: 'flex', gap: 18, marginTop: 14, paddingTop: 14 }}>
            {[['出發', f['出發顯示']], ['回程', f['回程顯示']], ['季節', f['季節']]].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 11, color: 'var(--brown)', letterSpacing: '.1em' }}>{k}</span>
                <span className="serif" style={{ fontSize: 15, fontWeight: 700 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        {/* 飯店卡 */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--green)', border: '1px solid var(--green)', borderRadius: 4, padding: '2px 7px' }}>✓ {f['飯店狀態']}</span>
            <span className="label-en" style={{ letterSpacing: '.2em' }}>HOTEL</span>
          </div>
          <div className="serif" style={{ fontSize: 21, fontWeight: 700, marginTop: 8 }}>{f['飯店']}</div>
          <div style={{ fontSize: 12, color: 'var(--brown-dk)' }}>{f['飯店副標']}</div>
          <div className="dash-top" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14, paddingTop: 12, fontSize: 13 }}>
            {overview.transportNotes.map((n) => {
              const [mark, ...rest] = n.split('｜');
              return (
                <div key={n} style={{ display: 'flex', gap: 8 }}>
                  <span style={{ color: mark === '早' ? 'var(--brown)' : 'var(--red)', fontWeight: 700 }}>{mark}</span>
                  <span style={{ color: mark === '早' ? 'var(--brown-dk)' : undefined }}>{rest.join('｜')}</span>
                </div>
              );
            })}
          </div>
        </div>
        {/* 訂購卡 */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="label-en" style={{ letterSpacing: '.2em' }}>BOOKING</div>
          <div className="serif" style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>{f['訂購']}</div>
          <div style={{ fontSize: 13, color: 'var(--brown-dk)', marginTop: 4 }}>{f['產品']}</div>
          <div style={{ fontSize: 12, color: 'var(--brown)', marginTop: 10, fontFamily: 'ui-monospace, monospace' }}>{f['訂單編號']}</div>
          <div style={{ flex: 1 }} />
          {f['訂購提醒'] && (
            <div className="dash-top" style={{ marginTop: 14, paddingTop: 12, fontSize: 13, color: 'var(--red)', fontWeight: 600 }}>⚠ {f['訂購提醒']}</div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {/* 待辦 */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <div className="serif" style={{ fontSize: 18, fontWeight: 700 }}>出發前待辦</div>
            <div style={{ fontSize: 12, color: 'var(--brown)' }}>{done} / {todos.length} 完成</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
            {todos.map((t) => {
              const on = !!todosState[t.key];
              return (
                <button key={t.key} className="btn-plain dash-bottom"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', opacity: canEdit ? 1 : 0.6 }}
                  onClick={() => (canEdit ? toggleTodo(t.key) : openLogin())}>
                  <span style={{
                    flex: 'none', width: 20, height: 20, borderRadius: 4,
                    border: `1.6px solid ${on ? 'var(--green)' : 'rgba(41,35,26,.4)'}`,
                    background: on ? 'var(--green)' : 'transparent', color: '#F7F2E6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
                  }}>{on ? '✓' : ''}</span>
                  <span style={{ fontSize: 13.5, color: on ? 'var(--brown)' : 'var(--ink)', textDecoration: on ? 'line-through' : 'none' }}>{t.text}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 快速連結 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            {quick.map((q) => (
              <button key={q.label} className="card btn-plain card-tap" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer' }}
                onClick={() => { location.hash = q.hash; }}>
                <span className="serif" style={{ fontSize: 26, fontWeight: 800, color: 'var(--red)' }}>{q.count}</span>
                <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.06em' }}>{q.label}</span>
                <span style={{ fontSize: 11, color: 'var(--brown)' }}>{q.sub}</span>
              </button>
            ))}
          </div>
          <GuideFavCard />
          {/* 收藏統計橫幅（點擊展開想去清單） */}
          <button className="banner-dark btn-plain" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', cursor: 'pointer', textAlign: 'left', width: '100%' }}
            onClick={() => setWishOpen((o) => !o)}>
            <div className="serif" style={{ writingMode: 'vertical-rl', fontSize: 14, fontWeight: 700, letterSpacing: '.3em', borderRight: '1px solid rgba(239,233,218,.3)', paddingRight: 10 }}>已標記</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span className="serif" style={{ fontSize: 40, fontWeight: 800, color: 'var(--gold)' }}>{favCount}</span>
              <span style={{ fontSize: 13 }}>個想去的地方</span>
            </div>
            <div style={{ flex: 1, fontSize: 12, color: 'rgba(239,233,218,.72)', minWidth: 150 }}>
              在美食庫、景點與購物頁按 ♡ 標記，地圖頁會依區域統計。
            </div>
            <span style={{ fontSize: 12, color: 'var(--gold)', whiteSpace: 'nowrap' }}>{wishOpen ? '▲ 收合' : '▼ 展開清單'}</span>
          </button>
          {wishOpen && <WishList items={favEntities} />}
        </div>
      </div>
    </div>
  );
}
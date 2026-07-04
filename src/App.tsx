import { useEffect, useState, type JSX } from 'react';
import { meta, overview, byCategory } from './data';
import Chip from './components/Chip';
import Home from './pages/Home';
import DailyPlan from './pages/DailyPlan';
import Food from './pages/Food';
import Places from './pages/Places';
import Transport from './pages/Transport';
import AreaMap from './pages/AreaMap';

export type TabKey = 'home' | 'plan' | 'food' | 'places' | 'trans' | 'map';

export function countdownDays(tripStart: string, now = new Date()): number {
  const dep = new Date(`${tripStart}T00:00:00+09:00`).getTime();
  return Math.max(0, Math.ceil((dep - now.getTime()) / 86400000));
}

const TABS: [TabKey, string][] = [
  ['home', '總覽'], ['plan', '每日行程'], ['food', '美食庫'],
  ['places', '景點・購物'], ['trans', '交通票券'], ['map', '地圖'],
];

const PAGES: Record<TabKey, () => JSX.Element> = {
  home: Home, plan: DailyPlan, food: Food, places: Places, trans: Transport, map: AreaMap,
};

function tabFromHash(): TabKey {
  const h = location.hash.replace('#', '') as TabKey;
  return TABS.some(([k]) => k === h) ? h : 'home';
}

export default function App() {
  const [tab, setTab] = useState<TabKey>(tabFromHash);
  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = (k: TabKey) => { location.hash = k; };

  const cd = countdownDays(meta.tripStart);
  const foodCount = byCategory('餐廳').length;
  const Page = PAGES[tab];
  const f = overview.fields;

  return (
    <div style={{ minHeight: '100vh' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50, background: 'rgba(241,235,221,.94)',
        backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--line)',
      }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '14px 20px 0', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
          <div className="serif" style={{
            width: 44, height: 44, background: 'var(--red)', color: '#F7F2E6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 700, borderRadius: 6,
            boxShadow: '2px 2px 0 rgba(41,35,26,.18)', transform: 'rotate(-3deg)',
          }}>阪</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 180 }}>
            <div className="serif" style={{ fontSize: 21, fontWeight: 700, letterSpacing: '.12em' }}>
              大阪旅券 <span className="label-en" style={{ fontSize: 12 }}>OSAKA TRIP</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--brown-dk)', letterSpacing: '.06em' }}>
              {f['出發顯示']} → {f['回程顯示']}・{f['天數']}・宿 心齋橋
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 7, border: '1.5px solid var(--red)',
            color: 'var(--red)', borderRadius: 999, padding: '6px 16px', background: 'rgba(178,58,30,.05)',
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.1em' }}>出發倒數</span>
            <span className="serif" style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{cd}</span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>日</span>
          </div>
        </div>
        <nav style={{ maxWidth: 1120, margin: '0 auto', padding: '10px 20px 12px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {TABS.map(([k, label]) => (
            <Chip key={k} on={tab === k} red onClick={() => go(k)}>
              {k === 'food' ? `${label} ${foodCount}` : label}
            </Chip>
          ))}
        </nav>
      </header>
      <main style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 20px 64px' }}>
        <Page key={tab} />
      </main>
      <footer style={{
        borderTop: '1px solid var(--line)', padding: '18px 20px', textAlign: 'center',
        fontSize: 11.5, color: 'var(--brown)', letterSpacing: '.08em',
      }}>
        資料來源：Osaka-vault wiki・資料建置於 {new Date(meta.builtAt).toLocaleString('zh-TW')}
      </footer>
    </div>
  );
}
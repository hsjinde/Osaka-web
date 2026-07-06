import { useEffect, useState, type JSX } from 'react';
import { meta, overview, byCategory } from './data';
import Chip from './components/Chip';
import Home from './pages/Home';
import { useTripState } from './state/store';
import { apiBase, getToken, setupLink } from './api/state';
import { useAuth } from './state/auth';
import LoginModal from './components/LoginModal';
import DailyPlan from './pages/DailyPlan';
import Food from './pages/Food';
import Places from './pages/Places';
import Transport from './pages/Transport';
import AreaMap from './pages/AreaMap';
import Guides from './pages/Guides';

export type TabKey = 'home' | 'plan' | 'food' | 'places' | 'trans' | 'map' | 'guides';

export function countdownDays(tripStart: string, now = new Date()): number {
  const dep = new Date(`${tripStart}T00:00:00+09:00`).getTime();
  return Math.max(0, Math.ceil((dep - now.getTime()) / 86400000));
}

const TABS: [TabKey, string][] = [
  ['home', '總覽'], ['plan', '每日行程'], ['food', '美食庫'],
  ['places', '景點・購物'], ['trans', '交通票券'], ['map', '地圖'], ['guides', '攻略'],
];

const PAGES: Record<TabKey, () => JSX.Element> = {
  home: Home, plan: DailyPlan, food: Food, places: Places, trans: Transport, map: AreaMap, guides: Guides,
};

export function parseHash(hash: string): TabKey {
  const raw = hash.replace('#', '');
  return (TABS.some(([k]) => k === raw) ? raw : 'home') as TabKey;
}

export default function App() {
  const [tab, setTab] = useState<TabKey>(() => parseHash(location.hash));
  const { offline } = useTripState();
  const { canEdit, openLogin, logout } = useAuth();
  useEffect(() => {
    const onHash = () => setTab(parseHash(location.hash));
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
        {apiBase() && (canEdit ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 20px 4px' }}>
            <button className="btn-plain" title="複製新裝置設定連結" style={{ fontSize: 18, cursor: 'pointer' }}
              onClick={() => { const cur = getToken(); if (cur) window.prompt('新裝置設定連結（點一次即完成同步）：', setupLink(cur)); }}>⚙</button>
            <button className="btn-plain" style={{
              fontSize: 12.5, color: 'var(--brown-dk)', border: '1px solid var(--line-dark)',
              borderRadius: 6, padding: '6px 12px', minHeight: 34, cursor: 'pointer',
            }} onClick={logout}>登出</button>
            {offline && (
              <span style={{ fontSize: 11, color: 'var(--brown)', border: '1px dashed var(--brown)', borderRadius: 4, padding: '2px 8px' }}>
                離線模式・變更暫存本機
              </span>
            )}
          </div>
        ) : (
          <div style={{ padding: '0 20px 4px' }}>
            <button className="btn-plain" style={{
              fontSize: 13, color: 'var(--red)', border: '1px solid var(--red)',
              borderRadius: 6, padding: '7px 16px', minHeight: 38, fontWeight: 600, cursor: 'pointer',
            }} onClick={openLogin}>登入編輯</button>
          </div>
        ))}
        <nav style={{ maxWidth: 1120, margin: '0 auto', padding: '10px 20px 12px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {TABS.map(([k, label]) => (
            <Chip key={k} on={tab === k} red onClick={() => go(k)}>
              {k === 'food' ? `${label} ${foodCount}` : label}
            </Chip>
          ))}
        </nav>
      </header>
      <LoginModal />
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
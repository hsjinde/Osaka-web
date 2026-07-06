import { byCategory, meta, overview } from '../data';
import Chip from './Chip';
import { useTripState } from '../state/store';
import { apiBase, getToken, setupLink } from '../api/state';
import { useAuth } from '../state/auth';
import { countdownDays } from '../lib/countdown';
import { TABS, type TabKey } from '../lib/tabs';
import { useCondensedHeader } from '../lib/useCondensedHeader';

export default function Header({ tab, onNavigate }: { tab: TabKey; onNavigate: (k: TabKey) => void }) {
  const condensed = useCondensedHeader();
  const { offline } = useTripState();
  const { canEdit, openLogin, logout } = useAuth();
  const cd = countdownDays(meta.tripStart);
  const foodCount = byCategory('餐廳').length;
  const f = overview.fields;

  const go = (k: TabKey) => {
    onNavigate(k);
    window.scrollTo(0, 0);
  };

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50, background: 'rgba(241,235,221,.94)',
      backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--line)',
    }}>
      <div className={`hdr-collapse${condensed ? ' hdr-collapse--hidden' : ''}`}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 20px 0' }}>
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
          <div style={{ padding: '6px 20px 0' }}>
            <button className="btn-plain" style={{
              fontSize: 13, color: 'var(--red)', border: '1px solid var(--red)',
              borderRadius: 6, padding: '7px 16px', minHeight: 38, fontWeight: 600, cursor: 'pointer',
            }} onClick={openLogin}>登入編輯</button>
          </div>
        ))}
      </div>
      <nav className="hscroll" style={{ maxWidth: 1120, margin: '0 auto', padding: '10px 20px 12px', alignItems: 'center' }}>
        {condensed && (
          <button className="btn-plain serif" aria-label="回到頂部"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            style={{
              flex: 'none', width: 30, height: 30, background: 'var(--red)', color: '#F7F2E6',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700, borderRadius: 5, transform: 'rotate(-3deg)', cursor: 'pointer',
            }}>阪</button>
        )}
        {TABS.map(([k, label]) => (
          <Chip key={k} on={tab === k} red onClick={() => go(k)}>
            {k === 'food' ? `${label} ${foodCount}` : label}
          </Chip>
        ))}
      </nav>
    </header>
  );
}

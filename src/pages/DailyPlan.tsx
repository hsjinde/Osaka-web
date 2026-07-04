import { useState } from 'react';
import { days } from '../data';
import AreaRail from '../components/AreaRail';

type View = 'timeline' | 'cards' | 'map';
const VIEWS: [View, string][] = [['timeline', '時間軸'], ['cards', '卡片'], ['map', '地圖']];

export default function DailyPlan() {
  const [dayIdx, setDayIdx] = useState(0);
  const [view, setView] = useState<View>('timeline');
  const day = days[dayIdx] ?? days[0];

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {days.map((d, i) => (
          <button key={d.label} className="btn-plain" onClick={() => setDayIdx(i)} style={{
            background: dayIdx === i ? 'var(--ink)' : 'transparent',
            color: dayIdx === i ? '#F7F2E6' : 'var(--ink)',
            border: dayIdx === i ? '1px solid var(--ink)' : '1px solid rgba(41,35,26,.3)',
            borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
          }}>
            <span style={{ display: 'block', fontSize: 11, letterSpacing: '.08em', opacity: .75 }}>{d.date}</span>
            <span className="serif" style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{d.label}</span>
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', border: '1px solid var(--line-dark)', borderRadius: 8, overflow: 'hidden' }}>
          {VIEWS.map(([k, label]) => (
            <button key={k} className="btn-plain" onClick={() => setView(k)} style={{
              background: view === k ? 'var(--red)' : 'transparent',
              color: view === k ? '#F7F2E6' : 'var(--ink)',
              padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {view === 'timeline' && (
        <div className="card" style={{ padding: '24px 26px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 12, paddingBottom: 16, borderBottom: '1px solid var(--line)' }}>
            <span className="serif" style={{ fontSize: 24, fontWeight: 800, color: 'var(--red)' }}>{day.label}</span>
            <span className="serif" style={{ fontSize: 18, fontWeight: 700 }}>{day.theme}</span>
            <span style={{ fontSize: 12, color: 'var(--brown)', letterSpacing: '.06em' }}>活動區域：{day.areas.join('・')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
            {day.slots.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 16 }}>
                <div className="serif" style={{ width: 52, flex: 'none', textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--brown)', paddingTop: 18 }}>{s.time}</div>
                <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: 1, flex: 1, background: 'rgba(41,35,26,.18)' }} />
                  <div style={{
                    flex: 'none', width: 12, height: 12, borderRadius: '50%',
                    border: `2.5px solid ${s.pending ? 'rgba(41,35,26,.3)' : 'var(--red)'}`,
                    background: s.pending ? 'transparent' : 'rgba(178,58,30,.1)',
                  }} />
                  <div style={{ width: 1, flex: 1, background: 'rgba(41,35,26,.18)' }} />
                </div>
                <div style={{ flex: 1, padding: '8px 0' }}>
                  <div style={{
                    borderRadius: 8, padding: '12px 16px',
                    border: s.pending ? '1.5px dashed rgba(41,35,26,.3)' : '1px solid var(--line)',
                    background: s.pending ? 'transparent' : 'rgba(255,255,255,.5)',
                  }}>
                    <div className="serif" style={{ fontSize: 15, fontWeight: 700, color: s.pending ? 'var(--brown-lt)' : 'var(--ink)' }}>
                      {s.pending ? '待安排' : s.title}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--brown-dk)', marginTop: 3 }}>
                      {s.pending ? '空白時段，到 Obsidian 填 — 或從美食庫挑一間' : s.note || ' '}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'cards' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(205px, 1fr))', gap: 12 }}>
          {days.map((d, i) => (
            <div key={d.label} className="card" style={{ padding: '16px 18px', borderColor: i === dayIdx ? 'var(--red)' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '2px solid var(--ink)', paddingBottom: 8 }}>
                <span className="serif" style={{ fontSize: 17, fontWeight: 800 }}>{d.label}</span>
                <span style={{ fontSize: 11, color: 'var(--brown)', letterSpacing: '.06em' }}>{d.date}</span>
              </div>
              <div className="serif" style={{ fontSize: 14, fontWeight: 700, color: 'var(--red)', marginTop: 10 }}>{d.theme}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                {d.slots.map((s, j) => (
                  <div key={j} style={{
                    fontSize: 12.5, lineHeight: 1.5,
                    color: s.pending ? 'var(--brown-lt)' : 'var(--ink)',
                    ...(s.pending ? { border: '1px dashed rgba(41,35,26,.25)', borderRadius: 6, padding: '5px 9px' } : { padding: '2px 0' }),
                  }}>
                    <span style={{ fontWeight: 700, color: 'var(--brown)', fontSize: 11, letterSpacing: '.05em' }}>{s.time}</span>{' '}
                    {s.pending ? '待安排' : s.title}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'map' && (
        <div className="card" style={{ padding: '24px 26px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
            <span className="serif" style={{ fontSize: 20, fontWeight: 800, color: 'var(--red)' }}>{day.label}</span>
            <span style={{ fontSize: 13, color: 'var(--brown-dk)' }}>{day.theme}・當日活動區域以朱色標示</span>
          </div>
          <AreaRail highlightAreas={day.areas} showCounts={false} />
        </div>
      )}
    </div>
  );
}
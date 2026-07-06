import { useState } from 'react';
import { guides } from '../data';
import MarkdownBody from '../components/MarkdownBody';

export default function Guides() {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setOpen((s) => ({ ...s, [id]: !s[id] }));

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 820 }}>
      <div style={{ fontSize: 12.5, color: 'var(--brown)' }}>
        別人分享的大阪攻略與清單（來自 Threads／小紅書／Google Maps），僅供參考。
      </div>
      {guides.map((g) => {
        const isOpen = !!open[g.id];
        return (
          <div key={g.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div onClick={() => toggle(g.id)} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '16px 22px', cursor: 'pointer',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="serif" style={{ fontSize: 17, fontWeight: 800 }}>{g.title}</div>
                {g.source && (
                  <div style={{ fontSize: 12, color: 'var(--brown)', marginTop: 3 }}>
                    來源：{g.sourceUrl ? (
                      <a href={g.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                        {g.source} ↗
                      </a>
                    ) : g.source}
                  </div>
                )}
              </div>
              <span className="serif" style={{ fontSize: 13, color: 'var(--red)', fontWeight: 700, flex: 'none' }}>
                {isOpen ? '收合 ▲' : '展開 ▼'}
              </span>
            </div>
            {isOpen && (
              <div className="dash-top" style={{ padding: '2px 22px 18px' }}>
                <MarkdownBody>{g.body}</MarkdownBody>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

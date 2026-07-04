import { byCategory } from '../data';
import MarkdownBody from '../components/MarkdownBody';

const HEADER_COLORS = ['var(--navy)', 'var(--red)', 'var(--green)'];

export default function Transport() {
  const items = byCategory('交通');
  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 820 }}>
      {items.map((t, i) => (
        <div key={t.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ background: HEADER_COLORS[i % HEADER_COLORS.length], color: '#EFE9DA', padding: '14px 22px', display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 10 }}>
            <span className="serif" style={{ fontSize: 18, fontWeight: 800 }}>{t.name}</span>
            <span style={{ fontSize: 12, opacity: .78 }}>{t.summary.slice(0, 60)}</span>
          </div>
          <div style={{ padding: '10px 22px 18px' }}>
            <MarkdownBody>{t.body.replace(/## 基本資訊[\s\S]*?(?=\n## |$)/, '').replace(/## 來源[\s\S]*$/, '')}</MarkdownBody>
          </div>
        </div>
      ))}
    </div>
  );
}
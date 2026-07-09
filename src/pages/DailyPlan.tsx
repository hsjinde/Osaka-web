import { useState, type CSSProperties } from 'react';
import { entities } from '../data';
import { useItinerary } from '../state/itinerary';
import { configured } from '../api/state';
import type { DaySlot } from '../data/schema';
import AreaRail from '../components/AreaRail';
import Reveal from '../components/Reveal';

type View = 'timeline' | 'cards' | 'map';
const VIEWS: [View, string][] = [['timeline', '時間軸'], ['cards', '卡片'], ['map', '地圖']];

export default function DailyPlan() {
  const { days, saving, updateSlot, addSlot, removeSlot, moveSlot, save, reset } = useItinerary();
  const [dayIdx, setDayIdx] = useState(0);
  const [view, setView] = useState<View>('timeline');
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const day = days[dayIdx] ?? days[0];
  const canEdit = configured();

  const onSave = async () => {
    setMsg(null);
    try { await save(); setMsg('已提交，網站將於重建後更新'); setEditing(false); }
    catch (e) { setMsg(e instanceof Error ? e.message : '提交失敗'); }
  };
  const onCancel = () => { reset(); setEditing(false); setMsg(null); };

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <div className="hscroll" style={{ flex: 1, minWidth: 0 }}>
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
        </div>
        <div style={{ display: 'flex', border: '1px solid var(--line-dark)', borderRadius: 8, overflow: 'hidden', flex: 'none' }}>
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
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              {canEdit ? (
                editing ? (
                  <>
                    <button className="btn-plain" onClick={onCancel} disabled={saving} style={editBtn(false)}>取消</button>
                    <button className="btn-plain" onClick={onSave} disabled={saving} style={editBtn(true)}>
                      {saving ? '提交中…' : '儲存並提交'}
                    </button>
                  </>
                ) : (
                  <button className="btn-plain" onClick={() => setEditing(true)} style={editBtn(false)}>編輯</button>
                )
              ) : (
                <span style={{ fontSize: 11.5, color: 'var(--brown-lt)' }}>登入後可編輯</span>
              )}
            </div>
          </div>

          {msg && (
            <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--brown-dk)' }}>{msg}</div>
          )}

          {editing ? (
            <EditableSlots dayIdx={dayIdx} slots={day.slots}
              onUpdate={updateSlot} onAdd={addSlot} onRemove={removeSlot} onMove={moveSlot} />
          ) : (
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
          )}
        </div>
      )}

      {view === 'cards' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(205px, 1fr))', gap: 12 }}>
          {days.map((d, i) => (
            <Reveal key={d.label} index={i}>
            <div className="card" style={{ padding: '16px 18px', borderColor: i === dayIdx ? 'var(--red)' : undefined }}>
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
            </Reveal>
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

function editBtn(primary: boolean): CSSProperties {
  return {
    padding: '6px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', borderRadius: 8,
    background: primary ? 'var(--red)' : 'transparent',
    color: primary ? '#F7F2E6' : 'var(--ink)',
    border: `1px solid ${primary ? 'var(--red)' : 'rgba(41,35,26,.3)'}`,
  };
}

function EditableSlots({ dayIdx, slots, onUpdate, onAdd, onRemove, onMove }: {
  dayIdx: number; slots: DaySlot[];
  onUpdate: (di: number, si: number, patch: Partial<DaySlot>) => void;
  onAdd: (di: number) => void;
  onRemove: (di: number, si: number) => void;
  onMove: (di: number, si: number, dir: -1 | 1) => void;
}) {
  const field: CSSProperties = {
    fontFamily: 'inherit', fontSize: 13, padding: '6px 8px',
    border: '1px solid var(--line-dark)', borderRadius: 6, background: 'var(--card)', color: 'var(--ink)',
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
      <datalist id="entity-options">
        {entities.map((e) => <option key={e.id} value={e.name}>{e.category}・{e.area}</option>)}
      </datalist>
      {slots.map((s, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '80px 1fr 1fr auto', gap: 8, alignItems: 'center',
          border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', background: 'rgba(255,255,255,.4)',
        }}>
          <input style={field} value={s.time} placeholder="時段"
            onChange={(e) => onUpdate(dayIdx, i, { time: e.target.value })} />
          <input style={{ ...field, opacity: s.pending ? .5 : 1 }} list="entity-options"
            value={s.pending ? '' : s.title} placeholder={s.pending ? '待安排' : '標題（可打字或選單）'}
            disabled={s.pending}
            onChange={(e) => {
              const v = e.target.value;
              const match = entities.find((x) => x.name === v);
              onUpdate(dayIdx, i, { title: v, ...(match && !s.note.trim() ? { note: match.area } : {}) });
            }} />
          <input style={{ ...field, opacity: s.pending ? .5 : 1 }} value={s.pending ? '' : s.note} placeholder="備註"
            disabled={s.pending}
            onChange={(e) => onUpdate(dayIdx, i, { note: e.target.value })} />
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <label style={{ fontSize: 11, color: 'var(--brown)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <input type="checkbox" checked={s.pending}
                onChange={(e) => onUpdate(dayIdx, i, { pending: e.target.checked })} />待安排
            </label>
            <button className="btn-plain" title="上移" onClick={() => onMove(dayIdx, i, -1)} style={iconBtn}>↑</button>
            <button className="btn-plain" title="下移" onClick={() => onMove(dayIdx, i, 1)} style={iconBtn}>↓</button>
            <button className="btn-plain" title="刪除" onClick={() => onRemove(dayIdx, i)} style={{ ...iconBtn, color: 'var(--red)' }}>✕</button>
          </div>
        </div>
      ))}
      <button className="btn-plain" onClick={() => onAdd(dayIdx)} style={{
        alignSelf: 'flex-start', padding: '6px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
        borderRadius: 8, border: '1px dashed rgba(41,35,26,.4)', background: 'transparent', color: 'var(--ink)',
      }}>＋ 新增時段</button>
    </div>
  );
}

const iconBtn: CSSProperties = {
  width: 26, height: 26, cursor: 'pointer', borderRadius: 6,
  border: '1px solid rgba(41,35,26,.25)', background: 'var(--card)', color: 'var(--ink)', fontSize: 13,
};

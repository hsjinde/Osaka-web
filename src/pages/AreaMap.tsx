import AreaRail from '../components/AreaRail';

export default function AreaMap() {
  return (
    <div className="fade-up" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
      <div className="card" style={{ flex: 2, minWidth: 300, padding: '24px 26px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
          <span className="serif" style={{ fontSize: 18, fontWeight: 800 }}>御堂筋軸・區域示意</span>
          <span style={{ fontSize: 12, color: 'var(--brown)' }}>北 ↓ 南</span>
        </div>
        <AreaRail highlightAreas={null} showCounts={true} />
      </div>
      <div style={{ flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card" style={{ padding: '18px 20px' }}>
          <div className="serif" style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>西側・市郊</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 13 }}>
            {[
              ['此花區', '日本環球影城（JR 夢咲線）'],
              ['大阪港・天保山', '海遊館＋摩天輪'],
              ['池田市', '杯麵博物館（車程約 30 分）'],
              ['門真市', '三井 Outlet＋LaLaport'],
              ['淀屋橋', '堂島濱塔免費夜景'],
            ].map(([b, rest]) => (
              <div key={b} style={{ display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--navy)', fontWeight: 700 }}>◆</span>
                <span><b>{b}</b>：{rest}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: 'rgba(46,58,82,.06)', border: '1px dashed rgba(46,58,82,.4)', borderRadius: 10, padding: '16px 20px', fontSize: 12.5, color: '#4A5468', lineHeight: 1.7 }}>
          尚未收錄各店座標，此頁以路線示意呈現。之後可把 Google Maps 清單（82 個標記）匯入升級成真地圖。
        </div>
      </div>
    </div>
  );
}
# 攻略典藏功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 攻略頁每篇攻略可「典藏」，狀態跨裝置同步；典藏置頂、可篩選「只看典藏」、首頁顯示典藏攻略捷徑卡。

**Architecture:** 沿用 `TripStateProvider` 既有的 key-value 同步管線（localStorage 先寫、有 token 才同步 D1），新 key 前綴 `guide:<攻略id>`。Worker 端是 generic key-value，完全不用改。UI 分三塊：`GuideStar` 按鈕元件（仿 `Heart`）、`Guides` 頁排序＋篩選、`GuideFavCard` 首頁捷徑卡。

**Tech Stack:** React 19 + TypeScript、Vitest（非 Jest）+ @testing-library/react + jsdom、oxlint（非 ESLint）。

**Spec:** `docs/superpowers/specs/2026-07-17-guide-favorites-design.md`

## Global Constraints

- 使用者可見文案一律繁體中文；程式碼識別字維持英文。
- 測試指令用 `npx vitest run <path>`；lint 用 `npm run lint`（oxlint）。
- 未登入（`canEdit === false`）為唯讀：互動元件半透明（`opacity: 0.4`）、點擊呼叫 `openLogin()`，不改狀態。此行為以 `src/components/Heart.tsx` 為準。
- `src/data/*.json` 是建置產物，不要手改。
- 攻略 id = vault 檔名去掉 `.md`（`scripts/lib/parse-guide.ts`），可直接當 key。

---

### Task 1: store 狀態層 — `guide:` 前綴

**Files:**
- Modify: `src/state/store.tsx`
- Test: `src/state/__tests__/store.test.tsx`

**Interfaces:**
- Consumes: 既有 `toggle(key)` 內部函式（本地寫入 + putState/queuePut）。
- Produces（後續 Task 依賴的確切簽名，加入 `TripState` interface）:
  - `guideFavs: Record<string, boolean>` — 所有 `guide:` 前綴的項目（key 含前綴）。
  - `isGuideFav(guideId: string): boolean`
  - `toggleGuideFav(guideId: string): void`

- [ ] **Step 1: 寫失敗測試**

在 `src/state/__tests__/store.test.tsx` 的 `describe('useTripState (localStorage)')` 區塊內（`toggleTodo 切換` 測試之後）加入：

```tsx
  it('toggleGuideFav 切換並持久化，反映在 guideFavs', () => {
    const { result } = renderHook(() => useTripState(), { wrapper });
    act(() => result.current.toggleGuideFav('大阪美食攻略'));
    expect(result.current.isGuideFav('大阪美食攻略')).toBe(true);
    expect(result.current.guideFavs['guide:大阪美食攻略']).toBe(true);
    expect(JSON.parse(localStorage.getItem('osaka-trip-state')!)['guide:大阪美食攻略']).toBe(true);
    act(() => result.current.toggleGuideFav('大阪美食攻略'));
    expect(result.current.isGuideFav('大阪美食攻略')).toBe(false);
  });

  it('guide: 前綴不影響 favCount 與 favs', () => {
    const { result } = renderHook(() => useTripState(), { wrapper });
    const before = result.current.favCount;
    act(() => result.current.toggleGuideFav('大阪美食攻略'));
    expect(result.current.favCount).toBe(before);
    expect(result.current.favs['guide:大阪美食攻略']).toBeUndefined();
  });
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/state/__tests__/store.test.tsx`
Expected: FAIL — `result.current.toggleGuideFav is not a function`（TypeScript 也會先報 `TripState` 沒有此屬性）。

- [ ] **Step 3: 最小實作**

修改 `src/state/store.tsx`：

(a) `TripState` interface（第 22–27 行）改為：

```tsx
interface TripState {
  favs: StateMap; todosState: StateMap; guideFavs: StateMap;
  toggleFav(entityId: string): void; toggleTodo(key: string): void;
  toggleGuideFav(guideId: string): void;
  isFav(entityId: string): boolean; isGuideFav(guideId: string): boolean;
  favCount: number; offline: boolean;
  syncing: boolean;
}
```

(b) `value` 的 `useMemo`（第 82–97 行）改為：

```tsx
  const value = useMemo<TripState>(() => {
    const favs: StateMap = {}; const todosState: StateMap = {}; const guideFavs: StateMap = {};
    for (const [k, v] of Object.entries(state)) {
      if (k.startsWith('fav:')) favs[k] = v;
      else if (k.startsWith('todo:')) todosState[k] = v;
      else if (k.startsWith('guide:')) guideFavs[k] = v;
    }
    return {
      favs, todosState, guideFavs,
      toggleFav: (id) => toggle(`fav:${id}`),
      toggleTodo: (key) => toggle(key),
      toggleGuideFav: (id) => toggle(`guide:${id}`),
      isFav: (id) => !!state[`fav:${id}`],
      isGuideFav: (id) => !!state[`guide:${id}`],
      favCount: Object.entries(favs).filter(([, v]) => v).length,
      offline,
      syncing,
    };
  }, [state, toggle, offline, syncing]);
```

其餘（`defaults()`、`syncRemote`、`toggle`）不動——同步是 generic key-value，`guide:` 自動走同一條管線。

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/state/__tests__/store.test.tsx`
Expected: PASS（全部，含既有測試）。

- [ ] **Step 5: Commit**

```bash
git add src/state/store.tsx src/state/__tests__/store.test.tsx
git commit -m "feat(store): 攻略典藏狀態走 guide: 前綴同步管線"
```

---

### Task 2: `GuideStar` 典藏按鈕元件

**Files:**
- Create: `src/components/GuideStar.tsx`
- Test: `src/components/__tests__/GuideStar.test.tsx`

**Interfaces:**
- Consumes: Task 1 的 `isGuideFav` / `toggleGuideFav`；`useAuth()` 的 `canEdit` / `openLogin`。
- Produces: `export default function GuideStar({ guideId }: { guideId: string })` — 供 Task 3 放進攻略卡標題列。`aria-label="典藏"`，未典藏顯示 `☆`、已典藏顯示 `★`。點擊會 `stopPropagation`（卡片標題列本身是展開/收合的點擊區）。

- [ ] **Step 1: 寫失敗測試**

建立 `src/components/__tests__/GuideStar.test.tsx`（模式仿 `Heart.test.tsx`）：

```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import GuideStar from '../GuideStar';
import { TripStateProvider } from '../../state/store';

const openLogin = vi.fn();
let canEdit = false;
vi.mock('../../state/auth', () => ({
  useAuth: () => ({ canEdit, openLogin }),
}));

function renderStar() {
  return render(<TripStateProvider><GuideStar guideId="大阪美食攻略" /></TripStateProvider>);
}

describe('GuideStar 依登入狀態上鎖', () => {
  beforeEach(() => { localStorage.clear(); openLogin.mockReset(); });
  afterEach(() => cleanup());

  it('未登入：點擊開登入、不切換、不寫本機', () => {
    canEdit = false;
    renderStar();
    const btn = screen.getByRole('button', { name: '典藏' });
    fireEvent.click(btn);
    expect(openLogin).toHaveBeenCalledTimes(1);
    expect(btn.textContent).toBe('☆');
    expect(localStorage.getItem('osaka-trip-state')).toBeNull();
  });

  it('已登入：點擊切換典藏、不開登入', () => {
    canEdit = true;
    renderStar();
    const btn = screen.getByRole('button', { name: '典藏' });
    fireEvent.click(btn);
    expect(openLogin).not.toHaveBeenCalled();
    expect(btn.textContent).toBe('★');
  });

  it('點擊不冒泡到外層（避免觸發卡片展開）', () => {
    canEdit = true;
    const outer = vi.fn();
    render(
      <TripStateProvider>
        <div onClick={outer}><GuideStar guideId="大阪美食攻略" /></div>
      </TripStateProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '典藏' }));
    expect(outer).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/components/__tests__/GuideStar.test.tsx`
Expected: FAIL — 找不到模組 `../GuideStar`。

- [ ] **Step 3: 最小實作**

建立 `src/components/GuideStar.tsx`（沿用 `.heart` 樣式 class，靠字符 ★/☆ 與收藏的 ♥ 區隔，不加新 CSS）：

```tsx
import { useState } from 'react';
import { useAuth } from '../state/auth';
import { useTripState } from '../state/store';

export default function GuideStar({ guideId }: { guideId: string }) {
  const { isGuideFav, toggleGuideFav } = useTripState();
  const { canEdit, openLogin } = useAuth();
  const [pop, setPop] = useState(false);
  const on = isGuideFav(guideId);
  return (
    <button className={`heart${on ? ' heart--on' : ''}${pop ? ' heart--pop' : ''}`} aria-label="典藏"
      style={canEdit ? undefined : { opacity: 0.4 }}
      onAnimationEnd={() => setPop(false)}
      onClick={(e) => {
        e.stopPropagation();
        if (canEdit) { toggleGuideFav(guideId); setPop(true); } else openLogin();
      }}>
      {on ? '★' : '☆'}
    </button>
  );
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/components/__tests__/GuideStar.test.tsx`
Expected: PASS（3 個測試）。

- [ ] **Step 5: Commit**

```bash
git add src/components/GuideStar.tsx src/components/__tests__/GuideStar.test.tsx
git commit -m "feat: GuideStar 攻略典藏按鈕元件"
```

---

### Task 3: 攻略頁整合 — 星星按鈕、典藏置頂、只看典藏

**Files:**
- Modify: `src/pages/Guides.tsx`
- Test: `src/pages/__tests__/Guides.test.tsx`

**Interfaces:**
- Consumes: Task 1 的 `isGuideFav`；Task 2 的 `<GuideStar guideId={...} />`；既有 `Chip` 元件（`src/components/Chip.tsx`，props：`{ on, red?, onClick, children }`）。
- Produces: 無（頁面層，無下游依賴）。

**行為規格：**
- 每張卡標題列在「展開 ▼」左側加 `<GuideStar />`。
- 排序：搜尋/篩選後，已典藏排前（stable sort，各自維持原順序）。
- 篩選鈕 `★ 只看典藏`：`hasFav || onlyFav` 時顯示（`onlyFav` 開啟中即使典藏歸零也要顯示，否則使用者會被鎖在空篩選裡關不掉）；篩選與搜尋取交集；結果為零沿用既有「沒有符合的攻略」空狀態卡。

- [ ] **Step 1: 改寫測試檔（含既有測試的 provider 包裝）**

`Guides` 即將使用 `useTripState`（經 `GuideStar`）＋ `useAuth`，既有測試需要三處配合：(1) data mock 補 `todos: []`（store 頂層 import `todos`，缺了會 crash）；(2) render 包 `TripStateProvider`；(3) mock auth。整檔改寫 `src/pages/__tests__/Guides.test.tsx`：

```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import Guides from '../Guides';
import { TripStateProvider } from '../../state/store';

vi.mock('../../data', () => ({
  guides: [
    { id: 'g1', title: '大阪美食攻略', source: '', sourceUrl: '', body: '本文開頭。中段推薦章魚燒與大阪燒名店。' },
    { id: 'g2', title: '交通懶人包', source: '', sourceUrl: '', body: 'ICOCA 卡使用方式' },
  ],
  entities: [], // search.ts 與 store.tsx 頂層 import，mock 必須提供
  todos: [],    // store.tsx 頂層 import
}));

const openLogin = vi.fn();
vi.mock('../../state/auth', () => ({
  useAuth: () => ({ canEdit: true, openLogin }),
}));

const PLACEHOLDER = '搜尋攻略內容…';

function renderGuides() {
  return render(<TripStateProvider><Guides /></TripStateProvider>);
}

describe('Guides 就地搜尋', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  it('預設收合，點擊標題展開內文', () => {
    const { container } = renderGuides();
    expect(container.querySelector('.guide-body--open')).toBeNull();
    fireEvent.click(screen.getByText('大阪美食攻略'));
    expect(container.querySelector('.guide-body--open')).toBeTruthy();
  });

  it('查詢過濾攻略並顯示符合篇數', () => {
    renderGuides();
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '章魚燒' } });
    expect(screen.getByText('大阪美食攻略')).toBeTruthy();
    expect(screen.queryByText('交通懶人包')).toBeNull();
    expect(screen.getByText('符合 1 篇')).toBeTruthy();
  });

  it('命中卡片標題下顯示 snippet 且命中處標亮', () => {
    const { container } = renderGuides();
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '章魚燒' } });
    const mark = container.querySelector('mark.search-hit');
    expect(mark?.textContent).toBe('章魚燒');
  });

  it('標題命中但內文未命中時不顯示 snippet', () => {
    // 「懶人包」只命中標題後半，標題因標亮被拆成 <span>交通</span><mark>懶人包</mark>
    // 兩個 DOM 節點，getByText 預設不跨元素邊界比對，改用 container.textContent 驗證。
    const { container } = renderGuides();
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '懶人包' } });
    expect(container.textContent).toContain('交通懶人包');
    // body「ICOCA 卡使用方式」不含「懶人包」→ 無 snippet 元素
    expect(screen.queryByTestId('guide-snippet')).toBeNull();
  });

  it('展開命中卡片後內文以 mark 標亮', () => {
    const { container } = renderGuides();
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '章魚燒' } });
    fireEvent.click(screen.getByText('大阪美食攻略'));
    const marks = [...container.querySelectorAll('.guide-body mark.search-hit')].map((m) => m.textContent);
    expect(marks).toContain('章魚燒');
  });

  it('無結果顯示空狀態', () => {
    renderGuides();
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '不存在' } });
    expect(screen.getByText('沒有符合的攻略')).toBeTruthy();
  });
});

describe('Guides 典藏', () => {
  beforeEach(() => { localStorage.clear(); openLogin.mockReset(); });
  afterEach(() => cleanup());

  it('每張卡有典藏按鈕，點擊典藏不觸發卡片展開', () => {
    const { container } = renderGuides();
    const stars = screen.getAllByRole('button', { name: '典藏' });
    expect(stars).toHaveLength(2);
    fireEvent.click(stars[0]);
    expect(container.querySelector('.guide-body--open')).toBeNull();
  });

  it('已典藏的攻略置頂', () => {
    localStorage.setItem('osaka-trip-state', JSON.stringify({ 'guide:g2': true }));
    const { container } = renderGuides();
    const text = container.textContent!;
    expect(text.indexOf('交通懶人包')).toBeLessThan(text.indexOf('大阪美食攻略'));
  });

  it('沒有任何典藏時不顯示「只看典藏」鈕', () => {
    renderGuides();
    expect(screen.queryByText('★ 只看典藏')).toBeNull();
  });

  it('只看典藏：僅顯示已典藏攻略', () => {
    localStorage.setItem('osaka-trip-state', JSON.stringify({ 'guide:g2': true }));
    renderGuides();
    fireEvent.click(screen.getByText('★ 只看典藏'));
    expect(screen.getByText('交通懶人包')).toBeTruthy();
    expect(screen.queryByText('大阪美食攻略')).toBeNull();
  });

  it('只看典藏與搜尋取交集，無交集顯示空狀態', () => {
    localStorage.setItem('osaka-trip-state', JSON.stringify({ 'guide:g2': true }));
    renderGuides();
    fireEvent.click(screen.getByText('★ 只看典藏'));
    // 「章魚燒」只命中未典藏的 g1 → 交集為空
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '章魚燒' } });
    expect(screen.getByText('沒有符合的攻略')).toBeTruthy();
  });

  it('篩選開啟中取消最後一篇典藏：鈕仍在，可關閉篩選', () => {
    localStorage.setItem('osaka-trip-state', JSON.stringify({ 'guide:g2': true }));
    renderGuides();
    fireEvent.click(screen.getByText('★ 只看典藏'));
    // 取消唯一一篇的典藏 → 清單空，但篩選鈕必須還在
    fireEvent.click(screen.getByRole('button', { name: '典藏' }));
    expect(screen.getByText('沒有符合的攻略')).toBeTruthy();
    fireEvent.click(screen.getByText('★ 只看典藏')); // 關閉篩選
    expect(screen.getByText('大阪美食攻略')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/pages/__tests__/Guides.test.tsx`
Expected: 「Guides 典藏」describe 全數 FAIL（找不到典藏按鈕/篩選鈕）；「就地搜尋」describe 應維持 PASS（只是換了包裝）。

- [ ] **Step 3: 實作**

改寫 `src/pages/Guides.tsx`（完整檔案）：

```tsx
import { useMemo, useRef, useState } from 'react';
import { guides } from '../data';
import type { Guide } from '../data/schema';
import MarkdownBody from '../components/MarkdownBody';
import SearchField from '../components/SearchField';
import HitText from '../components/HitText';
import Chip from '../components/Chip';
import GuideStar from '../components/GuideStar';
import { useTripState } from '../state/store';
import { tokenize, matchesTokens, makeSegments, makeSnippet } from '../lib/search';
import { useMarkText } from '../lib/useMarkText';

function GuideCard({ g, tokens, isOpen, onToggle }: {
  g: Guide; tokens: string[]; isOpen: boolean; onToggle: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  useMarkText(bodyRef, tokens, isOpen);
  const snippet = tokens.length > 0 ? makeSnippet(g.body, tokens) : null;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="card-tap" onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '16px 22px', cursor: 'pointer',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="serif" style={{ fontSize: 17, fontWeight: 800 }}>
            <HitText segments={makeSegments(g.title, tokens)} />
          </div>
          {g.source && (
            <div style={{ fontSize: 12, color: 'var(--brown)', marginTop: 3 }}>
              來源：{g.sourceUrl ? (
                <a href={g.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                  {g.source} ↗
                </a>
              ) : g.source}
            </div>
          )}
          {snippet && (
            <div data-testid="guide-snippet" style={{ fontSize: 12.5, color: 'var(--brown-dk)', marginTop: 5 }}>
              <HitText segments={snippet} />
            </div>
          )}
        </div>
        <GuideStar guideId={g.id} />
        <span className="serif" style={{ fontSize: 13, color: 'var(--red)', fontWeight: 700, flex: 'none' }}>
          {isOpen ? '收合 ▲' : '展開 ▼'}
        </span>
      </div>
      <div className={`guide-body${isOpen ? ' guide-body--open' : ''}`} aria-hidden={!isOpen}>
        <div>
          <div ref={bodyRef} className="dash-top" style={{ padding: '2px 22px 18px' }}>
            <MarkdownBody>{g.body}</MarkdownBody>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Guides() {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState('');
  const [onlyFav, setOnlyFav] = useState(false);
  const { isGuideFav } = useTripState();
  const tokens = useMemo(() => tokenize(q), [q]);
  const toggle = (id: string) => setOpen((s) => ({ ...s, [id]: !s[id] }));

  const hasFav = guides.some((g) => isGuideFav(g.id));
  const searched = tokens.length === 0
    ? guides
    : guides.filter((g) => matchesTokens(`${g.title} ${g.body}`, tokens));
  const filtered = onlyFav ? searched.filter((g) => isGuideFav(g.id)) : searched;
  // 典藏置頂；Array.prototype.sort 是 stable sort，各群內維持原順序
  const shown = [...filtered].sort((a, b) => Number(isGuideFav(b.id)) - Number(isGuideFav(a.id)));

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 820 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <SearchField value={q} onChange={setQ} placeholder="搜尋攻略內容…" />
        {(hasFav || onlyFav) && (
          <Chip on={onlyFav} red onClick={() => setOnlyFav((o) => !o)}>★ 只看典藏</Chip>
        )}
        {tokens.length > 0 && (
          <span style={{ fontSize: 12.5, color: 'var(--brown)' }}>符合 {shown.length} 篇</span>
        )}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--brown)' }}>
        別人分享的大阪攻略與清單（來自 Threads／小紅書／Google Maps），僅供參考。
      </div>
      {shown.length === 0 && (
        <div className="card" style={{ padding: '18px 20px', fontSize: 13, color: 'var(--brown)' }}>
          沒有符合的攻略
        </div>
      )}
      {shown.map((g) => (
        <GuideCard key={g.id} g={g} tokens={tokens} isOpen={!!open[g.id]} onToggle={() => toggle(g.id)} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/pages/__tests__/Guides.test.tsx`
Expected: PASS（12 個測試：6 既有 + 6 新增）。

- [ ] **Step 5: Commit**

```bash
git add src/pages/Guides.tsx src/pages/__tests__/Guides.test.tsx
git commit -m "feat(guides): 攻略典藏——星星按鈕、典藏置頂、只看典藏篩選"
```

---

### Task 4: 首頁典藏攻略捷徑卡

**Files:**
- Create: `src/components/GuideFavCard.tsx`
- Modify: `src/pages/Home.tsx`
- Test: `src/components/__tests__/GuideFavCard.test.tsx`

**Interfaces:**
- Consumes: Task 1 的 `guideFavs`（key 格式 `guide:<id>`）；`guides`（`src/data`）。
- Produces: `export default function GuideFavCard()` — 無 props；沒有任何典藏時回傳 `null`（首頁不出現此卡）。

- [ ] **Step 1: 寫失敗測試**

建立 `src/components/__tests__/GuideFavCard.test.tsx`：

```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import GuideFavCard from '../GuideFavCard';
import { TripStateProvider } from '../../state/store';

vi.mock('../../data', () => ({
  guides: [
    { id: 'g1', title: '大阪美食攻略', source: '', sourceUrl: '', body: 'A' },
    { id: 'g2', title: '交通懶人包', source: '', sourceUrl: '', body: 'B' },
  ],
  entities: [], // store.tsx 頂層 import
  todos: [],    // store.tsx 頂層 import
}));

function renderCard() {
  return render(<TripStateProvider><GuideFavCard /></TripStateProvider>);
}

describe('GuideFavCard 首頁典藏攻略', () => {
  beforeEach(() => { localStorage.clear(); location.hash = ''; });
  afterEach(() => cleanup());

  it('沒有任何典藏時不渲染', () => {
    const { container } = renderCard();
    expect(container.firstChild).toBeNull();
  });

  it('列出已典藏攻略標題，未典藏的不顯示', () => {
    localStorage.setItem('osaka-trip-state', JSON.stringify({ 'guide:g2': true }));
    renderCard();
    expect(screen.getByText('典藏攻略')).toBeTruthy();
    expect(screen.getByText('交通懶人包')).toBeTruthy();
    expect(screen.queryByText('大阪美食攻略')).toBeNull();
  });

  it('點擊標題跳到攻略分頁', () => {
    localStorage.setItem('osaka-trip-state', JSON.stringify({ 'guide:g2': true }));
    renderCard();
    fireEvent.click(screen.getByText('交通懶人包'));
    expect(location.hash).toBe('#guides');
  });

  it('取消典藏（值為 false）視同未典藏', () => {
    localStorage.setItem('osaka-trip-state', JSON.stringify({ 'guide:g2': false }));
    const { container } = renderCard();
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/components/__tests__/GuideFavCard.test.tsx`
Expected: FAIL — 找不到模組 `../GuideFavCard`。

- [ ] **Step 3: 實作元件**

建立 `src/components/GuideFavCard.tsx`。注意標題的 ★ 與「典藏攻略」要拆成兩個元素——測試用 `screen.getByText('典藏攻略')` 完整比對，若寫成同一個文字節點 `★ 典藏攻略` 會找不到：

```tsx
import { guides } from '../data';
import { useTripState } from '../state/store';

export default function GuideFavCard() {
  const { guideFavs } = useTripState();
  const favGuides = guides.filter((g) => guideFavs[`guide:${g.id}`]);
  if (favGuides.length === 0) return null;
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ color: 'var(--red)', fontSize: 16 }}>★</span>
        <div className="serif" style={{ fontSize: 18, fontWeight: 700 }}>典藏攻略</div>
        <div style={{ fontSize: 12, color: 'var(--brown)' }}>{favGuides.length} 篇</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
        {favGuides.map((g) => (
          <button key={g.id} className="btn-plain dash-bottom"
            style={{ textAlign: 'left', padding: '9px 4px', fontSize: 13.5, cursor: 'pointer' }}
            onClick={() => { location.hash = 'guides'; }}>
            {g.title}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/components/__tests__/GuideFavCard.test.tsx`
Expected: PASS（4 個測試）。

- [ ] **Step 5: 接進首頁**

修改 `src/pages/Home.tsx`：

(a) import 區（第 6 行 `import WishList...` 之後）加：

```tsx
import GuideFavCard from '../components/GuideFavCard';
```

(b) 在「快速連結」grid 的結尾 `</div>` 與「收藏統計橫幅」`<button className="banner-dark ...">` 之間（原第 114–115 行之間）插入：

```tsx
          <GuideFavCard />
```

（它在右欄 `display:flex; flexDirection:column; gap:16` 容器內，會自動吃到間距；無典藏時回傳 null，首頁維持現狀。）

- [ ] **Step 6: 全套驗證**

Run: `npm test`
Expected: 全部 PASS。

Run: `npm run lint`
Expected: 無錯誤。

Run: `npx tsc -b`
Expected: 無錯誤。

- [ ] **Step 7: Commit**

```bash
git add src/components/GuideFavCard.tsx src/components/__tests__/GuideFavCard.test.tsx src/pages/Home.tsx
git commit -m "feat(home): 首頁典藏攻略捷徑卡"
```

---

## 驗收對照（spec → task）

| Spec 要求 | Task |
| --- | --- |
| `guide:` 前綴走既有同步管線 | Task 1 |
| 典藏按鈕 ★/☆、未登入唯讀鎖、不觸發展開 | Task 2 + Task 3 |
| 已典藏置頂（stable） | Task 3 |
| 只看典藏篩選、與搜尋交集、歸零顯示空狀態 | Task 3 |
| 首頁典藏卡、無典藏隱藏、點擊跳攻略頁 | Task 4 |
| Worker／vault 不動 | 全部（無相關變更） |

# 全站搜尋功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Header 加一個常駐搜尋框，即時搜尋跨分類的實體（餐廳/景點/購物/交通）與攻略，點選結果可跳到對應分頁並捲動、高亮到該項目。

**Architecture:** 純函式搜尋邏輯（`src/lib/search.ts`）+ 展示用元件（`SearchBar.tsx`）+ 共用捲動高亮 hook（`useScrollHighlight.ts`）+ 既有 hash-router（`App.tsx`）擴充成 `tab:anchor` 格式做跨頁導覽。不引入任何新套件、不做後端變更。

**Tech Stack:** React 19 + TypeScript、Vitest + @testing-library/react（jsdom）、既有 CSS 變數風格（無 Tailwind/CSS-in-JS 套件，行內 style 物件）。

## Global Constraints

- 搜尋範圍只涵蓋 `餐廳/景點/購物/交通` 四類實體 + 攻略（guides）；`住宿`/`區域` 完全排除（目前沒有可跳轉、高亮的分類列表頁）。
- 結果上限：實體最多 6 筆（依 `rating` 由高到低排序，`null` 視為 0）；攻略最多 4 筆（維持原順序）。
- 導頁用的 `location.hash` 格式為 `` `${tab}:${encodeURIComponent(anchorId)}` ``，`anchorId` 為 `entity-<id>` 或 `guide-<id>`；解析時必須 `decodeURIComponent`（實體 id 可能含中文與 `/`，直接放進 hash 會被瀏覽器改寫，寫入/讀出都要走 `encodeURIComponent`/`decodeURIComponent` 才能正確還原）。
- 高亮動畫時長固定 1.6 秒（`.search-highlight` class + `searchFlash` keyframes）。
- 不做鍵盤上下鍵導覽、不做 debounce（YAGNI——資料量小，即時同步過濾即可）。
- 元件測試檔一律加 `// @vitest-environment jsdom` pragma（專案預設 test environment 是 `node`，見 `vite.config.ts`），用 `@testing-library/react`，每個 `it` 後 `cleanup()`（沿用 `Heart.test.tsx`/`wishlist.test.tsx` 既有寫法）。
- Lint 用 oxlint，不是 ESLint。
- 涉及 `useAuth()` 的元件（渲染了 `<Heart>` 的頁面）測試一律要 `vi.mock('../../state/auth', ...)`，否則 `useAuth()` 會 throw（見 `src/state/auth.tsx:42`）。

---

### Task 1: 搜尋邏輯 `src/lib/search.ts`

**Files:**
- Create: `src/lib/search.ts`
- Test: `src/lib/__tests__/search.test.ts`

**Interfaces:**
- Produces: `searchAll(query: string): { entities: Entity[]; guides: Guide[] }`（`Entity`/`Guide`型別來自 `src/data/schema.ts`，已存在）。後續 Task 3 的 `SearchBar.tsx` 會 import 這個函式。

- [ ] **Step 1: 寫失敗測試**

Create `src/lib/__tests__/search.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { searchAll } from '../search';

vi.mock('../../data', () => ({
  entities: [
    {
      id: 'e1', category: '餐廳', name: '章魚燒本舖', tags: ['Octopus'], updated: '',
      favorite: false, fields: { 類型: '小吃' }, summary: '道頓堀人氣章魚燒', body: '',
      area: '道頓堀', rating: 4.5,
    },
    {
      id: 'e2', category: '景點', name: '大阪城', tags: [], updated: '', favorite: false,
      fields: {}, summary: '天守閣景觀', body: '', area: '大阪城公園', rating: 4.2,
    },
    {
      id: 'e3', category: '住宿', name: '心齋橋飯店', tags: [], updated: '', favorite: false,
      fields: {}, summary: '住宿地點', body: '', area: '心齋橋', rating: null,
    },
    {
      id: 'e4', category: '區域', name: '梅田區域', tags: [], updated: '', favorite: false,
      fields: {}, summary: '梅田周邊', body: '', area: '梅田', rating: null,
    },
  ],
  guides: [
    { id: 'g1', title: '大阪美食攻略', source: '', sourceUrl: '', body: '推薦章魚燒與大阪燒' },
    { id: 'g2', title: '交通懶人包', source: '', sourceUrl: '', body: 'ICOCA 卡使用方式' },
  ],
}));

describe('searchAll', () => {
  it('依 name 比對成功', () => {
    expect(searchAll('章魚燒').entities.map((e) => e.id)).toEqual(['e1']);
  });

  it('依 summary 比對成功', () => {
    expect(searchAll('天守閣').entities.map((e) => e.id)).toEqual(['e2']);
  });

  it('依 tags 比對且大小寫不敏感', () => {
    expect(searchAll('octopus').entities.map((e) => e.id)).toEqual(['e1']);
  });

  it('依 fields 值比對成功', () => {
    expect(searchAll('小吃').entities.map((e) => e.id)).toEqual(['e1']);
  });

  it('排除住宿與區域分類', () => {
    expect(searchAll('心齋橋飯店').entities).toEqual([]);
    expect(searchAll('梅田區域').entities).toEqual([]);
  });

  it('查詢字串為空或只有空白回傳空陣列', () => {
    expect(searchAll('')).toEqual({ entities: [], guides: [] });
    expect(searchAll('   ')).toEqual({ entities: [], guides: [] });
  });

  it('攻略依 title 比對成功', () => {
    expect(searchAll('美食攻略').guides.map((g) => g.id)).toEqual(['g1']);
  });

  it('攻略依 body 比對成功', () => {
    expect(searchAll('ICOCA').guides.map((g) => g.id)).toEqual(['g2']);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/lib/__tests__/search.test.ts`
Expected: FAIL（`../search` 模組不存在 / `searchAll` undefined）

- [ ] **Step 3: 實作 `searchAll`**

Create `src/lib/search.ts`:

```ts
import { entities, guides } from '../data';
import type { Entity, Guide } from '../data/schema';

const SEARCHABLE_CATEGORIES: readonly Entity['category'][] = ['餐廳', '景點', '購物', '交通'];
const MAX_ENTITIES = 6;
const MAX_GUIDES = 4;

function entityHaystack(e: Entity): string {
  return [e.name, e.summary, e.area, e.tags.join(' '), Object.values(e.fields).join(' ')]
    .join(' ')
    .toLowerCase();
}

function guideHaystack(g: Guide): string {
  return `${g.title} ${g.body}`.toLowerCase();
}

export function searchAll(query: string): { entities: Entity[]; guides: Guide[] } {
  const q = query.trim().toLowerCase();
  if (!q) return { entities: [], guides: [] };

  const matchedEntities = entities
    .filter((e) => SEARCHABLE_CATEGORIES.includes(e.category))
    .filter((e) => entityHaystack(e).includes(q))
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, MAX_ENTITIES);

  const matchedGuides = guides
    .filter((g) => guideHaystack(g).includes(q))
    .slice(0, MAX_GUIDES);

  return { entities: matchedEntities, guides: matchedGuides };
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/lib/__tests__/search.test.ts`
Expected: PASS（8 個測試）

- [ ] **Step 5: Commit**

```bash
git add src/lib/search.ts src/lib/__tests__/search.test.ts
git commit -m "feat(search): 新增跨分類搜尋邏輯 searchAll()"
```

---

### Task 2: 捲動高亮 hook `src/lib/useScrollHighlight.ts`

**Files:**
- Create: `src/lib/useScrollHighlight.ts`
- Test: `src/lib/__tests__/useScrollHighlight.test.ts`
- Modify: `src/styles.css`（新增 highlight 動畫，append 到檔案末尾）

**Interfaces:**
- Produces: `useScrollHighlight(highlightId?: string): void`。Task 5–8 的 `Food`/`Places`/`Transport`/`Guides` 會呼叫這個 hook。

- [ ] **Step 1: 寫失敗測試**

Create `src/lib/__tests__/useScrollHighlight.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useScrollHighlight } from '../useScrollHighlight';

describe('useScrollHighlight', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="target"></div>';
    Element.prototype.scrollIntoView = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('捲動到目標節點並加上高亮 class', () => {
    renderHook(() => useScrollHighlight('target'));
    const el = document.getElementById('target')!;
    expect(el.scrollIntoView).toHaveBeenCalled();
    expect(el.classList.contains('search-highlight')).toBe(true);
  });

  it('1.6 秒後移除高亮 class', () => {
    renderHook(() => useScrollHighlight('target'));
    const el = document.getElementById('target')!;
    vi.advanceTimersByTime(1600);
    expect(el.classList.contains('search-highlight')).toBe(false);
  });

  it('沒有 highlightId 時不動作', () => {
    renderHook(() => useScrollHighlight(undefined));
    const el = document.getElementById('target')!;
    expect(el.scrollIntoView).not.toHaveBeenCalled();
  });

  it('找不到節點時不丟錯誤', () => {
    expect(() => renderHook(() => useScrollHighlight('missing'))).not.toThrow();
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/lib/__tests__/useScrollHighlight.test.ts`
Expected: FAIL（`../useScrollHighlight` 模組不存在）

- [ ] **Step 3: 實作 hook**

Create `src/lib/useScrollHighlight.ts`:

```ts
import { useEffect } from 'react';

export function useScrollHighlight(highlightId?: string): void {
  useEffect(() => {
    if (!highlightId) return;
    const el = document.getElementById(highlightId);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('search-highlight');
    const timer = setTimeout(() => el.classList.remove('search-highlight'), 1600);
    return () => clearTimeout(timer);
  }, [highlightId]);
}
```

- [ ] **Step 4: 加上高亮動畫 CSS**

Append to `src/styles.css` (after line 53, end of file):

```css
@keyframes searchFlash { 0%, 100% { box-shadow: none; } 30% { box-shadow: 0 0 0 3px rgba(178,58,30,.35); } }
.search-highlight { animation: searchFlash 1.6s ease; }
```

- [ ] **Step 5: 執行測試確認通過**

Run: `npx vitest run src/lib/__tests__/useScrollHighlight.test.ts`
Expected: PASS（4 個測試）

- [ ] **Step 6: Commit**

```bash
git add src/lib/useScrollHighlight.ts src/lib/__tests__/useScrollHighlight.test.ts src/styles.css
git commit -m "feat(search): 新增 useScrollHighlight 捲動+高亮 hook"
```

---

### Task 3: 搜尋框元件 `src/components/SearchBar.tsx`

**Files:**
- Create: `src/components/SearchBar.tsx`
- Test: `src/components/__tests__/SearchBar.test.tsx`

**Interfaces:**
- Consumes: `searchAll(query: string): { entities: Entity[]; guides: Guide[] }`（Task 1）；`TabKey`（型別，來自 `src/App.tsx`，目前已存在：`'home' | 'plan' | 'food' | 'places' | 'trans' | 'map' | 'guides'`）。
- Produces: `export default function SearchBar(): JSX.Element`。Task 4 的 `App.tsx` 會 render `<SearchBar />`。

- [ ] **Step 1: 寫失敗測試**

Create `src/components/__tests__/SearchBar.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import SearchBar from '../SearchBar';

vi.mock('../../lib/search', () => ({
  searchAll: (q: string) => {
    if (q === '章魚燒') {
      return {
        entities: [{ id: 'e1', category: '餐廳', name: '章魚燒本舖', summary: '道頓堀人氣小吃' }],
        guides: [],
      };
    }
    if (q === '攻略') {
      return { entities: [], guides: [{ id: 'g1', title: '大阪美食攻略' }] };
    }
    return { entities: [], guides: [] };
  },
}));

const PLACEHOLDER = '搜尋餐廳、景點、購物、交通、攻略…';

describe('SearchBar', () => {
  beforeEach(() => { location.hash = ''; });
  afterEach(() => cleanup());

  it('輸入關鍵字顯示分組下拉結果', () => {
    render(<SearchBar />);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '章魚燒' } });
    expect(screen.getByText('章魚燒本舖')).toBeTruthy();
  });

  it('點選實體結果會設定 location.hash', () => {
    render(<SearchBar />);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '章魚燒' } });
    fireEvent.click(screen.getByText('章魚燒本舖'));
    expect(location.hash).toBe('#food:entity-e1');
  });

  it('點選攻略結果會設定 location.hash', () => {
    render(<SearchBar />);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '攻略' } });
    fireEvent.click(screen.getByText('大阪美食攻略'));
    expect(location.hash).toBe('#guides:guide-g1');
  });

  it('按 Esc 關閉下拉選單', () => {
    render(<SearchBar />);
    const input = screen.getByPlaceholderText(PLACEHOLDER);
    fireEvent.change(input, { target: { value: '章魚燒' } });
    expect(screen.getByText('章魚燒本舖')).toBeTruthy();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByText('章魚燒本舖')).toBeNull();
  });

  it('點擊外部關閉下拉選單', () => {
    render(<div><SearchBar /><div data-testid="outside" /></div>);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '章魚燒' } });
    expect(screen.getByText('章魚燒本舖')).toBeTruthy();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByText('章魚燒本舖')).toBeNull();
  });

  it('查無結果顯示提示文字', () => {
    render(<SearchBar />);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '不存在的東西' } });
    expect(screen.getByText('找不到符合「不存在的東西」的結果')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/components/__tests__/SearchBar.test.tsx`
Expected: FAIL（`../SearchBar` 模組不存在）

- [ ] **Step 3: 實作 SearchBar**

Create `src/components/SearchBar.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { searchAll } from '../lib/search';
import type { Entity } from '../data/schema';
import type { TabKey } from '../App';

const CATEGORY_TAB: Partial<Record<Entity['category'], TabKey>> = {
  餐廳: 'food', 景點: 'places', 購物: 'places', 交通: 'trans',
};

const PLACEHOLDER = '搜尋餐廳、景點、購物、交通、攻略…';

function goTo(tab: TabKey, anchorId: string) {
  location.hash = `${tab}:${encodeURIComponent(anchorId)}`;
}

export default function SearchBar() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { entities, guides } = useMemo(() => searchAll(q), [q]);
  const hasQuery = q.trim().length > 0;

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  function select(tab: TabKey, anchorId: string) {
    goTo(tab, anchorId);
    setQ('');
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') setOpen(false);
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', padding: '0 20px 10px' }}>
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={PLACEHOLDER}
        style={{
          width: '100%', maxWidth: 420, background: 'var(--card)',
          border: '1px solid var(--line-dark)', borderRadius: 8, padding: '10px 14px',
          fontSize: 14, fontFamily: 'inherit', color: 'var(--ink)', outline: 'none',
        }}
      />
      {open && hasQuery && (
        <div style={{
          position: 'absolute', top: '100%', left: 20, right: 20, maxWidth: 420,
          marginTop: 6, background: 'var(--card)', border: '1px solid var(--line-dark)',
          borderRadius: 8, boxShadow: '0 6px 18px rgba(41,35,26,.14)', zIndex: 60,
          maxHeight: 360, overflowY: 'auto', padding: '6px 0',
        }}>
          {entities.length === 0 && guides.length === 0 && (
            <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--brown)' }}>
              找不到符合「{q}」的結果
            </div>
          )}
          {entities.length > 0 && (
            <div>
              <div style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, color: 'var(--brown)', letterSpacing: '.06em' }}>實體</div>
              {entities.map((e) => (
                <button key={e.id} className="btn-plain" style={{ display: 'block', width: '100%', padding: '8px 14px', cursor: 'pointer' }}
                  onClick={() => select(CATEGORY_TAB[e.category]!, `entity-${e.id}`)}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{e.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--navy)' }}>{e.category}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--brown)', marginTop: 2 }}>{e.summary}</div>
                </button>
              ))}
            </div>
          )}
          {guides.length > 0 && (
            <div>
              <div style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, color: 'var(--brown)', letterSpacing: '.06em' }}>攻略</div>
              {guides.map((g) => (
                <button key={g.id} className="btn-plain" style={{ display: 'block', width: '100%', padding: '8px 14px', cursor: 'pointer' }}
                  onClick={() => select('guides', `guide-${g.id}`)}>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{g.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/components/__tests__/SearchBar.test.tsx`
Expected: PASS（6 個測試）

- [ ] **Step 5: Commit**

```bash
git add src/components/SearchBar.tsx src/components/__tests__/SearchBar.test.tsx
git commit -m "feat(search): 新增 SearchBar 全站搜尋下拉元件"
```

---

### Task 4: `App.tsx` 接上 `parseHash` 與 `SearchBar`

**Files:**
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`（新檔，跟 `App.tsx` 同層，比照既有 `countdownDays` 可測試寫法）

**Interfaces:**
- Consumes: `SearchBar`（Task 3，default export）。
- Produces: `export function parseHash(hash: string): { tab: TabKey; anchor?: string }`；`PAGES` 型別放寬為 `Record<TabKey, (props: { highlightId?: string }) => JSX.Element>`。Task 5–8 的頁面元件都要能接受這個 `highlightId` prop。

- [ ] **Step 1: 寫失敗測試**

Create `src/App.test.tsx`:

```ts
import { describe, it, expect } from 'vitest';
import { parseHash } from './App';

describe('parseHash', () => {
  it('純 tab（無冒號）', () => {
    expect(parseHash('#food')).toEqual({ tab: 'food' });
  });

  it('tab:anchor 格式', () => {
    expect(parseHash('#food:entity-abc')).toEqual({ tab: 'food', anchor: 'entity-abc' });
  });

  it('anchor 會 decodeURIComponent（還原中文與斜線）', () => {
    const encoded = encodeURIComponent('entity-餐廳/Bakuro');
    expect(parseHash(`#food:${encoded}`)).toEqual({ tab: 'food', anchor: 'entity-餐廳/Bakuro' });
  });

  it('不合法 tab 預設回 home', () => {
    expect(parseHash('#not-a-tab')).toEqual({ tab: 'home' });
  });

  it('空 hash 預設回 home', () => {
    expect(parseHash('')).toEqual({ tab: 'home' });
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL（`parseHash` 未從 `./App` 匯出）

- [ ] **Step 3: 實作 `parseHash` 並移除 `tabFromHash`**

Modify `src/App.tsx` — 把第 32–35 行（原 `tabFromHash`）連同上面的 `PAGES` 宣告一起換成：

```ts
const PAGES: Record<TabKey, (props: { highlightId?: string }) => JSX.Element> = {
  home: Home, plan: DailyPlan, food: Food, places: Places, trans: Transport, map: AreaMap, guides: Guides,
};

export function parseHash(hash: string): { tab: TabKey; anchor?: string } {
  const raw = hash.replace('#', '');
  const [tabPart, anchorPart] = raw.split(':');
  const tab = (TABS.some(([k]) => k === tabPart) ? tabPart : 'home') as TabKey;
  return anchorPart ? { tab, anchor: decodeURIComponent(anchorPart) } : { tab };
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS（5 個測試）

- [ ] **Step 5: 接上 `anchor` state、`SearchBar`、`highlightId` prop**

Modify `src/App.tsx`：

1. 加 import（放在其他 `./components/*` import 旁）：

```ts
import SearchBar from './components/SearchBar';
```

2. 把 `export default function App() {` 開頭到 `const go = ...` 這段（原第 37–46 行）換成：

```ts
export default function App() {
  const [tab, setTab] = useState<TabKey>(() => parseHash(location.hash).tab);
  const [anchor, setAnchor] = useState<string | undefined>(() => parseHash(location.hash).anchor);
  const { offline } = useTripState();
  const { canEdit, openLogin, logout } = useAuth();
  useEffect(() => {
    const onHash = () => {
      const parsed = parseHash(location.hash);
      setTab(parsed.tab);
      setAnchor(parsed.anchor);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = (k: TabKey) => { location.hash = k; };
```

3. 在標題列 `</div>` 結束、`{apiBase() && (...)}` 開始之前（原第 73–84 行間）插入 `<SearchBar />`：

```tsx
          </div>
        </div>
        <SearchBar />
        {apiBase() && (canEdit ? (
```

4. 把渲染 `<Page key={tab} />` 的那一行（原第 116 行）改成：

```tsx
        <Page key={tab} highlightId={anchor} />
```

- [ ] **Step 6: 跑完整測試與型別檢查確認沒有回歸**

Run: `npm test`
Expected: 所有既有測試（含新增的 `App.test.tsx`）全部 PASS，無編譯錯誤

Run: `npx tsc -b --noEmit`
Expected: 無型別錯誤（確認 `PAGES` 型別放寬後 `Home`/`DailyPlan`/`AreaMap` 這些 `() => JSX.Element` 元件仍可指派給放寬後的型別）

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat(search): App.tsx 接上 parseHash 與 SearchBar，支援 tab:anchor 導頁"
```

---

### Task 5: `Food.tsx` 接上高亮

**Files:**
- Modify: `src/pages/Food.tsx`
- Test: `src/pages/__tests__/Food.test.tsx`（新檔）

**Interfaces:**
- Consumes: `useScrollHighlight(highlightId?: string): void`（Task 2）。
- Produces: `Food` 改為接收 `{ highlightId }: { highlightId?: string }`；卡片 DOM 加上 `id={\`entity-${r.id}\`}`。

- [ ] **Step 1: 寫失敗測試**

Create `src/pages/__tests__/Food.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { TripStateProvider } from '../../state/store';
import Food from '../Food';

vi.mock('../../state/auth', () => ({ useAuth: () => ({ canEdit: true, openLogin: vi.fn() }) }));

const useScrollHighlight = vi.fn();
vi.mock('../../lib/useScrollHighlight', () => ({ useScrollHighlight }));

vi.mock('../../data', () => ({
  byCategory: (cat: string) => (cat === '餐廳' ? [{
    id: 'e1', category: '餐廳', name: '章魚燒本舖', tags: [], updated: '', favorite: false,
    fields: {}, summary: '道頓堀人氣小吃', body: '', area: '道頓堀', rating: 4.5,
  }] : []),
}));

describe('Food 接上搜尋高亮', () => {
  afterEach(() => cleanup());

  it('卡片有 entity-<id> 的 DOM id', () => {
    const { container } = render(<TripStateProvider><Food /></TripStateProvider>);
    expect(container.querySelector('#entity-e1')).toBeTruthy();
  });

  it('把 highlightId 傳給 useScrollHighlight', () => {
    render(<TripStateProvider><Food highlightId="entity-e1" /></TripStateProvider>);
    expect(useScrollHighlight).toHaveBeenCalledWith('entity-e1');
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/pages/__tests__/Food.test.tsx`
Expected: FAIL（找不到 `#entity-e1`；`useScrollHighlight` 未被呼叫）

- [ ] **Step 3: 修改 `Food.tsx`**

Modify `src/pages/Food.tsx`：

1. 加 import（在 `import { useTripState } from '../state/store';` 後面）：

```ts
import { useScrollHighlight } from '../lib/useScrollHighlight';
```

2. 函式簽名（原第 9 行）：

```ts
export default function Food({ highlightId }: { highlightId?: string }) {
```

3. 在 `const { favs } = useTripState();` 後面加一行：

```ts
  useScrollHighlight(highlightId);
```

4. 卡片 `div`（原第 49 行）加上 `id`：

```tsx
            <div key={r.id} id={`entity-${r.id}`} className="card" style={{ padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/pages/__tests__/Food.test.tsx`
Expected: PASS（2 個測試）

- [ ] **Step 5: Commit**

```bash
git add src/pages/Food.tsx src/pages/__tests__/Food.test.tsx
git commit -m "feat(search): Food 頁面接上搜尋高亮"
```

---

### Task 6: `Places.tsx` 接上高亮

**Files:**
- Modify: `src/pages/Places.tsx`
- Test: `src/pages/__tests__/Places.test.tsx`（新檔）

**Interfaces:**
- Consumes: `useScrollHighlight(highlightId?: string): void`（Task 2）。
- Produces: `Places` 改為接收 `{ highlightId }: { highlightId?: string }`；景點與購物兩個 section 的卡片 DOM 都加上 `id={\`entity-${p.id}\`}`。

- [ ] **Step 1: 寫失敗測試**

Create `src/pages/__tests__/Places.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { TripStateProvider } from '../../state/store';
import Places from '../Places';

vi.mock('../../state/auth', () => ({ useAuth: () => ({ canEdit: true, openLogin: vi.fn() }) }));

const useScrollHighlight = vi.fn();
vi.mock('../../lib/useScrollHighlight', () => ({ useScrollHighlight }));

vi.mock('../../data', () => ({
  byCategory: (cat: string) => {
    if (cat === '景點') return [{
      id: 'p1', category: '景點', name: '大阪城', tags: [], updated: '', favorite: false,
      fields: {}, summary: '天守閣景觀', body: '', area: '大阪城公園', rating: 4.2,
    }];
    if (cat === '購物') return [{
      id: 's1', category: '購物', name: '心齋橋筋商店街', tags: [], updated: '', favorite: false,
      fields: {}, summary: '', body: '', area: '心齋橋', rating: null,
    }];
    return [];
  },
}));

describe('Places 接上搜尋高亮', () => {
  afterEach(() => cleanup());

  it('景點與購物卡片都有 entity-<id> 的 DOM id', () => {
    const { container } = render(<TripStateProvider><Places /></TripStateProvider>);
    expect(container.querySelector('#entity-p1')).toBeTruthy();
    expect(container.querySelector('#entity-s1')).toBeTruthy();
  });

  it('把 highlightId 傳給 useScrollHighlight', () => {
    render(<TripStateProvider><Places highlightId="entity-s1" /></TripStateProvider>);
    expect(useScrollHighlight).toHaveBeenCalledWith('entity-s1');
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/pages/__tests__/Places.test.tsx`
Expected: FAIL

- [ ] **Step 3: 修改 `Places.tsx`**

Modify `src/pages/Places.tsx`：

1. 加 import（檔案最上方）：

```ts
import { useScrollHighlight } from '../lib/useScrollHighlight';
```

2. 函式簽名（原第 6 行）：

```ts
export default function Places({ highlightId }: { highlightId?: string }) {
```

3. 在 `const shops = byCategory('購物');` 後面加一行：

```ts
  useScrollHighlight(highlightId);
```

4. 景點卡片 `div`（原第 19 行）加上 `id`：

```tsx
            <div key={p.id} id={`entity-${p.id}`} className="card" style={{ padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
```

5. 購物卡片 `div`（原第 46 行）加上 `id`：

```tsx
            <div key={p.id} id={`entity-${p.id}`} className="card" style={{ padding: '16px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/pages/__tests__/Places.test.tsx`
Expected: PASS（2 個測試）

- [ ] **Step 5: Commit**

```bash
git add src/pages/Places.tsx src/pages/__tests__/Places.test.tsx
git commit -m "feat(search): Places 頁面接上搜尋高亮"
```

---

### Task 7: `Transport.tsx` 接上高亮

**Files:**
- Modify: `src/pages/Transport.tsx`
- Test: `src/pages/__tests__/Transport.test.tsx`（新檔）

**Interfaces:**
- Consumes: `useScrollHighlight(highlightId?: string): void`（Task 2）。
- Produces: `Transport` 改為接收 `{ highlightId }: { highlightId?: string }`；卡片 DOM 加上 `id={\`entity-${t.id}\`}`。

- [ ] **Step 1: 寫失敗測試**

Create `src/pages/__tests__/Transport.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import Transport from '../Transport';

const useScrollHighlight = vi.fn();
vi.mock('../../lib/useScrollHighlight', () => ({ useScrollHighlight }));

vi.mock('../../data', () => ({
  byCategory: () => [{
    id: 't1', category: '交通', name: 'ICOCA 卡', tags: [], updated: '', favorite: false,
    fields: {}, summary: '西日本 IC 卡', body: '## 基本資訊\n備註\n## 來源\nx', area: '', rating: null,
  }],
}));

describe('Transport 接上搜尋高亮', () => {
  afterEach(() => cleanup());

  it('卡片有 entity-<id> 的 DOM id', () => {
    const { container } = render(<Transport />);
    expect(container.querySelector('#entity-t1')).toBeTruthy();
  });

  it('把 highlightId 傳給 useScrollHighlight', () => {
    render(<Transport highlightId="entity-t1" />);
    expect(useScrollHighlight).toHaveBeenCalledWith('entity-t1');
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/pages/__tests__/Transport.test.tsx`
Expected: FAIL

- [ ] **Step 3: 修改 `Transport.tsx`**

Modify `src/pages/Transport.tsx`：

1. 加 import（檔案最上方）：

```ts
import { useScrollHighlight } from '../lib/useScrollHighlight';
```

2. 函式簽名（原第 6 行）：

```ts
export default function Transport({ highlightId }: { highlightId?: string }) {
```

3. 在 `const items = byCategory('交通');` 後面加一行：

```ts
  useScrollHighlight(highlightId);
```

4. 卡片 `div`（原第 11 行）加上 `id`：

```tsx
        <div key={t.id} id={`entity-${t.id}`} className="card" style={{ padding: 0, overflow: 'hidden' }}>
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/pages/__tests__/Transport.test.tsx`
Expected: PASS（2 個測試）

- [ ] **Step 5: Commit**

```bash
git add src/pages/Transport.tsx src/pages/__tests__/Transport.test.tsx
git commit -m "feat(search): Transport 頁面接上搜尋高亮"
```

---

### Task 8: `Guides.tsx` 接上高亮並自動展開

**Files:**
- Modify: `src/pages/Guides.tsx`
- Test: `src/pages/__tests__/Guides.test.tsx`（新檔）

**Interfaces:**
- Consumes: `useScrollHighlight(highlightId?: string): void`（Task 2）。
- Produces: `Guides` 改為接收 `{ highlightId }: { highlightId?: string }`；卡片 DOM 加上 `id={\`guide-${g.id}\`}`；`highlightId` 以 `guide-` 開頭時自動展開對應攻略內文。

- [ ] **Step 1: 寫失敗測試**

Create `src/pages/__tests__/Guides.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import Guides from '../Guides';

const useScrollHighlight = vi.fn();
vi.mock('../../lib/useScrollHighlight', () => ({ useScrollHighlight }));

vi.mock('../../data', () => ({
  guides: [
    { id: 'g1', title: '大阪美食攻略', source: '', sourceUrl: '', body: '推薦章魚燒' },
    { id: 'g2', title: '交通懶人包', source: '', sourceUrl: '', body: 'ICOCA 卡使用方式' },
  ],
}));

describe('Guides 接上搜尋高亮', () => {
  afterEach(() => cleanup());

  it('卡片有 guide-<id> 的 DOM id，預設收合', () => {
    const { container } = render(<Guides />);
    expect(container.querySelector('#guide-g1')).toBeTruthy();
    expect(screen.queryByText('推薦章魚燒')).toBeNull();
  });

  it('highlightId 對應攻略時自動展開並呼叫 useScrollHighlight', () => {
    render(<Guides highlightId="guide-g1" />);
    expect(screen.getByText('推薦章魚燒')).toBeTruthy();
    expect(useScrollHighlight).toHaveBeenCalledWith('guide-g1');
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/pages/__tests__/Guides.test.tsx`
Expected: FAIL

- [ ] **Step 3: 修改 `Guides.tsx`**

Replace the full content of `src/pages/Guides.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import { guides } from '../data';
import MarkdownBody from '../components/MarkdownBody';
import { useScrollHighlight } from '../lib/useScrollHighlight';

export default function Guides({ highlightId }: { highlightId?: string }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setOpen((s) => ({ ...s, [id]: !s[id] }));

  useEffect(() => {
    if (highlightId?.startsWith('guide-')) {
      const id = highlightId.slice('guide-'.length);
      setOpen((s) => ({ ...s, [id]: true }));
    }
  }, [highlightId]);
  useScrollHighlight(highlightId);

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 820 }}>
      <div style={{ fontSize: 12.5, color: 'var(--brown)' }}>
        別人分享的大阪攻略與清單（來自 Threads／小紅書／Google Maps），僅供參考。
      </div>
      {guides.map((g) => {
        const isOpen = !!open[g.id];
        return (
          <div key={g.id} id={`guide-${g.id}`} className="card" style={{ padding: 0, overflow: 'hidden' }}>
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
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/pages/__tests__/Guides.test.tsx`
Expected: PASS（2 個測試）

- [ ] **Step 5: Commit**

```bash
git add src/pages/Guides.tsx src/pages/__tests__/Guides.test.tsx
git commit -m "feat(search): Guides 頁面接上搜尋高亮並自動展開"
```

---

### Task 9: 全量回歸與手動驗證

**Files:** 無新檔案（純驗證）

- [ ] **Step 1: 跑完整測試、型別檢查、lint**

Run: `npm test`
Expected: 全部 PASS（含 Task 1–8 新增的所有測試）

Run: `npx tsc -b --noEmit`
Expected: 無型別錯誤

Run: `npm run lint`
Expected: 無 oxlint 錯誤

- [ ] **Step 2: 啟動開發伺服器手動驗證**

Run: `npm run dev`

在瀏覽器打開顯示的網址，操作並確認：
1. Header 常駐搜尋框可見，輸入「章魚」等關鍵字後即時出現分組下拉結果（實體／攻略）
2. 點選一筆實體結果 → 分頁切換到對應 tab（食/景點購物/交通），且該卡片捲動進畫面並短暫出現紅色高亮框
3. 點選一筆攻略結果 → 切到攻略分頁，該攻略自動展開內文並高亮
4. 輸入完全查無結果的字串 → 顯示「找不到符合...的結果」
5. 按 Esc 或點擊搜尋框外部 → 下拉選單收起
6. 搜尋「心齋橋」（住宿或區域相關關鍵字，若剛好命中住宿/區域資料）確認結果中不包含住宿／區域類型

- [ ] **Step 3: 確認無殘留變更**

Run: `git status`
Expected: working tree clean（Task 1–8 已個別 commit，本 Task 純驗證不產生新變更）

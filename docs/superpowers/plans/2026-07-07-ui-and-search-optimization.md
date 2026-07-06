# UI 介面與搜尋優化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除全站搜尋，改為美食庫／景點・購物／攻略三頁就地搜尋（含美食分類建議、命中標亮、攻略 snippet 與內文標記）；header 捲動收合成細列；8 項手機視覺打磨。

**Architecture:** 純函式搜尋工具（`src/lib/search.ts` 重寫）+ 共用元件（`SearchField`/`HitText`）+ 兩個 hook（`useMarkText` DOM 標亮、`useCondensedHeader` 位置門檻收合）+ header 抽成 `Header.tsx`。先整組移除舊全站搜尋管線再蓋新的。規格見 `docs/superpowers/specs/2026-07-07-ui-and-search-optimization-design.md`。

**Tech Stack:** React 19 + TypeScript、Vitest + @testing-library/react（jsdom）、oxlint、CSS 變數 + 行內 style（無 CSS 框架）、零新依賴。

## Global Constraints

- **零新依賴**：不引入任何 npm 套件。
- **比對一律 `toLowerCase` + `indexOf`/`includes` 子字串**，不得把使用者輸入組成 regex（含 `(`、`[` 的查詢不能炸）；分詞用的固定 regex（`/[\s　]+/`）不在此限。
- 元件測試檔一律加 `// @vitest-environment jsdom` pragma（專案預設 test environment 是 `node`），用 `@testing-library/react`，每個測試後 `cleanup()`。
- 渲染了 `<Heart>` 或用到 `useAuth()` 的元件測試一律 `vi.mock('../../state/auth', () => ({ useAuth: () => ({ canEdit: true, openLogin: vi.fn() }) }))`，否則 `useAuth()` 會 throw。
- Lint 用 oxlint（`npm run lint`），不是 ESLint。
- 視覺底線：延續紙質風（`--card` 底、細線框、柔和陰影），不加新顏色、不加圖示雜訊；標亮用淡金 `rgba(232,180,74,.28)`，不用螢光色。
- 不動 `worker/`、不動 `scripts/`、不動資料 JSON。
- 執行單一測試檔：`npx vitest run <路徑>`。

---

### Task 1: 移除全站搜尋管線

**Files:**
- Delete: `src/components/SearchBar.tsx`、`src/components/__tests__/SearchBar.test.tsx`
- Delete: `src/lib/useScrollHighlight.ts`、`src/lib/__tests__/useScrollHighlight.test.ts`
- Delete: `src/lib/search.ts`、`src/lib/__tests__/search.test.ts`（Task 2 全新重寫）
- Delete: `src/pages/__tests__/Transport.test.tsx`（只測高亮，交通頁不做搜尋）
- Modify: `src/App.tsx`、`src/App.test.tsx`
- Modify: `src/pages/Food.tsx`、`src/pages/Places.tsx`、`src/pages/Transport.tsx`、`src/pages/Guides.tsx`
- Modify: `src/pages/__tests__/Food.test.tsx`、`src/pages/__tests__/Places.test.tsx`、`src/pages/__tests__/Guides.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: `parseHash(hash: string): TabKey`（回傳值從物件改為純 `TabKey`）；四個頁面元件簽名退回 `() => JSX.Element`（不再收 `highlightId`）。後續所有 Task 以此為基線。

- [ ] **Step 1: 改寫 `src/App.test.tsx` 為新的 parseHash 期望**

整檔換成：

```ts
import { describe, it, expect } from 'vitest';
import { parseHash } from './App';

describe('parseHash', () => {
  it('合法 tab', () => {
    expect(parseHash('#food')).toBe('food');
  });

  it('空 hash 回 home', () => {
    expect(parseHash('')).toBe('home');
  });

  it('不合法 tab 回 home', () => {
    expect(parseHash('#not-a-tab')).toBe('home');
  });

  it('舊 tab:anchor 格式回 home（跳轉管線已移除）', () => {
    expect(parseHash('#food:entity-abc')).toBe('home');
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL（`parseHash('#food')` 目前回傳 `{ tab: 'food' }` 物件，不是字串）

- [ ] **Step 3: 刪除舊檔**

```bash
git rm src/components/SearchBar.tsx src/components/__tests__/SearchBar.test.tsx
git rm src/lib/useScrollHighlight.ts src/lib/__tests__/useScrollHighlight.test.ts
git rm src/lib/search.ts src/lib/__tests__/search.test.ts
git rm src/pages/__tests__/Transport.test.tsx
```

- [ ] **Step 4: 改 `src/App.tsx`**

1. 移除 import：`import SearchBar from './components/SearchBar';`
2. `PAGES` 與 `parseHash` 換成：

```ts
const PAGES: Record<TabKey, () => JSX.Element> = {
  home: Home, plan: DailyPlan, food: Food, places: Places, trans: Transport, map: AreaMap, guides: Guides,
};

export function parseHash(hash: string): TabKey {
  const raw = hash.replace('#', '');
  return (TABS.some(([k]) => k === raw) ? raw : 'home') as TabKey;
}
```

3. `App()` 開頭的 state 與 hashchange 監聽換成（移除 `anchor`）：

```ts
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
```

4. 刪掉 header 中的 `<SearchBar />` 那一行。
5. 渲染行改回：`<Page key={tab} />`

- [ ] **Step 5: 改四個頁面**

`src/pages/Food.tsx`：
1. 刪 import：`import { useScrollHighlight } from '../lib/useScrollHighlight';`
2. 簽名改回：`export default function Food() {`
3. 刪：`useScrollHighlight(highlightId);`
4. 卡片 div 移除 id：`<div key={r.id} className="card" style={{ padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>`

`src/pages/Places.tsx`：同樣刪 import、簽名改 `export default function Places() {`、刪 `useScrollHighlight(highlightId);`、兩處卡片 div 移除 `id={\`entity-${p.id}\`}`。

`src/pages/Transport.tsx`：同樣刪 import、簽名改 `export default function Transport() {`、刪 `useScrollHighlight(highlightId);`、卡片 div 移除 `id={\`entity-${t.id}\`}`。

`src/pages/Guides.tsx`：
1. 刪 import：`useScrollHighlight`；`useEffect` 若因此沒人用就從 react import 一併移除
2. 簽名改回：`export default function Guides() {`
3. 刪整段 highlightId 自動展開 effect（`useEffect(() => { if (highlightId?.startsWith('guide-')) ... }, [highlightId]);`）與 `useScrollHighlight(highlightId);`
4. 卡片 div 移除 `id={\`guide-${g.id}\`}`

- [ ] **Step 6: 改三個頁面測試（移除高亮測試，留渲染冒煙測試）**

`src/pages/__tests__/Food.test.tsx` 整檔換成：

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TripStateProvider } from '../../state/store';
import Food from '../Food';

vi.mock('../../state/auth', () => ({ useAuth: () => ({ canEdit: true, openLogin: vi.fn() }) }));

vi.mock('../../data', () => ({
  byCategory: (cat: string) => (cat === '餐廳' ? [{
    id: 'e1', category: '餐廳', name: '章魚燒本舖', tags: [], updated: '', favorite: false,
    fields: { 類型: '小吃' }, summary: '道頓堀人氣小吃', body: '', area: '道頓堀', rating: 4.5,
  }] : []),
}));

describe('Food', () => {
  afterEach(() => cleanup());

  it('渲染店家卡片', () => {
    render(<TripStateProvider><Food /></TripStateProvider>);
    expect(screen.getByText('章魚燒本舖')).toBeTruthy();
  });
});
```

`src/pages/__tests__/Places.test.tsx` 整檔換成：

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TripStateProvider } from '../../state/store';
import Places from '../Places';

vi.mock('../../state/auth', () => ({ useAuth: () => ({ canEdit: true, openLogin: vi.fn() }) }));

vi.mock('../../data', () => ({
  byCategory: (cat: string) => {
    if (cat === '景點') return [{
      id: 'p1', category: '景點', name: '大阪城', tags: [], updated: '', favorite: false,
      fields: {}, summary: '天守閣景觀', body: '', area: '大阪城公園', rating: 4.2,
    }];
    if (cat === '購物') return [{
      id: 's1', category: '購物', name: '心齋橋筋商店街', tags: [], updated: '', favorite: false,
      fields: {}, summary: '藥妝與伴手禮', body: '', area: '心齋橋', rating: null,
    }];
    return [];
  },
}));

describe('Places', () => {
  afterEach(() => cleanup());

  it('渲染景點與購物卡片', () => {
    render(<TripStateProvider><Places /></TripStateProvider>);
    expect(screen.getByText('大阪城')).toBeTruthy();
    expect(screen.getByText('心齋橋筋商店街')).toBeTruthy();
  });
});
```

`src/pages/__tests__/Guides.test.tsx` 整檔換成：

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import Guides from '../Guides';

vi.mock('../../data', () => ({
  guides: [
    { id: 'g1', title: '大阪美食攻略', source: '', sourceUrl: '', body: '推薦章魚燒' },
    { id: 'g2', title: '交通懶人包', source: '', sourceUrl: '', body: 'ICOCA 卡使用方式' },
  ],
}));

describe('Guides', () => {
  afterEach(() => cleanup());

  it('預設收合，點擊標題展開內文', () => {
    render(<Guides />);
    expect(screen.queryByText('推薦章魚燒')).toBeNull();
    fireEvent.click(screen.getByText('大阪美食攻略'));
    expect(screen.getByText('推薦章魚燒')).toBeTruthy();
  });
});
```

- [ ] **Step 7: 移除 `src/styles.css` 的高亮動畫**

刪掉檔案末尾這兩行：

```css
@keyframes searchFlash { 0%, 100% { box-shadow: none; } 30% { box-shadow: 0 0 0 3px rgba(178,58,30,.35); } }
.search-highlight { animation: searchFlash 1.6s ease; }
```

- [ ] **Step 8: 全量驗證**

Run: `npm test`
Expected: 全部 PASS（含改寫後的 App.test 與三個頁面測試）

Run: `npx tsc -b --noEmit`
Expected: 無型別錯誤

Run: `npm run lint`
Expected: 無 oxlint 錯誤

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(search): 移除全站搜尋管線（SearchBar/跳轉高亮/anchor hash）"
```

---

### Task 2: 搜尋純函式 `src/lib/search.ts` 重寫

**Files:**
- Create: `src/lib/search.ts`
- Test: `src/lib/__tests__/search.test.ts`

**Interfaces:**
- Consumes: `Entity` 型別（`src/data/schema.ts`，已存在）；`entities`（`src/data`，僅 `suggestFoodTypes` 用）。
- Produces（後續 Task 3–7 依賴，簽名固定）:
  - `export type Segment = { text: string; hit: boolean }`
  - `tokenize(query: string): string[]`
  - `matchesTokens(haystack: string, tokens: string[]): boolean`
  - `scoreEntity(e: Entity, tokens: string[]): number`
  - `suggestFoodTypes(query: string): { type: string; count: number }[]`
  - `makeSegments(text: string, tokens: string[]): Segment[]`
  - `makeSnippet(text: string, tokens: string[], radius?: number): Segment[] | null`

- [ ] **Step 1: 寫失敗測試**

Create `src/lib/__tests__/search.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import {
  tokenize, matchesTokens, scoreEntity, suggestFoodTypes, makeSegments, makeSnippet,
} from '../search';
import type { Entity } from '../../data/schema';

vi.mock('../../data', () => ({
  entities: [
    { id: 'r1', category: '餐廳', name: 'Bakuro', tags: [], updated: '', favorite: false,
      fields: { 類型: '關東煮' }, summary: '', body: '', area: '', rating: 4.4 },
    { id: 'r2', category: '餐廳', name: '花',  tags: [], updated: '', favorite: false,
      fields: { 類型: '關東煮' }, summary: '', body: '', area: '', rating: 4.1 },
    { id: 'r3', category: '餐廳', name: '鳥貴族', tags: [], updated: '', favorite: false,
      fields: { 類型: '日式串燒' }, summary: '', body: '', area: '', rating: 3.9 },
    { id: 'r4', category: '餐廳', name: '無類型店', tags: [], updated: '', favorite: false,
      fields: {}, summary: '', body: '', area: '', rating: null },
    { id: 'p1', category: '景點', name: '大阪城', tags: [], updated: '', favorite: false,
      fields: { 類型: '關東煮' }, summary: '', body: '', area: '', rating: null },
  ],
}));

function ent(over: Partial<Entity>): Entity {
  return {
    id: 'x', category: '餐廳', name: '', tags: [], updated: '', favorite: false,
    fields: {}, summary: '', body: '', area: '', rating: null, ...over,
  };
}

describe('tokenize', () => {
  it('半形與全形空白分詞並小寫化', () => {
    expect(tokenize('道頓堀　Ramen 拉麵')).toEqual(['道頓堀', 'ramen', '拉麵']);
  });
  it('空字串與全空白回空陣列', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('  　 ')).toEqual([]);
  });
});

describe('matchesTokens', () => {
  it('AND：全部命中才 true', () => {
    expect(matchesTokens('道頓堀的一蘭拉麵', ['道頓堀', '拉麵'])).toBe(true);
    expect(matchesTokens('道頓堀的一蘭拉麵', ['道頓堀', '燒肉'])).toBe(false);
  });
  it('大小寫不敏感', () => {
    expect(matchesTokens('ICOCA 卡', ['icoca'])).toBe(true);
  });
});

describe('scoreEntity', () => {
  it('名稱命中權重最高', () => {
    const byName = scoreEntity(ent({ name: '一蘭拉麵' }), ['拉麵']);
    const bySummary = scoreEntity(ent({ summary: '拉麵名店' }), ['拉麵']);
    const byField = scoreEntity(ent({ fields: { 類型: '拉麵' } }), ['拉麵']);
    expect(byName).toBe(100);
    expect(bySummary).toBe(30);
    expect(byField).toBe(20);
    expect(byName).toBeGreaterThan(bySummary);
    expect(bySummary).toBeGreaterThan(byField);
  });
  it('多 token 分數加總', () => {
    const e = ent({ name: '一蘭拉麵', area: '道頓堀' });
    expect(scoreEntity(e, ['拉麵', '道頓堀'])).toBe(150);
  });
  it('任一 token 未命中回 0', () => {
    expect(scoreEntity(ent({ name: '一蘭拉麵' }), ['拉麵', '燒肉'])).toBe(0);
  });
  it('特殊字元不會炸', () => {
    expect(scoreEntity(ent({ name: 'a(b)c' }), ['(b)'])).toBe(100);
  });
});

describe('suggestFoodTypes', () => {
  it('子字串命中類型並計數、依數量排序', () => {
    expect(suggestFoodTypes('關東')).toEqual([{ type: '關東煮', count: 2 }]);
  });
  it('多類型命中時依 count 降冪', () => {
    expect(suggestFoodTypes('煮 串')).toEqual([]); // AND：沒有類型同時含「煮」「串」
    expect(suggestFoodTypes('日式')).toEqual([{ type: '日式串燒', count: 1 }]);
  });
  it('只算餐廳分類', () => {
    // p1 是景點但類型也是關東煮，不能算進 count
    expect(suggestFoodTypes('關東煮')[0].count).toBe(2);
  });
  it('空查詢回空陣列', () => {
    expect(suggestFoodTypes('  ')).toEqual([]);
  });
});

describe('makeSegments', () => {
  it('命中片段標 hit，其餘不標', () => {
    expect(makeSegments('道頓堀拉麵店', ['拉麵'])).toEqual([
      { text: '道頓堀', hit: false },
      { text: '拉麵', hit: true },
      { text: '店', hit: false },
    ]);
  });
  it('多 token 與重疊範圍合併', () => {
    expect(makeSegments('AABBA', ['aab', 'bb'])).toEqual([
      { text: 'AABB', hit: true },
      { text: 'A', hit: false },
    ]);
  });
  it('無命中回單一非 hit 片段', () => {
    expect(makeSegments('大阪城', ['拉麵'])).toEqual([{ text: '大阪城', hit: false }]);
  });
  it('空 tokens 回單一非 hit 片段', () => {
    expect(makeSegments('大阪城', [])).toEqual([{ text: '大阪城', hit: false }]);
  });
});

describe('makeSnippet', () => {
  it('擷取命中前後文並標亮，前後截斷加省略號', () => {
    const text = 'A'.repeat(30) + '拉麵' + 'B'.repeat(30);
    const segs = makeSnippet(text, ['拉麵'], 5)!;
    expect(segs[0]).toEqual({ text: '…', hit: false });
    expect(segs.some((s) => s.hit && s.text === '拉麵')).toBe(true);
    expect(segs[segs.length - 1]).toEqual({ text: '…', hit: false });
  });
  it('markdown 語法清乾淨', () => {
    const md = '## 標題\n![圖](http://x/i.png)\n[一蘭拉麵](http://x)推薦 | 表格';
    const segs = makeSnippet(md, ['拉麵'])!;
    const joined = segs.map((s) => s.text).join('');
    expect(joined).not.toContain('##');
    expect(joined).not.toContain('](');
    expect(joined).not.toContain('|');
    expect(joined).toContain('一蘭拉麵');
  });
  it('無命中回 null', () => {
    expect(makeSnippet('大阪城', ['拉麵'])).toBeNull();
  });
  it('空 tokens 回 null', () => {
    expect(makeSnippet('大阪城', [])).toBeNull();
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/lib/__tests__/search.test.ts`
Expected: FAIL（`../search` 模組不存在）

- [ ] **Step 3: 實作 `src/lib/search.ts`**

```ts
import { entities } from '../data';
import type { Entity } from '../data/schema';

export type Segment = { text: string; hit: boolean };

export function tokenize(query: string): string[] {
  return query.toLowerCase().split(/[\s　]+/).filter(Boolean);
}

export function matchesTokens(haystack: string, tokens: string[]): boolean {
  const lower = haystack.toLowerCase();
  return tokens.every((t) => lower.includes(t));
}

const ENTITY_WEIGHTS: [(e: Entity) => string, number][] = [
  [(e) => e.name, 100],
  [(e) => e.tags.join(' '), 60],
  [(e) => e.area, 50],
  [(e) => e.summary, 30],
  [(e) => Object.values(e.fields).join(' '), 20],
];

export function scoreEntity(e: Entity, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const parts = ENTITY_WEIGHTS.map(([get, w]) => [get(e).toLowerCase(), w] as const);
  let total = 0;
  for (const t of tokens) {
    let best = 0;
    for (const [s, w] of parts) {
      if (w > best && s.includes(t)) best = w;
    }
    if (best === 0) return 0;
    total += best;
  }
  return total;
}

export function suggestFoodTypes(query: string): { type: string; count: number }[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const counts = new Map<string, number>();
  for (const e of entities) {
    if (e.category !== '餐廳') continue;
    const type = e.fields['類型'];
    if (!type) continue;
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([type]) => matchesTokens(type, tokens))
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

export function makeSegments(text: string, tokens: string[]): Segment[] {
  if (!text || tokens.length === 0) return [{ text, hit: false }];
  const lower = text.toLowerCase();
  const ranges: [number, number][] = [];
  for (const t of tokens) {
    let i = lower.indexOf(t);
    while (i !== -1) {
      ranges.push([i, i + t.length]);
      i = lower.indexOf(t, i + t.length);
    }
  }
  if (ranges.length === 0) return [{ text, hit: false }];
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [ranges[0].slice() as [number, number]];
  for (const r of ranges.slice(1)) {
    const last = merged[merged.length - 1];
    if (r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push(r.slice() as [number, number]);
  }
  const out: Segment[] = [];
  let pos = 0;
  for (const [s, e] of merged) {
    if (s > pos) out.push({ text: text.slice(pos, s), hit: false });
    out.push({ text: text.slice(s, e), hit: true });
    pos = e;
  }
  if (pos < text.length) out.push({ text: text.slice(pos), hit: false });
  return out;
}

const plainCache = new Map<string, string>();

function plainify(md: string): string {
  const cached = plainCache.get(md);
  if (cached !== undefined) return cached;
  const plain = md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/[|`*_>#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  plainCache.set(md, plain);
  return plain;
}

export function makeSnippet(text: string, tokens: string[], radius = 18): Segment[] | null {
  if (tokens.length === 0) return null;
  const plain = plainify(text);
  const lower = plain.toLowerCase();
  let first = -1;
  let firstLen = 0;
  for (const t of tokens) {
    const i = lower.indexOf(t);
    if (i !== -1 && (first === -1 || i < first)) {
      first = i;
      firstLen = t.length;
    }
  }
  if (first === -1) return null;
  const start = Math.max(0, first - radius);
  const end = Math.min(plain.length, first + firstLen + radius);
  const out: Segment[] = [];
  if (start > 0) out.push({ text: '…', hit: false });
  out.push(...makeSegments(plain.slice(start, end), tokens));
  if (end < plain.length) out.push({ text: '…', hit: false });
  return out;
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/lib/__tests__/search.test.ts`
Expected: PASS（全部測試）

- [ ] **Step 5: Commit**

```bash
git add src/lib/search.ts src/lib/__tests__/search.test.ts
git commit -m "feat(search): 就地搜尋純函式（分詞/AND/加權評分/分類建議/segments/snippet）"
```

---

### Task 3: 共用元件 `HitText` 與 `SearchField`

**Files:**
- Create: `src/components/HitText.tsx`
- Create: `src/components/SearchField.tsx`
- Test: `src/components/__tests__/HitText.test.tsx`、`src/components/__tests__/SearchField.test.tsx`
- Modify: `src/styles.css`（append `.search-hit` 與 `.search-field`）

**Interfaces:**
- Consumes: `Segment`（Task 2）。
- Produces（Task 4/5/7 依賴）:
  - `HitText({ segments }: { segments: Segment[] })` default export
  - `SearchField({ value, onChange, placeholder, onKeyDown? }: { value: string; onChange: (v: string) => void; placeholder: string; onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void })` default export——input + 非空時的 ✕ 清除鈕

- [ ] **Step 1: 寫失敗測試**

Create `src/components/__tests__/HitText.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import HitText from '../HitText';

describe('HitText', () => {
  afterEach(() => cleanup());

  it('hit 片段渲染為 mark.search-hit', () => {
    const { container } = render(
      <HitText segments={[
        { text: '道頓堀', hit: false },
        { text: '拉麵', hit: true },
      ]} />,
    );
    const mark = container.querySelector('mark.search-hit');
    expect(mark?.textContent).toBe('拉麵');
    expect(container.textContent).toBe('道頓堀拉麵');
  });
});
```

Create `src/components/__tests__/SearchField.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import SearchField from '../SearchField';

describe('SearchField', () => {
  afterEach(() => cleanup());

  it('受控輸入觸發 onChange', () => {
    const onChange = vi.fn();
    render(<SearchField value="" onChange={onChange} placeholder="搜尋…" />);
    fireEvent.change(screen.getByPlaceholderText('搜尋…'), { target: { value: '拉' } });
    expect(onChange).toHaveBeenCalledWith('拉');
  });

  it('有值時顯示清除鈕，點擊清空', () => {
    const onChange = vi.fn();
    render(<SearchField value="拉麵" onChange={onChange} placeholder="搜尋…" />);
    fireEvent.click(screen.getByLabelText('清除搜尋'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('空值時不顯示清除鈕', () => {
    render(<SearchField value="" onChange={() => {}} placeholder="搜尋…" />);
    expect(screen.queryByLabelText('清除搜尋')).toBeNull();
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/components/__tests__/HitText.test.tsx src/components/__tests__/SearchField.test.tsx`
Expected: FAIL（模組不存在）

- [ ] **Step 3: 實作元件**

Create `src/components/HitText.tsx`:

```tsx
import type { Segment } from '../lib/search';

export default function HitText({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((s, i) =>
        s.hit ? <mark key={i} className="search-hit">{s.text}</mark> : <span key={i}>{s.text}</span>,
      )}
    </>
  );
}
```

Create `src/components/SearchField.tsx`:

```tsx
import type { KeyboardEvent } from 'react';

export default function SearchField({ value, onChange, placeholder, onKeyDown }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 340 }}>
      <input
        className="search-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
      />
      {value && (
        <button
          className="btn-plain"
          aria-label="清除搜尋"
          onClick={() => onChange('')}
          style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            fontSize: 15, color: 'var(--brown)', padding: '4px 6px', cursor: 'pointer', lineHeight: 1,
          }}
        >✕</button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: styles.css append（檔案末尾）**

```css
.search-hit { background: rgba(232,180,74,.28); border-radius: 3px; padding: 0 1px; color: inherit; }
.search-field {
  width: 100%; background: var(--card); border: 1px solid var(--line-dark);
  border-radius: 8px; padding: 10px 34px 10px 14px; font-size: 14px;
  font-family: inherit; color: var(--ink);
}
@media (max-width: 640px) { .search-field { font-size: 16px; } }
```

（`search-field` 不設 `outline: none`——聚焦外框交給 Task 10 的全站 `:focus-visible`，在那之前用瀏覽器預設。手機 16px 是防 iOS 聚焦自動放大。）

- [ ] **Step 5: 執行測試確認通過**

Run: `npx vitest run src/components/__tests__/HitText.test.tsx src/components/__tests__/SearchField.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/HitText.tsx src/components/SearchField.tsx src/components/__tests__/HitText.test.tsx src/components/__tests__/SearchField.test.tsx src/styles.css
git commit -m "feat(search): 共用 HitText 標亮渲染與 SearchField 輸入框元件"
```

---

### Task 4: 美食庫就地搜尋升級 + 分類建議

**Files:**
- Modify: `src/pages/Food.tsx`（整檔改寫）
- Test: `src/pages/__tests__/Food.test.tsx`（整檔改寫）

**Interfaces:**
- Consumes: `tokenize`/`scoreEntity`/`suggestFoodTypes`/`makeSegments`（Task 2）、`SearchField`/`HitText`（Task 3）。
- Produces: 無（頁面元件，`() => JSX.Element`）。

- [ ] **Step 1: 寫失敗測試**

`src/pages/__tests__/Food.test.tsx` 整檔換成：

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TripStateProvider } from '../../state/store';
import Food from '../Food';

vi.mock('../../state/auth', () => ({ useAuth: () => ({ canEdit: true, openLogin: vi.fn() }) }));

const RESTAURANTS = [
  { id: 'r1', category: '餐廳', name: 'Bakuro', tags: [], updated: '', favorite: false,
    fields: { 類型: '關東煮' }, summary: '關東煮 4.4 分。', body: '', area: '難波', rating: 4.4 },
  { id: 'r2', category: '餐廳', name: '花くじら', tags: [], updated: '', favorite: false,
    fields: { 類型: '關東煮' }, summary: '福島名店', body: '', area: '福島', rating: 4.1 },
  { id: 'r3', category: '餐廳', name: '一蘭 道頓堀', tags: [], updated: '', favorite: false,
    fields: { 類型: '拉麵' }, summary: '天然豚骨', body: '', area: '道頓堀', rating: 3.9 },
];

vi.mock('../../data', () => ({
  byCategory: (cat: string) => (cat === '餐廳' ? RESTAURANTS : []),
  entities: [], // search.ts 頂層 import { entities }，mock 必須提供
}));

vi.mock('../../lib/search', async (importOriginal) => {
  // suggestFoodTypes 依賴 ../data 的 entities，測試中直接覆寫；其餘用真實作。
  // count 故意用 5（與 chip 文字「關東煮 2」區隔，避免 getByRole 撞名）
  const mod = await importOriginal<typeof import('../../lib/search')>();
  return {
    ...mod,
    suggestFoodTypes: (q: string) =>
      q.includes('關東') ? [{ type: '關東煮', count: 5 }] : [],
  };
});

function renderFood() {
  return render(<TripStateProvider><Food /></TripStateProvider>);
}

describe('Food 就地搜尋', () => {
  afterEach(() => cleanup());

  it('多關鍵字 AND 過濾', () => {
    renderFood();
    fireEvent.change(screen.getByPlaceholderText('搜尋店名、類型、區域…'), { target: { value: '道頓堀 拉麵' } });
    expect(screen.getByText(/一蘭/)).toBeTruthy();
    expect(screen.queryByText('Bakuro')).toBeNull();
  });

  it('店名命中排在摘要命中前（相關性排序）', () => {
    renderFood();
    // 「花」命中 r2 店名（100 分）；不命中其他
    fireEvent.change(screen.getByPlaceholderText('搜尋店名、類型、區域…'), { target: { value: '花' } });
    expect(screen.getByText(/花くじら/)).toBeTruthy();
  });

  it('輸入命中類型時顯示分類建議，點選套用篩選並清空輸入', () => {
    renderFood();
    const input = screen.getByPlaceholderText('搜尋店名、類型、區域…');
    fireEvent.change(input, { target: { value: '關東' } });
    const option = screen.getByRole('button', { name: /關東煮.*5/ });
    fireEvent.click(option);
    expect((input as HTMLInputElement).value).toBe('');
    // 篩選套用：拉麵店消失、兩間關東煮在列
    expect(screen.queryByText(/一蘭/)).toBeNull();
    expect(screen.getByText('Bakuro')).toBeTruthy();
    // chips 列的「關東煮」處於選中狀態（chip--on）
    const chips = screen.getAllByText(/^關東煮/).filter((el) => el.closest('.chip'));
    expect(chips.some((el) => el.closest('.chip')?.className.includes('chip--on'))).toBe(true);
  });

  it('Esc 關閉建議浮層', () => {
    renderFood();
    const input = screen.getByPlaceholderText('搜尋店名、類型、區域…');
    fireEvent.change(input, { target: { value: '關東' } });
    expect(screen.getByRole('button', { name: /關東煮.*5/ })).toBeTruthy();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: /關東煮.*5/ })).toBeNull();
  });

  it('搜尋命中處以 mark.search-hit 標亮', () => {
    const { container } = renderFood();
    fireEvent.change(screen.getByPlaceholderText('搜尋店名、類型、區域…'), { target: { value: '一蘭' } });
    const mark = container.querySelector('mark.search-hit');
    expect(mark?.textContent).toBe('一蘭');
  });

  it('無結果顯示空狀態', () => {
    renderFood();
    fireEvent.change(screen.getByPlaceholderText('搜尋店名、類型、區域…'), { target: { value: '不存在的店' } });
    expect(screen.getByText('沒有符合的店家')).toBeTruthy();
  });

  it('只看已標記且無任何標記時顯示引導文案', () => {
    renderFood();
    fireEvent.click(screen.getByText('♥ 只看已標記'));
    expect(screen.getByText('還沒有標記的店，去按 ♥')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/pages/__tests__/Food.test.tsx`
Expected: FAIL（placeholder 不同、無建議浮層、無空狀態）

- [ ] **Step 3: 改寫 `src/pages/Food.tsx`**

整檔換成：

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { byCategory } from '../data';
import Chip from '../components/Chip';
import Heart from '../components/Heart';
import Stamp from '../components/Stamp';
import MapLink from '../components/MapLink';
import SearchField from '../components/SearchField';
import HitText from '../components/HitText';
import { useTripState } from '../state/store';
import { tokenize, scoreEntity, suggestFoodTypes, makeSegments } from '../lib/search';

export default function Food() {
  const { favs } = useTripState();
  const all = useMemo(() => byCategory('餐廳'), []);
  const [cat, setCat] = useState('全部');
  const [q, setQ] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const tokens = useMemo(() => tokenize(q), [q]);
  const suggestions = useMemo(() => suggestFoodTypes(q), [q]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setSuggestOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const cats = useMemo(
    () => ['全部', ...Array.from(new Set(all.map((r) => r.fields['類型'] ?? '未分類')))],
    [all],
  );

  const hasAnyFav = all.some((r) => favs[`fav:${r.id}`]);

  const list = all
    .map((r) => ({ r, score: tokens.length ? scoreEntity(r, tokens) : 0 }))
    .filter(({ r, score }) =>
      (cat === '全部' || (r.fields['類型'] ?? '未分類') === cat) &&
      (!favOnly || favs[`fav:${r.id}`]) &&
      (tokens.length === 0 || score > 0))
    .sort((a, b) => (b.score - a.score) || ((b.r.rating ?? 0) - (a.r.rating ?? 0)))
    .map(({ r }) => r);

  const pickType = (type: string) => {
    setCat(type);
    setQ('');
    setSuggestOpen(false);
  };

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div ref={wrapRef} style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 340, display: 'flex' }}>
          <SearchField
            value={q}
            onChange={(v) => { setQ(v); setSuggestOpen(true); }}
            placeholder="搜尋店名、類型、區域…"
            onKeyDown={(e) => { if (e.key === 'Escape') setSuggestOpen(false); }}
          />
          {suggestOpen && tokens.length > 0 && suggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6,
              background: 'var(--card)', border: '1px solid var(--line-dark)', borderRadius: 8,
              boxShadow: '0 6px 18px rgba(41,35,26,.14)', zIndex: 40, padding: '4px 0',
            }}>
              {suggestions.map(({ type, count }) => (
                <button key={type} className="btn-plain" onClick={() => pickType(type)} style={{
                  display: 'flex', width: '100%', alignItems: 'baseline', gap: 8,
                  padding: '9px 14px', cursor: 'pointer', fontSize: 13.5,
                }}>
                  <span style={{ fontWeight: 600 }}>
                    <HitText segments={makeSegments(type, tokens)} />
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--brown)' }}>{count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <Chip on={favOnly} red onClick={() => setFavOnly(!favOnly)}>♥ 只看已標記</Chip>
        <span style={{ fontSize: 12.5, color: 'var(--brown)' }}>共 {list.length} 間</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {cats.map((c) => {
          const n = c === '全部' ? all.length : all.filter((r) => (r.fields['類型'] ?? '未分類') === c).length;
          return <Chip key={c} on={cat === c} onClick={() => setCat(c)}>{c} {n}</Chip>;
        })}
      </div>
      {list.length === 0 && (
        <div className="card" style={{ padding: '18px 20px', fontSize: 13, color: 'var(--brown)' }}>
          {favOnly && !hasAnyFav ? '還沒有標記的店，去按 ♥' : '沒有符合的店家'}
        </div>
      )}
      <div className="cards-grid">
        {list.map((r) => {
          const note = r.fields['備註'] && r.fields['備註'] !== '-' ? r.fields['備註'] : r.summary;
          return (
            <div key={r.id} className="card" style={{ padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <Stamp rating={r.rating} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="serif" style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.35 }}>
                  <HitText segments={makeSegments(r.name, tokens)} />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--navy)', border: '1px solid rgba(46,58,82,.4)', borderRadius: 4, padding: '1.5px 7px' }}>{r.fields['類型'] ?? '未分類'}</span>
                  <span style={{ fontSize: 12, color: 'var(--brown)' }}>{r.fields['價位'] && r.fields['價位'] !== '-' ? r.fields['價位'] : '價位未記'}</span>
                  {r.area && <span style={{ fontSize: 12, color: 'var(--brown)' }}>{r.area}</span>}
                  <MapLink name={r.name} area={r.area} />
                </div>
                {note && (
                  <div style={{ fontSize: 12.5, color: 'var(--brown-dk)', marginTop: 7, borderTop: '1px dashed rgba(41,35,26,.16)', paddingTop: 7 }}>
                    <HitText segments={makeSegments(note, tokens)} />
                  </div>
                )}
              </div>
              <Heart entityId={r.id} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/pages/__tests__/Food.test.tsx`
Expected: PASS（7 個測試）

- [ ] **Step 5: Commit**

```bash
git add src/pages/Food.tsx src/pages/__tests__/Food.test.tsx
git commit -m "feat(search): 美食庫就地搜尋升級（AND/相關性排序/分類建議/標亮/空狀態）"
```

---

### Task 5: 景點・購物新增搜尋

**Files:**
- Modify: `src/pages/Places.tsx`（整檔改寫）
- Test: `src/pages/__tests__/Places.test.tsx`（整檔改寫）

**Interfaces:**
- Consumes: `tokenize`/`scoreEntity`/`makeSegments`（Task 2）、`SearchField`/`HitText`（Task 3）、`Entity`（schema）。
- Produces: 無。

- [ ] **Step 1: 寫失敗測試**

`src/pages/__tests__/Places.test.tsx` 整檔換成：

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TripStateProvider } from '../../state/store';
import Places from '../Places';

vi.mock('../../state/auth', () => ({ useAuth: () => ({ canEdit: true, openLogin: vi.fn() }) }));

vi.mock('../../data', () => ({
  byCategory: (cat: string) => {
    if (cat === '景點') return [
      { id: 'p1', category: '景點', name: '大阪城', tags: [], updated: '', favorite: false,
        fields: { 類型: '史跡' }, summary: '天守閣景觀', body: '', area: '大阪城公園', rating: 4.2 },
      { id: 'p2', category: '景點', name: '海遊館', tags: [], updated: '', favorite: false,
        fields: { 類型: '水族館' }, summary: '鯨鯊', body: '', area: '大阪港', rating: 4.5 },
    ];
    if (cat === '購物') return [
      { id: 's1', category: '購物', name: '心齋橋筋商店街', tags: [], updated: '', favorite: false,
        fields: {}, summary: '藥妝與伴手禮', body: '', area: '心齋橋', rating: null },
    ];
    return [];
  },
  entities: [], // search.ts 頂層 import { entities }，mock 必須提供
}));

const PLACEHOLDER = '搜尋景點、購物…';

describe('Places 就地搜尋', () => {
  afterEach(() => cleanup());

  it('無查詢時全部顯示、計數正確', () => {
    render(<TripStateProvider><Places /></TripStateProvider>);
    expect(screen.getByText('2 處')).toBeTruthy();
    expect(screen.getByText(/1 處/)).toBeTruthy();
  });

  it('查詢同時過濾兩區並更新計數', () => {
    render(<TripStateProvider><Places /></TripStateProvider>);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '大阪城' } });
    expect(screen.getByText('大阪城')).toBeTruthy();
    expect(screen.queryByText('海遊館')).toBeNull();
    expect(screen.queryByText('心齋橋筋商店街')).toBeNull();
    expect(screen.getByText('1 處')).toBeTruthy();
  });

  it('單區無結果顯示該區空狀態', () => {
    render(<TripStateProvider><Places /></TripStateProvider>);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '海遊館' } });
    expect(screen.getByText('沒有符合的購物點')).toBeTruthy();
  });

  it('兩區皆無結果顯示整頁空狀態', () => {
    render(<TripStateProvider><Places /></TripStateProvider>);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '不存在' } });
    expect(screen.getByText('沒有符合的項目')).toBeTruthy();
  });

  it('命中處標亮', () => {
    const { container } = render(<TripStateProvider><Places /></TripStateProvider>);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '鯨鯊' } });
    expect(container.querySelector('mark.search-hit')?.textContent).toBe('鯨鯊');
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/pages/__tests__/Places.test.tsx`
Expected: FAIL（無搜尋框）

- [ ] **Step 3: 改寫 `src/pages/Places.tsx`**

整檔換成：

```tsx
import { useMemo, useState } from 'react';
import { byCategory } from '../data';
import type { Entity } from '../data/schema';
import Heart from '../components/Heart';
import Stamp from '../components/Stamp';
import MapLink from '../components/MapLink';
import SearchField from '../components/SearchField';
import HitText from '../components/HitText';
import { tokenize, scoreEntity, makeSegments } from '../lib/search';

export default function Places() {
  const spots = byCategory('景點');
  const shops = byCategory('購物');
  const [q, setQ] = useState('');
  const tokens = useMemo(() => tokenize(q), [q]);

  const filterList = (list: Entity[]) => {
    if (tokens.length === 0) return list;
    return list
      .map((p) => ({ p, score: scoreEntity(p, tokens) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => (b.score - a.score) || ((b.p.rating ?? 0) - (a.p.rating ?? 0)))
      .map(({ p }) => p);
  };

  const fSpots = filterList(spots);
  const fShops = filterList(shops);
  const allEmpty = tokens.length > 0 && fSpots.length === 0 && fShops.length === 0;

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <SearchField value={q} onChange={setQ} placeholder="搜尋景點、購物…" />
      </div>
      {allEmpty && (
        <div className="card" style={{ padding: '18px 20px', fontSize: 13, color: 'var(--brown)' }}>
          沒有符合的項目
        </div>
      )}
      {!allEmpty && (
        <>
          <section>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
              <span className="serif" style={{ fontSize: 20, fontWeight: 800, borderLeft: '4px solid var(--red)', paddingLeft: 12 }}>景點</span>
              <span style={{ fontSize: 12, color: 'var(--brown)' }}>{fSpots.length} 處</span>
            </div>
            {fSpots.length === 0 && (
              <div style={{ fontSize: 12.5, color: 'var(--brown)' }}>沒有符合的景點</div>
            )}
            <div className="cards-grid">
              {fSpots.map((p) => (
                <div key={p.id} className="card" style={{ padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <Stamp rating={p.rating} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="serif" style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.35 }}>
                      <HitText segments={makeSegments(p.name, tokens)} />
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--navy)', border: '1px solid rgba(46,58,82,.4)', borderRadius: 4, padding: '1.5px 7px' }}>{p.fields['類型'] ?? ''}</span>
                      <span style={{ fontSize: 12, color: 'var(--brown)' }}>
                        {[p.fields['位置'], p.fields['門票']].filter(Boolean).join('・')}
                      </span>
                      <MapLink name={p.name} area={p.area} />
                    </div>
                    {p.summary && (
                      <div style={{ fontSize: 12.5, color: 'var(--brown-dk)', marginTop: 7, borderTop: '1px dashed rgba(41,35,26,.16)', paddingTop: 7 }}>
                        <HitText segments={makeSegments(p.summary, tokens)} />
                      </div>
                    )}
                  </div>
                  <Heart entityId={p.id} />
                </div>
              ))}
            </div>
          </section>
          <section>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
              <span className="serif" style={{ fontSize: 20, fontWeight: 800, borderLeft: '4px solid var(--navy)', paddingLeft: 12 }}>購物</span>
              <span style={{ fontSize: 12, color: 'var(--brown)' }}>{fShops.length} 處・梅田 vs 心齋橋雙主場</span>
            </div>
            {fShops.length === 0 && (
              <div style={{ fontSize: 12.5, color: 'var(--brown)' }}>沒有符合的購物點</div>
            )}
            <div className="cards-grid">
              {fShops.map((p) => (
                <div key={p.id} className="card" style={{ padding: '16px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <span className="serif" style={{ fontSize: 15.5, fontWeight: 700 }}>
                        <HitText segments={makeSegments(p.name, tokens)} />
                      </span>
                      {p.rating != null && <span style={{ fontSize: 11.5, color: 'var(--red)', fontWeight: 700 }}>★ {p.rating.toFixed(1)}</span>}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7, alignItems: 'center' }}>
                      {p.area && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--navy)', border: '1px solid rgba(46,58,82,.4)', borderRadius: 4, padding: '1.5px 7px' }}>{p.area}</span>}
                      <span style={{ fontSize: 12, color: 'var(--brown)' }}>{p.fields['類型'] ?? ''}</span>
                      <MapLink name={p.name} area={p.area} />
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--brown-dk)', marginTop: 7 }}>
                      <HitText segments={makeSegments(p.summary, tokens)} />
                    </div>
                  </div>
                  <Heart entityId={p.id} />
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/pages/__tests__/Places.test.tsx`
Expected: PASS（5 個測試）

- [ ] **Step 5: Commit**

```bash
git add src/pages/Places.tsx src/pages/__tests__/Places.test.tsx
git commit -m "feat(search): 景點・購物頁就地搜尋（雙區過濾/計數/標亮/空狀態）"
```

---

### Task 6: 內文標亮 hook `src/lib/useMarkText.ts`

**Files:**
- Create: `src/lib/useMarkText.ts`
- Test: `src/lib/__tests__/useMarkText.test.ts`

**Interfaces:**
- Produces（Task 7 依賴）: `useMarkText(ref: RefObject<HTMLElement | null>, tokens: string[], enabled: boolean): void`——`enabled` 且有 tokens 時把 ref 容器內文字節點的命中處包 `<mark class="search-hit">`；cleanup 時還原並 `normalize()`。

- [ ] **Step 1: 寫失敗測試**

Create `src/lib/__tests__/useMarkText.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useMarkText } from '../useMarkText';
import type { RefObject } from 'react';

function makeContainer(html: string): RefObject<HTMLElement | null> {
  document.body.innerHTML = `<div id="c">${html}</div>`;
  return { current: document.getElementById('c') };
}

describe('useMarkText', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  afterEach(() => cleanup());

  it('把命中文字包進 mark.search-hit（大小寫不敏感）', () => {
    const ref = makeContainer('<p>推薦 Takoyaki 章魚燒與大阪燒</p>');
    renderHook(() => useMarkText(ref, ['takoyaki', '大阪燒'], true));
    const marks = ref.current!.querySelectorAll('mark.search-hit');
    expect([...marks].map((m) => m.textContent)).toEqual(['Takoyaki', '大阪燒']);
  });

  it('同一文字節點多次命中都包到', () => {
    const ref = makeContainer('<p>拉麵店旁邊還是拉麵店</p>');
    renderHook(() => useMarkText(ref, ['拉麵'], true));
    expect(ref.current!.querySelectorAll('mark.search-hit').length).toBe(2);
  });

  it('unmount 後 mark 全部還原、文字內容不變', () => {
    const ref = makeContainer('<p>推薦章魚燒</p>');
    const { unmount } = renderHook(() => useMarkText(ref, ['章魚燒'], true));
    expect(ref.current!.querySelector('mark')).toBeTruthy();
    unmount();
    expect(ref.current!.querySelector('mark')).toBeNull();
    expect(ref.current!.textContent).toBe('推薦章魚燒');
  });

  it('enabled=false 不動作', () => {
    const ref = makeContainer('<p>推薦章魚燒</p>');
    renderHook(() => useMarkText(ref, ['章魚燒'], false));
    expect(ref.current!.querySelector('mark')).toBeNull();
  });

  it('tokens 變更時重新標記', () => {
    const ref = makeContainer('<p>章魚燒與大阪燒</p>');
    const { rerender } = renderHook(
      ({ tokens }) => useMarkText(ref, tokens, true),
      { initialProps: { tokens: ['章魚燒'] } },
    );
    expect(ref.current!.querySelector('mark')!.textContent).toBe('章魚燒');
    rerender({ tokens: ['大阪燒'] });
    const marks = ref.current!.querySelectorAll('mark');
    expect(marks.length).toBe(1);
    expect(marks[0].textContent).toBe('大阪燒');
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/lib/__tests__/useMarkText.test.ts`
Expected: FAIL（模組不存在）

- [ ] **Step 3: 實作 `src/lib/useMarkText.ts`**

```ts
import { useEffect, type RefObject } from 'react';

export function useMarkText(ref: RefObject<HTMLElement | null>, tokens: string[], enabled: boolean): void {
  const key = tokens.join(' ');
  useEffect(() => {
    const root = ref.current;
    const toks = key ? key.split(' ') : [];
    if (!enabled || !root || toks.length === 0) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) textNodes.push(n as Text);

    const marks: HTMLElement[] = [];
    for (const node of textNodes) {
      let current = node;
      for (;;) {
        const lower = current.data.toLowerCase();
        let first = -1;
        let len = 0;
        for (const t of toks) {
          const i = lower.indexOf(t);
          if (i !== -1 && (first === -1 || i < first)) {
            first = i;
            len = t.length;
          }
        }
        if (first === -1) break;
        const matchNode = current.splitText(first);
        const rest = matchNode.splitText(len);
        const mark = document.createElement('mark');
        mark.className = 'search-hit';
        matchNode.parentNode!.insertBefore(mark, matchNode);
        mark.appendChild(matchNode);
        marks.push(mark);
        current = rest;
      }
    }

    return () => {
      for (const mark of marks) {
        const parent = mark.parentNode;
        if (!parent) continue;
        while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
        parent.removeChild(mark);
        parent.normalize();
      }
    };
  }, [ref, key, enabled]);
}
```

（deps 用 `key`（tokens join）避免陣列 identity 每次 render 都變；` ` 不會出現在使用者輸入的正常查詢中。）

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/lib/__tests__/useMarkText.test.ts`
Expected: PASS（5 個測試）

- [ ] **Step 5: Commit**

```bash
git add src/lib/useMarkText.ts src/lib/__tests__/useMarkText.test.ts
git commit -m "feat(search): useMarkText 內文關鍵字 DOM 標亮 hook"
```

---

### Task 7: 攻略頁新增搜尋 + snippet + 內文標亮

**Files:**
- Modify: `src/pages/Guides.tsx`（整檔改寫）
- Test: `src/pages/__tests__/Guides.test.tsx`（整檔改寫）

**Interfaces:**
- Consumes: `tokenize`/`matchesTokens`/`makeSegments`/`makeSnippet`（Task 2）、`SearchField`/`HitText`（Task 3）、`useMarkText`（Task 6）。
- Produces: 無。注意本 Task 展開仍用條件渲染（`{isOpen && ...}`）；Task 10 才改成 grid 動畫結構。

- [ ] **Step 1: 寫失敗測試**

`src/pages/__tests__/Guides.test.tsx` 整檔換成：

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import Guides from '../Guides';

vi.mock('../../data', () => ({
  guides: [
    { id: 'g1', title: '大阪美食攻略', source: '', sourceUrl: '', body: '本文開頭。中段推薦章魚燒與大阪燒名店。' },
    { id: 'g2', title: '交通懶人包', source: '', sourceUrl: '', body: 'ICOCA 卡使用方式' },
  ],
  entities: [], // search.ts 頂層 import { entities }，mock 必須提供
}));

const PLACEHOLDER = '搜尋攻略內容…';

describe('Guides 就地搜尋', () => {
  afterEach(() => cleanup());

  it('預設收合，點擊標題展開內文', () => {
    render(<Guides />);
    expect(screen.queryByText(/中段推薦章魚燒/)).toBeNull();
    fireEvent.click(screen.getByText('大阪美食攻略'));
    expect(screen.getByText(/中段推薦章魚燒/)).toBeTruthy();
  });

  it('查詢過濾攻略並顯示符合篇數', () => {
    render(<Guides />);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '章魚燒' } });
    expect(screen.getByText('大阪美食攻略')).toBeTruthy();
    expect(screen.queryByText('交通懶人包')).toBeNull();
    expect(screen.getByText('符合 1 篇')).toBeTruthy();
  });

  it('命中卡片標題下顯示 snippet 且命中處標亮', () => {
    const { container } = render(<Guides />);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '章魚燒' } });
    const mark = container.querySelector('mark.search-hit');
    expect(mark?.textContent).toBe('章魚燒');
  });

  it('標題命中但內文未命中時不顯示 snippet', () => {
    render(<Guides />);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '懶人包' } });
    expect(screen.getByText('交通懶人包')).toBeTruthy();
    // body「ICOCA 卡使用方式」不含「懶人包」→ 無 snippet 元素
    expect(screen.queryByTestId('guide-snippet')).toBeNull();
  });

  it('展開命中卡片後內文以 mark 標亮', () => {
    const { container } = render(<Guides />);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '章魚燒' } });
    fireEvent.click(screen.getByText('大阪美食攻略'));
    // snippet 的 mark + 內文的 mark 至少各一
    const marks = [...container.querySelectorAll('mark.search-hit')].map((m) => m.textContent);
    expect(marks.filter((t) => t === '章魚燒').length).toBeGreaterThanOrEqual(2);
  });

  it('無結果顯示空狀態', () => {
    render(<Guides />);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '不存在' } });
    expect(screen.getByText('沒有符合的攻略')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/pages/__tests__/Guides.test.tsx`
Expected: FAIL（無搜尋框）

- [ ] **Step 3: 改寫 `src/pages/Guides.tsx`**

整檔換成：

```tsx
import { useMemo, useRef, useState } from 'react';
import { guides } from '../data';
import type { Guide } from '../data/schema';
import MarkdownBody from '../components/MarkdownBody';
import SearchField from '../components/SearchField';
import HitText from '../components/HitText';
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
      <div onClick={onToggle} style={{
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
        <span className="serif" style={{ fontSize: 13, color: 'var(--red)', fontWeight: 700, flex: 'none' }}>
          {isOpen ? '收合 ▲' : '展開 ▼'}
        </span>
      </div>
      {isOpen && (
        <div ref={bodyRef} className="dash-top" style={{ padding: '2px 22px 18px' }}>
          <MarkdownBody>{g.body}</MarkdownBody>
        </div>
      )}
    </div>
  );
}

export default function Guides() {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState('');
  const tokens = useMemo(() => tokenize(q), [q]);
  const toggle = (id: string) => setOpen((s) => ({ ...s, [id]: !s[id] }));

  const shown = tokens.length === 0
    ? guides
    : guides.filter((g) => matchesTokens(`${g.title} ${g.body}`, tokens));

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 820 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <SearchField value={q} onChange={setQ} placeholder="搜尋攻略內容…" />
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

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/pages/__tests__/Guides.test.tsx`
Expected: PASS（6 個測試）

- [ ] **Step 5: Commit**

```bash
git add src/pages/Guides.tsx src/pages/__tests__/Guides.test.tsx
git commit -m "feat(search): 攻略頁就地搜尋（過濾/snippet/展開內文標亮）"
```

---

### Task 8: 收合 hook `src/lib/useCondensedHeader.ts`

**Files:**
- Create: `src/lib/useCondensedHeader.ts`
- Test: `src/lib/__tests__/useCondensedHeader.test.ts`

**Interfaces:**
- Produces（Task 9 依賴）: `useCondensedHeader(collapseAt = 80, expandAt = 40): boolean`。

- [ ] **Step 1: 寫失敗測試**

Create `src/lib/__tests__/useCondensedHeader.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useCondensedHeader } from '../useCondensedHeader';

function setScrollY(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
  window.dispatchEvent(new Event('scroll'));
}

describe('useCondensedHeader', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0; });
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('初始在頂部為 false', () => {
    const { result } = renderHook(() => useCondensedHeader());
    expect(result.current).toBe(false);
  });

  it('捲超過 collapseAt 變 true', () => {
    const { result } = renderHook(() => useCondensedHeader());
    act(() => setScrollY(100));
    expect(result.current).toBe(true);
  });

  it('遲滯區（expandAt~collapseAt 之間）維持原值', () => {
    const { result } = renderHook(() => useCondensedHeader());
    act(() => setScrollY(100));
    act(() => setScrollY(60));
    expect(result.current).toBe(true);
    act(() => setScrollY(30));
    expect(result.current).toBe(false);
    act(() => setScrollY(60));
    expect(result.current).toBe(false);
  });

  it('掛載時已捲下去（重整）直接 true', () => {
    Object.defineProperty(window, 'scrollY', { value: 200, configurable: true });
    const { result } = renderHook(() => useCondensedHeader());
    expect(result.current).toBe(true);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/lib/__tests__/useCondensedHeader.test.ts`
Expected: FAIL（模組不存在）

- [ ] **Step 3: 實作 `src/lib/useCondensedHeader.ts`**

```ts
import { useEffect, useState } from 'react';

export function useCondensedHeader(collapseAt = 80, expandAt = 40): boolean {
  const [condensed, setCondensed] = useState(() => window.scrollY > collapseAt);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      ticking = false;
      const y = window.scrollY;
      setCondensed((prev) => (y > collapseAt ? true : y < expandAt ? false : prev));
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [collapseAt, expandAt]);

  return condensed;
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/lib/__tests__/useCondensedHeader.test.ts`
Expected: PASS（4 個測試）

- [ ] **Step 5: Commit**

```bash
git add src/lib/useCondensedHeader.ts src/lib/__tests__/useCondensedHeader.test.ts
git commit -m "feat(ui): useCondensedHeader 位置門檻收合 hook（含遲滯防抖）"
```

---

### Task 9: Header 抽出與捲動收合

**Files:**
- Create: `src/lib/tabs.ts`、`src/lib/countdown.ts`、`src/components/Header.tsx`
- Test: `src/components/__tests__/Header.test.tsx`
- Modify: `src/App.tsx`（大幅瘦身）、`src/pages/Home.tsx`（import 路徑）、`src/__tests__/countdown.test.ts`（import 路徑）、`src/styles.css`（`.hscroll`、`.hdr-collapse`）

**Interfaces:**
- Consumes: `useCondensedHeader`（Task 8）、`Chip`、`useTripState`、`useAuth`、`apiBase`/`getToken`/`setupLink`、`byCategory`/`meta`/`overview`。
- Produces:
  - `src/lib/tabs.ts`: `export type TabKey = 'home' | 'plan' | 'food' | 'places' | 'trans' | 'map' | 'guides'`；`export const TABS: [TabKey, string][]`（內容同現有 App.tsx）
  - `src/lib/countdown.ts`: `export function countdownDays(tripStart: string, now = new Date()): number`（實作原封搬移）
  - `Header({ tab, onNavigate }: { tab: TabKey; onNavigate: (k: TabKey) => void })` default export；**tab chip 點擊時呼叫 `onNavigate(k)` 並 `window.scrollTo(0, 0)`**；收合時迷你 logo `window.scrollTo({ top: 0, behavior: 'smooth' })`
  - `src/App.tsx` 繼續 export `parseHash`、`countdownDays`（re-export 自 lib，讓既有 import 不破）

- [ ] **Step 1: 建立 `src/lib/tabs.ts` 與 `src/lib/countdown.ts`**

`src/lib/tabs.ts`:

```ts
export type TabKey = 'home' | 'plan' | 'food' | 'places' | 'trans' | 'map' | 'guides';

export const TABS: [TabKey, string][] = [
  ['home', '總覽'], ['plan', '每日行程'], ['food', '美食庫'],
  ['places', '景點・購物'], ['trans', '交通票券'], ['map', '地圖'], ['guides', '攻略'],
];
```

`src/lib/countdown.ts`:

```ts
export function countdownDays(tripStart: string, now = new Date()): number {
  const dep = new Date(`${tripStart}T00:00:00+09:00`).getTime();
  return Math.max(0, Math.ceil((dep - now.getTime()) / 86400000));
}
```

- [ ] **Step 2: 寫 Header 失敗測試**

Create `src/components/__tests__/Header.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TripStateProvider } from '../../state/store';
import Header from '../Header';

vi.mock('../../state/auth', () => ({
  useAuth: () => ({ canEdit: false, openLogin: vi.fn(), logout: vi.fn() }),
}));

const h = vi.hoisted(() => ({ condensed: false }));
vi.mock('../../lib/useCondensedHeader', () => ({ useCondensedHeader: () => h.condensed }));

function renderHeader(onNavigate = vi.fn()) {
  return render(
    <TripStateProvider>
      <Header tab="home" onNavigate={onNavigate} />
    </TripStateProvider>,
  );
}

describe('Header', () => {
  afterEach(() => { cleanup(); h.condensed = false; });

  it('完整態顯示標題與倒數、無迷你 logo', () => {
    renderHeader();
    expect(screen.getByText(/大阪旅券/)).toBeTruthy();
    expect(screen.getByText('出發倒數')).toBeTruthy();
    expect(screen.queryByLabelText('回到頂部')).toBeNull();
  });

  it('收合態顯示迷你 logo、完整區塊加上隱藏 class', () => {
    h.condensed = true;
    const { container } = renderHeader();
    expect(screen.getByLabelText('回到頂部')).toBeTruthy();
    expect(container.querySelector('.hdr-collapse--hidden')).toBeTruthy();
  });

  it('點 tab chip 呼叫 onNavigate 並捲回頂部', () => {
    const onNavigate = vi.fn();
    window.scrollTo = vi.fn();
    renderHeader(onNavigate);
    fireEvent.click(screen.getByText('每日行程'));
    expect(onNavigate).toHaveBeenCalledWith('plan');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('迷你 logo 點擊平滑捲頂', () => {
    h.condensed = true;
    window.scrollTo = vi.fn();
    renderHeader();
    fireEvent.click(screen.getByLabelText('回到頂部'));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});
```

- [ ] **Step 3: 執行測試確認失敗**

Run: `npx vitest run src/components/__tests__/Header.test.tsx`
Expected: FAIL（`../Header` 模組不存在）

- [ ] **Step 4: 實作 `src/components/Header.tsx`**

```tsx
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
```

- [ ] **Step 5: styles.css append**

```css
.hscroll { display: flex; gap: 8px; overflow-x: auto; flex-wrap: nowrap; scrollbar-width: none; }
.hscroll::-webkit-scrollbar { display: none; }
.hscroll > * { flex: none; }
.hdr-collapse { max-height: 320px; opacity: 1; overflow: hidden; transition: max-height .2s ease, opacity .2s ease; }
.hdr-collapse--hidden { max-height: 0; opacity: 0; pointer-events: none; }
```

- [ ] **Step 6: 瘦身 `src/App.tsx`**

整檔換成：

```tsx
import { useEffect, useState, type JSX } from 'react';
import { meta } from './data';
import Home from './pages/Home';
import LoginModal from './components/LoginModal';
import Header from './components/Header';
import DailyPlan from './pages/DailyPlan';
import Food from './pages/Food';
import Places from './pages/Places';
import Transport from './pages/Transport';
import AreaMap from './pages/AreaMap';
import Guides from './pages/Guides';
import { TABS, type TabKey } from './lib/tabs';
import { countdownDays } from './lib/countdown';

export { countdownDays };
export type { TabKey };

const PAGES: Record<TabKey, () => JSX.Element> = {
  home: Home, plan: DailyPlan, food: Food, places: Places, trans: Transport, map: AreaMap, guides: Guides,
};

export function parseHash(hash: string): TabKey {
  const raw = hash.replace('#', '');
  return (TABS.some(([k]) => k === raw) ? raw : 'home') as TabKey;
}

export default function App() {
  const [tab, setTab] = useState<TabKey>(() => parseHash(location.hash));
  useEffect(() => {
    const onHash = () => setTab(parseHash(location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const Page = PAGES[tab];

  return (
    <div style={{ minHeight: '100vh' }}>
      <Header tab={tab} onNavigate={(k) => { location.hash = k; }} />
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
```

（`useTripState`/`useAuth`/`apiBase` 相關 import 全部移進 Header；App 保留 `countdownDays`/`TabKey` re-export 讓 `Home.tsx` 與 `countdown.test.ts` 的既有 import 過渡期不破——下一步隨即改掉它們的 import 路徑後，App 的 re-export 仍保留作為公開介面。）

- [ ] **Step 7: 更新 `Home.tsx` 與 `countdown.test.ts` 的 import**

`src/pages/Home.tsx` 第 2 行：

```ts
import { countdownDays } from '../lib/countdown';
```

`src/__tests__/countdown.test.ts` 的 import：

```ts
import { countdownDays } from '../lib/countdown';
```

- [ ] **Step 8: 執行測試與全量驗證**

Run: `npx vitest run src/components/__tests__/Header.test.tsx`
Expected: PASS（4 個測試）

Run: `npm test && npx tsc -b --noEmit && npm run lint`
Expected: 全部 PASS、無型別錯誤、無 lint 錯誤

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(ui): Header 抽出並支援捲動收合成細列（tabs 橫捲/迷你logo/切頁捲頂）"
```

---

### Task 10: 視覺打磨（觸控/焦點/動畫/橫捲/reduced-motion）

**Files:**
- Modify: `src/styles.css`
- Modify: `src/pages/DailyPlan.tsx`（日期鈕列橫捲）
- Modify: `src/pages/Home.tsx`（快速連結卡 `.card-tap`）
- Modify: `src/pages/Guides.tsx`（展開動畫結構）
- Test: `src/pages/__tests__/Guides.test.tsx`（配合動畫結構更新兩處斷言）

**Interfaces:**
- Consumes: `.hscroll`（Task 9）。
- Produces: CSS classes `.card-tap`、`.guide-body`/`.guide-body--open`；全站 `:focus-visible`。

- [ ] **Step 1: 更新 Guides 測試（動畫結構後內文常駐 DOM，改用 class 斷言）**

`src/pages/__tests__/Guides.test.tsx` 中兩個測試改成：

```tsx
  it('預設收合，點擊標題展開內文', () => {
    const { container } = render(<Guides />);
    expect(container.querySelector('.guide-body--open')).toBeNull();
    fireEvent.click(screen.getByText('大阪美食攻略'));
    expect(container.querySelector('.guide-body--open')).toBeTruthy();
  });
```

```tsx
  it('展開命中卡片後內文以 mark 標亮', () => {
    const { container } = render(<Guides />);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '章魚燒' } });
    fireEvent.click(screen.getByText('大阪美食攻略'));
    const marks = [...container.querySelectorAll('.guide-body mark.search-hit')].map((m) => m.textContent);
    expect(marks).toContain('章魚燒');
  });
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/pages/__tests__/Guides.test.tsx`
Expected: FAIL（尚無 `.guide-body` 結構）

- [ ] **Step 3: 改 `src/pages/Guides.tsx` 展開結構**

`GuideCard` 中：

1. 標題列 div 加上 `card-tap` class：

```tsx
      <div className="card-tap" onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '16px 22px', cursor: 'pointer',
      }}>
```

2. 條件渲染的內文區換成常駐 grid 結構（`useMarkText` 的 `enabled` 仍是 `isOpen`，收合時 cleanup 還原標記）：

```tsx
      <div className={`guide-body${isOpen ? ' guide-body--open' : ''}`}>
        <div>
          <div ref={bodyRef} className="dash-top" style={{ padding: '2px 22px 18px' }}>
            <MarkdownBody>{g.body}</MarkdownBody>
          </div>
        </div>
      </div>
```

（原本的 `{isOpen && (...)}` 整段刪除。11 篇攻略的 markdown 常駐渲染，資料量小、可接受。）

- [ ] **Step 4: 改 `src/pages/DailyPlan.tsx` 日期鈕列**

第 15–27 行的外層 div 改成——日期鈕包進 `.hscroll`，檢視切換鈕留在右側：

```tsx
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
```

（`VIEWS` 那段與後續不變。）

- [ ] **Step 5: 改 `src/pages/Home.tsx` 快速連結卡**

快速連結按鈕的 className 加 `card-tap`：

```tsx
              <button key={q.label} className="card btn-plain card-tap" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer' }}
```

- [ ] **Step 6: styles.css append（打磨樣式 + reduced-motion）**

```css
.heart { padding: 12px; margin: -10px; }
.chip { min-height: 36px; }
:focus-visible { outline: 2px solid var(--red); outline-offset: 2px; }
.card-tap { transition: transform .15s ease, box-shadow .15s ease; }
.card-tap:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(41,35,26,.12); }
.card-tap:active { transform: scale(.98); }
.guide-body { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .2s ease; }
.guide-body--open { grid-template-rows: 1fr; }
.guide-body > div { min-height: 0; overflow: hidden; }
@media (prefers-reduced-motion: reduce) {
  .fade-up { animation: none; }
  .hdr-collapse, .card-tap, .guide-body { transition: none; }
}
```

注意：`.heart` 既有規則在 styles.css 第 40 行已有 `padding: 2px`——把該行的 `padding: 2px` 改為 `padding: 12px`，並在同一行加 `margin: -10px`（**不要**留兩條重複規則）。最終該行為：

```css
.heart { flex: none; background: none; border: none; cursor: pointer; font-size: 20px; line-height: 1; padding: 12px; margin: -10px; color: rgba(41,35,26,.35); }
```

（上方 append 區塊中就**不再**重複 `.heart`；`.chip` 的 `min-height` 為新增屬性，append 即可。）

- [ ] **Step 7: 執行測試確認通過**

Run: `npx vitest run src/pages/__tests__/Guides.test.tsx`
Expected: PASS（6 個測試）

Run: `npm test && npx tsc -b --noEmit && npm run lint`
Expected: 全部 PASS

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(ui): 視覺打磨（觸控熱區/focus-visible/卡片回饋/攻略展開動畫/橫捲/reduced-motion）"
```

---

### Task 11: 全量回歸與瀏覽器手動驗證

**Files:** 無新檔案（純驗證）

- [ ] **Step 1: 全量測試、型別、lint**

Run: `npm test`
Expected: 全部 PASS

Run: `npx tsc -b --noEmit`
Expected: 無型別錯誤

Run: `npm run lint`
Expected: 無 oxlint 錯誤

- [ ] **Step 2: 啟動 dev server 手動驗證**

Run: `npx vite --port 5178`（資料 JSON 已在 repo，不需重跑 build:data）

手機視窗（375px）+ 桌面各驗證：

1. 美食庫：打「關東」→ 浮出「關東煮 N」建議；點選 → chip 套用、輸入清空、清單只剩關東煮；打「道頓堀 拉麵」（兩個詞）→ AND 過濾；店名命中處淡金標亮；亂打 → 「沒有符合的店家」
2. 景點・購物：搜尋框過濾兩區、計數即時更新、命中標亮、單區/雙區空狀態
3. 攻略：搜尋過濾 + 「符合 N 篇」；命中卡標題下有上下文片段；展開後內文關鍵字標亮、收合後還原；展開/收合有滑順動畫
4. header：往下捲 → 收成細列（迷你阪 logo + tabs 橫捲）、不抖動；捲回頂 → 展開；細列點迷你 logo → 平滑捲頂；切 tab → 自動回頂部
5. 手機：tabs 與每日行程日期鈕單列橫滑；♥ 好點不誤觸；輸入框聚焦不放大頁面
6. 桌面：快速連結卡 hover 浮起、按壓回饋;Tab 鍵巡覽有朱色焦點框
7. 舊網址 `#food:entity-xxx` 格式 → 回總覽頁不炸

- [ ] **Step 3: 確認 working tree 乾淨**

Run: `git status`
Expected: clean（Task 1–10 已各自 commit）

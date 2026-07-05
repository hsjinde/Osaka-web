# 愛心跨裝置同步修復 + 想去清單 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓愛心（想去的地方）在裝置間真正同步（設定連結一鍵設定 + 切回前景自動重抓），並在首頁提供可展開的想去清單。

**Architecture:** 同步後端（Cloudflare Worker + D1）已存在且正常，Worker 程式碼不改。前端改三件事：(1) `?setup=<token>` 網址參數自動存 token；(2) `visibilitychange` 時重抓遠端狀態合併；(3) 首頁橫幅展開 `WishList` 元件。最後重設 `DASH_TOKEN` secret 並產生設定連結。

**Tech Stack:** React 19 + TypeScript（strict）、Vitest + @testing-library/react（jsdom）、Cloudflare Worker（Hono）+ D1、wrangler。

**Spec:** `docs/superpowers/specs/2026-07-06-fav-sync-and-wishlist-design.md`

## Global Constraints

- 不新增任何 npm 依賴。
- 程式碼風格照現有：2 空格縮排、單引號、繁中註解、單檔小而聚焦。
- Commit 訊息用繁中、照現有格式（`feat:` / `test:` / `docs:`），結尾加 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- 測試指令：`npx vitest run <path>`（全跑：`npm test`）；lint：`npm run lint`。
- Worker 程式碼（`worker/src/index.ts`）不修改。
- 遠端合併語意：先 `flushQueue()` 補送本機佇列，再 `fetchState()` 且遠端優先合併——順序不可顛倒。

---

### Task 1: `?setup=<token>` 設定連結處理

**Files:**
- Modify: `src/api/state.ts`
- Modify: `src/main.tsx`
- Test: `src/api/__tests__/state.test.ts`

**Interfaces:**
- Consumes: 現有 `setToken(t: string): void`、`getToken(): string | null`（`src/api/state.ts`）。
- Produces: `consumeSetupToken(): boolean`（讀網址參數、存 token、清網址）、`setupLink(token: string): string`（產生設定連結）。Task 3 的 ⚙ 按鈕會用 `setupLink`。

- [ ] **Step 1: 寫失敗測試**

在 `src/api/__tests__/state.test.ts` 檔尾新增（import 行改為 `import { queuePut, flushQueue, setToken, getToken, consumeSetupToken, setupLink } from '../state';`）：

```ts
describe('setup 連結', () => {
  beforeEach(() => localStorage.clear());

  it('有 setup 參數：存 token、從網址移除、保留 hash', () => {
    history.replaceState(null, '', '/Osaka-web/?setup=abc123&x=1#food');
    expect(consumeSetupToken()).toBe(true);
    expect(getToken()).toBe('abc123');
    expect(location.search).toBe('?x=1');
    expect(location.hash).toBe('#food');
  });

  it('無參數或空值：不動作、不覆寫既有 token', () => {
    setToken('keep');
    history.replaceState(null, '', '/Osaka-web/');
    expect(consumeSetupToken()).toBe(false);
    history.replaceState(null, '', '/Osaka-web/?setup=');
    expect(consumeSetupToken()).toBe(false);
    expect(getToken()).toBe('keep');
  });

  it('setupLink 產生含 encode 過 token 的連結', () => {
    history.replaceState(null, '', '/Osaka-web/');
    expect(setupLink('a b')).toBe(`${location.origin}/Osaka-web/?setup=a%20b`);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/api/__tests__/state.test.ts`
Expected: FAIL —— `consumeSetupToken` / `setupLink` 沒有 export。

- [ ] **Step 3: 實作**

在 `src/api/state.ts` 檔尾新增：

```ts
/** 讀取網址 ?setup=<token>：存入本機並從網址移除（避免留在瀏覽紀錄）。回傳是否有處理。 */
export function consumeSetupToken(): boolean {
  const params = new URLSearchParams(location.search);
  const t = params.get('setup');
  if (!t) return false;
  setToken(t);
  params.delete('setup');
  const qs = params.toString();
  history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
  return true;
}

/** 產生給新裝置用的設定連結（點一次即完成同步設定）。 */
export function setupLink(token: string): string {
  return `${location.origin}${location.pathname}?setup=${encodeURIComponent(token)}`;
}
```

`src/main.tsx` 在 render 前呼叫（必須在 `TripStateProvider` 掛載前執行，啟動同步才拿得到 token）：

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App.tsx';
import { TripStateProvider } from './state/store';
import { consumeSetupToken } from './api/state';

consumeSetupToken();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TripStateProvider>
      <App />
    </TripStateProvider>
  </StrictMode>,
);
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/api/__tests__/state.test.ts`
Expected: PASS（含既有的 offline queue 測試）。

- [ ] **Step 5: Lint + commit**

```bash
npm run lint
git add src/api/state.ts src/main.tsx src/api/__tests__/state.test.ts
git commit -m "feat: 網址 ?setup= 參數一鍵設定同步 token"
```

---

### Task 2: 切回前景自動重抓遠端狀態

**Files:**
- Modify: `src/api/state.ts`（`BASE` 常數改為 lazy 函式，測試才能 stub env）
- Modify: `src/state/store.tsx`
- Test: `src/state/__tests__/store.test.tsx`

**Interfaces:**
- Consumes: `configured()`、`fetchState()`、`flushQueue()`、`putState()`、`queuePut()`（`src/api/state.ts`，簽名不變）。
- Produces: `TripStateProvider` 行為變更——`visibilitychange` 切回前景且距上次同步 ≥15 秒時重抓合併。對外的 `TripState` 介面不變。

- [ ] **Step 1: `src/api/state.ts` 把 BASE 改為 lazy 讀取**

把檔案開頭的

```ts
const BASE = import.meta.env.VITE_API_BASE as string | undefined;
```

改成

```ts
function apiBase(): string | undefined { return import.meta.env.VITE_API_BASE as string | undefined; }
```

並把三處使用改掉：
- `configured()` → `return !!apiBase() && !!getToken();`
- `fetchState()` 的 URL → `` `${apiBase()}/api/state` ``
- `putState()` 的 URL → `` `${apiBase()}/api/state/${encodeURIComponent(key)}` ``

Run: `npx vitest run src/api/__tests__/state.test.ts`
Expected: PASS（純重構，行為不變）。

- [ ] **Step 2: 寫失敗測試**

在 `src/state/__tests__/store.test.tsx` 檔尾新增，並把 import 行改為：

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
```

```tsx
describe('切回前景重抓', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.stubEnv('VITE_API_BASE', 'http://api.test');
    localStorage.setItem('osaka-dash-token', 'tok');
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('visible 時重抓合併，15 秒內不重複', async () => {
    let getCount = 0;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') return new Response('{"ok":true}', { status: 200 });
      getCount++;
      return new Response(JSON.stringify(getCount >= 2 ? { 'fav:遠端/新增': true } : {}), { status: 200 });
    }));
    const { result } = renderHook(() => useTripState(), { wrapper });
    await act(async () => {}); // 等啟動同步完成
    expect(getCount).toBe(1);

    vi.setSystemTime(Date.now() + 16000);
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(getCount).toBe(2);
    expect(result.current.isFav('遠端/新增')).toBe(true); // 遠端優先合併

    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(getCount).toBe(2); // 最小間隔內不重抓
  });
});
```

（jsdom 的 `document.visibilityState` 預設就是 `'visible'`。若啟動同步的 `await act(async () => {})` 不夠讓 promise 鏈完成，改用 `await vi.waitFor(() => expect(getCount).toBe(1))`。）

- [ ] **Step 3: 跑測試確認失敗**

Run: `npx vitest run src/state/__tests__/store.test.tsx`
Expected: FAIL —— 第二次 `getCount` 仍為 1（目前沒有 visibilitychange 監聽）。

- [ ] **Step 4: 實作 `src/state/store.tsx`**

import 行加 `useRef`：

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
```

把整個「啟動」useEffect（原第 32–48 行）換成共用的 `syncRemote` + 監聽：

```tsx
const SYNC_MIN_INTERVAL_MS = 15000;
```

（放在 `const LS_KEY` 附近的模組層。）Provider 內：

```tsx
  const lastSyncRef = useRef(0);

  // 補送離線佇列 → 拉遠端狀態合併（遠端優先）。啟動與切回前景共用。
  const syncRemote = useCallback(async () => {
    if (!configured()) { setOffline(true); return; }
    try {
      await flushQueue();
      const remote = await fetchState();
      setState((s) => { const merged = { ...s, ...remote }; saveLocal(merged); return merged; });
      setOffline(false);
    } catch { setOffline(true); }
  }, []);

  useEffect(() => {
    lastSyncRef.current = Date.now();
    void syncRemote();
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastSyncRef.current < SYNC_MIN_INTERVAL_MS) return;
      lastSyncRef.current = Date.now();
      void syncRemote();
    };
    const onOnline = () => { flushQueue().then((n) => { if (n > 0) setOffline(false); }); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [syncRemote]);
```

（原本的 `cancelled` 旗標拿掉——React 18+ unmount 後 setState 是 no-op，且共用函式後旗標傳遞複雜度不划算。`fetchState` 的 import 保留，`configured` 已在 import 中。）

- [ ] **Step 5: 跑測試確認通過**

Run: `npx vitest run src/state/__tests__/store.test.tsx`
Expected: PASS（含既有 3 個 localStorage 測試）。

- [ ] **Step 6: 全測試 + lint + commit**

```bash
npm test
npm run lint
git add src/api/state.ts src/state/store.tsx src/state/__tests__/store.test.tsx
git commit -m "feat: 切回前景自動重抓遠端狀態（15 秒最小間隔）"
```

---

### Task 3: ⚙ 按鈕改版 + 未同步提示

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `getToken()`、`setToken()`、`setupLink()`、`configured()`（`src/api/state.ts`，Task 1 已提供 `setupLink`）。
- Produces: 無新 API，純 UI 行為。

- [ ] **Step 1: 修改 `src/App.tsx`**

import 行（第 6 行）改為：

```tsx
import { configured, getToken, setToken, setupLink } from './api/state';
```

⚙ 按鈕（原第 81–85 行）換成：已設定的裝置顯示設定連結供複製，未設定的維持手動輸入備援：

```tsx
        <button className="btn-plain" title="同步設定" style={{ fontSize: 18, cursor: 'pointer' }}
          onClick={() => {
            const cur = getToken();
            if (cur) {
              window.prompt('把這條設定連結存好；新裝置點開一次即完成同步設定：', setupLink(cur));
            } else {
              const t = window.prompt('輸入通行密碼；或在已設定過的裝置按 ⚙ 取得設定連結', '');
              if (t) { setToken(t.trim()); location.reload(); }
            }
          }}>⚙</button>
```

離線標籤（原第 86–90 行）改為區分「未設定」與「斷線」：

```tsx
        {offline && (
          <span style={{ fontSize: 11, color: 'var(--brown)', border: '1px dashed var(--brown)', borderRadius: 4, padding: '2px 8px' }}>
            {configured() ? '離線模式・變更暫存本機' : '尚未同步・點 ⚙ 設定'}
          </span>
        )}
```

- [ ] **Step 2: 全測試 + lint**

Run: `npm test`、`npm run lint`
Expected: 全 PASS（本 task 是 UI 接線，核心邏輯 `setupLink` 已在 Task 1 有測試）。

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: ⚙ 顯示同步設定連結、未設定時顯示引導提示"
```

---

### Task 4: 想去清單（首頁橫幅展開）

**Files:**
- Create: `src/components/WishList.tsx`
- Modify: `src/pages/Home.tsx`
- Test: `src/components/__tests__/wishlist.test.tsx`

**Interfaces:**
- Consumes: `useTripState()` 的 `favs: Record<string, boolean>`（key 格式 `fav:<entityId>`）、`Heart`（`src/components/Heart.tsx`，props `{ entityId: string }`，點擊即 toggleFav）、`MapLink`（props `{ name: string; area?: string }`）、`CATEGORIES` 與 `Entity`（`src/data/schema.ts`）、`entities`（`src/data`）。
- Produces: `WishList`（default export，props `{ items: Entity[] }`）——由呼叫端（Home）負責篩出已標記的 entities，元件本身只管分組呈現。

- [ ] **Step 1: 寫失敗測試**

新檔 `src/components/__tests__/wishlist.test.tsx`：

```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TripStateProvider } from '../../state/store';
import WishList from '../WishList';
import type { Entity } from '../../data/schema';

const ent = (id: string, category: Entity['category'], name: string, area = '難波'): Entity => ({
  id, category, name, tags: [], updated: '', favorite: false, fields: {}, summary: '', body: '', area, rating: null,
});

describe('WishList', () => {
  beforeEach(() => localStorage.clear());

  it('依分類分組，顯示名稱、區域與地圖連結', () => {
    render(
      <TripStateProvider>
        <WishList items={[ent('餐廳/一蘭', '餐廳', '一蘭拉麵'), ent('景點/通天閣', '景點', '通天閣', '新世界')]} />
      </TripStateProvider>,
    );
    expect(screen.getByText('一蘭拉麵')).toBeTruthy();
    expect(screen.getByText('通天閣')).toBeTruthy();
    expect(screen.getByText('新世界')).toBeTruthy();
    expect(screen.getAllByTitle(/在 Google 地圖搜尋/)).toHaveLength(2);
    // 分組標題：餐廳在景點前（CATEGORIES 順序）
    const headers = screen.getAllByText(/^(餐廳|景點)$/).map((el) => el.textContent);
    expect(headers).toEqual(['餐廳', '景點']);
  });

  it('點 ♥ 取消標記（寫回 state）', () => {
    localStorage.setItem('osaka-trip-state', JSON.stringify({ 'fav:餐廳/一蘭': true }));
    render(
      <TripStateProvider>
        <WishList items={[ent('餐廳/一蘭', '餐廳', '一蘭拉麵')]} />
      </TripStateProvider>,
    );
    fireEvent.click(screen.getAllByLabelText('收藏')[0]);
    expect(JSON.parse(localStorage.getItem('osaka-trip-state')!)['fav:餐廳/一蘭']).toBe(false);
  });

  it('空清單顯示提示', () => {
    render(<TripStateProvider><WishList items={[]} /></TripStateProvider>);
    expect(screen.getByText(/還沒有標記/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/components/__tests__/wishlist.test.tsx`
Expected: FAIL —— 找不到模組 `../WishList`。

- [ ] **Step 3: 實作 `src/components/WishList.tsx`**

```tsx
import { CATEGORIES, type Entity } from '../data/schema';
import Heart from './Heart';
import MapLink from './MapLink';

/** 想去清單：依分類分組列出已標記的地點。items 由呼叫端篩選。 */
export default function WishList({ items }: { items: Entity[] }) {
  if (items.length === 0) {
    return (
      <div className="card" style={{ fontSize: 13, color: 'var(--brown)' }}>
        還沒有標記，去美食庫、景點與購物頁按 ♡。
      </div>
    );
  }
  const groups = CATEGORIES
    .map((c) => [c, items.filter((e) => e.category === c)] as const)
    .filter(([, list]) => list.length > 0);
  return (
    <div className="card fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {groups.map(([cat, list]) => (
        <div key={cat}>
          <div className="serif" style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>
            {cat} <span style={{ fontSize: 12, color: 'var(--brown)', fontWeight: 400 }}>{list.length}</span>
          </div>
          {list.map((e) => (
            <div key={e.id} className="dash-bottom" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 2px' }}>
              <Heart entityId={e.id} />
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{e.name}</span>
              {e.area && (
                <span style={{ fontSize: 11, color: 'var(--brown)', border: '1px solid var(--line)', borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap' }}>
                  {e.area}
                </span>
              )}
              <span style={{ flex: 1 }} />
              <MapLink name={e.name} area={e.area} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/components/__tests__/wishlist.test.tsx`
Expected: PASS（3 個測試）。

- [ ] **Step 5: 接上首頁 `src/pages/Home.tsx`**

import 區改為：

```tsx
import { useState } from 'react';
import { countdownDays } from '../App';
import { byCategory, entities, meta, overview, todos } from '../data';
import { useTripState } from '../state/store';
import WishList from '../components/WishList';
```

元件開頭改為：

```tsx
export default function Home() {
  const { todosState, toggleTodo, favCount, favs } = useTripState();
  const [wishOpen, setWishOpen] = useState(false);
  const favEntities = entities.filter((e) => favs[`fav:${e.id}`]);
```

「收藏統計橫幅」區塊（原第 109–119 行的 `<div className="banner-dark" ...>`）換成可點擊按鈕 + 條件展開：

```tsx
          {/* 收藏統計橫幅（點擊展開想去清單） */}
          <button className="banner-dark btn-plain" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', cursor: 'pointer', textAlign: 'left', width: '100%' }}
            onClick={() => setWishOpen((o) => !o)}>
            <div className="serif" style={{ writingMode: 'vertical-rl', fontSize: 14, fontWeight: 700, letterSpacing: '.3em', borderRight: '1px solid rgba(239,233,218,.3)', paddingRight: 10 }}>已標記</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span className="serif" style={{ fontSize: 40, fontWeight: 800, color: 'var(--gold)' }}>{favCount}</span>
              <span style={{ fontSize: 13 }}>個想去的地方</span>
            </div>
            <div style={{ flex: 1, fontSize: 12, color: 'rgba(239,233,218,.72)', minWidth: 150 }}>
              在美食庫、景點與購物頁按 ♡ 標記，地圖頁會依區域統計。
            </div>
            <span style={{ fontSize: 12, color: 'var(--gold)', whiteSpace: 'nowrap' }}>{wishOpen ? '▲ 收合' : '▼ 展開清單'}</span>
          </button>
          {wishOpen && <WishList items={favEntities} />}
```

- [ ] **Step 6: 全測試 + lint + commit**

```bash
npm test
npm run lint
git add src/components/WishList.tsx src/components/__tests__/wishlist.test.tsx src/pages/Home.tsx
git commit -m "feat: 首頁橫幅展開想去清單（分類分組＋地圖連結＋可取消標記）"
```

---

### Task 5: 重設 DASH_TOKEN、部署與端對端驗證

**Files:**
- 無程式碼變更（wrangler secret + 部署 + 驗證）。

**Interfaces:**
- Consumes: Task 1–4 全部完成並 commit；`cloudflare-use` skill（Cloudflare 認證與慣例——執行本 task 前先 invoke）。
- Produces: 新的 `DASH_TOKEN`、給使用者的設定連結。

- [ ] **Step 1: Invoke `cloudflare-use` skill 取得 wrangler 認證方式**

依該 skill 的流程準備 Cloudflare 憑證與 worker 目錄慣例。

- [ ] **Step 2: 產生新 token 並更新 Worker secret**

```powershell
$token = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
Write-Output $token   # 記下來，Step 4/5 要用
$token | npx wrangler secret put DASH_TOKEN --config worker/wrangler.toml
```

（若 `wrangler.toml` 位置不同，先 `Get-ChildItem -Recurse -Filter wrangler.toml -Depth 2` 找到再帶入；secret 更新即時生效，不需重新 deploy Worker。）

- [ ] **Step 3: 驗證 Worker 收新 token**

```powershell
curl.exe -s -o NUL -w "%{http_code}" -H "Authorization: Bearer $token" https://osaka-dashboard.ethan19980803.workers.dev/api/state
```

Expected: `200`。（不帶 token 應仍是 `401`。）

- [ ] **Step 4: 本機端對端驗證（preview tools）**

1. 啟動 dev server（`npm run dev`，經 preview_start）。
2. 開 `http://localhost:5173/?setup=<新token>`，確認：網址列的 `setup` 參數消失、header 沒有「尚未同步」標籤。
3. 在美食庫按一個 ♡，用 `curl.exe -H "Authorization: Bearer $token" https://osaka-dashboard.ethan19980803.workers.dev/api/state` 確認該 key 出現且為 true。
4. 回首頁點橫幅，確認清單展開、剛標記的店在清單上、點 ♥ 可取消。
5. preview_screenshot 留證。

- [ ] **Step 5: Push 部署 + 交付設定連結**

```bash
git push
```

等 Pages workflow 完成後，把設定連結交給使用者（**這是唯一一次顯示，請使用者存好**）：

```
https://hsjinde.github.io/Osaka-web/?setup=<新token>
```

提醒：現有裝置與新裝置都要點一次這條連結（舊 token 已失效）。並更新記憶檔 `deploy-and-domain.md` 註記「DASH_TOKEN 已於 2026-07-06 重設，設定連結交付使用者」。

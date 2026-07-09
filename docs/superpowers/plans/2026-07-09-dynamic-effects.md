# 動態效果強化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 下載 claude-directory 的 animations-loaders 參考碼（排除影片）到 `docs/reference/`，並以純 CSS + IntersectionObserver 為 Osaka-web 加上四類動態效果：滾動進場、和風微互動、頁面切換過渡、同步載入動畫。

**Architecture:** 全部效果以 CSS class 切換驅動（keyframes/transition），JS 只負責在對的時機加 class：`useReveal` hook（IntersectionObserver）管滾動進場、`Heart` 元件內部 state 管收藏彈跳、`App.tsx` 的 `key={tab}` 重掛載管換頁過渡、`store.tsx` 新增 `syncing` 旗標驅動 Header 的朱印 loader。

**Tech Stack:** React 19 + TypeScript、純 CSS（`src/styles.css`）、Vitest + @testing-library/react（jsdom）。

## Global Constraints

- **零新依賴**：不得新增任何 npm 套件。
- 所有新動畫必須收進 `src/styles.css` 尾端既有的 `@media (prefers-reduced-motion: reduce)` 區塊。
- 顏色只用既有 CSS 變數（`--red`、`--ink`、`--line` 等），不新增色票。
- jsdom 沒有 `IntersectionObserver`：`useReveal` 必須在其不存在時直接把元素視為可見。
- Lint 用 oxlint（`npm run lint`）；測試跑 `npx vitest run <path>`。
- Commit 訊息用繁中 conventional commit，結尾加 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- `docs/` 不在 Vite build 範圍，參考碼不得放進 `src/`。

---

### Task 1: 下載 animations-loaders 參考碼到 docs/reference/

**Files:**
- Create: `docs/reference/claude-directory/README.md`
- Create: `docs/reference/claude-directory/animations-loaders/**`（自上游複製，排除影音）

**Interfaces:**
- Produces: 純參考資料，後續任務不 import 它。

- [ ] **Step 1: sparse clone 到暫存目錄**

在 PowerShell 執行（`$env:TEMP` 下操作，避免污染專案）：

```powershell
$tmp = Join-Path $env:TEMP "claude-directory-ref"
if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
git clone --depth 1 --filter=blob:none --sparse https://github.com/pulkitxm/claude-directory $tmp
git -C $tmp sparse-checkout set animations-loaders
```

Expected: clone 成功，`$tmp\animations-loaders` 下有 12 個子資料夾。

- [ ] **Step 2: 複製到 docs/reference/，排除影音與肥大檔案**

```powershell
$dest = "D:\Osaka-web\docs\reference\claude-directory\animations-loaders"
New-Item -ItemType Directory -Force $dest | Out-Null
robocopy (Join-Path $tmp "animations-loaders") $dest /E /XF *.mp4 *.webm *.mov *.gif *.png *.jpg *.jpeg *.webp *.lock package-lock.json /XD node_modules .git
```

Expected: robocopy 結束碼 ≤ 3（1=有複製檔案）。確認沒有任何 `*.mp4`：

```powershell
Get-ChildItem $dest -Recurse -Include *.mp4,*.webm | Measure-Object
```

Expected: `Count : 0`。

- [ ] **Step 3: 寫 README 標註來源**

`docs/reference/claude-directory/README.md`：

```markdown
# claude-directory 參考碼

來源：https://github.com/pulkitxm/claude-directory （animations-loaders 分類）
用途：Osaka-web 動態效果的參考範例，**不進 build、不被 import**。
已排除影音與圖片素材以控制 repo 體積。
各子專案的原始 prompt 見其 `prompt.md`。
```

- [ ] **Step 4: 確認體積合理後 commit**

```powershell
"{0:N1} MB" -f ((Get-ChildItem $dest -Recurse | Measure-Object Length -Sum).Sum / 1MB)
```

Expected: 小於 ~5 MB。若超過，找出肥大檔案再加排除規則重跑 Step 2。

```powershell
git add docs/reference
git commit -m "docs: 納入 claude-directory animations-loaders 參考碼（排除影音）"
```

---

### Task 2: useReveal hook + reveal CSS（滾動進場）

**Files:**
- Create: `src/lib/useReveal.ts`
- Test: `src/lib/__tests__/useReveal.test.ts`
- Modify: `src/styles.css`（新增 `.reveal` 樣式與 reduced-motion 條目）

**Interfaces:**
- Produces: `useReveal(): React.RefCallback<HTMLElement>` — 把回傳的 ref 掛到元素上，元素初始帶 `reveal` class，進入視窗後加 `reveal--in`。stagger 靠元素自己的 inline `--reveal-delay` CSS 變數。

- [ ] **Step 1: 寫失敗測試**

`src/lib/__tests__/useReveal.test.ts`：

```ts
// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useReveal } from '../useReveal';

function mountWithRef(ref: (el: HTMLElement | null) => void) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  ref(el);
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('useReveal', () => {
  it('無 IntersectionObserver（jsdom）時直接標記為已進場', () => {
    const { result } = renderHook(() => useReveal());
    const el = mountWithRef(result.current);
    expect(el.classList.contains('reveal--in')).toBe(true);
  });

  it('有 IntersectionObserver 時先加 reveal，交叉後加 reveal--in 並解除觀察', () => {
    let capturedCb: IntersectionObserverCallback = () => {};
    const unobserve = vi.fn();
    vi.stubGlobal('IntersectionObserver', class {
      constructor(cb: IntersectionObserverCallback) { capturedCb = cb; }
      observe() {}
      unobserve = unobserve;
      disconnect() {}
    });
    const { result } = renderHook(() => useReveal());
    const el = mountWithRef(result.current);
    expect(el.classList.contains('reveal')).toBe(true);
    expect(el.classList.contains('reveal--in')).toBe(false);
    capturedCb([{ isIntersecting: true, target: el } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
    expect(el.classList.contains('reveal--in')).toBe(true);
    expect(unobserve).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/__tests__/useReveal.test.ts`
Expected: FAIL — `Cannot find module '../useReveal'`（或同義錯誤）。

- [ ] **Step 3: 實作 hook**

`src/lib/useReveal.ts`：

```ts
import { useCallback, useRef } from 'react';
import type { RefCallback } from 'react';

/** 滾動進場：掛上回傳的 ref，元素進入視窗時加 `reveal--in`。 */
export function useReveal(): RefCallback<HTMLElement> {
  const obRef = useRef<IntersectionObserver | null>(null);
  return useCallback((el) => {
    obRef.current?.disconnect();
    obRef.current = null;
    if (!el) return;
    el.classList.add('reveal');
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('reveal--in');
      return;
    }
    const ob = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('reveal--in');
        ob.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    ob.observe(el);
    obRef.current = ob;
  }, []);
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/__tests__/useReveal.test.ts`
Expected: PASS（2 tests）。

- [ ] **Step 5: 加 CSS**

在 `src/styles.css` 的 `.fade-up` 定義（第 17 行附近）之後加入：

```css
.reveal { opacity: 0; transform: translateY(14px); }
.reveal--in { opacity: 1; transform: none; transition: opacity .5s ease, transform .5s cubic-bezier(.22,.9,.35,1); transition-delay: var(--reveal-delay, 0s); }
```

並把檔尾的 reduced-motion 區塊改成（新增 `.reveal` 兩行）：

```css
@media (prefers-reduced-motion: reduce) {
  .fade-up { animation: none; }
  .hdr-collapse, .card-tap, .guide-body { transition: none; }
  .reveal { opacity: 1; transform: none; }
  .reveal--in { transition: none; }
}
```

- [ ] **Step 6: Commit**

```powershell
git add src/lib/useReveal.ts src/lib/__tests__/useReveal.test.ts src/styles.css
git commit -m "feat: useReveal hook 與滾動進場樣式"
```

---

### Task 3: 卡片列表與行程區塊套用 reveal

**Files:**
- Create: `src/components/Reveal.tsx`
- Test: `src/components/__tests__/Reveal.test.tsx`
- Modify: `src/pages/Places.tsx`（兩處 `cards-grid` 的卡片外層）
- Modify: `src/pages/Food.tsx`（`cards-grid` 的卡片外層）
- Modify: `src/pages/DailyPlan.tsx`（每日區塊外層）

**Interfaces:**
- Consumes: Task 2 的 `useReveal()`。
- Produces: `<Reveal index={n}>{children}</Reveal>` — 包一層 `div`，自動掛 ref 與 `--reveal-delay: index*60ms`（上限 300ms）。

- [ ] **Step 1: 寫失敗測試**

`src/components/__tests__/Reveal.test.tsx`：

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Reveal from '../Reveal';

describe('Reveal', () => {
  it('渲染子內容並依 index 設定 --reveal-delay', () => {
    render(<Reveal index={2}><span>內容</span></Reveal>);
    const el = screen.getByText('內容').parentElement!;
    expect(el.style.getPropertyValue('--reveal-delay')).toBe('120ms');
    // jsdom 無 IntersectionObserver → useReveal 直接標記進場
    expect(el.classList.contains('reveal--in')).toBe(true);
  });

  it('delay 上限 300ms', () => {
    render(<Reveal index={99}><span>晚來的</span></Reveal>);
    const el = screen.getByText('晚來的').parentElement!;
    expect(el.style.getPropertyValue('--reveal-delay')).toBe('300ms');
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/components/__tests__/Reveal.test.tsx`
Expected: FAIL — 找不到模組 `../Reveal`。

- [ ] **Step 3: 實作元件**

`src/components/Reveal.tsx`：

```tsx
import type { CSSProperties, ReactNode } from 'react';
import { useReveal } from '../lib/useReveal';

/** 滾動進場包裝：index 決定 stagger 延遲（60ms/個，上限 300ms）。 */
export default function Reveal({ index = 0, children }: { index?: number; children: ReactNode }) {
  const ref = useReveal();
  const style = { '--reveal-delay': `${Math.min(index * 60, 300)}ms` } as CSSProperties;
  return <div ref={ref} style={style}>{children}</div>;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/components/__tests__/Reveal.test.tsx`
Expected: PASS（2 tests）。

- [ ] **Step 5: 套用到頁面**

三個檔案的改法一致：找到列表 `.map(...)` 產出的卡片元素，用 `<Reveal index={i}>` 包住（`.map` 需有第二參數 `i`；`key` 移到 `Reveal` 上）。範例（`src/pages/Places.tsx` 的 `cards-grid`，兩處都改）：

```tsx
// 修改前（示意）：
{list.map((e) => <EntityCard key={e.id} e={e} />)}
// 修改後：
{list.map((e, i) => <Reveal key={e.id} index={i}><EntityCard e={e} /></Reveal>)}
```

`src/pages/Food.tsx` 的 `cards-grid` 同法。`src/pages/DailyPlan.tsx` 對每個 Day 區塊（最外層 `.map` 的直接子元素）同法。實際變數名以現場程式碼為準；只包列表項，不動排序與 props。記得在各檔案加 `import Reveal from '../components/Reveal';`。

- [ ] **Step 6: 跑相關頁面既有測試**

Run: `npx vitest run src/pages/__tests__/Places.test.tsx src/pages/__tests__/Food.test.tsx`
Expected: PASS（jsdom 下 Reveal 立即標記 `reveal--in`，不影響查詢）。

- [ ] **Step 7: Commit**

```powershell
git add src/components/Reveal.tsx src/components/__tests__/Reveal.test.tsx src/pages/Places.tsx src/pages/Food.tsx src/pages/DailyPlan.tsx
git commit -m "feat: 卡片與行程區塊滾動進場動畫"
```

---

### Task 4: 和風微互動（Heart 彈跳、Stamp 蓋章、卡片抬起）

**Files:**
- Modify: `src/components/Heart.tsx`
- Modify: `src/components/__tests__/Heart.test.tsx`（新增一測）
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: 無。
- Produces: CSS class `heart--pop`（點擊後短暫存在）、`stamp` 進場動畫、強化的 `.card-tap`。

- [ ] **Step 1: 寫失敗測試（Heart 點擊出現 heart--pop）**

在 `src/components/__tests__/Heart.test.tsx` 現有 describe 內新增（沿用該檔既有的 Provider包裝方式；若既有測試有 helper 就用同一個）：

```tsx
it('點擊收藏時加上 heart--pop 動畫 class', async () => {
  // 使用該測試檔既有的 render 包裝（TripStateProvider + auth 可編輯狀態）
  renderHeart(); // ← 以現場既有 helper / render 呼叫為準
  const btn = screen.getByRole('button', { name: '收藏' });
  await userEvent.click(btn);
  expect(btn.className).toContain('heart--pop');
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/components/__tests__/Heart.test.tsx`
Expected: 新測試 FAIL（class 不含 heart--pop），其餘 PASS。

- [ ] **Step 3: 實作 Heart 彈跳**

`src/components/Heart.tsx` 全檔改為：

```tsx
import { useState } from 'react';
import { useAuth } from '../state/auth';
import { useTripState } from '../state/store';

export default function Heart({ entityId }: { entityId: string }) {
  const { isFav, toggleFav } = useTripState();
  const { canEdit, openLogin } = useAuth();
  const [pop, setPop] = useState(false);
  const on = isFav(entityId);
  return (
    <button className={`heart${on ? ' heart--on' : ''}${pop ? ' heart--pop' : ''}`} aria-label="收藏"
      style={canEdit ? undefined : { opacity: 0.4 }}
      onAnimationEnd={() => setPop(false)}
      onClick={() => { if (canEdit) { toggleFav(entityId); setPop(true); } else openLogin(); }}>
      {on ? '♥' : '♡'}
    </button>
  );
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/components/__tests__/Heart.test.tsx`
Expected: 全部 PASS。

- [ ] **Step 5: 加 CSS（三個微互動一起）**

`src/styles.css`——在 `.heart--on` 之後加：

```css
@keyframes heartPop { 0% { transform: scale(1); } 40% { transform: scale(1.45); } 70% { transform: scale(.92); } 100% { transform: scale(1); } }
.heart--pop { animation: heartPop .35s ease; }
@keyframes stampIn { from { opacity: 0; transform: rotate(-14deg) scale(1.5); } to { opacity: 1; transform: rotate(-6deg) scale(1); } }
.stamp { animation: stampIn .35s cubic-bezier(.2,1.4,.4,1) both; }
```

（`.stamp` 既有規則不動，另起一行只加 animation。）強化卡片抬起——把既有 `.card-tap:hover` 改為：

```css
.card-tap:hover { transform: translateY(-2px) rotate(-.2deg); box-shadow: 0 6px 18px rgba(41,35,26,.16); }
```

reduced-motion 區塊補：

```css
  .heart--pop, .stamp { animation: none; }
```

- [ ] **Step 6: Commit**

```powershell
git add src/components/Heart.tsx src/components/__tests__/Heart.test.tsx src/styles.css
git commit -m "feat: 和風微互動——收藏彈跳、蓋章進場、卡片抬起"
```

---

### Task 5: 頁面切換過渡強化

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: 既有 `key={tab}` 重掛載機制。
- Produces: `.page-enter` class（套在 `<main>` 內的包裝 div）。

- [ ] **Step 1: 加 CSS**

`src/styles.css`——`.fade-up` 之後加：

```css
@keyframes pageIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
.page-enter { animation: pageIn .38s cubic-bezier(.22,.9,.35,1) both; }
```

reduced-motion 區塊補 `.page-enter { animation: none; }`（可併入既有 `.fade-up` 那行：`.fade-up, .page-enter { animation: none; }`）。

- [ ] **Step 2: 改 App.tsx**

`src/App.tsx:42` 的 `<Page key={tab} />` 改為：

```tsx
<div className="page-enter" key={tab}><Page /></div>
```

（各頁根元素的 `.fade-up` 保留不動——動畫曲線相近，疊加無感知問題；移除屬跨檔清理，YAGNI。）

- [ ] **Step 3: 跑 App 相關測試 + lint**

Run: `npx vitest run src/components/__tests__/Header.test.tsx && npm run lint`
Expected: PASS、lint 無錯。

- [ ] **Step 4: Commit**

```powershell
git add src/App.tsx src/styles.css
git commit -m "feat: 分頁切換加入頁面過渡動畫"
```

---

### Task 6: 同步中朱印 loader

**Files:**
- Modify: `src/state/store.tsx`（新增 `syncing` 旗標）
- Modify: `src/state/__tests__/store.test.tsx`（新增一測）
- Create: `src/components/SyncSeal.tsx`
- Test: `src/components/__tests__/SyncSeal.test.tsx`
- Modify: `src/components/Header.tsx`（倒數徽章旁顯示）
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `useTripState()`。
- Produces: `TripState` 介面新增 `syncing: boolean`；`<SyncSeal />` 元件（無 props，自行讀 `useTripState().syncing`，非同步中回傳 `null`）。

- [ ] **Step 1: 寫失敗測試（store 的 syncing）**

在 `src/state/__tests__/store.test.tsx` 新增（沿用該檔既有的 Provider render 方式與 api mock）：

```tsx
it('syncRemote 進行中 syncing 為 true，結束後為 false', async () => {
  // 讓 fetchState 掛在未 resolve 的 promise 上（沿用該檔既有的 vi.mock('../../api/state') 手法）
  let release!: (v: Record<string, boolean>) => void;
  mocked.fetchState.mockReturnValueOnce(new Promise((r) => { release = r; }));
  mocked.apiBase.mockReturnValue('https://example.test'); // 依現場 mock 名稱調整
  const { result } = renderTripState(); // ← 以現場既有 helper 為準
  await waitFor(() => expect(result.current.syncing).toBe(true));
  release({});
  await waitFor(() => expect(result.current.syncing).toBe(false));
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/state/__tests__/store.test.tsx`
Expected: 新測試 FAIL（`syncing` 為 undefined），其餘 PASS。

- [ ] **Step 3: 實作 store 的 syncing**

`src/state/store.tsx` 修改四處：

```tsx
// 1) interface TripState 加一行：
  syncing: boolean;
// 2) Provider 內加 state：
  const [syncing, setSyncing] = useState(false);
// 3) syncRemote 包上旗標：
  const syncRemote = useCallback(async () => {
    if (!apiBase()) { setOffline(true); return; }
    setSyncing(true);
    try {
      if (getToken()) {
        await flushQueue();
      }
      const remote = await fetchState();
      setState((s) => { const merged = { ...s, ...remote }; saveLocal(merged); return merged; });
      setOffline(false);
    } catch { setOffline(true); }
    finally { setSyncing(false); }
  }, []);
// 4) useMemo 的回傳物件加 syncing，依賴陣列加 syncing：
  return { favs, todosState, ..., offline, syncing };
  }, [state, toggle, offline, syncing]);
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/state/__tests__/store.test.tsx`
Expected: 全部 PASS。

- [ ] **Step 5: 寫 SyncSeal 失敗測試**

`src/components/__tests__/SyncSeal.test.tsx`（Provider 包裝沿用 Heart 測試的手法；mock `../../api/state` 讓 `apiBase` 回傳假值、`fetchState` 永不 resolve，即可讓 syncing 停在 true）：

```tsx
// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../api/state', () => ({
  apiBase: () => 'https://example.test',
  configured: () => false,
  getToken: () => null,
  fetchState: () => new Promise(() => {}),
  flushQueue: () => Promise.resolve(0),
  putState: () => Promise.resolve(),
  queuePut: () => {},
}));

import { TripStateProvider } from '../../state/store';
import SyncSeal from '../SyncSeal';

describe('SyncSeal', () => {
  it('同步中顯示朱印 loader', async () => {
    render(<TripStateProvider><SyncSeal /></TripStateProvider>);
    await waitFor(() => expect(screen.getByLabelText('同步中')).toBeTruthy());
    expect(screen.getByLabelText('同步中').className).toContain('seal-loader');
  });
});
```

- [ ] **Step 6: 跑測試確認失敗**

Run: `npx vitest run src/components/__tests__/SyncSeal.test.tsx`
Expected: FAIL — 找不到模組 `../SyncSeal`。

- [ ] **Step 7: 實作 SyncSeal**

`src/components/SyncSeal.tsx`：

```tsx
import { useTripState } from '../state/store';

/** 同步中的朱印 loader：非同步中不渲染。 */
export default function SyncSeal() {
  const { syncing } = useTripState();
  if (!syncing) return null;
  return <span className="seal-loader serif" role="status" aria-label="同步中">印</span>;
}
```

CSS（`src/styles.css`，`.stamp--off` 之後加）：

```css
@keyframes sealPulse {
  0% { transform: rotate(-6deg) scale(1); opacity: .55; }
  50% { transform: rotate(-2deg) scale(1.08); opacity: 1; }
  100% { transform: rotate(-6deg) scale(1); opacity: .55; }
}
.seal-loader {
  flex: none; width: 26px; height: 26px; border-radius: 50%;
  border: 1.4px solid var(--red); color: var(--red);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 800; background: rgba(178,58,30,.05);
  animation: sealPulse 1.1s ease-in-out infinite;
}
```

reduced-motion 區塊補 `.seal-loader { animation: none; }`。

- [ ] **Step 8: 跑測試確認通過**

Run: `npx vitest run src/components/__tests__/SyncSeal.test.tsx`
Expected: PASS。

- [ ] **Step 9: 掛進 Header**

`src/components/Header.tsx`：`import SyncSeal from './SyncSeal';`，在倒數徽章（「出發倒數」那個 div）前面加 `<SyncSeal />`：

```tsx
          <div style={{ flex: 1 }} />
          <SyncSeal />
          <div style={{ /* 出發倒數徽章，原樣不動 */ }}>
```

Run: `npx vitest run src/components/__tests__/Header.test.tsx`
Expected: PASS（無 apiBase 時 syncing 恆為 false，SyncSeal 渲染 null，不影響既有斷言）。

- [ ] **Step 10: Commit**

```powershell
git add src/state/store.tsx src/state/__tests__/store.test.tsx src/components/SyncSeal.tsx src/components/__tests__/SyncSeal.test.tsx src/components/Header.tsx src/styles.css
git commit -m "feat: 同步中朱印 loader（store 新增 syncing 旗標）"
```

---

### Task 7: 全量驗證

**Files:** 無新檔。

- [ ] **Step 1: 全套測試 + lint + build**

```powershell
npm test; if ($?) { npm run lint }; if ($?) { npm run build }
```

Expected: 測試全綠、lint 無錯、`tsc -b && vite build` 成功。
（`npm run build` 讀的是既有 `src/data/*.json`，不需 vault。若 build 因缺 data JSON 失敗，先跑一次 `npm run build:data` 需本機 `NOTES_DIR`——沒有 vault 時可略過 build 步驟並回報。）

- [ ] **Step 2: 開發伺服器目視驗證**

啟動 dev server（preview 工具），逐項檢查：
1. 首頁載入：頁面淡入、卡片滾動進場有 stagger
2. 切換分頁：`.page-enter` 過渡順暢
3. 點收藏：愛心彈跳
4. Stamp：進場有蓋章感
5. 卡片 hover：紙張抬起
6. DevTools 模擬 `prefers-reduced-motion: reduce`：所有動畫關閉

- [ ] **Step 3: 若有殘餘變更則 commit**

```powershell
git status --short
```

Expected: 乾淨；有遺漏則補 commit。

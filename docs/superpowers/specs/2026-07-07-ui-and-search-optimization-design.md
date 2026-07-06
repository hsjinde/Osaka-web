# UI 介面與搜尋優化 — 設計文件

日期：2026-07-07
狀態：已核可

## 背景與問題

2026-07-06 上線的全站搜尋（header 常駐搜尋框 + 跨分類下拉結果 + `tab:anchor` 跳轉高亮，見
[2026-07-06-global-search-design.md](2026-07-06-global-search-design.md)）經使用者實際體驗後，
確認**不符合使用習慣**：使用者要的是「在哪個分頁就搜哪類東西」的就地過濾，而不是全站下拉再跳頁。
同時手機版 sticky header 疊了 6 列（標題、倒數、搜尋框、登入鈕、兩排 tabs）約 460px，
在 812px 高的螢幕上佔掉超過一半，滾動時內容區只剩一小條。

本設計做三件事：

1. **搜尋反轉**：移除全站搜尋與跳轉管線，改為美食庫／景點・購物／攻略三頁各自的就地搜尋
2. **Header 捲動收合**：捲過門檻後收成一條細列，拿回內容空間
3. **視覺打磨**：8 項小而具體的手機體驗與互動回饋改善

## 決策（與使用者確認過）

| 議題 | 決定 |
|---|---|
| 搜尋形態 | **分頁各自搜尋、就地過濾**；不做全站搜尋、不做跨頁跳轉（反轉 07-06 的設計） |
| 搜尋入口 | 美食庫（升級現有框）、景點・購物（新增）、攻略（新增）；header 搜尋框移除 |
| 分類建議 | 美食庫搜尋框打「關東」→ 浮出「關東煮 5」選項，點了套用類型篩選（使用者指定的核心需求） |
| 不做搜尋的頁 | 交通（3 筆）、每日行程、總覽、地圖 |
| 先前勾選的全站搜尋擴充 | 「行程納入搜尋」「顯示更多」「鍵盤上下鍵導覽」在就地過濾模型下失去意義，**取消** |
| 搜尋引擎架構 | 擴充手寫純函式邏輯；不引入 Fuse.js/MiniSearch 等套件（中文場景 fuzzy 無用、資料量小） |
| Header 收合機制 | **位置門檻式**（非方向偵測式）：scrollY > 80 收合、< 40 展開，中間為遲滯區防抖 |
| 視覺打磨 | 8 項全做；不動配色、紙質紋理、字體、卡片版式（站的識別，已成熟） |
| 視覺底線 | 「不要很醜」：延續紙質風，不加新顏色與圖示雜訊，標亮用淡金非螢光 |

## A. 搜尋邏輯（`src/lib/search.ts` 重寫）

移除 `searchAll`，改為可組合的純函式（全部 `toLowerCase` 後以 `indexOf` 子字串比對，
**不用 regex**——查詢字串含 `(`、`[` 等特殊字元時不會炸）：

- `tokenize(query: string): string[]` — 以半形與全形（`　`）空白切詞，trim 後為空回 `[]`
- `matchesTokens(haystack: string, tokens: string[]): boolean` — **AND**：每個 token 都出現才算符合
- `scoreEntity(e: Entity, tokens: string[]): number` — 每個 token 取最高權重命中加總：
  名稱 100、標籤 60、區域 50、摘要 30、其他欄位（`fields` 值）20；任一 token 全未命中回 0。
  實體比對範圍**不含 `body`**（實測實體 body 幾乎都是 summary+fields 的重複，加了只會產生噪音）
- `suggestFoodTypes(query: string): { type: string; count: number }[]` — 對 `餐廳` 實體的
  `fields['類型']` 值做 token AND 比對，回傳命中類型與該類店家總數，依數量降冪
- `makeSegments(text: string, tokens: string[]): Segment[]` — 把整段文字切成
  `{ text: string; hit: boolean }[]`，供卡片名稱/摘要標亮命中字段
- `makeSnippet(text: string, tokens: string[], radius = 18): Segment[] | null` — 攻略上下文片段：
  先把 markdown 轉純文字（去圖片/連結語法、`#` 標題符、表格 `|`、反引號，空白摺疊；每篇結果
  module-level 快取），找第一個 token 命中處，擷取前後 `radius` 字，窗內所有 token 命中標 `hit: true`；
  無命中回 `null`（例如只有標題命中）

`Segment` 由共用小元件 `src/components/HitText.tsx` 渲染：`hit: true` 的片段包
`<mark className="search-hit">`（淡金底、細圓角）。

## B. 三頁的就地搜尋

### 1. 美食庫 `src/pages/Food.tsx`（升級現有框）

- 過濾邏輯升級：`tokenize` + `scoreEntity`，比對範圍從現在的「店名/備註/類型/摘要」擴為
  schema 全欄位（名稱/標籤/區域/摘要/fields 值）
- 排序：**有查詢字串時依相關性分數**（同分比 rating）；無查詢字串維持 rating 降冪（現狀）
- **分類建議下拉**：輸入框下方浮層，列出 `suggestFoodTypes` 結果，每列「類型名（命中處標亮）＋
  右側淡棕數量」。點選 → `setCat(type)` + 清空輸入框 + 關閉浮層。Esc 或點擊外部關閉；
  無命中類型時不顯示。浮層樣式：`--card` 底、細線框、柔和陰影、`z-index` 高於卡片
- 卡片的店名與備註/摘要以 `HitText` 渲染，命中字段標亮
- 空狀態：過濾後 0 筆 → 「沒有符合的店家」；「只看已標記」開啟且 0 筆 → 「還沒有標記的店，去按 ♥」
- 「共 N 間」計數保留（現狀）

### 2. 景點・購物 `src/pages/Places.tsx`（新增搜尋框）

- 頁頂加搜尋框，同時過濾景點與購物兩個 section，規則同美食庫（AND + 相關性排序 + 命中標亮）
- 兩區標題的「N 處」隨過濾即時更新；某區 0 筆時顯示該區空狀態提示，兩區皆空顯示整頁提示
- **不做**分類建議（此頁沒有類型篩選 chips，建議了沒東西可套）

### 3. 攻略 `src/pages/Guides.tsx`（新增搜尋框）

- 頁頂加搜尋框，以「標題＋內文」token AND 過濾攻略卡片，顯示「符合 N 篇」
- 命中卡片的標題下方顯示 `makeSnippet` 上下文片段（命中處標亮）——回答「為什麼這篇有符合」
- 展開命中卡片時，內文所有 token 出現處自動包 `<mark class="search-hit">`：
  新 hook `src/lib/useMarkText.ts`（見下），收合、換關鍵字或清空搜尋時還原
- 標題以 `HitText` 渲染命中標亮

### 共用輸入框元件 `src/components/SearchField.tsx`

三頁共用：統一樣式（`--card` 底、細線框、圓角 8）、手機字級 16px（防 iOS 聚焦自動放大）、
非空時右側顯示 ✕ 清除鈕、支援 `placeholder` 與受控 `value`/`onChange`。
美食庫的分類建議浮層以 children/slot 塞進來，Places/Guides 用素的。

### `useMarkText(containerRef, tokens, enabled)` hook

- `enabled` 且 `tokens` 非空時：走訪 container 內文字節點（`TreeWalker`），對每個 token 出現處
  用 `Range.surroundContents` 或手動 split+wrap 包上 `<mark class="search-hit">`
- cleanup（deps 變更或 unmount）：unwrap 所有 mark、`normalize()` 合併文字節點
- 安全性依據：MarkdownBody 渲染後該子樹對固定的 guide body 不會再 re-render，
  DOM 修改不會和 React reconciler 打架；cleanup 在收合（子樹卸載）前執行

## C. 全站搜尋移除清單

| 檔案 | 動作 |
|---|---|
| `src/components/SearchBar.tsx` + 測試 | 刪除 |
| `src/lib/search.ts` 的 `searchAll` + 測試 | 重寫為 A 節的純函式與新測試 |
| `src/lib/useScrollHighlight.ts` + 測試 | 刪除 |
| `src/App.tsx` | `parseHash` 退回純 tab 解析（移除 anchor 段）、移除 `anchor` state、
  `PAGES` 型別退回 `Record<TabKey, () => JSX.Element>`、移除 `<SearchBar />` |
| `src/pages/{Food,Places,Transport,Guides}.tsx` | 移除 `highlightId` prop、`useScrollHighlight`
  呼叫、卡片 `entity-*`/`guide-*` DOM id；Guides 移除 highlightId 自動展開 effect |
| `src/styles.css` | 移除 `searchFlash` keyframes 與 `.search-highlight` |
| 各頁測試 | 高亮相關測試刪除，改寫為新搜尋行為的測試 |

07-06 的全站搜尋設計文件與實作計畫保留在 repo 作為歷史紀錄，本文件為其後繼。

## D. Header 捲動收合

### 結構

Header 從 `App.tsx` 抽成 `src/components/Header.tsx`（App.tsx 已 135 行）。
App 傳入：`tab`、`onNavigate`、其餘資料（倒數、日期字串、美食數）Header 自己從 `data`/hooks 取。
登入列（⚙／登出／離線徽章／登入編輯鈕）搬進 Header 且**只在完整態渲染**；
`LoginModal` 是全域覆蓋層，留在 App。

### 新 hook `src/lib/useCondensedHeader.ts`

- `useCondensedHeader(collapseAt = 80, expandAt = 40): boolean`
- scroll 監聽（`passive: true`）+ `requestAnimationFrame` 節流；
  `scrollY > collapseAt` → `true`；`scrollY < expandAt` → `false`；之間維持原值（遲滯防抖）

### 兩種狀態

- **完整態**（接近頂部）：現有內容不動——標題、日期、倒數徽章、登入列、tabs。
  唯一調整：tabs 改單列橫向捲動（`.hscroll`，見 E-1）
- **收合態**：一條約 52px 細列：`[阪]` 迷你 logo（約 28px，點擊 `window.scrollTo({ top: 0,
  behavior: 'smooth' })`）＋ tabs 橫捲佔剩餘寬度。**無搜尋 icon**（header 已無搜尋功能）。
  倒數徽章、登入鈕、日期副標不渲染（倒數首頁卡片有、登入是低頻操作）
- 過場：收合區塊 max-height + opacity 約 200ms ease transition；
  `prefers-reduced-motion: reduce` 時無動畫直接切換
- 桌面與手機同一套行為（一致、程式簡單、桌面也賺閱讀空間）
- 細列維持毛玻璃底 + 底線（現有 header 樣式語彙）

### 連動行為

- **切換分頁時捲回頂部**（`onNavigate` 內 `window.scrollTo(0, 0)`）：目前切 tab 保留舊捲動位置，
  收合後會「落在新頁面中段」，不符預期

## E. 視覺打磨（8 項）

1. **橫捲列統一**：新增 CSS class `.hscroll`（`display: flex`、`overflow-x: auto`、不換行、
   隱藏捲軸 `scrollbar-width: none` + `::-webkit-scrollbar { display: none }`）。
   套用：header tabs（兩態）、每日行程的日期選擇鈕列
2. **觸控目標擴大**：♥ 愛心 padding 擴到點擊熱區 ≥ 44px（視覺大小不變，負 margin 抵銷佔位）；
   `.chip` 加 `min-height: 36px`
3. **iOS 聚焦放大修正**：`SearchField` 手機（`max-width: 640px` media query）字級 16px
4. **鍵盤焦點可見**：全站 `:focus-visible { outline: 2px solid var(--red); outline-offset: 2px }`；
   移除輸入框的 `outline: none`（或僅在 `:focus:not(:focus-visible)` 隱藏）
5. **可點擊卡片回饋**：新增 `.card-tap` class——hover 浮起（`translateY(-1px)` + 陰影加深）、
   `:active` 輕縮（`scale(.98)`）、150ms transition。套用：總覽快速連結卡、攻略標題列。
   純資訊卡不套用
6. **攻略展開動畫**：展開/收合改 CSS grid `grid-template-rows: 0fr → 1fr` + 200ms transition
   （不用 JS 量高度；內層 `min-height: 0` + `overflow: hidden`）
7. **prefers-reduced-motion**：`@media (prefers-reduced-motion: reduce)` 內停用
   fadeUp／header 收合／卡片回饋／攻略展開全部動畫
8. **空狀態提示**：見 B-1、B-2（搜尋無結果、只看已標記但無標記）

## 錯誤處理／邊界情況

- 查詢為空或全空白 → 不過濾、不顯示建議浮層、不標亮；美食庫排序回到 rating 降冪
- token 含 `(`、`[`、`\` 等字元 → 純 `indexOf` 比對，無 regex 注入問題
- `useMarkText` 找不到任何命中（理論上不會，因為卡片已過濾）→ 靜默不動作
- 分類建議數量 = 該類型店家總數（不受「只看已標記」影響——建議是導覽捷徑，非過濾結果）
- 頁面內容比視窗短、捲不過門檻 → header 永遠是完整態，正常
- iOS 彈性捲動 scrollY 為負 → `< expandAt` 恆真，維持展開，正常
- 搜尋中切換類型 chip → 查詢字串與 chip 篩選是 AND 疊加（現狀行為，維持）

## 測試

沿用 Vitest + @testing-library/react（jsdom pragma、`cleanup()`、`vi.mock` auth 慣例）：

- `search.test.ts` 重寫：tokenize（半/全形空白）、AND 比對、scoreEntity 權重與 0 分、
  suggestFoodTypes（子字串命中、計數、排序）、makeSegments/makeSnippet（命中標記、radius、
  markdown 清理、無命中回 null）
- `SearchField` 測試：受控輸入、清除鈕、Esc
- `Food` 測試改寫：AND 過濾、相關性排序、建議浮層（顯示/點選套用 chip/Esc/外部點擊）、
  空狀態兩種、命中標亮
- `Places` 測試改寫：雙區過濾、計數更新、空狀態
- `Guides` 測試改寫：過濾、snippet 顯示、展開後 useMarkText 標亮、收合還原
- `useMarkText` 測試：包裹/還原/normalize、tokens 變更重算
- `useCondensedHeader` 測試：門檻、遲滯區維持原值
- `Header` 測試：完整態/收合態渲染差異、迷你 logo 捲頂
- `App.test.tsx`：parseHash 退回純 tab 的測試更新；`go` 切頁時捲回頂部
- 全量 `npm test` + `npx tsc -b --noEmit` + `npm run lint`（oxlint）

## 實作範圍總表

| 檔案 | 變更 |
|---|---|
| `src/lib/search.ts`（重寫） | tokenize / matchesTokens / scoreEntity / suggestFoodTypes / makeSegments / makeSnippet |
| `src/lib/useMarkText.ts`（新） | 內文關鍵字 DOM 標亮 hook |
| `src/lib/useCondensedHeader.ts`（新） | 位置門檻收合 hook |
| `src/components/SearchField.tsx`（新） | 共用搜尋輸入框 |
| `src/components/HitText.tsx`（新） | Segment 標亮渲染 |
| `src/components/Header.tsx`（新） | 從 App 抽出、兩態收合 |
| `src/components/SearchBar.tsx`（刪） | 全站搜尋移除 |
| `src/lib/useScrollHighlight.ts`（刪） | 跳轉高亮管線移除 |
| `src/App.tsx` | 瘦身：抽 Header、parseHash 退回純 tab、移除 anchor 管線 |
| `src/pages/Food.tsx` | 搜尋升級 + 建議浮層 + 標亮 + 空狀態；移除 highlightId |
| `src/pages/Places.tsx` | 新增搜尋 + 標亮 + 空狀態；移除 highlightId |
| `src/pages/Guides.tsx` | 新增搜尋 + snippet + useMarkText；移除 highlightId |
| `src/pages/Transport.tsx` | 移除 highlightId（無搜尋） |
| `src/pages/DailyPlan.tsx` | 日期鈕列改 `.hscroll` |
| `src/pages/Home.tsx` | 快速連結卡套 `.card-tap` |
| `src/styles.css` | `.hscroll`／`.search-hit`／`.card-tap`／focus-visible／攻略展開動畫／reduced-motion；移除 searchFlash |

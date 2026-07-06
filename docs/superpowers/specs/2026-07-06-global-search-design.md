# 全站搜尋功能 — 設計文件

日期：2026-07-06
狀態：已核可

## 背景與問題

- 目前只有[美食庫](../../../src/pages/Food.tsx)頁面有搜尋框（篩類型 + 關鍵字比對店名/備註/類型/摘要），
  景點・購物、交通票券、攻略頁都沒有搜尋功能，且各頁搜尋範圍僅限該頁自己的分類。
- 使用者想找「這個東西在哪個分類」時，得自己切換 tab 一個個找，尤其攻略內文很長，用眼睛掃不容易。
- 資料量小（實體 99 筆、攻略 11 篇），純子字串比對即可，不需要 fuzzy search 套件或 debounce。

目標：在 Header 加一個常駐搜尋框，輸入關鍵字即時列出跨分類的結果，點一項可以直接跳到對應分頁
並捲動、高亮到那個項目。

## 決策（與使用者確認過）

| 議題 | 決定 |
|---|---|
| 搜尋範圍 | 全站搜尋（不是幫各頁面各自補搜尋框） |
| 入口位置 | Header 常駐搜尋框（不開新 tab），任何分頁都能用 |
| 涵蓋內容 | 實體（餐廳/景點/購物/交通）+ 攻略（guides）；**不含**每日行程 |
| 住宿／區域實體 | 從搜尋範圍中排除——目前沒有對應的分類列表頁可以跳轉、高亮 |
| 點擊結果行為 | 切換到對應分頁，並 `scrollIntoView` + 短暫高亮到那張卡片（攻略則自動展開） |
| 互動方式 | 即時搜尋（輸入即顯示下拉結果），點選一項或按 Esc 關閉；不做上下鍵盤導覽（YAGNI） |

## A. 搜尋邏輯（新增）`src/lib/search.ts`

- 匯出 `searchAll(query: string): { entities: Entity[]; guides: Guide[] }`。
- `query` 前後空白 trim 後為空字串 → 兩者皆回傳空陣列。
- **實體**：只在 `餐廳/景點/購物/交通` 四類中比對（`住宿`/`區域` 排除），
  比對欄位為 `name + summary + area + tags.join(' ') + Object.values(fields).join(' ')`，
  小寫化後子字串比對（比照 `Food.tsx` 現有寫法）；依 `rating`（`null` 當 0）由高到低排序，
  最多回傳 6 筆。
- **攻略**：比對 `title + body`，最多回傳 4 筆，維持原始順序。
- 純函式、不依賴 React，方便單元測試。

## B. 新元件 `src/components/SearchBar.tsx`

- 內部 state：`q`（輸入字串）、`open`（下拉選單是否顯示）。
- `useMemo(() => searchAll(q), [q])` 計算結果；`q.trim()` 為空時不顯示下拉選單。
- 下拉選單分兩組顯示（有結果才顯示該組標題）：
  - 「實體」：每列顯示名稱 + 分類徽章（餐廳/景點/購物/交通）+ 摘要片段
  - 「攻略」：每列顯示標題
  - 兩組都沒有結果時顯示「找不到符合「{q}」的結果」
- 點擊下拉外部（`ref` + document `mousedown` 監聽）或按 `Esc` → 關閉下拉選單。
- 點選一筆結果 → 呼叫 `goTo(tab, anchorId)`：
  - 實體：`tab` 依分類對應（`餐廳→food`、`景點/購物→places`、`交通→trans`），
    `anchorId = `entity-${id}``
  - 攻略：`tab='guides'`，`anchorId = `guide-${id}``
  - 設定 `location.hash = `${tab}:${anchorId}``，清空 `q`、收起下拉選單。
- 樣式沿用專案既有 input/card 風格（`var(--card)`、`var(--line-dark)` 等 CSS 變數），
  放在 Header 標題列下方、tabs 列上方，全寬一列（維持 mobile-first 版面）。

## C. 導頁與高亮

### 1. `src/App.tsx`

- 新增匯出的純函式 `parseHash(hash: string): { tab: TabKey; anchor?: string }`：
  把 `location.hash` 依 `:` 拆成 `tab` 與 `anchor` 兩段，`tab` 不合法時預設 `'home'`
  （比照現有可測試的 `countdownDays` 寫法）。
- `tabFromHash()` 呼叫的地方改用 `parseHash(location.hash).tab`；`anchor` 存進新的
  `useState<string | undefined>`，在 `hashchange` 監聽中一起更新。
- `PAGES` 型別放寬為 `Record<TabKey, (props: { highlightId?: string }) => JSX.Element>`；
  不需要此 prop 的頁面（`Home`/`DailyPlan`/`AreaMap`）維持 `() => JSX.Element`，結構上仍相容。
- render 改為 `<Page key={tab} highlightId={anchor} />`。
- Header 內加入 `<SearchBar />`。

### 2. 共用 hook `src/lib/useScrollHighlight.ts`

- `useScrollHighlight(highlightId?: string)`：`highlightId` 變動且對應 DOM 節點存在時，
  `scrollIntoView({ behavior: 'smooth', block: 'center' })`，加上 CSS class `search-highlight`
  觸發高亮動畫，`setTimeout` 約 1.6 秒後移除 class（cleanup 也會清 timeout）。

### 3. 各頁面接上高亮

- `Food.tsx` / `Places.tsx` / `Transport.tsx`：
  - 元件簽名改為接收 `{ highlightId }: { highlightId?: string }`
  - 對應卡片 `div` 加上 `id={`entity-${item.id}`}`
  - 呼叫 `useScrollHighlight(highlightId)`
  - 因為 `App.tsx` 對 `<Page key={tab} .../>` 用 `tab` 當 key，切換分頁時會重新掛載頁面，
    篩選/分類 state 會重置為預設值（`全部`/`favOnly=false`），從搜尋跳轉過去時目標項目
    一定在預設篩選條件下可見。
- `Guides.tsx`：
  - 同樣接收 `highlightId`，卡片 `div` 加 `id={`guide-${g.id}`}`
  - `useEffect` 依 `highlightId` 是否以 `guide-` 開頭，自動把該 id 的 `open[id]` 設成 `true`
    （自動展開攻略內文）
  - 呼叫 `useScrollHighlight(highlightId)`

### 4. `src/styles.css`

- 新增：
  ```css
  @keyframes searchFlash { 0%, 100% { box-shadow: none; } 30% { box-shadow: 0 0 0 3px rgba(178,58,30,.35); } }
  .search-highlight { animation: searchFlash 1.6s ease; }
  ```

## 實作範圍

| 檔案 | 變更 |
|---|---|
| `src/lib/search.ts` | 新增：`searchAll()` |
| `src/lib/useScrollHighlight.ts` | 新增：捲動+高亮 hook |
| `src/components/SearchBar.tsx` | 新增：全站搜尋框與下拉結果 |
| `src/App.tsx` | 新增 `parseHash()`、`anchor` state、渲染 `SearchBar`、`PAGES` 型別放寬 |
| `src/pages/Food.tsx` | 接收 `highlightId`、卡片加 `id`、接上高亮 hook |
| `src/pages/Places.tsx` | 同上 |
| `src/pages/Transport.tsx` | 同上 |
| `src/pages/Guides.tsx` | 接收 `highlightId`、卡片加 `id`、自動展開 + 接上高亮 hook |
| `src/styles.css` | 新增 `.search-highlight` 動畫 |

## 錯誤處理／邊界情況

- 查詢字串為空或只有空白 → 不顯示下拉選單。
- 有查詢字串但兩組都沒結果 → 顯示「找不到符合結果」提示文字，不是空白區塊。
- 住宿／區域實體 → 完全不會出現在搜尋結果中。
- 目標 DOM 節點尚未渲染完成時才 highlight（例如頁面剛掛載）→ `useEffect` 依 `highlightId` 觸發，
  該時間點頁面已完成本次 render，`getElementById` 找得到節點；找不到則靜默跳過，不丟錯誤。
- 連續搜尋兩個不同項目（不論是否同一分頁）→ hash 字串不同會正常觸發 `hashchange` 並重新捲動高亮。

## 測試

- `src/lib/__tests__/search.test.ts`：
  - 依 name/summary/tags/area/fields 任一欄位比對成功
  - 大小寫不敏感
  - 排除住宿與區域分類
  - 查詢字串為空回傳空陣列
  - 攻略依 title/body 比對成功
- `src/components/__tests__/SearchBar.test.tsx`：
  - 輸入關鍵字後顯示分組下拉結果
  - 點選一筆結果會設定 `location.hash` 為 `<tab>:<anchorId>` 格式
  - 按 Esc 關閉下拉選單
  - 查無結果時顯示提示文字
- `src/App.test.tsx`（或既有測試檔）新增 `parseHash()` 單元測試：
  - 純 tab（無 `:`）、`tab:anchor`、不合法 tab 三種情況
- 依專案現有 vitest + `@testing-library/react` 模式撰寫。

# 攻略典藏功能設計

日期：2026-07-17
狀態：已核可

## 目標

攻略頁（Guides）的每篇攻略可以「典藏」，典藏狀態跨裝置同步，並在三個地方產生效果：

1. 攻略列表中，已典藏的攻略置頂。
2. 攻略頁提供「只看典藏」篩選。
3. 首頁顯示已典藏攻略的捷徑區塊。

## 背景

- 攻略資料來自 vault（`guides.json`），`id` 為 vault 檔名去掉 `.md`，穩定可作為 key。
- 現有收藏（實體 `fav:`）與待辦（`todo:`）狀態由 `src/state/store.tsx` 的
  `TripStateProvider` 管理：本地先寫 `localStorage`，有 token 時同步到 Worker（D1）。
  Worker 是 generic key-value（`state(key, value, updated_at)`），不需要改動。
- 未登入為唯讀模式：可看到同步下來的狀態，點擊互動元件會開登入框（`useAuth().openLogin`）。

## 設計

### 狀態層（`src/state/store.tsx`）

- 新 key 前綴：`guide:<攻略id>`，value 為 boolean。
- 走既有管線：`toggle()`、`saveLocal`、`putState`/`queuePut`、`syncRemote` merge 全部共用，
  不需要新增同步邏輯。
- `TripState` 介面新增：
  - `guideFavs: StateMap` — 所有 `guide:` 前綴的項目。
  - `isGuideFav(id: string): boolean`
  - `toggleGuideFav(id: string): void` — 內部呼叫 `toggle('guide:' + id)`。
- `defaults()` 不需要為攻略加預設值（vault 攻略沒有 favorite 欄位）。
- 現有 `favCount` 與 `favs` 只認 `fav:` 前綴，不受影響；`value` 的 key 分派
  （`fav:` / `todo:`）加上 `guide:` 分支。

### 攻略頁（`src/pages/Guides.tsx`）

- **典藏按鈕**：每張 `GuideCard` 標題列右側（展開箭頭旁）加 ★／☆ 按鈕，
  與實體收藏的 ♥ 做視覺區隔。
  - 已登入（`canEdit`）：點擊 toggle 典藏，`stopPropagation` 避免觸發卡片展開。
  - 未登入：按鈕半透明（opacity 0.4），點擊呼叫 `openLogin()`。與 `Heart` 元件行為一致。
- **排序**：已典藏的攻略排在最前面，典藏與未典藏內部各自維持原始順序（stable）。
  排序在搜尋篩選之後套用。
- **「只看典藏」篩選**：搜尋框旁加一顆切換鈕（例：`★ 只看典藏`），開啟時只顯示已典藏
  的攻略，可與搜尋條件同時生效（交集）。
  - 一篇典藏都沒有時，這顆鈕不顯示。
  - 若篩選開啟中典藏數歸零（使用者取消了最後一篇的典藏），自動退出篩選或顯示空狀態
    文案「沒有符合的攻略」——採後者（沿用現有空狀態卡片），避免畫面跳動。

### 首頁（`src/pages/Home.tsx`）

- 快速連結區下方（收藏統計橫幅上方）加一張「典藏攻略」小卡：
  - 列出所有已典藏攻略的標題，每列可點，點擊後 `location.hash = 'guides'` 跳到攻略分頁
    （典藏的攻略本來就置頂，不需要額外定位）。
  - 一篇典藏都沒有時整張卡不渲染，首頁維持現狀。
- 標題資料來源：`guides`（`src/data`）依 `guideFavs` 過濾。

### 不做的事（YAGNI）

- 不改 Worker、不加新 API。
- 不做「典藏後跳到指定攻略並自動展開」的深連結。
- 不在 vault 攻略 frontmatter 加預設典藏欄位。

## 測試

- `src/state/__tests__/store.test.tsx`：
  - `toggleGuideFav` 寫入 `guide:<id>` 並反映在 `isGuideFav` / `guideFavs`。
  - 同步（putState / queuePut）行為與現有 `fav:` 一致（走同一 `toggle`，可少量驗證）。
- `src/pages/__tests__/Guides.test.tsx`：
  - 已典藏攻略置頂排序。
  - 「只看典藏」篩選：無典藏時不顯示切換鈕；開啟時只列典藏且可與搜尋交集。
  - 未登入點擊典藏按鈕 → 呼叫 `openLogin`，不改變狀態。
  - 點典藏按鈕不觸發卡片展開。
- `src/pages/__tests__/Home.test.tsx`（若尚無此檔則新增）：
  - 有典藏時顯示「典藏攻略」卡與標題列表；無典藏時不渲染。

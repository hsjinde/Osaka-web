# 愛心跨裝置同步修復 + 想去清單 — 設計文件

日期：2026-07-06
狀態：已核可

## 背景與問題

- 同步後端（Cloudflare Worker `osaka-dashboard.ethan19980803.workers.dev` + D1）已部署且運作正常（未帶 token 回 401），Pages bundle 也有正確的 `VITE_API_BASE`。
- 但同步實際上沒生效，原因有二：
  1. 每台裝置必須按 ⚙ 手動輸入 `DASH_TOKEN` 才會進入同步模式，而使用者不知道密碼（secret 設定後無法從 Cloudflare 讀回）。
  2. 遠端狀態只在頁面載入時抓一次，頁面開著時不會看到其他裝置的變更。
- 另外，「想去的地方」目前只有首頁的數字統計橫幅，沒有任何地方能看到完整清單。

## 決策（與使用者確認過）

| 議題 | 決定 |
|---|---|
| 驗證方式 | 密碼藏在設定連結裡（`?setup=<token>`），新裝置點一次連結即完成設定 |
| 即時性 | 頁面切回前景（`visibilitychange`）時自動重抓遠端狀態 |
| 清單位置 | 首頁「已標記 N 個」橫幅點開展開清單 |
| 清單內容 | 名稱＋分類分組＋區域＋Google Maps 連結＋♥ 可直接取消標記 |

## A. 同步修復

### 1. 設定連結

- 重設一組新的 `DASH_TOKEN`（隨機長字串），以 `wrangler secret put` 更新 Worker secret。Worker 程式碼不變。
- 前端啟動時檢查 `location.search` 的 `setup` 參數：
  - 偵測到 → `setToken(token)` 存入 localStorage → `history.replaceState` 移除參數（避免 token 留在網址列與瀏覽紀錄）→ 進入同步模式。
- 使用者保存一條設定連結：`https://hsjinde.github.io/Osaka-web/?setup=<token>`，新裝置點一次即可。
- ⚙ 按鈕改版：
  - 已設定 token 的裝置 → 顯示完整設定連結供複製（任何已設定裝置都能產生連結給新裝置）。
  - 未設定的裝置 → 維持現有手動輸入 prompt 作為備援。

### 2. 切回頁面自動更新

- `TripStateProvider` 監聽 `visibilitychange`：`document.visibilityState === 'visible'` 時，先 `flushQueue()` 補送離線佇列，再 `fetchState()` 合併（遠端優先，與啟動邏輯相同）。
- 最小間隔約 15 秒，避免快速切換分頁時連續打 API。

### 3. 未同步狀態提示

- 未設定 token 時，header 的離線標籤文字改為引導性提示（如「尚未同步・點 ⚙ 設定」），已設定但斷線時維持「離線模式・變更暫存本機」。

## B. 想去清單（首頁）

- 首頁深色橫幅「已標記 N 個想去的地方」改為可點擊，點開在下方展開清單，再點收合。
- 清單依分類分組（餐廳／景點／購物），每項顯示：名稱、區域標籤、Google Maps 連結（沿用 `MapLink`）、♥ 按鈕（點擊即 `toggleFav` 取消標記，會同步至其他裝置）。
- 無任何標記時：橫幅仍可點開，展開後顯示空狀態提示（「還沒有標記，去美食庫、景點頁按 ♡」），行為一致比較不易困惑。

## 實作範圍

| 檔案 | 變更 |
|---|---|
| `src/api/state.ts` | `setup` URL 參數處理（讀取、存 token、清網址） |
| `src/state/store.tsx` | `visibilitychange` 重抓 + 最小間隔 |
| `src/App.tsx` | ⚙ 按鈕改版、離線/未設定提示文字 |
| `src/pages/Home.tsx` | 橫幅展開清單元件 |
| Worker | 程式碼不變，僅 `wrangler secret put DASH_TOKEN` 重設 |

## 錯誤處理

- `setup` 參數為空字串或缺少 → 忽略，不覆寫既有 token。
- 重抓失敗（斷線）→ 維持現有 offline 標記行為，不清除本機狀態。
- 離線佇列語意不變：PUT 失敗進佇列，上線或切回前景時補送，補送先於重抓（避免遠端舊值蓋掉本機未送出的變更）。

## 測試

- `setup` 參數解析：有參數存 token 並清網址、空/無參數不動作、不覆寫規則。
- visibility 重抓：切回前景觸發 flush→fetch→合併、最小間隔內不重複觸發。
- 想去清單：分組正確、取消標記走 `toggleFav`、空狀態。
- 依專案現有 vitest 模式撰寫。

## 部署

1. 產生新 token，`wrangler secret put DASH_TOKEN`（依 cloudflare-use skill 流程）。
2. 前端變更 push main → Pages workflow 自動部署。
3. 使用者在目前裝置點設定連結完成設定，再於其他裝置點同一連結驗證同步。

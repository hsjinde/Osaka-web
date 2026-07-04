# 大阪行程儀表板 Osaka-web

和風紙質風格的大阪旅遊儀表板。內容來自 [Osaka-vault](https://github.com/hsjinde/Osaka-vault)（Obsidian），
收藏與待辦狀態存 Cloudflare D1 跨裝置同步。

- **設計文件**：`docs/superpowers/specs/2026-07-05-osaka-dashboard-design.md`
- **執行計畫**：`docs/superpowers/plans/2026-07-05-osaka-dashboard.md`（20 個任務，TDD）
- **GitHub**：https://github.com/hsjinde/Osaka-web

## 當前進度（2026-07-05）

| Task | 內容 | 狀態 |
| --- | --- | --- |
| 1 | 專案鷹架（Vite + React + TS + Vitest） | ✅ |
| 2 | 文字工具 stripWikilinks / extractArea / todoKey | ✅ |
| 3 | Zod Schema 與實體頁解析器 | ✅ |
| 4 | 每日行程解析器 | ✅ |
| 5 | 待辦解析器 | ✅ |
| 6 | Vault 範本檔（每日行程.md、總覽.md） | ✅ |
| 7 | build-data 主腳本（vault → 型別化 JSON） | ✅ |
| 8 | 主題樣式與字體（和風紙質 tokens） | ✅ |
| 9 | App 骨架（hash 分頁、Header 倒數、Footer） | ✅ |
| 10 | 狀態 Store（Context + localStorage） | ✅ |
| 11 | Stamp / Heart 元件 + 總覽頁 Home | ✅ |
| 12 | AreaRail + 每日行程頁（三檢視） | 🚧 進行中 |
| 13 | 美食庫頁 | ⏳ |
| 14 | 景點與購物頁 | ⏳ |
| 15 | 交通票券頁（markdown 渲染） | ⏳ |
| 16 | 地圖頁 | ⏳ |
| 17 | Cloudflare Worker + D1 | ⏳ |
| 18 | 前端串接 Worker（跨裝置同步） | ⏳ |
| 19 | CI/CD 與上線（GitHub Pages） | ⏳ |
| 20 | README 使用說明（最終版） | ⏳ |

**測試狀況**：28 個單元測試全綠（解析器 21 + countdown 2 + store 3 - 重覆計算後）
— 實際為 text 6 + parse-entity 7 + parse-itinerary 5 + parse-todos 3 + build-data 2 + countdown 2 + store 3 = 28。

**已產出可執行**：`npm run dev` 起得來、`npm run build` 過得了、總覽頁可見、待辦可勾、收藏可按 ♥。
**尚未完成**：每日行程三檢視、美食/景點/購物/交通/地圖頁內容、Worker 部署、CI/CD 上線。

## 日常使用（計畫中的最終流程，目前尚未上線）

### 更新旅遊資料（唯一需要記住的流程）

1. 在 Obsidian 編輯 `D:\大阪-vault`：
   - 新增/修改餐廳、景點等 → `wiki/entities/<分類>/`（格式照現有頁面）
   - 改每日行程 → `wiki/dashboard/每日行程.md`
   - 改總改總覽卡（飯店/日期）→ `wiki/dashboard/總覽.md`
   - 勾/改待辦 → `Osaka Trip/2026-09-30-osaka-confirmed-itinerary.md` 的「## ✅ 待辦」
2. push 到 GitHub（或等自動備份）
3. 約 2 分鐘後網站自動更新。若沒更新，看 Osaka-web repo 的 Actions 是否紅燈
   （紅燈通常 = markdown 格式錯，錯誤訊息會寫哪個檔案哪裡壞）

### 每日行程格式

    ## Day 0｜09/30 週三｜抵達日
    > 區域：難波、心齋橋

    - 下午｜關西機場 → 難波｜備註文字
    - 宵夜｜（待安排）

### 新裝置設定收藏同步（Task 18 完成後才可用）

開網站 → 按 header 的 ⚙ → 輸入通行密碼（一次即可）。
沒設密碼也能看，收藏只存在該裝置。

## 開發

    npm install
    npm run dev        # 讀 D:\大阪-vault（.env 的 NOTES_DIR）
    npm test           # 解析器 + store 測試
    cd worker && npx vitest run   # Worker API 測試（Task 17 後）

`.env` 欄位（见 `.env.example` — Task 18 才會建立）：
- `NOTES_DIR` — vault 本地路徑（目前設 `D:\大阪-vault`）
- `VITE_API_BASE` — Worker URL（Task 17-18 部署後填入）
- `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID` — Task 17 部署 D1/Worker 用

## 架構

- **內容**：vault markdown --(build:data + Zod)--> JSON --> Vite build --> GitHub Pages
- **狀態**：前端 --(Bearer 通行密碼)--> Cloudflare Worker --> D1（osaka-trip）
- **自動重建**：Osaka-vault push --> repository_dispatch --> Osaka-web deploy workflow

設計文件：`docs/superpowers/specs/2026-07-05-osaka-dashboard-design.md`
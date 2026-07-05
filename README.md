# 大阪行程儀表板 Osaka-web

和風紙質風格的大阪旅遊儀表板。內容來自 [Osaka-vault](https://github.com/hsjinde/Osaka-vault)（Obsidian），
收藏與待辦狀態存 Cloudflare D1 跨裝置同步。

**網站：** https://hsjinde.github.io/Osaka-web/

> 自訂網域 `osaka.19980803.xyz` 已規劃、程式碼就緒，待補上 Cloudflare DNS 記錄後即可切換
> （見 `docs/superpowers/specs/2026-07-05-osaka-dashboard-design.md`）。

## 日常使用

### 更新旅遊資料（唯一需要記住的流程）

1. 在 Obsidian 編輯 `D:\大阪-vault`：
   - 新增/修改餐廳、景點等 → `wiki/entities/<分類>/`（格式照現有頁面）
   - 改每日行程 → `wiki/dashboard/每日行程.md`
   - 改總覽卡（飯店/日期）→ `wiki/dashboard/總覽.md`
   - 勾/改待辦 → `Osaka Trip/2026-09-30-osaka-confirmed-itinerary.md` 的「## ✅ 待辦」
2. push 到 GitHub（或等自動備份）
3. 約 2 分鐘後網站自動更新。若沒更新，看 Osaka-web repo 的 Actions 是否紅燈
   （紅燈通常 = markdown 格式錯，錯誤訊息會寫哪個檔案哪裡壞）

### 每日行程格式

    ## Day 0｜09/30 週三｜抵達日
    > 區域：難波、心齋橋

    - 下午｜關西機場 → 難波｜備註文字
    - 宵夜｜（待安排）

### 新裝置設定收藏同步

開網站 → 按 header 的 ⚙ → 輸入通行密碼（一次即可）。
沒設密碼也能看，收藏只存在該裝置。

## 開發

    npm install
    npm run dev        # 讀 D:\大阪-vault（.env 的 NOTES_DIR）
    npm test           # 解析器 + store 測試（30 個）
    cd worker && npx vitest run   # Worker API 測試（4 個）

`.env` 欄位見 `.env.example`。

## 架構

- **內容**：vault markdown --(build:data + Zod)--> JSON --> Vite build --> GitHub Pages
- **狀態**：前端 --(Bearer 通行密碼)--> Cloudflare Worker（Hono）--> D1（osaka-trip）
- **自動重建**：Osaka-vault push --> notify-dashboard workflow --> repository_dispatch --> Osaka-web deploy

離線韌性：Worker 不可達或未設密碼時走純 localStorage，header 顯示「離線模式」，
變更暫存本機、恢復連線後自動補送。

- **設計文件**：`docs/superpowers/specs/2026-07-05-osaka-dashboard-design.md`
- **執行計畫**：`docs/superpowers/plans/2026-07-05-osaka-dashboard.md`

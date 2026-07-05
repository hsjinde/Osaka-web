# 大阪行程儀表板 Osaka-web

和風紙質風格的大阪旅遊儀表板。內容來自 [Osaka-vault](https://github.com/hsjinde/Osaka-vault)（Obsidian），
收藏與待辦狀態存 Cloudflare D1 跨裝置同步。

**網站：** https://osaka.19980803.xyz（Cloudflare Pages，自訂網域）
備援／原始網址：https://hsjinde.github.io/Osaka-web/（GitHub Pages，同步部署）

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

### 收藏 ♡ 與想去清單

在美食庫、景點、購物頁按 ♡ 標記想去的地方，首頁「已標記」橫幅可展開看清單
（依分類分組，附地圖連結，可直接取消標記）。

不設通行密碼也能瀏覽並看到別人已同步的收藏（唯讀模式）；要在本裝置也能標記/勾選並同步，
才需要設定密碼（見下）。

### 新裝置設定收藏同步

開網站 → 按 header 的 ⚙：
- 已在其他裝置設定過 → 會直接彈出一條「設定連結」，複製貼到新裝置開啟一次即完成同步設定
- 尚未設定過 → 輸入通行密碼（一次即可）

沒設密碼時是唯讀模式（能看不能標記），標記/勾選只存在本機瀏覽器，不會跨裝置同步。

## 開發

    npm install
    npm run dev        # 讀 D:\大阪-vault（.env 的 NOTES_DIR）
    npm test           # 解析器 + store 測試（54 個）
    cd worker && npx vitest run   # Worker API 測試（4 個）

`.env` 欄位見 `.env.example`。

## 架構

- **內容**：vault markdown --(build:data + Zod)--> JSON --> Vite build --> GitHub Pages / Cloudflare Pages
- **狀態**：前端 --(讀取免驗證，寫入用 Bearer 通行密碼)--> Cloudflare Worker（Hono）--> D1（osaka-trip）
- **自動重建**：Osaka-vault push --> notify-dashboard workflow --> repository_dispatch --> Osaka-web deploy

沒有通行密碼時走「唯讀模式」：能讀到遠端已同步的收藏/待辦狀態，但寫入只存本機 localStorage；
設定密碼後才會把變更寫回 Worker/D1。Worker 打不通（斷線）時則走「離線模式」，
變更暫存本機、恢復連線後自動補送。

- **設計文件**：`docs/superpowers/specs/2026-07-05-osaka-dashboard-design.md`、
  `docs/superpowers/specs/2026-07-06-fav-sync-and-wishlist-design.md`
- **執行計畫**：`docs/superpowers/plans/2026-07-05-osaka-dashboard.md`、
  `docs/superpowers/plans/2026-07-06-deploy-cloudflare-pages.md`、
  `docs/superpowers/plans/2026-07-06-readonly-and-write-auth.md`、
  `docs/superpowers/plans/2026-07-06-fav-sync-and-wishlist.md`

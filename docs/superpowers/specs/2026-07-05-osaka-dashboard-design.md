# 大阪行程儀表板 — 設計文件

- 日期：2026-07-05
- 狀態：已核可（使用者逐段確認）
- 風格來源：`untitled/project/大阪行程儀表板.dc.html`
- 資料來源：https://github.com/hsjinde/Osaka-vault（本地副本 `D:\大阪-vault`）

## 1. 目標

把現有的 dc.html 原型（和風紙質設計的旅遊儀表板）改寫為 React + TypeScript 正式專案：

- 視覺 1:1 復刻原型：`#F1EBDD` 紙色底＋細橫紋、朱紅 `#B23A1E`、Shippori Mincho 標題字、印章式評分、fadeUp 動畫
- 六個分頁：總覽、每日行程（時間軸／卡片／地圖三檢視）、美食庫、景點購物、交通票券、地圖
- 資料不再寫死在程式碼，改由 Obsidian vault（Osaka-vault repo）驅動
- 收藏（♥）與待辦勾選狀態跨裝置（手機＋電腦）即時同步
- 部署 GitHub Pages，旅途中手機可用

## 2. 整體架構

三條資料流：

### ① 內容流（唯讀：餐廳、景點、購物、交通、住宿、區域、每日行程）

```
Obsidian 編輯 → git push 到 hsjinde/Osaka-vault
  → vault repo 的 GitHub Action 發 repository_dispatch 通知 Osaka-web
  → Osaka-web CI：checkout 兩個 repo
      → scripts/build-data.ts 解析 wiki markdown（Zod 驗證，錯誤含檔名/欄位）
      → 產出型別安全 JSON
      → Vite build → 部署 GitHub Pages
```

- push 後約 1–2 分鐘生效
- 本機開發：build-data 直接讀 `.env` 的 `NOTES_DIR`（指向 `D:\大阪-vault`），不經 CI
- 解析失敗 → CI 失敗通知信，線上網站維持上一版

### ② 狀態流（可變：收藏、待辦勾選）— Cloudflare D1

```
任一裝置按 ♥ / 勾待辦
  → fetch Cloudflare Worker API（Authorization: Bearer <通行密碼>）
  → Worker 寫入 D1（本專案專用資料庫 osaka-trip）
  → 所有裝置即時同步；不產生 git commit、不觸發 CI
```

- 待辦「項目清單」來自 vault markdown；「勾選狀態」以 D1 為準
- 選 D1 而非寫回 GitHub 的理由：即時同步、不弄髒 vault commit 歷史、不誤觸重建

### ③ 前端

React 18 + TypeScript + Vite，SPA，部署 GitHub Pages。

## 3. Vault 格式約定

**現有 wiki 實體頁格式不動**，解析器直接支援：

- frontmatter：`title`、`tags`、`updated`（可選 `favorite: true` 作為預設收藏）
- 內文「## 基本資訊」段的 `- 類型：…`／`- 評分：…`／`- 價位：…`／`- 備註：…` 條列
- 六類實體目錄：`wiki/entities/{餐廳,景點,購物,交通,住宿,區域}/`

**新增 `wiki/dashboard/每日行程.md`**（由本專案建立範本並推入 vault）：

```markdown
---
title: 每日行程
updated: 2026-07-05
---

## Day 0｜09/30 週三｜抵達日
> 區域：難波、心齋橋

- 下午｜關西機場 → 難波｜南海 Rapi:t 最快 34 分，航班時段待確認
- 傍晚｜心齋橋格蘭多酒店 Check-in｜長堀橋站步行 5 分
- 夜｜道頓堀夜景散步｜格力高看板・戎橋
- 宵夜｜（待安排）
```

格式規則：

- `## Day N｜日期｜主題` 為一天的開頭
- `> 區域：A、B` 一行（地圖檢視高亮用）
- 每個時段一行：`時段｜標題｜備註`（備註可省略）
- 標題寫 `（待安排）` → 前端渲染為虛線空白卡
- 解析失敗時建置報錯並指出檔名與行號

**待辦清單**：讀取 `Osaka Trip/2026-09-30-osaka-confirmed-itinerary.md` 的「## ✅ 待辦」區段 `- [ ]` 項目。項目文字為 key 的一部分，改字視同新項目。

## 4. 專案結構

```
Osaka-web/
├── scripts/build-data.ts        # vault markdown → src/data/*.json（Zod 驗證）
├── src/
│   ├── data/                    # 建置產物 JSON + 型別（generated.d.ts）
│   ├── api/state.ts             # Worker API client + localStorage 離線快取
│   ├── theme/tokens.ts          # 色票、字體、間距（對齊 dc.html）
│   ├── components/              # StampBadge、HeartButton、Card、Chip、Timeline…
│   ├── pages/                   # Home / DailyPlan / Food / Places / Transport / AreaMap
│   ├── App.tsx                  # 分頁路由（hash-based，GitHub Pages 免設定）
│   └── main.tsx
├── worker/                      # Cloudflare Worker（Hono）+ wrangler.toml
├── docs/superpowers/            # 設計文件與執行計畫
└── .github/workflows/deploy.yml
```

- 狀態管理：TanStack Query；收藏採樂觀更新（即點即亮，失敗回滾）
- 離線韌性：D1 狀態快取 localStorage；Worker 不可達時顯示「離線模式」細條，變更暫存本地、恢復後補送
- footer 顯示資料建置時間

## 5. Worker API 與 D1 Schema

D1 資料庫 `osaka-trip`：

```sql
CREATE TABLE state (
  key        TEXT PRIMARY KEY,   -- "fav:餐廳/DOTONBORI-KUROFUNE" / "todo:<hash>"
  value      TEXT NOT NULL,      -- "1" / "0"
  updated_at TEXT NOT NULL
);
```

Worker（Hono）端點：

| Method | Path             | 說明               |
| ------ | ---------------- | ---------------- |
| GET    | `/api/state`     | 回傳全部狀態（一次拉回）     |
| PUT    | `/api/state/:key`| body `{value}` 寫入單筆 |

- 驗證：`Authorization: Bearer <通行密碼>`，密碼存 Worker secret（`wrangler secret put`）
- CORS：僅允許 GitHub Pages 網域與 `localhost`
- 收藏 key 用「分類/檔名」，vault 檔案改名前收藏不失效
- Cloudflare 操作一律遵循 `.claude/skills/cloudflare-use` 規範（token 自 `.env` 注入、非 ASCII 內容經 Node.js 寫檔避免 BOM）

## 6. CI/CD

**Osaka-web `.github/workflows/deploy.yml`**：

- 觸發：push main、`repository_dispatch: vault-updated`、`workflow_dispatch`
- 步驟：checkout 本 repo → checkout `hsjinde/Osaka-vault` → `npm ci` → `npm run build:data` → `npm run build` → deploy GitHub Pages

**Osaka-vault 新增 workflow**：push 時對 Osaka-web 發 `repository_dispatch`（需在 vault repo 設 PAT secret，執行計畫含設定步驟）

**Worker**：`wrangler deploy` 手動部署，不設 CI。

## 7. 錯誤處理

| 情境 | 行為 |
| --- | --- |
| vault markdown 格式錯誤 | 建置失敗，錯誤訊息含檔名＋欄位＋行號；線上維持上一版 |
| Worker 不可達／密碼錯 | 前端顯示離線模式細條；變更暫存 localStorage，恢復後補送 |
| D1 無資料（首次） | 全部視為未收藏／未勾選，vault `favorite: true` 作為預設值合併 |

## 8. 測試策略

- **解析器單元測試（Vitest）**：六類實體格式、每日行程格式、待辦抽取、各種格式錯誤案例 — 最容易壞的一層
- **Worker 測試**：密碼驗證、CORS、GET/PUT 行為
- **前端**：以 preview 手動驗證視覺復刻為主，不寫 UI snapshot 測試（個人專案，維護成本不划算）

## 9. 範圍外（YAGNI）

- 真地圖（Google Maps 82 標記匯入）— 原型也只有路線示意，列為日後擴充
- R2 圖片儲存 — 目前無圖片需求
- 多使用者／帳號系統 — 單人使用，通行密碼即可
- 從網頁編輯行程內容 — 內容編輯一律在 Obsidian

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

和風紙質風格的大阪旅遊儀表板（React + TS + Vite）。內容資料來自另一個 repo
[Osaka-vault](https://github.com/hsjinde/Osaka-vault)（Obsidian markdown），收藏/待辦狀態
存 Cloudflare D1 做跨裝置同步。線上網址：https://hsjinde.github.io/Osaka-web/

## Commands

Frontend (repo root):
```
npm install
npm run dev          # 先 build:data 再啟動 vite（讀 NOTES_DIR 指向的 vault）
npm run build:data   # 只重跑 vault -> src/data/*.json 的轉譯（tsx scripts/build-data.ts）
npm run build         # tsc -b && vite build
npm run lint          # oxlint
npm test              # vitest run（scripts/**/*.test.ts + src/**/*.test.{ts,tsx}）
npm run sync:images   # 攻略內文圖片同步到 R2（scripts/sync-guide-images.ts）
```
執行單一測試檔：`npx vitest run src/state/__tests__/store.test.tsx`（或任何路徑）。

Worker（`worker/` 子目錄，獨立的 npm 專案）：
```
cd worker
npm test        # vitest run
npm run dev     # wrangler dev
npm run deploy  # wrangler deploy
```

`.env`（repo root，勿提交）欄位見 `.env.example`：`NOTES_DIR`（本機 vault 路徑）、
`VITE_API_BASE`（Worker URL，留白則前端純 localStorage 離線模式）、Cloudflare 部署憑證。

## Architecture

**三段管線：** vault markdown → (`build:data` + Zod 驗證) → `src/data/*.json` → Vite build → 靜態網站。

- `scripts/build-data.ts` 是建置入口：讀 `NOTES_DIR` 下的 vault，呼叫 `scripts/lib/parse-*.ts`
  逐一解析不同來源，用 `src/data/schema.ts` 的 Zod schema 驗證後寫出 JSON 到 `src/data/`。
  任一必要來源解析失敗即 `process.exit(1)`（讓 CI 紅燈），但「別人推薦攻略」是 best-effort，
  單篇失敗只警告不擋建置。
  - 實體（餐廳/景點/購物/交通/住宿/區域）來自 `vault/wiki/entities/<分類>/*.md`
  - 每日行程來自 `vault/wiki/dashboard/每日行程.md`（格式：`## Day N｜日期｜主題` + `- 時段｜標題｜備註`）
  - 總覽卡（出發/回程日期等）來自 `vault/wiki/dashboard/總覽.md` 的 `## 基本資訊` / `## 交通備註`
  - 待辦來自 `vault/Osaka Trip/2026-09-30-osaka-confirmed-itinerary.md` 的 `## ✅ 待辦`
  - 攻略圖片經 `scripts/lib/guide-images.ts` 改寫成 R2 公開網址（`R2_PUBLIC_URL_PREFIX`，預設 `img.19980803.xyz`）
- `src/data/index.ts` 把建置產出的 JSON 轉型匯出（`entities`/`days`/`todos`/`overview`/`meta`/`guides`），
  是應用程式讀資料的唯一入口，元件不直接 import JSON。
- **這些 JSON 是產物，不是原始碼**：改資料內容要去改 Osaka-vault 那個 repo，不是改這裡的 `.json`。

**狀態同步：** `src/state/store.tsx` 的 `TripStateProvider`（`useTripState` hook）是收藏/待辦
唯一狀態來源，本地永遠先寫 `localStorage`，若 `configured()`（有 `VITE_API_BASE` 且有 token）
才嘗試同步到 Worker：
- 啟動與「切回前景且距上次同步 ≥15 秒」都會 `syncRemote`：先 `flushQueue()` 補送離線佇列，
  再 `fetchState()` 拉遠端、與本地 merge（遠端優先）
- 沒有 token＝唯讀模式（能看不能改，仍可看到別人同步的資料）；有 token 但 Worker 打不通＝離線模式，
  變更寫入 `queuePut`，之後自動補送
- `src/api/state.ts` 封裝所有 HTTP 呼叫；`?setup=<token>` URL 參數可一鍵完成新裝置同步設定
  （`consumeSetupToken`），設定連結由 `setupLink()` 產生

**Worker（`worker/src/index.ts`，Hono + D1）：** 單一資料表 `state(key, value, updated_at)`
（schema 見 `worker/schema.sql`）。`GET /api/state` 免驗證，其餘方法要求
`Authorization: Bearer <DASH_TOKEN>`（D1 綁定名 `DB`，D1 database 名 `osaka-trip`，見 `worker/wrangler.toml`）。
CORS 白名單寫死在程式碼裡（`osaka.19980803.xyz` / GitHub Pages / localhost）。

**部署（`.github/workflows/deploy.yml`）：** push 到 main 或收到 `Osaka-vault` 發來的
`repository_dispatch: vault-updated` 都會觸發：checkout 本 repo + checkout Osaka-vault 到 `vault/` →
`npm run build:data`（`NOTES_DIR=vault`）→ `npm run build` → 部署到 GitHub Pages。
`vite.config.ts` 的 `base` 依 `VITE_CF_PAGES` 是否設定切換 `/`（Cloudflare Pages）或 `/Osaka-web/`（GitHub Pages）。

**頁面/元件：** `src/App.tsx` 用 `location.hash` 做無 router 的分頁切換（`TabKey`），
`PAGES` map 對應 `src/pages/*.tsx`；共用小元件在 `src/components/`（`Chip`、`Heart`、`MapLink`、
`Stamp`、`WishList`、`MarkdownBody` 等）。`src/lib/maps.ts` 處理地圖連結產生邏輯。

## Notes

- 測試框架是 Vitest（不是 Jest），元件測試用 `@testing-library/react` + `jsdom`。
- Lint 用 oxlint，不是 ESLint；規則見 `.oxlintrc.json`。
- `worker/` 是獨立 npm 專案（有自己的 `package.json`/`tsconfig.json`/`vitest.config.ts`），
  不算在 root 的 `npm test` 範圍內，要單獨 `cd worker && npm test`。
- 專案內有 `.claude/skills/cloudflare-use` 技能，操作 D1 / R2 前應該優先使用它。

# Cloudflare Pages 部署與自訂網域設定 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將大阪行程儀表板（前端網頁）建置並部署至 Cloudflare Pages，並綁定自訂網域 `osaka.19980803.xyz`。

**Architecture:** 前端專案使用 Vite 建置。為相容 GitHub Pages (`/Osaka-web/`) 與 Cloudflare Pages 根目錄 (`/`)，我們將在 `vite.config.ts` 中讀取環境變數 `VITE_CF_PAGES` 動態調整 base path。接著使用 Wrangler 於 Cloudflare 建立 Pages 專案、執行部署、並新增自訂網域。

**Tech Stack:** Vite + React、Wrangler CLI。

---

## Global Constraints

- 使用 `.env` 中現有的 `CLOUDFLARE_API_TOKEN` 與 `CLOUDFLARE_ACCOUNT_ID` 進行認證。
- 不影響現有的 GitHub Pages 部署流程。
- 前端 base path 預設仍為 `/Osaka-web/`。

---

### Task 1: 支援動態 Base Path 設定

**Files:**
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: 環境變數 `VITE_CF_PAGES`（建置時由 PowerShell/Bash 帶入）。
- Produces: 動態的 base path 設定。

- [ ] **Step 1: 修改 `vite.config.ts`**

將 `vite.config.ts` 中的 `base: '/Osaka-web/',` 修改為：

```typescript
base: process.env.VITE_CF_PAGES ? '/' : '/Osaka-web/',
```

並確認引入 `process` 不會引起 TypeScript 錯誤（因 vite.config.ts 執行於 Node 環境中）。

- [ ] **Step 2: 測試本機建置（動態 base）**

在終端機中測試，不帶變數建置：
Run: `npm run build`
並檢查 `dist/index.html`，確認資源路徑皆以 `/Osaka-web/` 開頭。

- [ ] **Step 3: 測試帶環境變數建置**

在終端機中設定變數建置：
Run: `$env:VITE_CF_PAGES="1"; npm run build`
並檢查 `dist/index.html`，確認資源路徑已改為 `/` 開頭。

- [ ] **Step 4: Commit 程式碼**

```bash
git add vite.config.ts
git commit -m "chore: 支援建置時透過 VITE_CF_PAGES 動態調整 base path"
```

---

### Task 2: 於 Cloudflare Pages 建立專案與部署

**Files:**
- 無程式碼變更（Wrangler 部署操作）。

**Interfaces:**
- Consumes: `.env` 中的 API Token 與 Account ID，以及建置產物目錄 `dist/`。

- [ ] **Step 1: 建立 Cloudflare Pages 專案**

執行 Wrangler 指令建立名為 `osaka` 的專案，設定生產分支為 `main`：

```powershell
$env:CLOUDFLARE_API_TOKEN="<CLOUDFLARE_API_TOKEN>"
$env:CLOUDFLARE_ACCOUNT_ID="aad3b9dcdad1ab238f88663dc9d65c7c"
npx wrangler pages project create osaka --production-branch main
```

- [ ] **Step 2: 執行生產建置**

使用 Cloudflare Pages base path 進行專案打包：

```powershell
$env:VITE_CF_PAGES="1"
npm run build
```

- [ ] **Step 3: 部署至 Cloudflare Pages**

將 `dist/` 建置產物部署至 `osaka` 專案：

```powershell
$env:CLOUDFLARE_API_TOKEN="<CLOUDFLARE_API_TOKEN>"
$env:CLOUDFLARE_ACCOUNT_ID="aad3b9dcdad1ab238f88663dc9d65c7c"
npx wrangler pages deploy dist --project-name osaka
```

Expected: 部署成功，並輸出預覽網址（如 `osaka.pages.dev`）。

---

### Task 3: 綁定自訂網域 `osaka.19980803.xyz`

**Files:**
- 無程式碼變更（Wrangler 網域操作）。

- [ ] **Step 1: 綁定自訂網域**

透過 Wrangler 在 `osaka` 專案中綁定 `osaka.19980803.xyz`：

```powershell
$env:CLOUDFLARE_API_TOKEN="<CLOUDFLARE_API_TOKEN>"
$env:CLOUDFLARE_ACCOUNT_ID="aad3b9dcdad1ab238f88663dc9d65c7c"
npx wrangler pages domain add osaka.19980803.xyz --project-name osaka
```

Expected: 新增成功。因為網域 `19980803.xyz` 在同一個 Cloudflare 帳戶下，Cloudflare 應會自動補上 DNS CNAME 紀錄。

- [ ] **Step 2: 驗證網站連線**

- 使用 `curl.exe -I https://osaka.19980803.xyz` 測試連線，確認能成功回傳 200 HTTP 狀態。
- 檢查連線是否正常載入各資源，無 404 資源錯誤。

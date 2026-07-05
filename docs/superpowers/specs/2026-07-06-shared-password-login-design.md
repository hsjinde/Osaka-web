# 共用密碼登入 → 解鎖編輯 — 設計文件

日期：2026-07-06
狀態：已核可

## 背景與問題

- 目前寫入權限靠「持有 `DASH_TOKEN`（64 位元 hex）」判定：前端把 token 存在 `localStorage`，
  `GET /api/state` 免驗證、`PUT /api/state/:key` 需 `Authorization: Bearer <DASH_TOKEN>`。
- token 進到裝置只有兩條路：`?setup=<token>` 魔術連結（`consumeSetupToken`），或按 ⚙ 手動貼上那串 hex。
  兩者都不像「登入」——連結要保管、hex 難記。
- 現況有一個與需求相關的漏洞：`Heart.tsx` 與 `Home.tsx` 待辦勾選框**完全沒檢查是否已授權**，
  未設定 token 時點愛心仍會寫入本機 `localStorage`（只是不同步）。所謂「唯讀模式」其實不是真的唯讀。
- 資料模型是**全體共用的一張 map**（`fav:<id>` / `todo:<key>`），沒有 per-user 欄位，
  也不需要知道「誰標記的」。

目標：加一個真正的登入流程 —— 有登入的人可以編輯標記，沒登入只能看、愛心/勾選框按不動。
使用者就算停在 `https://osaka.19980803.xyz`（無 `?setup=`），只要登入一樣能編輯。

## 決策（與使用者確認過）

| 議題 | 決定 |
|---|---|
| 身分模型 | 單一共用密碼（不做個別帳號、不做第三方登入；貼合共用資料模型） |
| 密碼驗證方式 | Worker 新增 `POST /api/login`，密碼正確 → 回傳現有 hex `DASH_TOKEN`；前端存起來照舊用 |
| 密碼值 | `DASH_PASSWORD = 0509`（使用者刻意選的低強度密碼，見下方安全備註） |
| 未登入 UX | 愛心/勾選框照常顯示但鎖住（變灰、不切換），點下去彈出登入視窗 |
| 登入後生效方式 | 登入成功後 `location.reload()`（沿用現有 ⚙ 流程做法）→ store 自動同步、入口解鎖 |
| 向後相容 | 既有 `?setup=` 連結與 hex token 完全照舊可用，不移除 |

## A. Worker（後端）

### 1. 新增密碼 Secret

- 新增 Worker Secret `DASH_PASSWORD`，值為 `0509`，以 `wrangler secret put DASH_PASSWORD` 設定
  （依 cloudflare-use skill 流程）。不進 git、不進前端 bundle。
- `Bindings` 型別加上 `DASH_PASSWORD: string`。

### 2. 新增 `POST /api/login`

- Body：`{ password: string }`。
- `password === c.env.DASH_PASSWORD` → `200 { token: c.env.DASH_TOKEN }`；否則 → `401 { error: 'invalid password' }`。
- 目的：讓人記好記的密碼，實際跑在線上的仍是強度較高的 hex token。

### 3. 認證中介軟體放行登入路由

- 現行 middleware 對所有非 GET/OPTIONS 請求要求 `Bearer <DASH_TOKEN>`。
  `POST /api/login` 必須在**沒有 token** 的情況下打得進來（登入才是為了拿 token）。
- 放行條件改為：`method === 'GET' || method === 'OPTIONS' || path === '/api/login'` 時跳過驗證；
  其餘（`PUT /api/state/:key` 等）維持 `Bearer <DASH_TOKEN>` 驗證。

### 4. CORS

- `allowMethods` 由 `['GET', 'PUT', 'OPTIONS']` 增加 `'POST'`。

## B. 前端 — 認證模組（新增）

### 1. `src/api/state.ts`

- 新增 `login(password: string): Promise<boolean>`：`POST {apiBase}/api/login`，
  成功（200）取回 `token` 並 `setToken(token)`、回傳 `true`；401 回傳 `false`；其他錯誤 throw。
- 新增 `clearToken(): void`：`localStorage.removeItem(TOKEN_KEY)`（登出用）。

### 2. `src/state/auth.tsx`（新）

- `AuthProvider` + `useAuth()`，提供：
  - `canEdit: boolean` —— `!!apiBase() && !!getToken()`，於掛載時計算。
  - `openLogin() / closeLogin()`、`loginOpen: boolean` —— 控制登入視窗開關。
  - `login(password)` —— 呼叫 `api/state.login`，成功則 `location.reload()`；失敗回傳錯誤供 UI 顯示。
  - `logout()` —— `clearToken()` 後 `location.reload()`。
- 只負責「身分與登入視窗狀態」，與負責狀態同步的 `TripStateProvider` 職責分離。
  登入/登出都以 reload 收尾，兩者不需在執行期互相接線。

### 3. `src/components/LoginModal.tsx`（新）

- 和風紙質風格的密碼登入框：密碼輸入、送出、錯誤提示（密碼錯誤）、送出中狀態。
- 由 `useAuth()` 的 `loginOpen` 驅動；成功後模組會 reload，失敗顯示「密碼錯誤」。

## C. 前端 — 把編輯入口上鎖

- `Heart.tsx`：讀 `useAuth().canEdit`。`false` 時愛心變灰/半透明、`aria-disabled`、**不呼叫 `toggleFav`**；
  改為 `openLogin()`。
- `Home.tsx` 待辦勾選框（第 84–88 行）：同樣依 `canEdit` gating，鎖住時點擊改開登入視窗。
- `store.tsx` 的 `toggle` 邏輯不動 —— 未登入時元件不會呼叫它，順帶修掉「未登入仍寫本機」的漏洞。

## D. Header 登入／登出 UI（`src/App.tsx`）

- **未登入**（`!canEdit`）：顯示「登入」按鈕（點擊 `openLogin()`）；維持「唯讀模式」語意標籤。
- **已登入**：顯示「登出」按鈕（`logout()`）；保留 ⚙ 供已登入者複製新裝置設定連結；
  離線 badge 邏輯不變。
- 原 ⚙ 內未設定時的「輸入通行密碼」prompt 由 LoginModal 取代（不再要求貼 hex）。

## 實作範圍

| 檔案 | 變更 |
|---|---|
| `worker/src/index.ts` | 加 `DASH_PASSWORD` binding、`POST /api/login`、middleware 放行登入、CORS 加 POST |
| `worker/test/worker.test.ts` | 登入端點與授權行為測試 |
| `src/api/state.ts` | 加 `login()`、`clearToken()` |
| `src/state/auth.tsx` | 新增 AuthProvider / useAuth |
| `src/components/LoginModal.tsx` | 新增登入視窗 |
| `src/components/Heart.tsx` | 依 `canEdit` 上鎖、點擊開登入 |
| `src/pages/Home.tsx` | 待辦勾選框依 `canEdit` 上鎖 |
| `src/App.tsx` | 登入/登出按鈕、渲染 LoginModal |
| `src/main.tsx` | 以 `AuthProvider` 包住 App |

## 錯誤處理

- 密碼錯誤（401）→ LoginModal 顯示「密碼錯誤」，不存 token、不 reload。
- 登入請求網路失敗 → 顯示一般錯誤訊息，可重試。
- 未登入時點鎖住的愛心/勾選框 → 一律開登入視窗，不寫任何本機狀態。
- 既有離線佇列、`?setup=`、`configured()` 寫入路徑語意不變。

## 測試

- Worker（`worker/` vitest）：
  - `POST /api/login` 密碼正確 → 200 且回傳 `{ token }`；密碼錯誤 → 401。
  - `GET /api/state` 仍免驗證回 200；`PUT` 無 bearer 仍 401、帶正確 token → 200。
- 前端（vitest + @testing-library/react）：
  - `login()` 成功時 `setToken` 被呼叫並回 `true`；401 回 `false` 不存 token。
  - `clearToken()` 清掉 token。
  - `canEdit === false` 時 `Heart` 呈鎖住樣式、點擊呼叫 `openLogin` 而非 `toggleFav`（不寫本機）。
  - `canEdit === true` 時 `Heart` 可正常 `toggleFav`。
- 依專案現有 vitest 模式撰寫。

## 部署

1. `wrangler secret put DASH_PASSWORD`（值 `0509`）→ `wrangler deploy`（依 cloudflare-use skill）。
2. 前端變更 push main → Pages / GitHub Pages workflow 自動部署。
3. 驗證：未登入時愛心鎖住、點擊出現登入框；輸入 `0509` 登入後可正常標記並跨裝置同步；
   輸入錯誤密碼被拒。

## ⚠️ 安全備註（誠實揭露，使用者已知情並接受）

- `DASH_PASSWORD = 0509` 為 4 位數字（約 1 萬種組合），且 Worker **無 rate limiting**，
  理論上可被暴力嘗試。使用者明確表示「只是旅遊網站、非敏感資料（餐廳收藏），被改掉也沒差」，
  故刻意採低強度密碼、先不做限流。
- 此密碼定位是「擋路人隨手亂改共用清單」，不是高強度存取控制。日後要提升強度，
  可換較長密碼或於 `/api/login` 加簡單延遲/限流，不影響本設計架構。

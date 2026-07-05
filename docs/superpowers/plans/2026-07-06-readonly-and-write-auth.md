# 唯讀模式與寫入驗證分離 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓沒有設定 Token 的使用者可以正常讀取遠端狀態（唯讀模式），而只有設定 Token 的使用者才可以寫入變更（同步模式）。

**Architecture:** 
1. **Worker 端**：修改 `/api/*` 認證中介軟體 (middleware)，排除 `GET` 與 `OPTIONS` 請求的權限驗證，僅對 `PUT` 等寫入請求進行 `DASH_TOKEN` 驗證。
2. **前端 API 端**：在 `src/api/state.ts` 中導出 `apiBase()`，以便前端判斷是否已設定 API 位置。
3. **前端狀態端**：在 `src/state/store.tsx` 的 `syncRemote` 中，即使沒有 Token，只要有 API 位置就呼叫 `fetchState()` 拉取狀態進行唯讀；而在 `toggle` 內，僅在有 Token 時才寫回伺服器。
4. **前端介面端**：在 `src/App.tsx` 中調整提示標籤。無 Token 時顯示「唯讀模式・點 ⚙ 同步」；有 Token 且斷線時才顯示「離線模式・變更暫存本機」。

**Tech Stack:** Hono (Cloudflare Worker)、React 19 + TypeScript、Wrangler CLI。

---

## Global Constraints

- 不影響現有的功能運作與測試。
- 程式碼風格維持 2 空格縮排、繁體中文註解。
- 認證憑證繼續安全地使用現有環境變數與 secrets。

---

### Task 1: 修改 Worker 驗證機制與部署

**Files:**
- Modify: `worker/src/index.ts`

**Interfaces:**
- Consumes: `c.req.method` 判斷 HTTP 方法。

- [ ] **Step 1: 修改 `worker/src/index.ts` 驗證邏輯**

將 `worker/src/index.ts` 中的中介軟體（原第 13-18 行）：

```typescript
app.use('/api/*', async (c, next) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.DASH_TOKEN}`) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  await next();
});
```

修改為僅對非 GET/OPTIONS 請求進行認證：

```typescript
app.use('/api/*', async (c, next) => {
  if (c.req.method !== 'GET' && c.req.method !== 'OPTIONS') {
    if (c.req.header('Authorization') !== `Bearer ${c.env.DASH_TOKEN}`) {
      return c.json({ error: 'unauthorized' }, 401);
    }
  }
  await next();
});
```

- [ ] **Step 2: 部署 Worker**

將 Worker 變更部署至 Cloudflare：

```powershell
$env:CLOUDFLARE_API_TOKEN="<CLOUDFLARE_API_TOKEN>"
$env:CLOUDFLARE_ACCOUNT_ID="aad3b9dcdad1ab238f88663dc9d65c7c"
npx wrangler deploy --config worker/wrangler.toml
```

- [ ] **Step 3: 驗證 Worker API 行為**

測試不帶 Token 進行 GET 請求：
`curl.exe -s -o NUL -w "%{http_code}" https://osaka-dashboard.ethan19980803.workers.dev/api/state`
Expected: `200`（原先為 401）。

測試不帶 Token 進行 PUT 請求：
`curl.exe -s -o NUL -w "%{http_code}" -X PUT https://osaka-dashboard.ethan19980803.workers.dev/api/state/test`
Expected: `401`。

測試帶正確 Token 進行 PUT 請求：
`curl.exe -s -o NUL -w "%{http_code}" -X PUT -H "Authorization: Bearer 4eb7f6314da54133b3a322c366ff0d5ba8901c3e383162ca22e4d0cb5394ef34" -H "Content-Type: application/json" -d "{\"value\":true}" https://osaka-dashboard.ethan19980803.workers.dev/api/state/test`
Expected: `200`。

- [ ] **Step 4: Commit 變更**

```bash
git add worker/src/index.ts
git commit -m "feat(worker): 僅對寫入請求 (PUT) 進行 DASH_TOKEN 認證，開放匿名讀取 (GET)"
```

---

### Task 2: 前端狀態邏輯調整（讀寫分離）與單元測試

**Files:**
- Modify: `src/api/state.ts`
- Modify: `src/state/store.tsx`
- Modify: `src/state/__tests__/store.test.tsx`

**Interfaces:**
- Consumes: `apiBase()` 判斷 API 網址是否存在。
- Produces: 唯讀時只拉取狀態不寫入。

- [ ] **Step 1: 匯出 `apiBase`**

將 `src/api/state.ts` 中的 `function apiBase()` 改為具名匯出：
```typescript
export function apiBase(): string | undefined { return import.meta.env.VITE_API_BASE as string | undefined; }
```

- [ ] **Step 2: 修改 `src/state/store.tsx` 同步與點擊邏輯**

修改 `syncRemote`：
```typescript
  const syncRemote = useCallback(async () => {
    if (!apiBase()) { setOffline(true); return; }
    try {
      if (getToken()) {
        await flushQueue();
      }
      const remote = await fetchState();
      setState((s) => { const merged = { ...s, ...remote }; saveLocal(merged); return merged; });
      setOffline(false);
    } catch { setOffline(true); }
  }, []);
```

修改 `toggle` 內的寫回邏輯：
```typescript
  const toggle = useCallback((key: string) => {
    setState((s) => {
      const value = !s[key];
      const next = { ...s, [key]: value };
      saveLocal(next);
      if (configured()) {
        putState(key, value).then(() => setOffline(false)).catch(() => { queuePut(key, value); setOffline(true); });
      }
      return next;
    });
  }, []);
```

- [ ] **Step 3: 修改 `src/state/__tests__/store.test.tsx` 測試案例**

新增/修改測試驗證在無 Token 的情況下，仍然可以正常執行 `fetchState` 讀取遠端狀態，但點擊 `toggleFav` 時不呼叫 `putState` 寫入。

- [ ] **Step 4: 執行測試確認通過**

Run: `npm test`、`npm run lint`

- [ ] **Step 5: Commit 變更**

```bash
git add src/api/state.ts src/state/store.tsx src/state/__tests__/store.test.tsx
git commit -m "feat(frontend): 支援無 token 唯讀遠端同步狀態，有 token 時才寫入"
```

---

### Task 3: 前端 UI 標籤調整與部署

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 修改 `src/App.tsx` 提示標籤**

修改離線狀態與唯讀狀態提示區塊：

```tsx
        {apiBase() && (
          !getToken() ? (
            <span style={{ fontSize: 11, color: 'var(--brown)', border: '1px dashed var(--brown)', borderRadius: 4, padding: '2px 8px' }}>
              唯讀模式・點 ⚙ 同步
            </span>
          ) : offline ? (
            <span style={{ fontSize: 11, color: 'var(--brown)', border: '1px dashed var(--brown)', borderRadius: 4, padding: '2px 8px' }}>
              離線模式・變更暫存本機
            </span>
          ) : null
        )}
```

- [ ] **Step 2: 執行全案測試與 Lint**

Run: `npm test`、`npm run lint`

- [ ] **Step 3: 執行生產打包並部署**

執行 Pages 部署：
```powershell
$env:VITE_CF_PAGES="1"
npm run build
$env:CLOUDFLARE_API_TOKEN="<CLOUDFLARE_API_TOKEN>"
$env:CLOUDFLARE_ACCOUNT_ID="aad3b9dcdad1ab238f88663dc9d65c7c"
npx wrangler pages deploy dist --project-name osaka
```

- [ ] **Step 4: Commit 與 Push**

```bash
git add src/App.tsx
git commit -m "feat(ui): 調整提示標籤以區分唯讀模式與離線同步模式"
git push
```

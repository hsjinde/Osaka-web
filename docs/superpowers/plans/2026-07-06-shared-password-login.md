# 共用密碼登入 → 解鎖編輯 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓沒登入的人只能瀏覽、按不動愛心/待辦；輸入共用密碼 `0509` 登入後即可跨裝置編輯標記，手機體驗優先。

**Architecture:** 沿用現有「持有 `DASH_TOKEN` 才能寫入」模型。Worker 新增 `POST /api/login`：密碼正確即回傳現有 hex `DASH_TOKEN`。前端以新的 `AuthProvider` 管理登入狀態與登入視窗，`Heart`／待辦勾選依 `canEdit` 上鎖，未登入點擊改開手機優先的 `LoginModal`。登入/登出以 `location.reload()` 收尾，讓既有 store 於重載後自動同步。既有 `?setup=` 連結與 hex token 完全相容。

**Tech Stack:** Hono（Cloudflare Worker）、React 19 + TypeScript、Vite、Vitest、@testing-library/react、oxlint、Wrangler。

## Global Constraints

- 程式碼風格：2 空格縮排、繁體中文註解，跟隨既有檔案風格（大量 inline style）。
- 前端測試框架是 **Vitest**（非 Jest），元件測試用 `@testing-library/react` + jsdom；斷言用內建 matcher（`toBe`/`toBeTruthy`/`toBeNull`），**不引入** `@testing-library/jest-dom`（專案未安裝）。
- Lint 用 **oxlint**（`npm run lint`），會抓未使用的 import，移除即可。
- `worker/` 是獨立 npm 專案，測試指令 `npm test --prefix worker`；前端測試 `npm test`（全案）或 `npx vitest run <path>`（單檔）。
- `DASH_PASSWORD = 0509` 只存在 Worker Secret，**永不進 git、永不進前端 bundle**。前端只知道要 POST 密碼給 `/api/login`。
- 向後相容：不得破壞既有 `?setup=` 流程、`configured()` 寫入路徑、離線佇列語意。
- Cloudflare 操作（`wrangler secret`/`deploy`/`pages deploy`）優先使用 `.claude/skills/cloudflare-use` 技能取得憑證；已知 `CLOUDFLARE_ACCOUNT_ID=aad3b9dcdad1ab238f88663dc9d65c7c`。
- 每個 commit 訊息結尾加一行：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。
- 分支：本工作在 `feat/login-write-auth`（已建立）。

---

### Task 1: Worker — 新增 `POST /api/login` 並修正陳舊授權測試

**Files:**
- Modify: `worker/src/index.ts`
- Modify: `worker/test/worker.test.ts`

**Interfaces:**
- Produces: `POST /api/login`，body `{ password: string }` → `200 { token: string }`（密碼正確）或 `401 { error: string }`（錯誤）。
- Consumes: `c.env.DASH_PASSWORD`、`c.env.DASH_TOKEN`。

> 註：`worker/test/worker.test.ts` 目前有 2 個紅燈測試（「無 token 拒絕」「錯 token 拒絕」對 GET 期望 401，但唯讀模式改動後 GET 已公開回 200）。本任務一併修正為「讀公開／寫驗證」模型，否則測試檢查點無法通過。

- [ ] **Step 1: 改寫測試（先讓新行為的測試失敗）**

把 `worker/test/worker.test.ts` 第 26 行的 `env` 與第 29~59 行的 `describe` 內容，改成下列（保留檔案上半部的 `fakeD1`）：

```ts
const env = { DB: fakeD1() as unknown, DASH_TOKEN: 'secret123', DASH_PASSWORD: '0509' };
const auth = { Authorization: 'Bearer secret123' };

describe('worker API', () => {
  it('GET 免驗證，公開讀取', async () => {
    const res = await app.request('/api/state', {}, env);
    expect(res.status).toBe(200);
  });

  it('PUT 無 token 拒絕', async () => {
    const res = await app.request('/api/state/x', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: true }),
    }, env);
    expect(res.status).toBe(401);
  });

  it('PUT 錯 token 拒絕', async () => {
    const res = await app.request('/api/state/x', {
      method: 'PUT', headers: { Authorization: 'Bearer wrong', 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: true }),
    }, env);
    expect(res.status).toBe(401);
  });

  it('PUT 後 GET 讀得回來', async () => {
    const put = await app.request('/api/state/' + encodeURIComponent('fav:餐廳/測試'), {
      method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: true }),
    }, env);
    expect(put.status).toBe(200);
    const res = await app.request('/api/state', { headers: auth }, env);
    const map = await res.json() as Record<string, boolean>;
    expect(map['fav:餐廳/測試']).toBe(true);
  });

  it('value:false 覆寫', async () => {
    await app.request('/api/state/' + encodeURIComponent('fav:餐廳/測試'), {
      method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: false }),
    }, env);
    const res = await app.request('/api/state', { headers: auth }, env);
    const map = await res.json() as Record<string, boolean>;
    expect(map['fav:餐廳/測試']).toBe(false);
  });

  it('POST /api/login 密碼正確回傳 token', async () => {
    const res = await app.request('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: '0509' }),
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { token: string };
    expect(body.token).toBe('secret123');
  });

  it('POST /api/login 密碼錯誤回 401', async () => {
    const res = await app.request('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: '9999' }),
    }, env);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: 跑測試確認新測試失敗**

Run: `npm test --prefix worker`
Expected: 兩個 `POST /api/login` 測試 FAIL（登入路由不存在，Hono 回 404 而非 200/401）；其餘讀寫測試 PASS。

- [ ] **Step 3: 實作 Worker**

把 `worker/src/index.ts` 全檔改為：

```ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = { DB: D1Database; DASH_TOKEN: string; DASH_PASSWORD: string };
const app = new Hono<{ Bindings: Bindings }>();

app.use('/api/*', cors({
  origin: ['https://osaka.19980803.xyz', 'https://hsjinde.github.io', 'http://localhost:5173'],
  allowMethods: ['GET', 'PUT', 'POST', 'OPTIONS'],
  allowHeaders: ['Authorization', 'Content-Type'],
}));

app.use('/api/*', async (c, next) => {
  // 公開：讀取(GET)、預檢(OPTIONS)、登入(POST /api/login)；其餘寫入需 DASH_TOKEN。
  const open = c.req.method === 'GET' || c.req.method === 'OPTIONS' || c.req.path === '/api/login';
  if (!open && c.req.header('Authorization') !== `Bearer ${c.env.DASH_TOKEN}`) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  await next();
});

// 以共用密碼換取寫入用的 token。
app.post('/api/login', async (c) => {
  const { password } = await c.req.json<{ password: string }>();
  if (password !== c.env.DASH_PASSWORD) {
    return c.json({ error: 'invalid password' }, 401);
  }
  return c.json({ token: c.env.DASH_TOKEN });
});

app.get('/api/state', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT key, value FROM state').all<{ key: string; value: string }>();
  const map: Record<string, boolean> = {};
  for (const r of results) map[r.key] = r.value === '1';
  return c.json(map);
});

app.put('/api/state/:key', async (c) => {
  const key = decodeURIComponent(c.req.param('key'));
  const { value } = await c.req.json<{ value: boolean }>();
  await c.env.DB
    .prepare('INSERT INTO state (key, value, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ?3')
    .bind(key, value ? '1' : '0', new Date().toISOString())
    .run();
  return c.json({ ok: true });
});

export default app;
```

- [ ] **Step 4: 跑測試確認全過**

Run: `npm test --prefix worker`
Expected: 全部 PASS（7 個測試）。

- [ ] **Step 5: Commit**

```bash
git add worker/src/index.ts worker/test/worker.test.ts
git commit -m "feat(worker): 新增 POST /api/login 以密碼換 token，並修正讀公開/寫驗證測試"
```

- [ ] **Step 6: 設定密碼 Secret 並部署 Worker**

依 `.claude/skills/cloudflare-use` 取得 `CLOUDFLARE_API_TOKEN`，並設 `CLOUDFLARE_ACCOUNT_ID=aad3b9dcdad1ab238f88663dc9d65c7c`，於 repo 根目錄執行（PowerShell）：

```powershell
"0509" | npx wrangler secret put DASH_PASSWORD --config worker/wrangler.toml
npx wrangler deploy --config worker/wrangler.toml
```

- [ ] **Step 7: 驗證線上端點**

```bash
curl.exe -s -X POST -H "Content-Type: application/json" -d "{\"password\":\"0509\"}" https://osaka-dashboard.ethan19980803.workers.dev/api/login
```
Expected: 回傳 `{"token":"<hex>"}`（HTTP 200）。

```bash
curl.exe -s -o NUL -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "{\"password\":\"0000\"}" https://osaka-dashboard.ethan19980803.workers.dev/api/login
```
Expected: `401`。

---

### Task 2: 前端 API — `login()` 與 `clearToken()`

**Files:**
- Modify: `src/api/state.ts`
- Modify: `src/api/__tests__/state.test.ts`

**Interfaces:**
- Consumes: `apiBase()`、`setToken()`、`TOKEN_KEY`（同檔內既有）。
- Produces:
  - `login(password: string): Promise<boolean>` — 200 時存 token 回 `true`；401 回 `false` 不存；其他狀態 throw。
  - `clearToken(): void` — 移除本機 token。

- [ ] **Step 1: 寫失敗測試**

在 `src/api/__tests__/state.test.ts` 的 import 加入 `login, clearToken`：

```ts
import { queuePut, flushQueue, setToken, getToken, consumeSetupToken, setupLink, login, clearToken } from '../state';
```

在檔案最後新增：

```ts
describe('login / clearToken', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv('VITE_API_BASE', 'http://api.test');
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it('login 密碼正確：存 token、回 true', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ token: 'HEXTOKEN' }), { status: 200 })));
    await expect(login('0509')).resolves.toBe(true);
    expect(getToken()).toBe('HEXTOKEN');
  });

  it('login 密碼錯誤：回 false、不存 token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"invalid password"}', { status: 401 })));
    await expect(login('9999')).resolves.toBe(false);
    expect(getToken()).toBeNull();
  });

  it('clearToken 清除 token', () => {
    setToken('x');
    clearToken();
    expect(getToken()).toBeNull();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/api/__tests__/state.test.ts`
Expected: FAIL（`login`/`clearToken` 不是函式 / 未匯出）。

- [ ] **Step 3: 實作**

在 `src/api/state.ts` 的 `setToken` 之後（約第 6 行下方）新增：

```ts
export function clearToken(): void { localStorage.removeItem(TOKEN_KEY); }

/** 以共用密碼向 Worker 換取寫入 token；成功存入本機回 true，密碼錯誤回 false。 */
export async function login(password: string): Promise<boolean> {
  const res = await fetch(`${apiBase()}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (res.status === 401) return false;
  if (!res.ok) throw new Error(`POST login ${res.status}`);
  const { token } = await res.json() as { token: string };
  setToken(token);
  return true;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/api/__tests__/state.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/api/state.ts src/api/__tests__/state.test.ts
git commit -m "feat(api): 新增 login() 以密碼換 token 與 clearToken() 登出"
```

---

### Task 3: 認證 context — `AuthProvider` / `useAuth`

**Files:**
- Create: `src/state/auth.tsx`
- Create: `src/state/__tests__/auth.test.tsx`

**Interfaces:**
- Consumes: `apiBase()`、`getToken()`、`clearToken`、`login as apiLogin` from `../api/state`。
- Produces: `AuthProvider`、`useAuth(): Auth`，其中
  ```ts
  interface Auth {
    canEdit: boolean;              // 有 apiBase 且有 token
    loginOpen: boolean;            // 登入視窗是否開啟
    openLogin(): void;
    closeLogin(): void;
    login(password: string): Promise<boolean>;  // 成功會 reload；失敗回 false
    logout(): void;                // 清 token 後 reload
  }
  ```

- [ ] **Step 1: 寫失敗測試**

建立 `src/state/__tests__/auth.test.tsx`：

```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { AuthProvider, useAuth } from '../auth';

const wrapper = AuthProvider;

function fakeLocation() {
  return { reload: vi.fn(), assign: vi.fn(), replace: vi.fn(),
    href: 'http://localhost/', origin: 'http://localhost', pathname: '/', search: '', hash: '' };
}

describe('useAuth', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv('VITE_API_BASE', 'http://api.test');
    vi.stubGlobal('location', fakeLocation());
  });
  afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it('無 token：canEdit 為 false', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.canEdit).toBe(false);
  });

  it('有 token 與 apiBase：canEdit 為 true', () => {
    localStorage.setItem('osaka-dash-token', 'tok');
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.canEdit).toBe(true);
  });

  it('openLogin / closeLogin 切換 loginOpen', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.loginOpen).toBe(false);
    act(() => result.current.openLogin());
    expect(result.current.loginOpen).toBe(true);
    act(() => result.current.closeLogin());
    expect(result.current.loginOpen).toBe(false);
  });

  it('login 密碼錯誤：回 false、不 reload、不存 token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
    const { result } = renderHook(() => useAuth(), { wrapper });
    let ok = true;
    await act(async () => { ok = await result.current.login('9999'); });
    expect(ok).toBe(false);
    expect((location as unknown as ReturnType<typeof fakeLocation>).reload).not.toHaveBeenCalled();
    expect(localStorage.getItem('osaka-dash-token')).toBeNull();
  });

  it('logout：清 token 並 reload', () => {
    localStorage.setItem('osaka-dash-token', 'tok');
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.logout());
    expect(localStorage.getItem('osaka-dash-token')).toBeNull();
    expect((location as unknown as ReturnType<typeof fakeLocation>).reload).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/state/__tests__/auth.test.tsx`
Expected: FAIL（`../auth` 不存在）。

- [ ] **Step 3: 實作**

建立 `src/state/auth.tsx`：

```tsx
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { apiBase, clearToken, getToken, login as apiLogin } from '../api/state';

interface Auth {
  canEdit: boolean;
  loginOpen: boolean;
  openLogin(): void;
  closeLogin(): void;
  login(password: string): Promise<boolean>;
  logout(): void;
}
const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loginOpen, setLoginOpen] = useState(false);
  // 有 API 位置且有 token 才能編輯。登入/登出都以 reload 收尾，故掛載時計算即可反映當前狀態。
  const canEdit = !!apiBase() && !!getToken();

  const login = useCallback(async (password: string): Promise<boolean> => {
    const ok = await apiLogin(password);
    if (ok) location.reload(); // 重載後 store 會以新 token 自動同步，愛心解鎖
    return ok;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    location.reload();
  }, []);

  const value = useMemo<Auth>(() => ({
    canEdit, loginOpen,
    openLogin: () => setLoginOpen(true),
    closeLogin: () => setLoginOpen(false),
    login, logout,
  }), [canEdit, loginOpen, login, logout]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth 必須在 AuthProvider 內使用');
  return ctx;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/state/__tests__/auth.test.tsx`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/state/auth.tsx src/state/__tests__/auth.test.tsx
git commit -m "feat(auth): 新增 AuthProvider/useAuth 管理登入狀態與登入視窗"
```

---

### Task 4: `LoginModal` 元件（手機優先）

**Files:**
- Create: `src/components/LoginModal.tsx`
- Create: `src/components/__tests__/LoginModal.test.tsx`

**Interfaces:**
- Consumes: `useAuth()`（`loginOpen`、`closeLogin`、`login`）。
- Produces: `default` export `LoginModal`（無 props；由 `loginOpen` 決定渲染）。

- [ ] **Step 1: 寫失敗測試**

建立 `src/components/__tests__/LoginModal.test.tsx`：

```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import LoginModal from '../LoginModal';

const mockLogin = vi.fn();
const closeLogin = vi.fn();
let open = true;
vi.mock('../../state/auth', () => ({
  useAuth: () => ({ loginOpen: open, closeLogin, login: mockLogin }),
}));

describe('LoginModal', () => {
  beforeEach(() => { open = true; mockLogin.mockReset(); closeLogin.mockReset(); });
  afterEach(() => cleanup());

  it('關閉時不渲染', () => {
    open = false;
    const { container } = render(<LoginModal />);
    expect(container.firstChild).toBeNull();
  });

  it('密碼輸入具手機數字鍵盤屬性', () => {
    render(<LoginModal />);
    const input = screen.getByLabelText('密碼') as HTMLInputElement;
    expect(input.getAttribute('inputmode')).toBe('numeric');
    expect(input.getAttribute('autocomplete')).toBe('one-time-code');
    expect(input.type).toBe('password');
  });

  it('密碼錯誤顯示錯誤訊息', async () => {
    mockLogin.mockResolvedValue(false);
    render(<LoginModal />);
    fireEvent.change(screen.getByLabelText('密碼'), { target: { value: '9999' } });
    fireEvent.click(screen.getByRole('button', { name: '登入' }));
    await waitFor(() => expect(screen.getByText('密碼錯誤')).toBeTruthy());
    expect(mockLogin).toHaveBeenCalledWith('9999');
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/components/__tests__/LoginModal.test.tsx`
Expected: FAIL（`../LoginModal` 不存在）。

- [ ] **Step 3: 實作**

建立 `src/components/LoginModal.tsx`（手機優先：數字鍵盤、近滿版置中、避開虛擬鍵盤、大按鈕）：

```tsx
import { useState, type FormEvent } from 'react';
import { useAuth } from '../state/auth';

export default function LoginModal() {
  const { loginOpen, closeLogin, login } = useAuth();
  const [pw, setPw] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!loginOpen) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const ok = await login(pw); // 成功會 reload；失敗回 false
      if (!ok) { setError(true); setBusy(false); }
    } catch {
      setError(true); setBusy(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" onClick={closeLogin}
      style={{
        position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(41,35,26,.45)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '18vh 16px 16px',
      }}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="card"
        style={{ width: 'min(360px, 92vw)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="serif" style={{ fontSize: 19, fontWeight: 700 }}>登入以編輯</div>
        <div style={{ fontSize: 13, color: 'var(--brown-dk)' }}>輸入密碼即可標記想去的地方；未登入僅能瀏覽。</div>
        <label htmlFor="login-pw" style={{ fontSize: 12, color: 'var(--brown)', letterSpacing: '.08em' }}>密碼</label>
        <input id="login-pw" type="password" inputMode="numeric" pattern="[0-9]*"
          autoComplete="one-time-code" enterKeyHint="go" autoFocus
          value={pw} onChange={(e) => { setPw(e.target.value); setError(false); }}
          style={{
            fontSize: 20, letterSpacing: '.3em', textAlign: 'center',
            padding: '12px 14px', borderRadius: 8, border: '1px solid var(--line-dark)',
            background: 'var(--paper)', color: 'var(--ink)', fontFamily: 'inherit',
          }} />
        {error && <div style={{ fontSize: 12.5, color: 'var(--red)' }}>密碼錯誤</div>}
        <button type="submit" disabled={busy}
          style={{
            minHeight: 44, borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'var(--red)', color: '#F7F2E6', fontSize: 15, fontWeight: 700,
            fontFamily: 'inherit', opacity: busy ? 0.7 : 1,
          }}>{busy ? '登入中…' : '登入'}</button>
        <button type="button" className="btn-plain" onClick={closeLogin}
          style={{ fontSize: 12.5, color: 'var(--brown)', textAlign: 'center' }}>取消</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/components/__tests__/LoginModal.test.tsx`
Expected: PASS（3 個測試）。

- [ ] **Step 5: Commit**

```bash
git add src/components/LoginModal.tsx src/components/__tests__/LoginModal.test.tsx
git commit -m "feat(ui): 新增手機優先的密碼登入視窗 LoginModal"
```

---

### Task 5: 上鎖編輯入口（Heart 愛心 + Home 待辦勾選）

**Files:**
- Modify: `src/components/Heart.tsx`
- Modify: `src/pages/Home.tsx`
- Create: `src/components/__tests__/Heart.test.tsx`

**Interfaces:**
- Consumes: `useAuth()`（`canEdit`、`openLogin`）、`useTripState()`（既有）。

- [ ] **Step 1: 寫失敗測試**

建立 `src/components/__tests__/Heart.test.tsx`（mock `useAuth` 控制 `canEdit`，用真的 `TripStateProvider`）：

```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import Heart from '../Heart';
import { TripStateProvider } from '../../state/store';

const openLogin = vi.fn();
let canEdit = false;
vi.mock('../../state/auth', () => ({
  useAuth: () => ({ canEdit, openLogin }),
}));

function renderHeart() {
  return render(<TripStateProvider><Heart entityId="餐廳/測試" /></TripStateProvider>);
}

describe('Heart 依登入狀態上鎖', () => {
  beforeEach(() => { localStorage.clear(); openLogin.mockReset(); });
  afterEach(() => cleanup());

  it('未登入：點擊開登入、不切換、不寫本機', () => {
    canEdit = false;
    renderHeart();
    const btn = screen.getByRole('button', { name: '收藏' });
    fireEvent.click(btn);
    expect(openLogin).toHaveBeenCalledTimes(1);
    expect(btn.textContent).toBe('♡');
    expect(localStorage.getItem('osaka-trip-state')).toBeNull();
  });

  it('已登入：點擊切換收藏、不開登入', () => {
    canEdit = true;
    renderHeart();
    const btn = screen.getByRole('button', { name: '收藏' });
    fireEvent.click(btn);
    expect(openLogin).not.toHaveBeenCalled();
    expect(btn.textContent).toBe('♥');
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/components/__tests__/Heart.test.tsx`
Expected: FAIL（Heart 尚未使用 `useAuth`；未登入點擊仍會切換成 `♥`、`openLogin` 未被呼叫）。

- [ ] **Step 3: 實作 Heart**

把 `src/components/Heart.tsx` 全檔改為：

```tsx
import { useAuth } from '../state/auth';
import { useTripState } from '../state/store';

export default function Heart({ entityId }: { entityId: string }) {
  const { isFav, toggleFav } = useTripState();
  const { canEdit, openLogin } = useAuth();
  const on = isFav(entityId);
  return (
    <button className={`heart${on ? ' heart--on' : ''}`} aria-label="收藏"
      style={canEdit ? undefined : { opacity: 0.4 }}
      onClick={() => (canEdit ? toggleFav(entityId) : openLogin())}>
      {on ? '♥' : '♡'}
    </button>
  );
}
```

- [ ] **Step 4: 實作 Home 待辦勾選上鎖**

在 `src/pages/Home.tsx`：

1) 第 4 行後新增 import：
```tsx
import { useAuth } from '../state/auth';
```

2) 第 8 行 `const { todosState, toggleTodo, favCount, favs } = useTripState();` 之後新增：
```tsx
  const { canEdit, openLogin } = useAuth();
```

3) 待辦按鈕（第 86~88 行）改為依 `canEdit` 上鎖，並讓勾選框在未登入時半透明。把：
```tsx
                <button key={t.key} className="btn-plain dash-bottom"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px' }}
                  onClick={() => toggleTodo(t.key)}>
```
改成：
```tsx
                <button key={t.key} className="btn-plain dash-bottom"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', opacity: canEdit ? 1 : 0.6 }}
                  onClick={() => (canEdit ? toggleTodo(t.key) : openLogin())}>
```

- [ ] **Step 5: 跑測試確認通過（含全案）**

Run: `npx vitest run src/components/__tests__/Heart.test.tsx`
Expected: PASS。

Run: `npm test`
Expected: 全案 PASS（既有 store/api 測試不受影響）。

- [ ] **Step 6: Commit**

```bash
git add src/components/Heart.tsx src/pages/Home.tsx src/components/__tests__/Heart.test.tsx
git commit -m "feat(ui): 未登入時鎖住愛心與待辦勾選，點擊改開登入視窗"
```

---

### Task 6: Header 登入/登出、掛載 Provider 與 Modal，並部署前端

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `AuthProvider`、`useAuth()`、`LoginModal`。

- [ ] **Step 1: main.tsx 以 AuthProvider 包住 App**

把 `src/main.tsx` 改為：

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App.tsx';
import { TripStateProvider } from './state/store';
import { AuthProvider } from './state/auth';
import { consumeSetupToken } from './api/state';

consumeSetupToken();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <TripStateProvider>
        <App />
      </TripStateProvider>
    </AuthProvider>
  </StrictMode>,
);
```

- [ ] **Step 2: App.tsx 換上登入/登出 UI 與 LoginModal**

在 `src/App.tsx`：

1) 調整 import：把第 6 行
```tsx
import { apiBase, getToken, setToken, setupLink } from './api/state';
```
改為（移除未使用的 `setToken`）：
```tsx
import { apiBase, getToken, setupLink } from './api/state';
import { useAuth } from './state/auth';
import LoginModal from './components/LoginModal';
```

2) 第 37 行 `const { offline } = useTripState();` 之後新增：
```tsx
  const { canEdit, openLogin, logout } = useAuth();
```

3) 把第 81~101 行（⚙ 按鈕 + 唯讀/離線 badge 整段）替換為：
```tsx
        {apiBase() && (canEdit ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 20px 4px' }}>
            <button className="btn-plain" title="複製新裝置設定連結" style={{ fontSize: 18, cursor: 'pointer' }}
              onClick={() => { const cur = getToken(); if (cur) window.prompt('新裝置設定連結（點一次即完成同步）：', setupLink(cur)); }}>⚙</button>
            <button className="btn-plain" style={{
              fontSize: 12.5, color: 'var(--brown-dk)', border: '1px solid var(--line-dark)',
              borderRadius: 6, padding: '6px 12px', minHeight: 34, cursor: 'pointer',
            }} onClick={logout}>登出</button>
            {offline && (
              <span style={{ fontSize: 11, color: 'var(--brown)', border: '1px dashed var(--brown)', borderRadius: 4, padding: '2px 8px' }}>
                離線模式・變更暫存本機
              </span>
            )}
          </div>
        ) : (
          <div style={{ padding: '0 20px 4px' }}>
            <button className="btn-plain" style={{
              fontSize: 13, color: 'var(--red)', border: '1px solid var(--red)',
              borderRadius: 6, padding: '7px 16px', minHeight: 38, fontWeight: 600, cursor: 'pointer',
            }} onClick={openLogin}>登入編輯</button>
          </div>
        ))}
```

4) 在 `</header>`（第 109 行）之後、`<main>` 之前新增一行渲染登入視窗：
```tsx
      <LoginModal />
```

- [ ] **Step 3: Lint + 型別 + 全案測試**

Run: `npm run lint`
Expected: 無錯誤（若報 `setToken` 未使用，確認第 6 行已移除）。

Run: `npm test`
Expected: 全案 PASS。

Run: `npm run build`
Expected: `tsc -b && vite build` 成功、無型別錯誤（不需 build:data，`src/data/*.json` 已存在）。

- [ ] **Step 4: 以 preview 驗證實際行為（手機視角）**

用既有 `.claude/launch.json` 啟動 preview（server 名見該檔；本地不需 vault，直接跑 `vite`）：

1. `preview_start`，`preview_resize` preset `mobile`（375×812）。
2. `preview_snapshot`：確認 header 出現「登入編輯」按鈕、愛心呈半透明。
3. `preview_click` 一個愛心 → `preview_snapshot` 確認彈出登入視窗（`role="dialog"`、有「密碼」輸入框與「登入」按鈕）。
4. `preview_fill` 密碼 `0509` → `preview_click`「登入」→ 頁面 reload 後 `preview_snapshot` 確認愛心已可點、header 變「登出」。
5. 錯誤密碼路徑：登出後再開登入框，`preview_fill` `0000` → 送出 → 確認顯示「密碼錯誤」。
6. `preview_screenshot` 存證。

> 若 preview 需要 API：本機 `.env` 的 `VITE_API_BASE` 指向線上 Worker 即可（Task 1 已部署 `/api/login`）。

- [ ] **Step 5: Commit**

```bash
git add src/main.tsx src/App.tsx
git commit -m "feat(ui): Header 登入/登出按鈕、掛載 AuthProvider 與 LoginModal"
```

- [ ] **Step 6: 合併與部署**

依 `superpowers:finishing-a-development-branch` 決定整合方式。預設：

```bash
git checkout main
git merge --no-ff feat/login-write-auth
git push
```
Push 到 main 會觸發 GitHub Pages workflow 自動部署。

Cloudflare Pages（`osaka.19980803.xyz`）另需手動部署（依 cloudflare-use 憑證，PowerShell）：
```powershell
$env:VITE_CF_PAGES="1"; npm run build
npx wrangler pages deploy dist --project-name osaka
```

- [ ] **Step 7: 線上驗證**

於 `https://osaka.19980803.xyz`（不帶 `?setup=`）：未登入時愛心鎖住、點擊出現登入框；輸入 `0509` 後可標記並跨裝置同步；輸入錯誤密碼被拒。既有 `?setup=<token>` 連結仍可直接進入可編輯狀態。

---

## 自我審查結果（對照 spec）

- **Spec §A（Worker）** → Task 1（`DASH_PASSWORD` binding、`POST /api/login`、middleware 放行、CORS 加 POST）。✓
- **Spec §B（前端認證模組）** → Task 2（`login`/`clearToken`）+ Task 3（`AuthProvider`/`useAuth`）+ Task 4（`LoginModal`）。✓
- **Spec §C（上鎖編輯入口）** → Task 5（Heart + Home 待辦）。✓
- **Spec §D（Header 登入/登出）** → Task 6。✓
- **Spec §E（手機優化）** → Task 4 的 `inputMode="numeric"`/`autoComplete="one-time-code"`/`enterKeyHint`/`autoFocus`、近滿版置中、`padding:'18vh…'` 避開鍵盤、44px 按鈕；Task 6 登入/登出按鈕 ≥34–38px。✓
- **Spec 測試節** → 各 Task 的 TDD 測試涵蓋 Worker 登入/授權、`login`/`clearToken`、`canEdit` 上鎖、輸入框手機屬性。✓
- **向後相容** → Task 1 middleware 仍檢查 `Bearer DASH_TOKEN`；`consumeSetupToken` 未動；Task 6 保留 ⚙ 設定連結。✓
- **型別一致性** → `login(password): Promise<boolean>`、`clearToken(): void`、`canEdit`/`loginOpen`/`openLogin`/`closeLogin`/`login`/`logout` 於 Task 2–6 一致使用。✓
- **陳舊測試** → Task 1 Step 1 一併修正 `worker/test/worker.test.ts` 目前的 2 個紅燈。✓

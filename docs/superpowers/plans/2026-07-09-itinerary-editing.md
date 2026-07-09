# 每日行程時間軸編輯功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓「每日行程 → 時間軸」可編輯時段（打字或從實體庫下拉選），三檢視即時連動，並經 Worker 代理 commit 回 Osaka-vault。

**Architecture:** 前端在記憶體改可編輯 `days`（含 localStorage 待發佈 override），儲存時序列化行程區塊，經 Worker `PUT /api/itinerary` 用 GitHub contents API commit（保留前言、帶 sha），push 觸發既有 `vault-updated` 部署。

**Tech Stack:** React + TypeScript + Vite（前端）、Hono + Cloudflare Workers（後端）、Vitest（測試）。

## Global Constraints

- 溝通/註解一律**繁體中文**（台灣用語）；程式碼、識別字、檔名維持原文。
- 前端**永遠不持有 GitHub token**；GitHub 寫入一律經 Worker。
- Worker 寫入端點沿用現有授權：非 GET/OPTIONS/login 需 `Authorization: Bearer <DASH_TOKEN>`。
- Lint 用 oxlint（`npm run lint`）；測試用 Vitest（`npm test`；worker 另 `cd worker && npm test`）。
- `src/data/*.json` 是產物，不手改；行程真相來源是 vault `wiki/dashboard/每日行程.md`。
- 行程 markdown 格式：`## Day N｜日期｜主題` / `> 區域：A、B` / `- 時段｜標題｜備註`；待安排時段標題為 `（待安排）` 且無備註。

---

### Task 1: 行程序列化 `serializeDays`

**Files:**
- Create: `src/lib/itinerary-md.ts`
- Test: `src/lib/__tests__/itinerary-md.test.ts`

**Interfaces:**
- Consumes: `Day`、`DaySlot`（`src/data/schema.ts`）；`parseItinerary`（`scripts/lib/parse-itinerary.ts`，測試用）。
- Produces: `serializeDays(days: Day[]): string` — 回傳從第一個 `## Day` 起的行程區塊（結尾含換行）。

- [ ] **Step 1: 寫失敗測試**

```ts
// src/lib/__tests__/itinerary-md.test.ts
import { describe, it, expect } from 'vitest';
import { parseItinerary } from '../../../scripts/lib/parse-itinerary';
import { serializeDays } from '../itinerary-md';

const FIXTURE = `## Day 0｜09/30 週三｜抵達日
> 區域：難波、心齋橋

- 上午｜去程航班｜樂桃航空 MM024
- 傍晚｜Check-in｜步行 5 分
- 宵夜｜（待安排）

## Day 1｜10/01 週四｜USJ
> 區域：此花區

- 全日｜環球影城｜先買 Express
- 晚上｜（待安排）
`;

describe('serializeDays', () => {
  it('固定格式：一般時段、空備註、待安排', () => {
    const days = [{
      label: 'Day 0', date: '09/30 週三', theme: '抵達日',
      areas: ['難波', '心齋橋'],
      slots: [
        { time: '上午', title: '去程航班', note: '樂桃航空 MM024', pending: false },
        { time: '午', title: '退房', note: '', pending: false },
        { time: '宵夜', title: '（待安排）', note: '', pending: true },
      ],
    }];
    expect(serializeDays(days)).toBe(
      '## Day 0｜09/30 週三｜抵達日\n' +
      '> 區域：難波、心齋橋\n\n' +
      '- 上午｜去程航班｜樂桃航空 MM024\n' +
      '- 午｜退房\n' +
      '- 宵夜｜（待安排）\n',
    );
  });

  it('parse→serialize→parse 語意等價（idempotent）', () => {
    const once = parseItinerary(FIXTURE);
    const twice = parseItinerary(serializeDays(once));
    expect(twice).toEqual(once);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/lib/__tests__/itinerary-md.test.ts`
Expected: FAIL（`serializeDays` 尚未定義 / 找不到模組）

- [ ] **Step 3: 實作**

```ts
// src/lib/itinerary-md.ts
import type { Day } from '../data/schema';

/** parse-itinerary 的反向：輸出從第一個 `## Day` 起的行程區塊（結尾含換行）。 */
export function serializeDays(days: Day[]): string {
  return days.map(serializeDay).join('\n\n') + '\n';
}

function serializeDay(d: Day): string {
  const lines: string[] = [`## ${d.label}｜${d.date}｜${d.theme}`];
  if (d.areas.length) lines.push(`> 區域：${d.areas.join('、')}`);
  lines.push('');
  for (const s of d.slots) {
    if (s.pending) lines.push(`- ${s.time}｜（待安排）`);
    else if (s.note) lines.push(`- ${s.time}｜${s.title}｜${s.note}`);
    else lines.push(`- ${s.time}｜${s.title}`);
  }
  return lines.join('\n');
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/lib/__tests__/itinerary-md.test.ts`
Expected: PASS（2 passed）

- [ ] **Step 5: Commit**

```bash
git add src/lib/itinerary-md.ts src/lib/__tests__/itinerary-md.test.ts
git commit -m "feat: 行程序列化 serializeDays（parse-itinerary 反向）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Worker `PUT /api/itinerary` commit 端點

**Files:**
- Modify: `worker/src/index.ts`
- Modify: `worker/wrangler.toml`
- Test: `worker/test/worker.test.ts`

**Interfaces:**
- Consumes: 前端送 `{ daySectionsMarkdown: string }`。
- Produces: `PUT /api/itinerary` → 200 `{ ok: true }` / 400 / 401 / 409（sha 衝突）/ 502（GitHub 失敗）。
- 需要的 env：`GH_OWNER`、`GH_REPO`、`GH_BRANCH`、`GH_ITINERARY_PATH`、`GITHUB_TOKEN`。

- [ ] **Step 1: 加 `[vars]` 到 wrangler.toml**

在 `worker/wrangler.toml` 末尾加入（非機密設定；`GITHUB_TOKEN` 之後用 `wrangler secret put` 設）：

```toml
[vars]
GH_OWNER = "hsjinde"
GH_REPO = "Osaka-vault"
GH_BRANCH = "main"
GH_ITINERARY_PATH = "wiki/dashboard/每日行程.md"
```

- [ ] **Step 2: 寫失敗測試**

在 `worker/test/worker.test.ts` 檔頭把 import 改為含 `vi`、`afterEach`：

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
```

在檔案 `describe('worker API', ...)` 區塊「之後」新增：

```ts
function b64(str: string) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const x of bytes) bin += String.fromCharCode(x);
  return btoa(bin);
}
function unb64(s: string) {
  const bin = atob(s.replace(/\n/g, ''));
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

const itinEnv = {
  DB: fakeD1() as unknown,
  DASH_TOKEN: 'secret123', DASH_PASSWORD: '0509',
  GH_OWNER: 'o', GH_REPO: 'r', GH_BRANCH: 'main',
  GH_ITINERARY_PATH: 'wiki/dashboard/每日行程.md',
  GITHUB_TOKEN: 'ghtok',
};

describe('worker itinerary API', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('PUT /api/itinerary 無 token 拒絕', async () => {
    const res = await app.request('/api/itinerary', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ daySectionsMarkdown: '## Day 0｜x｜y\n- a｜b\n' }),
    }, itinEnv);
    expect(res.status).toBe(401);
  });

  it('PUT /api/itinerary 保留前言、換行程區塊、帶 sha', async () => {
    const current =
      '---\ntitle: 每日行程\n---\n\n# 每日行程\n\n> 格式規則：略\n\n' +
      '## Day 0｜09/30｜舊\n> 區域：難波\n\n- 上午｜舊行程\n';
    let putBody: { content: string; sha: string } | null = null;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (!init || init.method !== 'PUT') {
        return new Response(JSON.stringify({ content: b64(current), sha: 'sha123' }), { status: 200 });
      }
      putBody = JSON.parse(init.body as string);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }));

    const newSections = '## Day 0｜09/30｜新主題\n> 區域：梅田\n\n- 上午｜新行程｜備註\n';
    const res = await app.request('/api/itinerary', {
      method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ daySectionsMarkdown: newSections }),
    }, itinEnv);

    expect(res.status).toBe(200);
    expect(putBody!.sha).toBe('sha123');
    const decoded = unb64(putBody!.content);
    expect(decoded).toContain('> 格式規則：略');       // 前言保留
    expect(decoded).toContain('## Day 0｜09/30｜新主題'); // 新行程進去
    expect(decoded).not.toContain('## Day 0｜09/30｜舊'); // 舊行程被替換
  });

  it('PUT /api/itinerary GitHub 回 409 → 回 409', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (!init || init.method !== 'PUT') {
        return new Response(JSON.stringify({ content: b64('# x\n\n## Day 0｜a｜b\n- t｜x\n'), sha: 's' }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'conflict' }), { status: 409 });
    }));
    const res = await app.request('/api/itinerary', {
      method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ daySectionsMarkdown: '## Day 0｜a｜b\n- t｜x\n' }),
    }, itinEnv);
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 3: 執行測試確認失敗**

Run: `cd worker && npx vitest run`
Expected: FAIL（`/api/itinerary` 未定義 → 404，非預期狀態碼）

- [ ] **Step 4: 實作端點**

在 `worker/src/index.ts`：把 `Bindings` 型別擴充，並在 `export default app;` 前新增端點。

`Bindings` 改為：

```ts
type Bindings = {
  DB: D1Database; DASH_TOKEN: string; DASH_PASSWORD: string;
  GH_OWNER: string; GH_REPO: string; GH_BRANCH: string; GH_ITINERARY_PATH: string; GITHUB_TOKEN: string;
};
```

在 `app.put('/api/state/:key', ...)` 之後、`export default app;` 之前新增：

```ts
function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function fromBase64(b64: string): string {
  const bin = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
/** 保留現檔第一個 `## Day` 之前的前言，其後換成新行程區塊。 */
function spliceItinerary(current: string, daySections: string): string {
  const idx = current.search(/^## Day /m);
  const preamble = idx >= 0 ? current.slice(0, idx) : current.replace(/\n*$/, '\n\n');
  return preamble + daySections;
}

app.put('/api/itinerary', async (c) => {
  const { daySectionsMarkdown } = await c.req.json<{ daySectionsMarkdown: string }>();
  if (typeof daySectionsMarkdown !== 'string' || !daySectionsMarkdown.includes('## Day ')) {
    return c.json({ error: 'invalid itinerary' }, 400);
  }
  const { GH_OWNER, GH_REPO, GH_BRANCH, GH_ITINERARY_PATH, GITHUB_TOKEN } = c.env;
  const api = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${encodeURI(GH_ITINERARY_PATH)}`;
  const ghHeaders = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    'User-Agent': 'osaka-dashboard-worker',
    Accept: 'application/vnd.github+json',
  };

  const getRes = await fetch(`${api}?ref=${GH_BRANCH}`, { headers: ghHeaders });
  if (!getRes.ok) return c.json({ error: 'github get failed' }, 502);
  const file = await getRes.json<{ content: string; sha: string }>();
  const next = spliceItinerary(fromBase64(file.content), daySectionsMarkdown);

  const putRes = await fetch(api, {
    method: 'PUT',
    headers: { ...ghHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'chore(itinerary): 從儀表板更新每日行程',
      content: toBase64(next),
      sha: file.sha,
      branch: GH_BRANCH,
    }),
  });
  if (putRes.status === 409) return c.json({ error: 'sha conflict' }, 409);
  if (!putRes.ok) return c.json({ error: 'github put failed' }, 502);
  return c.json({ ok: true });
});
```

- [ ] **Step 5: 執行測試確認通過**

Run: `cd worker && npx vitest run`
Expected: PASS（原有 + 新增 itinerary 3 個測試全過）

- [ ] **Step 6: Commit**

```bash
git add worker/src/index.ts worker/wrangler.toml worker/test/worker.test.ts
git commit -m "feat(worker): PUT /api/itinerary 經 GitHub API commit 每日行程

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: 前端 API `putItinerary`

**Files:**
- Create: `src/api/itinerary.ts`
- Test: `src/api/__tests__/itinerary.test.ts`

**Interfaces:**
- Consumes: `apiBase()`、`getToken()`（`src/api/state.ts`，皆已 export）。
- Produces: `putItinerary(daySectionsMarkdown: string): Promise<void>`；409 拋「請重新整理」訊息，其餘非 2xx 拋錯。

- [ ] **Step 1: 寫失敗測試**

```ts
// src/api/__tests__/itinerary.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { putItinerary } from '../itinerary';

beforeEach(() => {
  localStorage.setItem('osaka-dash-token', 'tok');
  vi.stubEnv('VITE_API_BASE', 'https://api.test');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); localStorage.clear(); });

describe('putItinerary', () => {
  it('成功時帶 Bearer token 與正確 body', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await putItinerary('## Day 0｜a｜b\n- t｜x\n');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test/api/itinerary');
    expect((init as RequestInit).method).toBe('PUT');
    expect((init as any).headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse((init as any).body).daySectionsMarkdown).toContain('## Day 0');
  });

  it('409 拋出重新整理訊息', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 409 })));
    await expect(putItinerary('## Day 0｜a｜b\n')).rejects.toThrow('重新整理');
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/api/__tests__/itinerary.test.ts`
Expected: FAIL（找不到 `../itinerary`）

- [ ] **Step 3: 實作**

```ts
// src/api/itinerary.ts
import { apiBase, getToken } from './state';

/** 送整份行程區塊 markdown 給 Worker commit 回 vault。 */
export async function putItinerary(daySectionsMarkdown: string): Promise<void> {
  const res = await fetch(`${apiBase()}/api/itinerary`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${getToken() ?? ''}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ daySectionsMarkdown }),
  });
  if (res.status === 409) throw new Error('檔案已在他處變更，請重新整理後再試');
  if (!res.ok) throw new Error(`PUT itinerary ${res.status}`);
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/api/__tests__/itinerary.test.ts`
Expected: PASS（2 passed）

- [ ] **Step 5: Commit**

```bash
git add src/api/itinerary.ts src/api/__tests__/itinerary.test.ts
git commit -m "feat: 前端 putItinerary API（呼叫 Worker commit 行程）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: 可編輯行程狀態 `ItineraryProvider`

**Files:**
- Create: `src/state/itinerary.tsx`
- Test: `src/state/__tests__/itinerary.test.ts`

**Interfaces:**
- Consumes: `days`(builtDays)、`meta`（`src/data`）；`Day`、`DaySlot`（schema）；`serializeDays`（Task 1）；`putItinerary`（Task 3）。
- Produces:
  - `pickOverride(stored: Override | null, builtAt: string): Day[] | null`
  - `ItineraryProvider({ children })`
  - `useItinerary(): ItineraryState`，其中
    `ItineraryState = { days: Day[]; dirty: boolean; saving: boolean; updateSlot(di,si,patch): void; addSlot(di): void; removeSlot(di,si): void; moveSlot(di,si,dir:-1|1): void; save(): Promise<void>; reset(): void }`
  - `type Override = { baseBuiltAt: string; days: Day[] }`

- [ ] **Step 1: 寫失敗測試（純函式 pickOverride）**

```ts
// src/state/__tests__/itinerary.test.ts
import { describe, it, expect } from 'vitest';
import { pickOverride } from '../itinerary';

const sampleDays = [{ label: 'Day 0', date: 'x', theme: 'y', areas: [], slots: [{ time: 'a', title: 'b', note: '', pending: false }] }];

describe('pickOverride', () => {
  it('無 override 回 null', () => {
    expect(pickOverride(null, '2026-07-09T00:00:00.000Z')).toBeNull();
  });
  it('baseBuiltAt 早於目前 builtAt（CI 已重建）→ 丟棄回 null', () => {
    const stored = { baseBuiltAt: '2026-07-08T00:00:00.000Z', days: sampleDays };
    expect(pickOverride(stored, '2026-07-09T00:00:00.000Z')).toBeNull();
  });
  it('baseBuiltAt 不早於目前 builtAt → 套用', () => {
    const stored = { baseBuiltAt: '2026-07-09T00:00:00.000Z', days: sampleDays };
    expect(pickOverride(stored, '2026-07-09T00:00:00.000Z')).toEqual(sampleDays);
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/state/__tests__/itinerary.test.ts`
Expected: FAIL（找不到 `pickOverride`）

- [ ] **Step 3: 實作 Provider**

```tsx
// src/state/itinerary.tsx
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { days as builtDays, meta } from '../data';
import type { Day, DaySlot } from '../data/schema';
import { serializeDays } from '../lib/itinerary-md';
import { putItinerary } from '../api/itinerary';

const OVERRIDE_KEY = 'osaka-itinerary-override';
export type Override = { baseBuiltAt: string; days: Day[] };

/** 只有當 override 的 baseBuiltAt 不早於目前 builtAt 才採用；否則視為已被 CI 重建取代。 */
export function pickOverride(stored: Override | null, builtAt: string): Day[] | null {
  if (!stored) return null;
  if (new Date(stored.baseBuiltAt).getTime() < new Date(builtAt).getTime()) return null;
  return stored.days;
}

function clone(days: Day[]): Day[] {
  return days.map((d) => ({ ...d, areas: [...d.areas], slots: d.slots.map((s) => ({ ...s })) }));
}
function loadOverride(): Day[] | null {
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY);
    const picked = pickOverride(raw ? (JSON.parse(raw) as Override) : null, meta.builtAt);
    if (raw && !picked) localStorage.removeItem(OVERRIDE_KEY);
    return picked;
  } catch { return null; }
}
function saveOverride(days: Day[]) {
  try { localStorage.setItem(OVERRIDE_KEY, JSON.stringify({ baseBuiltAt: meta.builtAt, days })); }
  catch { /* 忽略 */ }
}

interface ItineraryState {
  days: Day[]; dirty: boolean; saving: boolean;
  updateSlot(dayIdx: number, slotIdx: number, patch: Partial<DaySlot>): void;
  addSlot(dayIdx: number): void;
  removeSlot(dayIdx: number, slotIdx: number): void;
  moveSlot(dayIdx: number, slotIdx: number, dir: -1 | 1): void;
  save(): Promise<void>;
  reset(): void;
}
const Ctx = createContext<ItineraryState | null>(null);

export function ItineraryProvider({ children }: { children: ReactNode }) {
  const [days, setDays] = useState<Day[]>(() => loadOverride() ?? clone(builtDays));
  const [dirty, setDirty] = useState<boolean>(() => loadOverride() != null);
  const [saving, setSaving] = useState(false);

  const mutate = useCallback((fn: (draft: Day[]) => void) => {
    setDays((prev) => { const next = clone(prev); fn(next); return next; });
    setDirty(true);
  }, []);

  const updateSlot = useCallback((di: number, si: number, patch: Partial<DaySlot>) => mutate((d) => {
    const s = { ...d[di].slots[si], ...patch };
    if (patch.pending === true) { s.title = '（待安排）'; s.note = ''; }
    else if (patch.pending === false && s.title === '（待安排）') { s.title = ''; }
    d[di].slots[si] = s;
  }), [mutate]);

  const addSlot = useCallback((di: number) => mutate((d) => {
    d[di].slots.push({ time: '', title: '', note: '', pending: false });
  }), [mutate]);

  const removeSlot = useCallback((di: number, si: number) => mutate((d) => {
    d[di].slots.splice(si, 1);
  }), [mutate]);

  const moveSlot = useCallback((di: number, si: number, dir: -1 | 1) => mutate((d) => {
    const arr = d[di].slots; const j = si + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[si], arr[j]] = [arr[j], arr[si]];
  }), [mutate]);

  const save = useCallback(async () => {
    for (const d of days) {
      if (d.slots.length === 0) throw new Error(`${d.label} 至少要有一個時段`);
      for (const s of d.slots) {
        if (!s.time.trim()) throw new Error(`${d.label} 有時段的「時間」是空的`);
        if (!s.pending && !s.title.trim()) throw new Error(`${d.label} 有時段的「標題」是空的`);
      }
    }
    setSaving(true);
    try {
      await putItinerary(serializeDays(days));
      saveOverride(days);
      setDirty(false);
    } finally { setSaving(false); }
  }, [days]);

  const reset = useCallback(() => {
    setDays(loadOverride() ?? clone(builtDays));
    setDirty(false);
  }, []);

  const value = useMemo<ItineraryState>(
    () => ({ days, dirty, saving, updateSlot, addSlot, removeSlot, moveSlot, save, reset }),
    [days, dirty, saving, updateSlot, addSlot, removeSlot, moveSlot, save, reset],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useItinerary(): ItineraryState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useItinerary 必須在 ItineraryProvider 內使用');
  return ctx;
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/state/__tests__/itinerary.test.ts`
Expected: PASS（3 passed）

- [ ] **Step 5: Commit**

```bash
git add src/state/itinerary.tsx src/state/__tests__/itinerary.test.ts
git commit -m "feat: ItineraryProvider 可編輯行程狀態（含 localStorage override）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: DailyPlan 編輯 UI 與三檢視連動

**Files:**
- Modify: `src/pages/DailyPlan.tsx`（全檔改寫）

**Interfaces:**
- Consumes: `useItinerary()`（Task 4）；`configured()`（`src/api/state.ts`，已 export）；`entities`（`src/data`）；`Day`、`DaySlot`（schema）；`AreaRail`、`Reveal`。
- Produces: 無對外新介面（頁面元件）。

- [ ] **Step 1: 全檔改寫 DailyPlan**

以下整檔取代 `src/pages/DailyPlan.tsx`：

```tsx
import { useState, type CSSProperties } from 'react';
import { entities } from '../data';
import { useItinerary } from '../state/itinerary';
import { configured } from '../api/state';
import type { DaySlot } from '../data/schema';
import AreaRail from '../components/AreaRail';
import Reveal from '../components/Reveal';

type View = 'timeline' | 'cards' | 'map';
const VIEWS: [View, string][] = [['timeline', '時間軸'], ['cards', '卡片'], ['map', '地圖']];

export default function DailyPlan() {
  const { days, dirty, saving, updateSlot, addSlot, removeSlot, moveSlot, save, reset } = useItinerary();
  const [dayIdx, setDayIdx] = useState(0);
  const [view, setView] = useState<View>('timeline');
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const day = days[dayIdx] ?? days[0];
  const canEdit = configured();

  const onSave = async () => {
    setMsg(null);
    try { await save(); setMsg('已提交，網站將於重建後更新'); setEditing(false); }
    catch (e) { setMsg(e instanceof Error ? e.message : '提交失敗'); }
  };
  const onCancel = () => { reset(); setEditing(false); setMsg(null); };

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <div className="hscroll" style={{ flex: 1, minWidth: 0 }}>
          {days.map((d, i) => (
            <button key={d.label} className="btn-plain" onClick={() => setDayIdx(i)} style={{
              background: dayIdx === i ? 'var(--ink)' : 'transparent',
              color: dayIdx === i ? '#F7F2E6' : 'var(--ink)',
              border: dayIdx === i ? '1px solid var(--ink)' : '1px solid rgba(41,35,26,.3)',
              borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
            }}>
              <span style={{ display: 'block', fontSize: 11, letterSpacing: '.08em', opacity: .75 }}>{d.date}</span>
              <span className="serif" style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{d.label}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', border: '1px solid var(--line-dark)', borderRadius: 8, overflow: 'hidden', flex: 'none' }}>
          {VIEWS.map(([k, label]) => (
            <button key={k} className="btn-plain" onClick={() => setView(k)} style={{
              background: view === k ? 'var(--red)' : 'transparent',
              color: view === k ? '#F7F2E6' : 'var(--ink)',
              padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {view === 'timeline' && (
        <div className="card" style={{ padding: '24px 26px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 12, paddingBottom: 16, borderBottom: '1px solid var(--line)' }}>
            <span className="serif" style={{ fontSize: 24, fontWeight: 800, color: 'var(--red)' }}>{day.label}</span>
            <span className="serif" style={{ fontSize: 18, fontWeight: 700 }}>{day.theme}</span>
            <span style={{ fontSize: 12, color: 'var(--brown)', letterSpacing: '.06em' }}>活動區域：{day.areas.join('・')}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              {canEdit ? (
                editing ? (
                  <>
                    <button className="btn-plain" onClick={onCancel} disabled={saving} style={editBtn(false)}>取消</button>
                    <button className="btn-plain" onClick={onSave} disabled={saving} style={editBtn(true)}>
                      {saving ? '提交中…' : '儲存並提交'}
                    </button>
                  </>
                ) : (
                  <button className="btn-plain" onClick={() => setEditing(true)} style={editBtn(false)}>編輯</button>
                )
              ) : (
                <span style={{ fontSize: 11.5, color: 'var(--brown-lt)' }}>登入後可編輯</span>
              )}
            </div>
          </div>

          {msg && (
            <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--brown-dk)' }}>{msg}</div>
          )}

          {editing ? (
            <EditableSlots dayIdx={dayIdx} slots={day.slots}
              onUpdate={updateSlot} onAdd={addSlot} onRemove={removeSlot} onMove={moveSlot} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
              {day.slots.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 16 }}>
                  <div className="serif" style={{ width: 52, flex: 'none', textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--brown)', paddingTop: 18 }}>{s.time}</div>
                  <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 1, flex: 1, background: 'rgba(41,35,26,.18)' }} />
                    <div style={{
                      flex: 'none', width: 12, height: 12, borderRadius: '50%',
                      border: `2.5px solid ${s.pending ? 'rgba(41,35,26,.3)' : 'var(--red)'}`,
                      background: s.pending ? 'transparent' : 'rgba(178,58,30,.1)',
                    }} />
                    <div style={{ width: 1, flex: 1, background: 'rgba(41,35,26,.18)' }} />
                  </div>
                  <div style={{ flex: 1, padding: '8px 0' }}>
                    <div style={{
                      borderRadius: 8, padding: '12px 16px',
                      border: s.pending ? '1.5px dashed rgba(41,35,26,.3)' : '1px solid var(--line)',
                      background: s.pending ? 'transparent' : 'rgba(255,255,255,.5)',
                    }}>
                      <div className="serif" style={{ fontSize: 15, fontWeight: 700, color: s.pending ? 'var(--brown-lt)' : 'var(--ink)' }}>
                        {s.pending ? '待安排' : s.title}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--brown-dk)', marginTop: 3 }}>
                        {s.pending ? '空白時段，到 Obsidian 填 — 或從美食庫挑一間' : s.note || ' '}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'cards' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(205px, 1fr))', gap: 12 }}>
          {days.map((d, i) => (
            <Reveal key={d.label} index={i}>
            <div className="card" style={{ padding: '16px 18px', borderColor: i === dayIdx ? 'var(--red)' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '2px solid var(--ink)', paddingBottom: 8 }}>
                <span className="serif" style={{ fontSize: 17, fontWeight: 800 }}>{d.label}</span>
                <span style={{ fontSize: 11, color: 'var(--brown)', letterSpacing: '.06em' }}>{d.date}</span>
              </div>
              <div className="serif" style={{ fontSize: 14, fontWeight: 700, color: 'var(--red)', marginTop: 10 }}>{d.theme}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                {d.slots.map((s, j) => (
                  <div key={j} style={{
                    fontSize: 12.5, lineHeight: 1.5,
                    color: s.pending ? 'var(--brown-lt)' : 'var(--ink)',
                    ...(s.pending ? { border: '1px dashed rgba(41,35,26,.25)', borderRadius: 6, padding: '5px 9px' } : { padding: '2px 0' }),
                  }}>
                    <span style={{ fontWeight: 700, color: 'var(--brown)', fontSize: 11, letterSpacing: '.05em' }}>{s.time}</span>{' '}
                    {s.pending ? '待安排' : s.title}
                  </div>
                ))}
              </div>
            </div>
            </Reveal>
          ))}
        </div>
      )}

      {view === 'map' && (
        <div className="card" style={{ padding: '24px 26px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
            <span className="serif" style={{ fontSize: 20, fontWeight: 800, color: 'var(--red)' }}>{day.label}</span>
            <span style={{ fontSize: 13, color: 'var(--brown-dk)' }}>{day.theme}・當日活動區域以朱色標示</span>
          </div>
          <AreaRail highlightAreas={day.areas} showCounts={false} />
        </div>
      )}
    </div>
  );
}

function editBtn(primary: boolean): CSSProperties {
  return {
    padding: '6px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', borderRadius: 8,
    background: primary ? 'var(--red)' : 'transparent',
    color: primary ? '#F7F2E6' : 'var(--ink)',
    border: `1px solid ${primary ? 'var(--red)' : 'rgba(41,35,26,.3)'}`,
  };
}

function EditableSlots({ dayIdx, slots, onUpdate, onAdd, onRemove, onMove }: {
  dayIdx: number; slots: DaySlot[];
  onUpdate: (di: number, si: number, patch: Partial<DaySlot>) => void;
  onAdd: (di: number) => void;
  onRemove: (di: number, si: number) => void;
  onMove: (di: number, si: number, dir: -1 | 1) => void;
}) {
  const field: CSSProperties = {
    fontFamily: 'inherit', fontSize: 13, padding: '6px 8px',
    border: '1px solid var(--line-dark)', borderRadius: 6, background: 'var(--card)', color: 'var(--ink)',
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
      <datalist id="entity-options">
        {entities.map((e) => <option key={e.id} value={e.name}>{e.category}・{e.area}</option>)}
      </datalist>
      {slots.map((s, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '80px 1fr 1fr auto', gap: 8, alignItems: 'center',
          border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', background: 'rgba(255,255,255,.4)',
        }}>
          <input style={field} value={s.time} placeholder="時段"
            onChange={(e) => onUpdate(dayIdx, i, { time: e.target.value })} />
          <input style={{ ...field, opacity: s.pending ? .5 : 1 }} list="entity-options"
            value={s.pending ? '' : s.title} placeholder={s.pending ? '待安排' : '標題（可打字或選單）'}
            disabled={s.pending}
            onChange={(e) => {
              const v = e.target.value;
              const match = entities.find((x) => x.name === v);
              onUpdate(dayIdx, i, { title: v, ...(match && !s.note.trim() ? { note: match.area } : {}) });
            }} />
          <input style={{ ...field, opacity: s.pending ? .5 : 1 }} value={s.pending ? '' : s.note} placeholder="備註"
            disabled={s.pending}
            onChange={(e) => onUpdate(dayIdx, i, { note: e.target.value })} />
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <label style={{ fontSize: 11, color: 'var(--brown)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <input type="checkbox" checked={s.pending}
                onChange={(e) => onUpdate(dayIdx, i, { pending: e.target.checked })} />待安排
            </label>
            <button className="btn-plain" title="上移" onClick={() => onMove(dayIdx, i, -1)} style={iconBtn}>↑</button>
            <button className="btn-plain" title="下移" onClick={() => onMove(dayIdx, i, 1)} style={iconBtn}>↓</button>
            <button className="btn-plain" title="刪除" onClick={() => onRemove(dayIdx, i)} style={{ ...iconBtn, color: 'var(--red)' }}>✕</button>
          </div>
        </div>
      ))}
      <button className="btn-plain" onClick={() => onAdd(dayIdx)} style={{
        alignSelf: 'flex-start', padding: '6px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
        borderRadius: 8, border: '1px dashed rgba(41,35,26,.4)', background: 'transparent', color: 'var(--ink)',
      }}>＋ 新增時段</button>
    </div>
  );
}

const iconBtn: CSSProperties = {
  width: 26, height: 26, cursor: 'pointer', borderRadius: 6,
  border: '1px solid rgba(41,35,26,.25)', background: 'var(--card)', color: 'var(--ink)', fontSize: 13,
};
```

- [ ] **Step 2: Lint + build 確認可編譯**

Run: `npm run lint && npx tsc -b`
Expected: 無錯誤（oxlint 0 warning、tsc 無型別錯）

- [ ] **Step 3: Commit**

```bash
git add src/pages/DailyPlan.tsx
git commit -m "feat: 時間軸編輯 UI（時段增刪改排序、實體下拉、儲存並提交）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: 掛載 Provider 並整合驗證

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `ItineraryProvider`（Task 4）。
- Produces: 無。

- [ ] **Step 1: 在 App 掛 ItineraryProvider（包住 main，跨分頁保留編輯）**

`src/App.tsx` 頂部 import 加：

```tsx
import { ItineraryProvider } from './state/itinerary';
```

把 `<main>...</main>` 用 provider 包起來（provider 需在 `key={tab}` 的 keyed div 之上，切分頁才不會遺失編輯）：

```tsx
<ItineraryProvider>
  <main style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 20px 64px' }}>
    <div className="page-enter" key={tab}><Page /></div>
  </main>
</ItineraryProvider>
```

- [ ] **Step 2: 全套測試 + lint + build**

Run: `npm test && npm run lint && npm run build`
Expected: 全綠（vitest 全過、oxlint 0、vite build 成功）

- [ ] **Step 3: worker 測試**

Run: `cd worker && npx vitest run`
Expected: 全過

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: App 掛載 ItineraryProvider（跨分頁保留行程編輯）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## 部署收尾（實作後、需使用者動作）

1. 部署 Worker：`cd worker && npm run deploy`（需 Cloudflare 憑證）。
2. 使用者在自己終端機設 secret：`cd worker && npx wrangler secret put GITHUB_TOKEN`，貼上 fine-grained PAT（Osaka-vault → Contents: Read and write）。
3. 確認前端 `.env` 的 `VITE_API_BASE` 指向已部署 Worker。
4. 端對端：正式站登入 → 編輯某天時段 → 儲存並提交 → 確認 Osaka-vault 出現 `chore(itinerary): …` commit → 等 Osaka-web 重建 → 網站顯示新行程。

## Self-Review 註記

- **Spec 覆蓋**：即時連動(Task 4/5)、打字+下拉(Task 5)、序列化(Task 1)、Worker commit+前言保留(Task 2)、前端 API(Task 3)、override 失效(Task 4)、掛載(Task 6)、錯誤處理(Task 3/4/5)、測試(各 Task)。皆有對應。
- **型別一致**：`updateSlot/addSlot/removeSlot/moveSlot/save/reset/dirty/saving` 在 Task 4 定義、Task 5 消費，簽章一致；`serializeDays`、`putItinerary`、`pickOverride` 命名跨任務一致。
- **待安排一致性**：Task 4 `updateSlot` 確保 pending 切換時 title/note 同步；Task 1 序列化只認 `pending` 旗標，與 parse 對稱。

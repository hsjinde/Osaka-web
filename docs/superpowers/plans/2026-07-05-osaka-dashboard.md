# 大阪行程儀表板 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將 `untitled/project/大阪行程儀表板.dc.html` 原型改寫為 React + TypeScript 正式專案：內容由 Osaka-vault（Obsidian markdown）在建置時解析產生，收藏/待辦狀態存 Cloudflare D1 跨裝置同步，部署 GitHub Pages。

**Architecture:** 三條資料流——①內容流：CI 解析 vault markdown → Zod 驗證 → JSON → Vite build；②狀態流：前端 → Cloudflare Worker（Hono + 通行密碼）→ D1；③前端：React SPA（hash routing），視覺 1:1 復刻原型。

**Tech Stack:** React 18、TypeScript、Vite、Vitest、Zod、gray-matter、TanStack Query、react-markdown、Hono、Cloudflare Workers + D1、GitHub Actions + Pages。

**Spec:** `docs/superpowers/specs/2026-07-05-osaka-dashboard-design.md`

## Global Constraints

- Node >= 22（本機 v24；CI 用 node 22）。wrangler 用最新版即可（Node >= 22 不需 pin v3）。
- `package.json` 需 `"type": "module"`。
- 任何含中文內容的檔案一律用 Write 工具或 Node.js `fs.writeFileSync(path, text, 'utf8')` 產生，**絕不可用 PowerShell `Set-Content`/`Out-File`**（BOM 會造成亂碼）——見 `.claude/skills/cloudflare-use/SKILL.md`。
- Cloudflare 指令的 token 一律從專案 `.env` 的 `CLOUDFLARE_API_TOKEN` 注入，不得輸出到回應中。
- vault 本地路徑從 `.env` 的 `NOTES_DIR` 讀取（值為 `D:\大阪-vault`；CI 中為 checkout 的 `vault/` 目錄）。
- 部署位址：GitHub Pages `https://hsjinde.github.io/Osaka-web/` → Vite `base: '/Osaka-web/'`。
- 顏色/字體 tokens（來自原型，全案唯一來源）：紙色底 `#F1EBDD`、卡片 `#FBF7EC`、墨色 `#29231A`、朱紅 `#B23A1E`、朱紅淺 `#C24A2A`、藏青 `#2E3A52`、綠 `#4A6B4F`、金 `#E8B44A`、灰棕 `#8A7C64`、淡棕 `#A2957F`、暗棕 `#6E6350`；標題字 `'Shippori Mincho', serif`、內文 `'Noto Sans TC', sans-serif`。
- 收藏 key 格式 `fav:<分類>/<檔名去.md>`（如 `fav:餐廳/DOTONBORI-KUROFUNE`）；待辦 key 格式 `todo:<djb2十六進位>`（hash 自待辦文字）。
- 所有 commit 訊息結尾加 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。

---

## 檔案結構總覽

```
Osaka-web/
├── package.json / vite.config.ts / tsconfig*.json / index.html
├── scripts/
│   ├── lib/text.ts            # stripWikilinks / extractArea / todoKey
│   ├── lib/parse-entity.ts    # wiki 實體頁解析
│   ├── lib/parse-itinerary.ts # 每日行程解析
│   ├── lib/parse-todos.ts     # 待辦解析
│   └── build-data.ts          # 主腳本：vault → src/data/*.json
├── src/
│   ├── data/schema.ts         # Zod schemas + TS 型別
│   ├── data/index.ts          # JSON 匯入與型別斷言
│   ├── data/*.json            # 建置產物（commit 進 repo）
│   ├── state/store.tsx        # TripStateProvider + useTripState
│   ├── api/state.ts           # Worker API client
│   ├── styles.css             # 全域樣式（和風 tokens）
│   ├── components/{Stamp,Heart,Chip,AreaRail}.tsx
│   ├── pages/{Home,DailyPlan,Food,Places,Transport,AreaMap}.tsx
│   ├── App.tsx / main.tsx
├── worker/
│   ├── wrangler.toml / schema.sql / src/index.ts / test/worker.test.ts
├── .github/workflows/deploy.yml
└── README.md
```

測試檔放 `scripts/lib/__tests__/`、`src/state/__tests__/`、`worker/test/`。

---

### Task 1: 專案鷹架（Vite + React + TS + Vitest）

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `.gitignore`
- Modify: `.env`（補 `VITE_API_BASE=`，暫空）

**Interfaces:**
- Produces: 可執行的 `npm run dev` / `npm test` / `npm run build`；後續所有任務的基礎。

- [ ] **Step 1: 產生 Vite 專案**

在 `D:\Osaka-web` 執行（目錄非空，用暫存資料夾再搬）：

```powershell
npm create vite@latest osaka-tmp -- --template react-ts
# 把 osaka-tmp 內容搬到專案根目錄（保留現有 .git/.claude/.env/docs/untitled）
Get-ChildItem osaka-tmp -Force | Move-Item -Destination . -Force
Remove-Item osaka-tmp -Recurse -Force
npm install
```

- [ ] **Step 2: 安裝依賴**

```powershell
npm install @tanstack/react-query react-markdown remark-gfm
npm install -D vitest zod gray-matter tsx dotenv
```

- [ ] **Step 3: 設定 vite.config.ts（base + vitest）**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/Osaka-web/',
  test: { environment: 'node', include: ['scripts/**/*.test.ts', 'src/**/*.test.{ts,tsx}'] },
});
```

- [ ] **Step 4: 調整 package.json scripts**（保留 vite 產生的其餘欄位，確認有 `"type": "module"`）

```json
{
  "scripts": {
    "dev": "npm run build:data && vite",
    "build": "tsc -b && vite build",
    "build:data": "tsx scripts/build-data.ts",
    "test": "vitest run",
    "preview": "vite preview"
  }
}
```

- [ ] **Step 5: 清空範本雜物**

`src/App.tsx` 暫改為：

```tsx
export default function App() {
  return <div>大阪行程儀表板</div>;
}
```

刪除 `src/App.css`、`src/index.css`、`src/assets/react.svg`、`public/vite.svg`，`src/main.tsx` 改為：

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`index.html` 的 `<title>` 改為 `大阪旅券 OSAKA TRIP`。

- [ ] **Step 6: .gitignore 補項**

在 vite 產生的 `.gitignore` 加：

```
.env
untitled/
.claude/launch.json
```

- [ ] **Step 7: 驗證**

```powershell
npm run build
```
Expected: `tsc` 無錯誤、`vite build` 產出 `dist/`。（`npm run dev` 此時會因 build-data 不存在而失敗，正常，Task 7 後才可用。先臨時驗證 `npx vite build` 即可。注意：Step 4 的 `dev`/`build:data` 依賴 Task 7 的腳本，本任務驗證用 `npx tsc -b && npx vite build`。）

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: Vite + React + TS + Vitest 鷹架"
```

---

### Task 2: 文字工具（stripWikilinks / extractArea / todoKey）

**Files:**
- Create: `scripts/lib/text.ts`
- Test: `scripts/lib/__tests__/text.test.ts`

**Interfaces:**
- Produces:
  - `stripWikilinks(s: string): string` — `[[A|B]]`→`B`、`[[路徑/C]]`→`C`
  - `extractArea(s: string): string` — 回傳 `'梅田'|'心齋橋'|'難波'|'天王寺'|''`（依此優先序找第一個出現者）
  - `todoKey(text: string): string` — 回傳 `todo:<djb2 hex>`

- [ ] **Step 1: 寫失敗測試**

```ts
// scripts/lib/__tests__/text.test.ts
import { describe, it, expect } from 'vitest';
import { stripWikilinks, extractArea, todoKey } from '../text';

describe('stripWikilinks', () => {
  it('別名連結取別名', () => {
    expect(stripWikilinks('去 [[梅田|梅田站]] 逛')).toBe('去 梅田站 逛');
  });
  it('一般連結取最後路徑段', () => {
    expect(stripWikilinks('[[原始資料/景點/通天閣]]方向')).toBe('通天閣方向');
    expect(stripWikilinks('[[大丸百貨]] 13F')).toBe('大丸百貨 13F');
  });
  it('無連結原樣返回', () => {
    expect(stripWikilinks('普通文字')).toBe('普通文字');
  });
});

describe('extractArea', () => {
  it('從位置文字找到區域', () => {
    expect(extractArea('梅田・天保山（大阪港）')).toBe('梅田');
    expect(extractArea('心齋橋 PARCO B2')).toBe('心齋橋');
  });
  it('找不到回空字串', () => {
    expect(extractArea('池田市')).toBe('');
  });
});

describe('todoKey', () => {
  it('同文字同 key、不同文字不同 key', () => {
    const a = todoKey('確認機票');
    expect(a).toMatch(/^todo:[0-9a-f]+$/);
    expect(todoKey('確認機票')).toBe(a);
    expect(todoKey('評估周遊券')).not.toBe(a);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run scripts/lib/__tests__/text.test.ts`
Expected: FAIL（找不到模組 `../text`）

- [ ] **Step 3: 實作**

```ts
// scripts/lib/text.ts
const AREAS = ['梅田', '心齋橋', '難波', '天王寺'] as const;

export function stripWikilinks(s: string): string {
  return s
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, (_, p: string) => p.split('/').pop() ?? p);
}

export function extractArea(s: string): string {
  for (const a of AREAS) if (s.includes(a)) return a;
  return '';
}

export function todoKey(text: string): string {
  let h = 5381;
  for (const ch of text) h = ((h * 33) ^ ch.codePointAt(0)!) >>> 0;
  return 'todo:' + h.toString(16);
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run scripts/lib/__tests__/text.test.ts`
Expected: PASS（3 個 describe 全綠）

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/text.ts scripts/lib/__tests__/text.test.ts
git commit -m "feat: wikilink 清理、區域抽取、待辦 key 工具"
```

---

### Task 3: Zod Schema 與實體頁解析器

**Files:**
- Create: `src/data/schema.ts`, `scripts/lib/parse-entity.ts`
- Test: `scripts/lib/__tests__/parse-entity.test.ts`

**Interfaces:**
- Consumes: `stripWikilinks`, `extractArea`（Task 2）
- Produces:
  - `Entity` 型別（schema.ts 匯出，全前端共用）：

```ts
export interface Entity {
  id: string;          // "餐廳/DOTONBORI-KUROFUNE"
  category: '餐廳' | '景點' | '購物' | '交通' | '住宿' | '區域';
  name: string;        // frontmatter title
  tags: string[];
  updated: string;     // 可為 ''
  favorite: boolean;   // frontmatter favorite ?? false
  fields: Record<string, string>; // 「## 基本資訊」條列（wikilinks 已清）
  summary: string;     // 內文第一段（wikilinks 已清）
  body: string;        // 完整內文 markdown（wikilinks 已清、不含 frontmatter）
  area: string;        // '' | 梅田 | 心齋橋 | 難波 | 天王寺
  rating: number | null;
}
```

  - `parseEntity(category: Entity['category'], filename: string, raw: string): Entity` — 解析失敗 throw `Error`，訊息含 `<category>/<filename>`

- [ ] **Step 1: 寫 schema**

```ts
// src/data/schema.ts
import { z } from 'zod';

export const CATEGORIES = ['餐廳', '景點', '購物', '交通', '住宿', '區域'] as const;

export const EntitySchema = z.object({
  id: z.string().min(1),
  category: z.enum(CATEGORIES),
  name: z.string().min(1),
  tags: z.array(z.string()),
  updated: z.string(),
  favorite: z.boolean(),
  fields: z.record(z.string(), z.string()),
  summary: z.string(),
  body: z.string(),
  area: z.string(),
  rating: z.number().min(0).max(5).nullable(),
});
export type Entity = z.infer<typeof EntitySchema>;

export const DaySlotSchema = z.object({
  time: z.string().min(1),
  title: z.string().min(1),
  note: z.string(),
  pending: z.boolean(),
});
export const DaySchema = z.object({
  label: z.string().regex(/^Day \d+$/),
  date: z.string().min(1),
  theme: z.string().min(1),
  areas: z.array(z.string()),
  slots: z.array(DaySlotSchema).min(1),
});
export type Day = z.infer<typeof DaySchema>;
export type DaySlot = z.infer<typeof DaySlotSchema>;

export const TodoItemSchema = z.object({
  key: z.string().startsWith('todo:'),
  text: z.string().min(1),
  checkedInVault: z.boolean(),
});
export type TodoItem = z.infer<typeof TodoItemSchema>;

export const MetaSchema = z.object({
  builtAt: z.string(),
  tripStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tripEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type Meta = z.infer<typeof MetaSchema>;
```

- [ ] **Step 2: 寫失敗測試**

```ts
// scripts/lib/__tests__/parse-entity.test.ts
import { describe, it, expect } from 'vitest';
import { parseEntity } from '../parse-entity';

const REST = `---
title: DOTONBORI KUROFUNE Higashishinsaibashi
tags: [餐廳, 大阪]
updated: 2026-06-09
---

道頓堀區域的鰻魚飯專賣店。

## 基本資訊
- 類型：鰻魚
- 評分：4.9
- 價位：¥3,000-4,000
- 備註：-

## 來源
- [[原始資料/餐廳/DOTONBORI KUROFUNE]]
`;

describe('parseEntity', () => {
  it('解析餐廳頁完整欄位', () => {
    const e = parseEntity('餐廳', 'DOTONBORI-KUROFUNE.md', REST);
    expect(e.id).toBe('餐廳/DOTONBORI-KUROFUNE');
    expect(e.name).toBe('DOTONBORI KUROFUNE Higashishinsaibashi');
    expect(e.rating).toBe(4.9);
    expect(e.fields['類型']).toBe('鰻魚');
    expect(e.fields['價位']).toBe('¥3,000-4,000');
    expect(e.summary).toBe('道頓堀區域的鰻魚飯專賣店。');
    expect(e.favorite).toBe(false);
  });

  it('位置欄位含 wikilink 時清掉並抽出區域', () => {
    const raw = REST.replace('- 備註：-', '- 位置：[[梅田|梅田]]・天保山');
    const e = parseEntity('景點', 'X.md', raw);
    expect(e.fields['位置']).toBe('梅田・天保山');
    expect(e.area).toBe('梅田');
  });

  it('tags 含區域時可補抽區域', () => {
    const raw = REST.replace('tags: [餐廳, 大阪]', 'tags: [購物, 大阪, 梅田]');
    const e = parseEntity('購物', 'X.md', raw);
    expect(e.area).toBe('梅田');
  });

  it('評分為 N/A 或缺欄時 rating 為 null', () => {
    const raw = REST.replace('- 評分：4.9', '- 評分：N/A');
    expect(parseEntity('餐廳', 'X.md', raw).rating).toBeNull();
  });

  it('評分非數字時報錯且訊息含檔名', () => {
    const raw = REST.replace('- 評分：4.9', '- 評分：很好吃');
    expect(() => parseEntity('餐廳', 'BAD.md', raw)).toThrow(/餐廳\/BAD/);
  });

  it('frontmatter 缺 title 報錯', () => {
    const raw = REST.replace('title: DOTONBORI KUROFUNE Higashishinsaibashi', 'foo: bar');
    expect(() => parseEntity('餐廳', 'BAD.md', raw)).toThrow(/餐廳\/BAD/);
  });

  it('favorite: true 生效', () => {
    const raw = REST.replace('updated: 2026-06-09', 'updated: 2026-06-09\nfavorite: true');
    expect(parseEntity('餐廳', 'X.md', raw).favorite).toBe(true);
  });
});
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `npx vitest run scripts/lib/__tests__/parse-entity.test.ts`
Expected: FAIL（找不到 `../parse-entity`）

- [ ] **Step 4: 實作**

```ts
// scripts/lib/parse-entity.ts
import matter from 'gray-matter';
import { EntitySchema, type Entity } from '../../src/data/schema';
import { stripWikilinks, extractArea } from './text';

export function parseEntity(
  category: Entity['category'],
  filename: string,
  raw: string,
): Entity {
  const id = `${category}/${filename.replace(/\.md$/, '')}`;
  try {
    const { data, content } = matter(raw);
    const body = stripWikilinks(content.trim());

    const fields: Record<string, string> = {};
    const section = body.match(/## 基本資訊\n([\s\S]*?)(?=\n## |$)/);
    if (section) {
      for (const line of section[1].split('\n')) {
        const m = line.match(/^- (.+?)[：:]\s*(.*)$/);
        if (m) fields[m[1].trim()] = m[2].trim();
      }
    }

    let rating: number | null = null;
    const rawRating = fields['評分'];
    if (rawRating && !['N/A', '-', '—', ''].includes(rawRating)) {
      rating = Number.parseFloat(rawRating);
      if (Number.isNaN(rating)) throw new Error(`評分不是數字：「${rawRating}」`);
    }

    const paragraphs = body.split(/\n{2,}/);
    const summary = paragraphs.find((p) => p.trim() && !p.startsWith('#'))?.trim() ?? '';

    const tags: string[] = Array.isArray(data.tags) ? data.tags.map(String) : [];
    const areaSource = `${fields['位置'] ?? ''} ${fields['區域'] ?? ''} ${tags.join(' ')}`;

    return EntitySchema.parse({
      id,
      category,
      name: String(data.title ?? '').trim() || raiseMissingTitle(),
      tags,
      updated: data.updated ? String(data.updated) : '',
      favorite: data.favorite === true,
      fields,
      summary,
      body,
      area: extractArea(areaSource),
      rating,
    });
  } catch (err) {
    throw new Error(`[${id}] 解析失敗：${err instanceof Error ? err.message : err}`);
  }
}

function raiseMissingTitle(): never {
  throw new Error('frontmatter 缺 title');
}
```

- [ ] **Step 5: 跑測試確認通過**

Run: `npx vitest run scripts/lib/__tests__/parse-entity.test.ts`
Expected: PASS（7 案例全綠）

- [ ] **Step 6: Commit**

```bash
git add src/data/schema.ts scripts/lib/parse-entity.ts scripts/lib/__tests__/parse-entity.test.ts
git commit -m "feat: 實體頁解析器 + Zod schema"
```

---

### Task 4: 每日行程解析器

**Files:**
- Create: `scripts/lib/parse-itinerary.ts`
- Test: `scripts/lib/__tests__/parse-itinerary.test.ts`

**Interfaces:**
- Consumes: `Day`, `DaySchema`（Task 3 schema.ts）
- Produces: `parseItinerary(raw: string): Day[]` — 解析 `wiki/dashboard/每日行程.md` 格式；格式錯誤 throw，訊息含行內容

- [ ] **Step 1: 寫失敗測試**

```ts
// scripts/lib/__tests__/parse-itinerary.test.ts
import { describe, it, expect } from 'vitest';
import { parseItinerary } from '../parse-itinerary';

const OK = `---
title: 每日行程
updated: 2026-07-05
---

## Day 0｜09/30 週三｜抵達日
> 區域：難波、心齋橋

- 下午｜關西機場 → 難波｜南海 Rapi:t 最快 34 分
- 傍晚｜心齋橋格蘭多酒店 Check-in｜長堀橋站步行 5 分
- 宵夜｜（待安排）

## Day 1｜10/01 週四｜環球影城 USJ
> 區域：此花區

- 全日｜日本環球影城｜Express Pass 建議先買
`;

describe('parseItinerary', () => {
  it('解析天數、標頭、區域、時段', () => {
    const days = parseItinerary(OK);
    expect(days).toHaveLength(2);
    expect(days[0]).toMatchObject({
      label: 'Day 0', date: '09/30 週三', theme: '抵達日',
      areas: ['難波', '心齋橋'],
    });
    expect(days[0].slots[0]).toEqual({
      time: '下午', title: '關西機場 → 難波', note: '南海 Rapi:t 最快 34 分', pending: false,
    });
  });

  it('（待安排）標成 pending 且 note 為空', () => {
    const days = parseItinerary(OK);
    expect(days[0].slots[2]).toEqual({ time: '宵夜', title: '（待安排）', note: '', pending: true });
  });

  it('備註可省略', () => {
    const days = parseItinerary(OK.replace('｜南海 Rapi:t 最快 34 分', ''));
    expect(days[0].slots[0].note).toBe('');
  });

  it('Day 標頭格式錯誤時報錯並含該行', () => {
    expect(() => parseItinerary(OK.replace('## Day 1｜10/01 週四｜環球影城 USJ', '## Day 1 環球影城')))
      .toThrow(/Day 1 環球影城/);
  });

  it('沒有任何 Day 時報錯', () => {
    expect(() => parseItinerary('---\ntitle: x\n---\n沒內容')).toThrow(/找不到任何/);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run scripts/lib/__tests__/parse-itinerary.test.ts`
Expected: FAIL（找不到 `../parse-itinerary`）

- [ ] **Step 3: 實作**

```ts
// scripts/lib/parse-itinerary.ts
import matter from 'gray-matter';
import { DaySchema, type Day } from '../../src/data/schema';

export function parseItinerary(raw: string): Day[] {
  const { content } = matter(raw);
  const days: Day[] = [];
  let cur: Day | null = null;

  for (const line of content.split('\n')) {
    const t = line.trim();
    if (t.startsWith('## ')) {
      const m = t.match(/^## (Day \d+)｜(.+?)｜(.+)$/);
      if (!m) throw new Error(`每日行程：Day 標頭格式錯誤 → 「${t}」（應為 ## Day N｜日期｜主題）`);
      cur = { label: m[1], date: m[2].trim(), theme: m[3].trim(), areas: [], slots: [] };
      days.push(cur);
    } else if (t.startsWith('> 區域')) {
      if (!cur) continue;
      cur.areas = t.replace(/^> 區域[：:]/, '').split('、').map((a) => a.trim()).filter(Boolean);
    } else if (t.startsWith('- ')) {
      if (!cur) continue;
      const parts = t.slice(2).split('｜').map((p) => p.trim());
      if (parts.length < 2 || !parts[0] || !parts[1])
        throw new Error(`每日行程：時段格式錯誤 → 「${t}」（應為 - 時段｜標題｜備註）`);
      const pending = parts[1].includes('待安排');
      cur.slots.push({ time: parts[0], title: parts[1], note: pending ? '' : (parts[2] ?? ''), pending });
    }
  }

  if (days.length === 0) throw new Error('每日行程：找不到任何 "## Day N｜…" 段落');
  return days.map((d) => DaySchema.parse(d));
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run scripts/lib/__tests__/parse-itinerary.test.ts`
Expected: PASS（5 案例全綠）

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/parse-itinerary.ts scripts/lib/__tests__/parse-itinerary.test.ts
git commit -m "feat: 每日行程解析器"
```

---

### Task 5: 待辦解析器

**Files:**
- Create: `scripts/lib/parse-todos.ts`
- Test: `scripts/lib/__tests__/parse-todos.test.ts`

**Interfaces:**
- Consumes: `todoKey`（Task 2）、`TodoItem`（Task 3）
- Produces: `parseTodos(raw: string): TodoItem[]` — 從確認行程檔的「## ✅ 待辦」區段抽 `- [ ]` 項目

- [ ] **Step 1: 寫失敗測試**

```ts
// scripts/lib/__tests__/parse-todos.test.ts
import { describe, it, expect } from 'vitest';
import { parseTodos } from '../parse-todos';

const DOC = `---
title: 行程
---

## 📅 行程日期
- 出發：2026/09/30

## ✅ 待辦（後續可繼續補）

- [ ] 確認機票航班時段（出發/回程時間）
- [x] 評估是否購買 [[周遊券]]
- [ ] 預約人氣餐廳

## 來源
- foo
`;

describe('parseTodos', () => {
  it('只抽待辦區段的核取項目', () => {
    const todos = parseTodos(DOC);
    expect(todos).toHaveLength(3);
    expect(todos[0].text).toBe('確認機票航班時段（出發/回程時間）');
    expect(todos[0].key).toMatch(/^todo:/);
    expect(todos[0].checkedInVault).toBe(false);
  });

  it('wikilink 清掉、[x] 標為已勾', () => {
    const todos = parseTodos(DOC);
    expect(todos[1].text).toBe('評估是否購買 周遊券');
    expect(todos[1].checkedInVault).toBe(true);
  });

  it('沒有待辦區段回空陣列', () => {
    expect(parseTodos('---\ntitle: x\n---\n無待辦')).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run scripts/lib/__tests__/parse-todos.test.ts`
Expected: FAIL（找不到 `../parse-todos`）

- [ ] **Step 3: 實作**

```ts
// scripts/lib/parse-todos.ts
import matter from 'gray-matter';
import { TodoItemSchema, type TodoItem } from '../../src/data/schema';
import { stripWikilinks, todoKey } from './text';

export function parseTodos(raw: string): TodoItem[] {
  const { content } = matter(raw);
  const section = content.match(/## ✅ 待辦[^\n]*\n([\s\S]*?)(?=\n## |$)/);
  if (!section) return [];

  const todos: TodoItem[] = [];
  for (const line of section[1].split('\n')) {
    const m = line.trim().match(/^- \[( |x)\] (.+)$/);
    if (!m) continue;
    const text = stripWikilinks(m[2].trim());
    todos.push(TodoItemSchema.parse({ key: todoKey(text), text, checkedInVault: m[1] === 'x' }));
  }
  return todos;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run scripts/lib/__tests__/parse-todos.test.ts`
Expected: PASS（3 案例全綠）

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/parse-todos.ts scripts/lib/__tests__/parse-todos.test.ts
git commit -m "feat: 待辦清單解析器"
```

---

### Task 6: Vault 範本檔（每日行程.md、總覽.md）

**Files:**
- Create: `D:\大阪-vault\wiki\dashboard\每日行程.md`
- Create: `D:\大阪-vault\wiki\dashboard\總覽.md`

**Interfaces:**
- Produces: Task 7 build-data 讀取的兩個 dashboard 檔案。總覽.md 用「## 基本資訊」格式（可被 `parseEntity` 以 category `區域` 之外的任一類解析——build-data 會以 `住宿` 類別借用解析器，只取 fields）。

- [ ] **Step 1: 用 Write 工具建立 `D:\大阪-vault\wiki\dashboard\每日行程.md`**（內容從原型 DAYS() 移植，Day 2 採梅田＋海遊館版）

```markdown
---
title: 每日行程
updated: 2026-07-05
---

# 每日行程

> 格式規則：`## Day N｜日期｜主題` 一天；`> 區域：A、B` 一行；時段一行 `- 時段｜標題｜備註`；標題寫 `（待安排）` 會顯示為空白卡。

## Day 0｜09/30 週三｜抵達日
> 區域：難波、心齋橋

- 下午｜關西機場 → 難波｜南海 Rapi:t 最快 34 分（見交通頁），航班時段待確認
- 傍晚｜心齋橋格蘭多酒店 Check-in｜長堀橋站步行 5 分
- 夜｜道頓堀夜景散步｜格力高看板・戎橋，順便物色宵夜
- 宵夜｜（待安排）

## Day 1｜10/01 週四｜環球影城 USJ
> 區域：此花區

- 全日｜日本環球影城｜任天堂世界需整理券・Express Pass 建議先買（見景點頁）
- 晚上｜（待安排）

## Day 2｜10/02 週五｜北部・梅田＋海遊館
> 區域：梅田、大阪港

- 上午｜（待安排）
- 中午｜（待安排）
- 下午｜海遊館＋天保山摩天輪｜門票 ¥2,700 建議先網購
- 晚上｜（待安排）

## Day 3｜10/03 週六｜南部・心齋橋筋＋道頓堀＋難波
> 區域：心齋橋、難波

- 上午｜（待安排）
- 中午｜（待安排）
- 下午｜（待安排）
- 晚上｜道頓堀｜週六人多，晚餐建議先訂位

## Day 4｜10/04 週日｜回國日
> 區域：難波

- 上午｜退房・寄放行李｜
- 中午｜（待安排）
- 下午｜難波 → 關西機場｜Rapi:t 或空港急行（¥970 最省）
```

- [ ] **Step 2: 用 Write 工具建立 `D:\大阪-vault\wiki\dashboard\總覽.md`**

```markdown
---
title: 總覽
updated: 2026-07-05
---

儀表板總覽頁資料。日期用 YYYY-MM-DD。

## 基本資訊
- 出發：2026-09-30
- 出發顯示：09.30 週三
- 回程：2026-10-04
- 回程顯示：10.04 週日
- 天數：5天4夜
- 季節：秋楓前緣・天氣穩定
- 飯店：大阪心齋橋格蘭多酒店
- 飯店副標：Shinsaibashi Grand Hotel Osaka・雙人床房 × 4 晚・早餐不含
- 飯店狀態：已確認
- 訂購：ezfly 易飛旅遊・機加酒
- 產品：【日本大阪│機加酒 5日】樂超值・心齋橋市區酒店自由行
- 訂單編號：WPKG000004961 / OSAP05MM93026M
- 訂購提醒：機票航班時段待確認 → 見待辦

## 交通備註
- 駅｜長堀橋站 步行 5 分（堺筋線・長堀鶴見綠地線）
- 駅｜心齋橋站 步行 10 分（御堂筋線 直達梅田／難波）
- 早｜飯店旁 LAWSON／7-11／心齋橋筋咖啡店
```

- [ ] **Step 3: commit 進 vault 並推上 GitHub**

```powershell
git -C "D:\大阪-vault" add "wiki/dashboard"
git -C "D:\大阪-vault" commit -m "feat: 儀表板資料檔（每日行程、總覽）"
git -C "D:\大阪-vault" push
```
Expected: push 成功（vault 已有自動備份 commit 記錄，憑證應已快取）。若 push 失敗，告知使用者手動推送。

---

### Task 7: build-data 主腳本

**Files:**
- Create: `scripts/build-data.ts`
- Test: `scripts/lib/__tests__/build-data.test.ts`（針對可測的純函式部分）
- Modify: `.gitignore`（**不要**忽略 `src/data/*.json`——建置產物要 commit，讓 clone 後不依賴 vault 也能 build）

**Interfaces:**
- Consumes: Task 2–5 全部解析器；`.env` 的 `NOTES_DIR`
- Produces: `src/data/entities.json`（`Entity[]`）、`src/data/days.json`（`Day[]`）、`src/data/todos.json`（`TodoItem[]`）、`src/data/overview.json`（`{ fields: Record<string,string>; transportNotes: string[] }`）、`src/data/meta.json`（`Meta`）
- 匯出純函式 `buildOverview(raw: string): { fields: Record<string,string>; transportNotes: string[] }` 供測試

- [ ] **Step 1: 寫失敗測試（buildOverview）**

```ts
// scripts/lib/__tests__/build-data.test.ts
import { describe, it, expect } from 'vitest';
import { buildOverview } from '../../build-data';

const OV = `---
title: 總覽
---

## 基本資訊
- 出發：2026-09-30
- 飯店：大阪心齋橋格蘭多酒店

## 交通備註
- 駅｜長堀橋站 步行 5 分
- 早｜LAWSON
`;

describe('buildOverview', () => {
  it('抽 fields 與交通備註', () => {
    const o = buildOverview(OV);
    expect(o.fields['出發']).toBe('2026-09-30');
    expect(o.fields['飯店']).toBe('大阪心齋橋格蘭多酒店');
    expect(o.transportNotes).toEqual(['駅｜長堀橋站 步行 5 分', '早｜LAWSON']);
  });
  it('缺出發日期報錯', () => {
    expect(() => buildOverview(OV.replace('- 出發：2026-09-30', ''))).toThrow(/出發/);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run scripts/lib/__tests__/build-data.test.ts`
Expected: FAIL

- [ ] **Step 3: 實作 build-data.ts**

```ts
// scripts/build-data.ts
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { CATEGORIES, MetaSchema, type Entity } from '../src/data/schema';
import { parseEntity } from './lib/parse-entity';
import { parseItinerary } from './lib/parse-itinerary';
import { parseTodos } from './lib/parse-todos';

export function buildOverview(raw: string): {
  fields: Record<string, string>;
  transportNotes: string[];
} {
  const { content } = matter(raw);
  const fields: Record<string, string> = {};
  const base = content.match(/## 基本資訊\n([\s\S]*?)(?=\n## |$)/);
  if (base) {
    for (const line of base[1].split('\n')) {
      const m = line.match(/^- (.+?)[：:]\s*(.*)$/);
      if (m) fields[m[1].trim()] = m[2].trim();
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields['出發'] ?? ''))
    throw new Error('總覽.md：「出發」欄位缺少或不是 YYYY-MM-DD');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields['回程'] ?? ''))
    throw new Error('總覽.md：「回程」欄位缺少或不是 YYYY-MM-DD');

  const trans = content.match(/## 交通備註\n([\s\S]*?)(?=\n## |$)/);
  const transportNotes = (trans?.[1] ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2));
  return { fields, transportNotes };
}

function main() {
  const vault = process.env.NOTES_DIR;
  if (!vault || !fs.existsSync(vault)) {
    console.error(`NOTES_DIR 未設定或不存在：${vault}`);
    process.exit(1);
  }
  const out = path.join(import.meta.dirname, '../src/data');
  fs.mkdirSync(out, { recursive: true });
  const write = (name: string, data: unknown) =>
    fs.writeFileSync(path.join(out, name), JSON.stringify(data, null, 1), 'utf8');

  const errors: string[] = [];
  const entities: Entity[] = [];
  for (const cat of CATEGORIES) {
    const dir = path.join(vault, 'wiki/entities', cat);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      try {
        entities.push(parseEntity(cat, f, fs.readFileSync(path.join(dir, f), 'utf8')));
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
  }

  let days, todos, overview;
  try {
    days = parseItinerary(fs.readFileSync(path.join(vault, 'wiki/dashboard/每日行程.md'), 'utf8'));
  } catch (e) { errors.push(String(e instanceof Error ? e.message : e)); }
  try {
    overview = buildOverview(fs.readFileSync(path.join(vault, 'wiki/dashboard/總覽.md'), 'utf8'));
  } catch (e) { errors.push(String(e instanceof Error ? e.message : e)); }
  try {
    todos = parseTodos(
      fs.readFileSync(path.join(vault, 'Osaka Trip/2026-09-30-osaka-confirmed-itinerary.md'), 'utf8'),
    );
  } catch (e) { errors.push(String(e instanceof Error ? e.message : e)); }

  if (errors.length || !days || !todos || !overview) {
    console.error(`❌ 資料建置失敗（${errors.length} 個錯誤）：`);
    for (const e of errors) console.error('  - ' + e);
    process.exit(1);
  }

  const meta = MetaSchema.parse({
    builtAt: new Date().toISOString(),
    tripStart: overview.fields['出發'],
    tripEnd: overview.fields['回程'],
  });

  write('entities.json', entities);
  write('days.json', days);
  write('todos.json', todos);
  write('overview.json', overview);
  write('meta.json', meta);
  console.log(
    `✅ 建置完成：${entities.length} 實體、${days.length} 天行程、${todos.length} 待辦`,
  );
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) main();
```

- [ ] **Step 4: 跑單元測試**

Run: `npx vitest run scripts/lib/__tests__/build-data.test.ts`
Expected: PASS（2 案例）

- [ ] **Step 5: 對真 vault 執行**

先確認 `.env` 有 `NOTES_DIR=D:\大阪-vault`（沒有就補上）。

Run: `npm run build:data`
Expected: `✅ 建置完成：99 實體、5 天行程、7 待辦`（實體數 = 65 餐廳 + 8 景點 + 17 購物 + 3 交通 + 2 住宿 + 4 區域 = 99；若 vault 已更新數字略有出入屬正常，重點是無錯誤）。若有解析錯誤，逐一檢查該 vault 檔案格式並回報使用者，不要靜默跳過。

- [ ] **Step 6: 建 src/data/index.ts（型別化匯入）**

```ts
// src/data/index.ts
import type { Entity, Day, TodoItem, Meta } from './schema';
import entitiesJson from './entities.json';
import daysJson from './days.json';
import todosJson from './todos.json';
import overviewJson from './overview.json';
import metaJson from './meta.json';

export const entities = entitiesJson as Entity[];
export const days = daysJson as Day[];
export const todos = todosJson as TodoItem[];
export const overview = overviewJson as { fields: Record<string, string>; transportNotes: string[] };
export const meta = metaJson as Meta;

export const byCategory = (cat: Entity['category']) => entities.filter((e) => e.category === cat);
```

確認 `tsconfig.app.json`（或 `tsconfig.json`）的 compilerOptions 有 `"resolveJsonModule": true`。

- [ ] **Step 7: 全部測試 + build 驗證**

Run: `npm test && npm run build`
Expected: 測試全綠、build 成功。

- [ ] **Step 8: Commit（含產出的 JSON）**

```bash
git add scripts/build-data.ts scripts/lib/__tests__/build-data.test.ts src/data/
git commit -m "feat: build-data 主腳本，vault → 型別化 JSON"
```

---

### Task 8: 主題樣式與字體

**Files:**
- Create: `src/styles.css`
- Modify: `index.html`（字體連結）、`src/main.tsx`（import styles）

**Interfaces:**
- Produces: 全案 CSS class：`card`、`chip`/`chip--on`、`stamp`/`stamp--off`、`heart`/`heart--on`、`serif`、`label-en`、`muted`、`dash-top`、`dash-bottom`、`btn-plain`、`fade-up`、`ov-grid`、`cards-grid`、`banner-dark`

- [ ] **Step 1: index.html `<head>` 加字體**

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
<link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;600;700;800&family=Noto+Sans+TC:wght@400;500;600;700&display=swap" rel="stylesheet">
```

- [ ] **Step 2: 建立 src/styles.css**

```css
:root {
  --paper: #F1EBDD; --card: #FBF7EC; --ink: #29231A;
  --red: #B23A1E; --red-lt: #C24A2A; --navy: #2E3A52;
  --green: #4A6B4F; --gold: #E8B44A;
  --brown: #8A7C64; --brown-lt: #A2957F; --brown-dk: #6E6350;
  --line: rgba(41, 35, 26, .14); --line-dark: rgba(41, 35, 26, .25);
  --serif: 'Shippori Mincho', serif;
}
* { box-sizing: border-box; }
body {
  margin: 0; color: var(--ink); background: var(--paper);
  background-image: repeating-linear-gradient(0deg, rgba(41,35,26,.018) 0px, rgba(41,35,26,.018) 1px, transparent 1px, transparent 3px);
  font-family: 'Noto Sans TC', sans-serif;
}
input::placeholder { color: var(--brown-lt); }
@keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.fade-up { animation: fadeUp .4s ease both; }
.serif { font-family: var(--serif); }
.muted { color: var(--brown); }
.label-en { font-size: 12px; letter-spacing: .25em; color: var(--brown); font-weight: 600; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 22px 24px; }
.dash-top { border-top: 1px dashed rgba(41,35,26,.22); }
.dash-bottom { border-bottom: 1px dashed var(--line); }
.btn-plain { background: none; border: none; cursor: pointer; font-family: inherit; text-align: left; padding: 0; color: inherit; }
.chip {
  background: transparent; color: var(--ink); border: 1px solid rgba(41,35,26,.3);
  border-radius: 999px; padding: 7px 16px; font-size: 13px; font-weight: 500;
  letter-spacing: .05em; cursor: pointer; font-family: 'Noto Sans TC', sans-serif;
}
.chip--on { background: var(--ink); color: #F7F2E6; border-color: var(--ink); font-weight: 600; }
.chip--red.chip--on { background: var(--red); border-color: var(--red); }
.stamp {
  flex: none; width: 42px; height: 42px; border-radius: 50%;
  border: 1.6px solid var(--red); color: var(--red);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--serif); font-size: 15px; font-weight: 800;
  transform: rotate(-6deg); background: rgba(178,58,30,.04);
}
.stamp--off { border-color: var(--line-dark); color: var(--brown-lt); font-size: 13px; background: transparent; }
.heart { flex: none; background: none; border: none; cursor: pointer; font-size: 20px; line-height: 1; padding: 2px; color: rgba(41,35,26,.35); }
.heart--on { color: var(--red); }
.ov-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 16px; }
.cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(295px, 1fr)); gap: 12px; }
.banner-dark { background: var(--navy); color: #EFE9DA; border-radius: 10px; padding: 18px 22px; }
a { color: var(--red); }
```

- [ ] **Step 3: src/main.tsx 首行 `import './styles.css';`**

- [ ] **Step 4: 驗證**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 5: Commit**

```bash
git add index.html src/styles.css src/main.tsx
git commit -m "feat: 和風主題樣式與字體"
```

---

### Task 9: App 骨架（分頁路由、Header 倒數、Footer）

**Files:**
- Create: `src/App.tsx`（覆寫）、`src/components/Chip.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `meta`, `entities`, `byCategory`（Task 7）
- Produces:
  - `type TabKey = 'home'|'plan'|'food'|'places'|'trans'|'map'`
  - 頁面元件介面：每頁為 `() => JSX.Element` 的 default export，Task 11–16 逐一實作（先用佔位 div，本任務建立檔案骨架）
  - `Chip` 元件：`{ on: boolean; red?: boolean; onClick: () => void; children: ReactNode }`
  - `countdownDays(tripStart: string, now?: Date): number`（App.tsx 匯出，JST 起算）

- [ ] **Step 1: Chip 元件**

```tsx
// src/components/Chip.tsx
import type { ReactNode } from 'react';

export default function Chip({ on, red, onClick, children }: {
  on: boolean; red?: boolean; onClick: () => void; children: ReactNode;
}) {
  return (
    <button className={`chip${on ? ' chip--on' : ''}${red ? ' chip--red' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}
```

- [ ] **Step 2: 六個頁面佔位檔**

`src/pages/Home.tsx`、`DailyPlan.tsx`、`Food.tsx`、`Places.tsx`、`Transport.tsx`、`AreaMap.tsx` 各建立：

```tsx
export default function Home() {
  return <div className="fade-up">（建置中）</div>;
}
```

（每檔函式名對應：`Home`/`DailyPlan`/`Food`/`Places`/`Transport`/`AreaMap`）

- [ ] **Step 3: App.tsx**

```tsx
// src/App.tsx
import { useEffect, useState } from 'react';
import { meta, overview, byCategory } from './data';
import Chip from './components/Chip';
import Home from './pages/Home';
import DailyPlan from './pages/DailyPlan';
import Food from './pages/Food';
import Places from './pages/Places';
import Transport from './pages/Transport';
import AreaMap from './pages/AreaMap';

export type TabKey = 'home' | 'plan' | 'food' | 'places' | 'trans' | 'map';

export function countdownDays(tripStart: string, now = new Date()): number {
  const dep = new Date(`${tripStart}T00:00:00+09:00`).getTime();
  return Math.max(0, Math.ceil((dep - now.getTime()) / 86400000));
}

const TABS: [TabKey, string][] = [
  ['home', '總覽'], ['plan', '每日行程'], ['food', '美食庫'],
  ['places', '景點・購物'], ['trans', '交通票券'], ['map', '地圖'],
];

const PAGES: Record<TabKey, () => JSX.Element> = {
  home: Home, plan: DailyPlan, food: Food, places: Places, trans: Transport, map: AreaMap,
};

function tabFromHash(): TabKey {
  const h = location.hash.replace('#', '') as TabKey;
  return TABS.some(([k]) => k === h) ? h : 'home';
}

export default function App() {
  const [tab, setTab] = useState<TabKey>(tabFromHash);
  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = (k: TabKey) => { location.hash = k; };

  const cd = countdownDays(meta.tripStart);
  const foodCount = byCategory('餐廳').length;
  const Page = PAGES[tab];
  const f = overview.fields;

  return (
    <div style={{ minHeight: '100vh' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50, background: 'rgba(241,235,221,.94)',
        backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--line)',
      }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '14px 20px 0', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
          <div className="serif" style={{
            width: 44, height: 44, background: 'var(--red)', color: '#F7F2E6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 700, borderRadius: 6,
            boxShadow: '2px 2px 0 rgba(41,35,26,.18)', transform: 'rotate(-3deg)',
          }}>阪</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 180 }}>
            <div className="serif" style={{ fontSize: 21, fontWeight: 700, letterSpacing: '.12em' }}>
              大阪旅券 <span className="label-en" style={{ fontSize: 12 }}>OSAKA TRIP</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--brown-dk)', letterSpacing: '.06em' }}>
              {f['出發顯示']} → {f['回程顯示']}・{f['天數']}・宿 心齋橋
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 7, border: '1.5px solid var(--red)',
            color: 'var(--red)', borderRadius: 999, padding: '6px 16px', background: 'rgba(178,58,30,.05)',
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.1em' }}>出發倒數</span>
            <span className="serif" style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{cd}</span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>日</span>
          </div>
        </div>
        <nav style={{ maxWidth: 1120, margin: '0 auto', padding: '10px 20px 12px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {TABS.map(([k, label]) => (
            <Chip key={k} on={tab === k} red onClick={() => go(k)}>
              {k === 'food' ? `${label} ${foodCount}` : label}
            </Chip>
          ))}
        </nav>
      </header>
      <main style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 20px 64px' }}>
        <Page key={tab} />
      </main>
      <footer style={{
        borderTop: '1px solid var(--line)', padding: '18px 20px', textAlign: 'center',
        fontSize: 11.5, color: 'var(--brown)', letterSpacing: '.08em',
      }}>
        資料來源：Osaka-vault wiki・資料建置於 {new Date(meta.builtAt).toLocaleString('zh-TW')}
      </footer>
    </div>
  );
}
```

- [ ] **Step 4: countdown 單元測試**

```tsx
// src/__tests__/countdown.test.ts
import { describe, it, expect } from 'vitest';
import { countdownDays } from '../App';

describe('countdownDays', () => {
  it('以 JST 零時起算、無條件進位', () => {
    expect(countdownDays('2026-09-30', new Date('2026-09-28T00:00:00+09:00'))).toBe(2);
    expect(countdownDays('2026-09-30', new Date('2026-09-29T23:00:00+09:00'))).toBe(1);
  });
  it('過期歸零', () => {
    expect(countdownDays('2026-09-30', new Date('2026-10-05T00:00:00+09:00'))).toBe(0);
  });
});
```

vite.config.ts 的 vitest `include` 已涵蓋 `src/**/*.test.{ts,tsx}`；此測試 import App.tsx（含 JSX），vitest environment 需在該檔案可解析——App.tsx 頂層 import data JSON 與頁面，node 環境可運作（不 render）。若遇 `document is not defined` 屬 render 才會發生，本測試僅呼叫純函式，不會。

Run: `npx vitest run src/__tests__/countdown.test.ts`
Expected: PASS

- [ ] **Step 5: 啟動 dev server 目視驗證**

Run: `npm run dev` → 用 preview 工具開 `http://localhost:5173/Osaka-web/`
Expected: 紙質底、header 有「阪」印章 logo、倒數天數、六個分頁 chip 可切換（頁面本體是「（建置中）」）、footer 顯示建置時間。

- [ ] **Step 6: Commit**

```bash
git add src/
git commit -m "feat: App 骨架——hash 分頁、Header 倒數、Footer"
```

---

### Task 10: 狀態 Store（Context + localStorage 版）

**Files:**
- Create: `src/state/store.tsx`
- Test: `src/state/__tests__/store.test.tsx`
- Modify: `src/main.tsx`（包 Provider）

**Interfaces:**
- Consumes: `entities`（favorite 預設值）、`todos`（checkedInVault 預設值）
- Produces（Task 11–16 頁面唯一的狀態入口，Task 18 只改內部實作、不改此 API）：

```ts
export function useTripState(): {
  favs: Record<string, boolean>;    // key: "fav:餐廳/xxx"
  todosState: Record<string, boolean>; // key: "todo:xxxx"
  toggleFav(entityId: string): void;   // 傳 entity.id，內部加 "fav:" 前綴
  toggleTodo(key: string): void;       // 傳 TodoItem.key
  isFav(entityId: string): boolean;
  favCount: number;
  offline: boolean;                    // localStorage 版恆為 false
};
export function TripStateProvider({ children }: { children: ReactNode }): JSX.Element;
```

- [ ] **Step 1: 寫失敗測試**

需要 DOM 環境：`npm install -D @testing-library/react jsdom`，並在測試檔頂加 `// @vitest-environment jsdom`。

```tsx
// src/state/__tests__/store.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { TripStateProvider, useTripState } from '../store';

const wrapper = TripStateProvider;

describe('useTripState (localStorage)', () => {
  beforeEach(() => localStorage.clear());

  it('toggleFav 切換並持久化', () => {
    const { result } = renderHook(() => useTripState(), { wrapper });
    act(() => result.current.toggleFav('餐廳/測試店'));
    expect(result.current.isFav('餐廳/測試店')).toBe(true);
    expect(result.current.favCount).toBeGreaterThanOrEqual(1);
    expect(JSON.parse(localStorage.getItem('osaka-trip-state')!)['fav:餐廳/測試店']).toBe(true);
    act(() => result.current.toggleFav('餐廳/測試店'));
    expect(result.current.isFav('餐廳/測試店')).toBe(false);
  });

  it('toggleTodo 切換', () => {
    const { result } = renderHook(() => useTripState(), { wrapper });
    act(() => result.current.toggleTodo('todo:abc'));
    expect(result.current.todosState['todo:abc']).toBe(true);
  });

  it('vault favorite: true 作為預設收藏', () => {
    // entities.json 中若有 favorite:true 的實體，其 fav 預設為 true
    // （真資料目前無 favorite 標記，此案例驗證合併邏輯：先寫入 localStorage 再確認優先序）
    localStorage.setItem('osaka-trip-state', JSON.stringify({ 'fav:餐廳/A': true }));
    const { result } = renderHook(() => useTripState(), { wrapper });
    expect(result.current.isFav('餐廳/A')).toBe(true);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/state/__tests__/store.test.tsx`
Expected: FAIL（找不到 `../store`）

- [ ] **Step 3: 實作**

```tsx
// src/state/store.tsx
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { entities, todos } from '../data';

const LS_KEY = 'osaka-trip-state';
type StateMap = Record<string, boolean>;

function defaults(): StateMap {
  const d: StateMap = {};
  for (const e of entities) if (e.favorite) d[`fav:${e.id}`] = true;
  for (const t of todos) if (t.checkedInVault) d[t.key] = true;
  return d;
}

function loadLocal(): StateMap {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}'); } catch { return {}; }
}

interface TripState {
  favs: StateMap;
  todosState: StateMap;
  toggleFav(entityId: string): void;
  toggleTodo(key: string): void;
  isFav(entityId: string): boolean;
  favCount: number;
  offline: boolean;
}

const Ctx = createContext<TripState | null>(null);

export function TripStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StateMap>(() => ({ ...defaults(), ...loadLocal() }));

  const toggle = useCallback((key: string) => {
    setState((s) => {
      const next = { ...s, [key]: !s[key] };
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* 忽略 */ }
      return next;
    });
  }, []);

  const value = useMemo<TripState>(() => {
    const favs: StateMap = {}; const todosState: StateMap = {};
    for (const [k, v] of Object.entries(state)) {
      if (k.startsWith('fav:')) favs[k] = v;
      else if (k.startsWith('todo:')) todosState[k] = v;
    }
    return {
      favs, todosState,
      toggleFav: (id) => toggle(`fav:${id}`),
      toggleTodo: (key) => toggle(key),
      isFav: (id) => !!state[`fav:${id}`],
      favCount: Object.entries(favs).filter(([, v]) => v).length,
      offline: false,
    };
  }, [state, toggle]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTripState(): TripState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTripState 必須在 TripStateProvider 內使用');
  return ctx;
}
```

- [ ] **Step 4: main.tsx 包 Provider**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App';
import { TripStateProvider } from './state/store';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TripStateProvider>
      <App />
    </TripStateProvider>
  </StrictMode>,
);
```

- [ ] **Step 5: 跑測試確認通過**

Run: `npx vitest run src/state/__tests__/store.test.tsx`
Expected: PASS（3 案例）

- [ ] **Step 6: Commit**

```bash
git add src/state/ src/main.tsx package.json package-lock.json
git commit -m "feat: TripState store（localStorage 版）"
```

---

### Task 11: 共用元件 Stamp / Heart + 總覽頁 Home

**Files:**
- Create: `src/components/Stamp.tsx`, `src/components/Heart.tsx`
- Modify: `src/pages/Home.tsx`（覆寫佔位）

**Interfaces:**
- Consumes: `useTripState`、`overview`、`todos`、`byCategory`、`countdownDays`、`meta`
- Produces:
  - `Stamp`: `{ rating: number | null }` — 印章式評分圓框
  - `Heart`: `{ entityId: string }` — 讀寫 store 的收藏按鈕

- [ ] **Step 1: Stamp / Heart**

```tsx
// src/components/Stamp.tsx
export default function Stamp({ rating }: { rating: number | null }) {
  return (
    <div className={`stamp${rating == null ? ' stamp--off' : ''}`}>
      {rating == null ? '—' : rating.toFixed(1)}
    </div>
  );
}
```

```tsx
// src/components/Heart.tsx
import { useTripState } from '../state/store';

export default function Heart({ entityId }: { entityId: string }) {
  const { isFav, toggleFav } = useTripState();
  const on = isFav(entityId);
  return (
    <button className={`heart${on ? ' heart--on' : ''}`} aria-label="收藏"
      onClick={() => toggleFav(entityId)}>
      {on ? '♥' : '♡'}
    </button>
  );
}
```

- [ ] **Step 2: Home.tsx**

```tsx
// src/pages/Home.tsx
import { countdownDays } from '../App';
import { byCategory, meta, overview, todos } from '../data';
import { useTripState } from '../state/store';

export default function Home() {
  const { todosState, toggleTodo, favCount } = useTripState();
  const f = overview.fields;
  const cd = countdownDays(meta.tripStart);
  const done = todos.filter((t) => todosState[t.key]).length;

  const quick: { count: number; label: string; sub: string; hash: string }[] = [
    { count: byCategory('餐廳').length, label: '美食庫', sub: '分類齊全・可篩選', hash: 'food' },
    { count: byCategory('景點').length, label: '景點', sub: 'USJ・展望台・水族館', hash: 'places' },
    { count: byCategory('購物').length, label: '購物', sub: '梅田 vs 心齋橋', hash: 'places' },
    { count: byCategory('交通').length, label: '交通票券', sub: 'Rapi:t・近鐵 PASS', hash: 'trans' },
  ];

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="ov-grid">
        {/* 倒數卡 */}
        <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -14, top: -14, width: 110, height: 110, border: '2px solid rgba(178,58,30,.12)', borderRadius: '50%' }} />
          <div className="label-en">DEPARTURE COUNTDOWN</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
            <span className="serif" style={{ fontSize: 72, fontWeight: 800, color: 'var(--red)', lineHeight: 1 }}>{cd}</span>
            <span className="serif" style={{ fontSize: 20, fontWeight: 700 }}>日</span>
          </div>
          <div className="dash-top" style={{ display: 'flex', gap: 18, marginTop: 14, paddingTop: 14 }}>
            {[['出發', f['出發顯示']], ['回程', f['回程顯示']], ['季節', f['季節']]].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 11, color: 'var(--brown)', letterSpacing: '.1em' }}>{k}</span>
                <span className="serif" style={{ fontSize: 15, fontWeight: 700 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        {/* 飯店卡 */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--green)', border: '1px solid var(--green)', borderRadius: 4, padding: '2px 7px' }}>✓ {f['飯店狀態']}</span>
            <span className="label-en" style={{ letterSpacing: '.2em' }}>HOTEL</span>
          </div>
          <div className="serif" style={{ fontSize: 21, fontWeight: 700, marginTop: 8 }}>{f['飯店']}</div>
          <div style={{ fontSize: 12, color: 'var(--brown-dk)' }}>{f['飯店副標']}</div>
          <div className="dash-top" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14, paddingTop: 12, fontSize: 13 }}>
            {overview.transportNotes.map((n) => {
              const [mark, ...rest] = n.split('｜');
              return (
                <div key={n} style={{ display: 'flex', gap: 8 }}>
                  <span style={{ color: mark === '早' ? 'var(--brown)' : 'var(--red)', fontWeight: 700 }}>{mark}</span>
                  <span style={{ color: mark === '早' ? 'var(--brown-dk)' : undefined }}>{rest.join('｜')}</span>
                </div>
              );
            })}
          </div>
        </div>
        {/* 訂購卡 */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="label-en" style={{ letterSpacing: '.2em' }}>BOOKING</div>
          <div className="serif" style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>{f['訂購']}</div>
          <div style={{ fontSize: 13, color: 'var(--brown-dk)', marginTop: 4 }}>{f['產品']}</div>
          <div style={{ fontSize: 12, color: 'var(--brown)', marginTop: 10, fontFamily: 'ui-monospace, monospace' }}>{f['訂單編號']}</div>
          <div style={{ flex: 1 }} />
          {f['訂購提醒'] && (
            <div className="dash-top" style={{ marginTop: 14, paddingTop: 12, fontSize: 13, color: 'var(--red)', fontWeight: 600 }}>⚠ {f['訂購提醒']}</div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {/* 待辦 */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <div className="serif" style={{ fontSize: 18, fontWeight: 700 }}>出發前待辦</div>
            <div style={{ fontSize: 12, color: 'var(--brown)' }}>{done} / {todos.length} 完成</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
            {todos.map((t) => {
              const on = !!todosState[t.key];
              return (
                <button key={t.key} className="btn-plain dash-bottom"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px' }}
                  onClick={() => toggleTodo(t.key)}>
                  <span style={{
                    flex: 'none', width: 20, height: 20, borderRadius: 4,
                    border: `1.6px solid ${on ? 'var(--green)' : 'rgba(41,35,26,.4)'}`,
                    background: on ? 'var(--green)' : 'transparent', color: '#F7F2E6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
                  }}>{on ? '✓' : ''}</span>
                  <span style={{ fontSize: 13.5, color: on ? 'var(--brown)' : 'var(--ink)', textDecoration: on ? 'line-through' : 'none' }}>{t.text}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 快速連結 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            {quick.map((q) => (
              <button key={q.label} className="card btn-plain" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer' }}
                onClick={() => { location.hash = q.hash; }}>
                <span className="serif" style={{ fontSize: 26, fontWeight: 800, color: 'var(--red)' }}>{q.count}</span>
                <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.06em' }}>{q.label}</span>
                <span style={{ fontSize: 11, color: 'var(--brown)' }}>{q.sub}</span>
              </button>
            ))}
          </div>
          {/* 收藏統計橫幅 */}
          <div className="banner-dark" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
            <div className="serif" style={{ writingMode: 'vertical-rl', fontSize: 14, fontWeight: 700, letterSpacing: '.3em', borderRight: '1px solid rgba(239,233,218,.3)', paddingRight: 10 }}>已標記</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span className="serif" style={{ fontSize: 40, fontWeight: 800, color: 'var(--gold)' }}>{favCount}</span>
              <span style={{ fontSize: 13 }}>個想去的地方</span>
            </div>
            <div style={{ flex: 1, fontSize: 12, color: 'rgba(239,233,218,.72)', minWidth: 150 }}>
              在美食庫、景點與購物頁按 ♡ 標記，地圖頁會依區域統計。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 目視驗證**

Run: `npm run dev` → preview 開總覽頁
Expected: 三張總覽卡（倒數/飯店/訂購）資料來自 vault、待辦可勾（重新整理仍在）、快速連結數字正確（65/8/17/3 或當前 vault 數量）、收藏橫幅顯示 0。

- [ ] **Step 4: Commit**

```bash
git add src/components/Stamp.tsx src/components/Heart.tsx src/pages/Home.tsx
git commit -m "feat: 總覽頁 + Stamp/Heart 元件"
```

---

### Task 12: 區域軸元件 AreaRail + 每日行程頁（三檢視）

**Files:**
- Create: `src/components/AreaRail.tsx`
- Modify: `src/pages/DailyPlan.tsx`（覆寫）

**Interfaces:**
- Consumes: `days`、`entities`、`useTripState`
- Produces: `AreaRail`: `{ highlightAreas: string[] | null; showCounts: boolean }` — 御堂筋軸區域示意（Task 16 地圖頁重用）

- [ ] **Step 1: AreaRail**

```tsx
// src/components/AreaRail.tsx
import { entities } from '../data';
import { useTripState } from '../state/store';

const ROWS = [
  { name: '梅田', en: 'UMEDA', badge: '', pts: '阪急・阪神・大丸・LUCUA・Grand Front・Nintendo OSAKA', match: ['梅田'] },
  { name: '本町・南船場', en: 'HOMMACHI', badge: '', pts: '本町製麵所・Yakiniku KITAN', match: [] as string[] },
  { name: '心齋橋', en: 'SHINSAIBASHI', badge: '🏨 住這裡', pts: 'PARCO・寶可夢中心DX・南堀江選品・道頓堀北岸', match: ['心齋橋'] },
  { name: '難波', en: 'NAMBA', badge: '', pts: '道頓堀・千日前・高島屋・南海往關西機場', match: ['難波'] },
  { name: '天王寺', en: 'TENNOJI', badge: '', pts: 'Harukas300・通天閣・新世界・動物園', match: ['天王寺'] },
];

export default function AreaRail({ highlightAreas, showCounts }: {
  highlightAreas: string[] | null; showCounts: boolean;
}) {
  const { favs } = useTripState();
  const favIn = (area: string) =>
    entities.filter((e) => e.area === area && favs[`fav:${e.id}`]).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {ROWS.map((r) => {
        const hl = !!highlightAreas && r.match.some((m) => highlightAreas.includes(m));
        const count = r.match.reduce((n, m) => n + favIn(m), 0);
        return (
          <div key={r.name} style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
            <div style={{ flex: 'none', width: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 3, flex: 1, background: 'var(--red-lt)' }} />
              <div style={{
                flex: 'none', width: r.badge ? 16 : 12, height: r.badge ? 16 : 12, borderRadius: '50%',
                background: hl ? 'var(--red)' : 'var(--card)',
                border: `3px solid ${r.badge ? 'var(--red)' : 'var(--red-lt)'}`,
              }} />
              <div style={{ width: 3, flex: 1, background: 'var(--red-lt)' }} />
            </div>
            <div style={{
              flex: 1, margin: '6px 0', padding: '12px 16px', borderRadius: 8,
              border: hl ? '1px solid var(--red)' : '1px solid rgba(41,35,26,.12)',
              background: hl ? 'rgba(178,58,30,.06)' : 'rgba(255,255,255,.4)',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span className="serif" style={{ fontSize: 16, fontWeight: 800 }}>{r.name}</span>
                <span style={{ fontSize: 10.5, letterSpacing: '.18em', color: 'var(--brown)' }}>{r.en}</span>
                {r.badge && <span style={{ fontSize: 12 }}>{r.badge}</span>}
                {showCounts && count > 0 && (
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--red)', border: '1px solid rgba(178,58,30,.4)', borderRadius: 999, padding: '1px 8px' }}>♥ {count}</span>
                )}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--brown-dk)', marginTop: 2 }}>{r.pts}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: DailyPlan.tsx**

```tsx
// src/pages/DailyPlan.tsx
import { useState } from 'react';
import { days } from '../data';
import AreaRail from '../components/AreaRail';

type View = 'timeline' | 'cards' | 'map';
const VIEWS: [View, string][] = [['timeline', '時間軸'], ['cards', '卡片'], ['map', '地圖']];

export default function DailyPlan() {
  const [dayIdx, setDayIdx] = useState(0);
  const [view, setView] = useState<View>('timeline');
  const day = days[dayIdx] ?? days[0];

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
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
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', border: '1px solid var(--line-dark)', borderRadius: 8, overflow: 'hidden' }}>
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
          </div>
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
        </div>
      )}

      {view === 'cards' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(205px, 1fr))', gap: 12 }}>
          {days.map((d, i) => (
            <div key={d.label} className="card" style={{ padding: '16px 18px', borderColor: i === dayIdx ? 'var(--red)' : undefined }}>
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
```

- [ ] **Step 3: 目視驗證**

Run: preview 開每日行程頁
Expected: 五天分頁切換、三種檢視切換、（待安排）呈虛線卡、地圖檢視當日區域朱色高亮。

- [ ] **Step 4: Commit**

```bash
git add src/components/AreaRail.tsx src/pages/DailyPlan.tsx
git commit -m "feat: 每日行程頁（時間軸/卡片/地圖三檢視）"
```

---

### Task 13: 美食庫頁

**Files:**
- Modify: `src/pages/Food.tsx`（覆寫）

**Interfaces:**
- Consumes: `byCategory('餐廳')`、`Stamp`、`Heart`、`Chip`、`useTripState`

- [ ] **Step 1: Food.tsx**

```tsx
// src/pages/Food.tsx
import { useMemo, useState } from 'react';
import { byCategory } from '../data';
import Chip from '../components/Chip';
import Heart from '../components/Heart';
import Stamp from '../components/Stamp';
import { useTripState } from '../state/store';

export default function Food() {
  const { favs } = useTripState();
  const all = useMemo(() => byCategory('餐廳'), []);
  const [cat, setCat] = useState('全部');
  const [q, setQ] = useState('');
  const [favOnly, setFavOnly] = useState(false);

  const cats = useMemo(
    () => ['全部', ...Array.from(new Set(all.map((r) => r.fields['類型'] ?? '未分類')))],
    [all],
  );

  const list = all
    .filter((r) =>
      (cat === '全部' || (r.fields['類型'] ?? '未分類') === cat) &&
      (!favOnly || favs[`fav:${r.id}`]) &&
      (!q || `${r.name}${r.fields['備註'] ?? ''}${r.fields['類型'] ?? ''}${r.summary}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋店名或備註…" style={{
          flex: 1, minWidth: 200, maxWidth: 340, background: 'var(--card)',
          border: '1px solid var(--line-dark)', borderRadius: 8, padding: '10px 14px',
          fontSize: 14, fontFamily: 'inherit', color: 'var(--ink)', outline: 'none',
        }} />
        <Chip on={favOnly} red onClick={() => setFavOnly(!favOnly)}>♥ 只看已標記</Chip>
        <span style={{ fontSize: 12.5, color: 'var(--brown)' }}>共 {list.length} 間</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {cats.map((c) => {
          const n = c === '全部' ? all.length : all.filter((r) => (r.fields['類型'] ?? '未分類') === c).length;
          return <Chip key={c} on={cat === c} onClick={() => setCat(c)}>{c} {n}</Chip>;
        })}
      </div>
      <div className="cards-grid">
        {list.map((r) => {
          const note = r.fields['備註'] && r.fields['備註'] !== '-' ? r.fields['備註'] : r.summary;
          return (
            <div key={r.id} className="card" style={{ padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <Stamp rating={r.rating} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="serif" style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.35 }}>{r.name}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--navy)', border: '1px solid rgba(46,58,82,.4)', borderRadius: 4, padding: '1.5px 7px' }}>{r.fields['類型'] ?? '未分類'}</span>
                  <span style={{ fontSize: 12, color: 'var(--brown)' }}>{r.fields['價位'] && r.fields['價位'] !== '-' ? r.fields['價位'] : '價位未記'}</span>
                  {r.area && <span style={{ fontSize: 12, color: 'var(--brown)' }}>{r.area}</span>}
                </div>
                {note && (
                  <div style={{ fontSize: 12.5, color: 'var(--brown-dk)', marginTop: 7, borderTop: '1px dashed rgba(41,35,26,.16)', paddingTop: 7 }}>{note}</div>
                )}
              </div>
              <Heart entityId={r.id} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 目視驗證**

Expected: 全部餐廳依評分排序、分類 chip 數量正確、搜尋即時過濾、♥ 可切換且「只看已標記」有效、重新整理收藏仍在。

- [ ] **Step 3: Commit**

```bash
git add src/pages/Food.tsx
git commit -m "feat: 美食庫頁（搜尋/分類/收藏過濾）"
```

---

### Task 14: 景點與購物頁

**Files:**
- Modify: `src/pages/Places.tsx`（覆寫）

**Interfaces:**
- Consumes: `byCategory('景點')`、`byCategory('購物')`、`Stamp`、`Heart`

- [ ] **Step 1: Places.tsx**

```tsx
// src/pages/Places.tsx
import { byCategory } from '../data';
import Heart from '../components/Heart';
import Stamp from '../components/Stamp';

export default function Places() {
  const spots = byCategory('景點');
  const shops = byCategory('購物');

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <section>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
          <span className="serif" style={{ fontSize: 20, fontWeight: 800, borderLeft: '4px solid var(--red)', paddingLeft: 12 }}>景點</span>
          <span style={{ fontSize: 12, color: 'var(--brown)' }}>{spots.length} 處</span>
        </div>
        <div className="cards-grid">
          {spots.map((p) => (
            <div key={p.id} className="card" style={{ padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <Stamp rating={p.rating} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="serif" style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.35 }}>{p.name}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--navy)', border: '1px solid rgba(46,58,82,.4)', borderRadius: 4, padding: '1.5px 7px' }}>{p.fields['類型'] ?? ''}</span>
                  <span style={{ fontSize: 12, color: 'var(--brown)' }}>
                    {[p.fields['位置'], p.fields['門票']].filter(Boolean).join('・')}
                  </span>
                </div>
                {p.summary && (
                  <div style={{ fontSize: 12.5, color: 'var(--brown-dk)', marginTop: 7, borderTop: '1px dashed rgba(41,35,26,.16)', paddingTop: 7 }}>{p.summary}</div>
                )}
              </div>
              <Heart entityId={p.id} />
            </div>
          ))}
        </div>
      </section>
      <section>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
          <span className="serif" style={{ fontSize: 20, fontWeight: 800, borderLeft: '4px solid var(--navy)', paddingLeft: 12 }}>購物</span>
          <span style={{ fontSize: 12, color: 'var(--brown)' }}>{shops.length} 處・梅田 vs 心齋橋雙主場</span>
        </div>
        <div className="cards-grid">
          {shops.map((p) => (
            <div key={p.id} className="card" style={{ padding: '16px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span className="serif" style={{ fontSize: 15.5, fontWeight: 700 }}>{p.name}</span>
                  {p.rating != null && <span style={{ fontSize: 11.5, color: 'var(--red)', fontWeight: 700 }}>★ {p.rating.toFixed(1)}</span>}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7, alignItems: 'center' }}>
                  {p.area && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--navy)', border: '1px solid rgba(46,58,82,.4)', borderRadius: 4, padding: '1.5px 7px' }}>{p.area}</span>}
                  <span style={{ fontSize: 12, color: 'var(--brown)' }}>{p.fields['類型'] ?? ''}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--brown-dk)', marginTop: 7 }}>{p.summary}</div>
              </div>
              <Heart entityId={p.id} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: 目視驗證**

Expected: 景點區朱紅左框標題、購物區藏青左框標題、卡片資料齊全、♥ 正常。

- [ ] **Step 3: Commit**

```bash
git add src/pages/Places.tsx
git commit -m "feat: 景點與購物頁"
```

---

### Task 15: 交通票券頁（markdown 渲染）

**Files:**
- Modify: `src/pages/Transport.tsx`（覆寫）
- Create: `src/components/MarkdownBody.tsx`

**Interfaces:**
- Consumes: `byCategory('交通')`、react-markdown + remark-gfm
- Produces: `MarkdownBody`: `{ children: string }` — 渲染實體 body（表格支援）

- [ ] **Step 1: MarkdownBody**

```tsx
// src/components/MarkdownBody.tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function MarkdownBody({ children }: { children: string }) {
  return (
    <div className="md-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
```

styles.css 追加：

```css
.md-body { font-size: 13.5px; line-height: 1.75; }
.md-body h2 { font-family: var(--serif); font-size: 16px; border-left: 3px solid var(--red); padding-left: 10px; margin: 18px 0 8px; }
.md-body table { border-collapse: collapse; width: 100%; margin: 8px 0; }
.md-body th, .md-body td { border: 1px solid var(--line); padding: 6px 10px; font-size: 13px; text-align: left; }
.md-body th { background: rgba(46,58,82,.06); font-weight: 700; }
.md-body code { background: rgba(41,35,26,.06); border-radius: 4px; padding: 1px 5px; }
.md-body ul { padding-left: 20px; margin: 6px 0; }
```

- [ ] **Step 2: Transport.tsx**

```tsx
// src/pages/Transport.tsx
import { byCategory } from '../data';
import MarkdownBody from '../components/MarkdownBody';

const HEADER_COLORS = ['var(--navy)', 'var(--red)', 'var(--green)'];

export default function Transport() {
  const items = byCategory('交通');
  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 820 }}>
      {items.map((t, i) => (
        <div key={t.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ background: HEADER_COLORS[i % HEADER_COLORS.length], color: '#EFE9DA', padding: '14px 22px', display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 10 }}>
            <span className="serif" style={{ fontSize: 18, fontWeight: 800 }}>{t.name}</span>
            <span style={{ fontSize: 12, opacity: .78 }}>{t.summary.slice(0, 60)}</span>
          </div>
          <div style={{ padding: '10px 22px 18px' }}>
            <MarkdownBody>{t.body.replace(/## 基本資訊[\s\S]*?(?=\n## |$)/, '').replace(/## 來源[\s\S]*$/, '')}</MarkdownBody>
          </div>
        </div>
      ))}
    </div>
  );
}
```

（body 移除「基本資訊」「來源」段避免重複與雜訊；其餘段落——票價表、省錢方案、使用重點——完整渲染。）

- [ ] **Step 3: 目視驗證**

Expected: 三張交通卡（Rapi:t／大阪地鐵／近鐵周遊券）、票價表格正確渲染、卡頭深色橫幅。

- [ ] **Step 4: Commit**

```bash
git add src/pages/Transport.tsx src/components/MarkdownBody.tsx src/styles.css package.json package-lock.json
git commit -m "feat: 交通票券頁（vault markdown 渲染）"
```

---

### Task 16: 地圖頁

**Files:**
- Modify: `src/pages/AreaMap.tsx`（覆寫）

**Interfaces:**
- Consumes: `AreaRail`（showCounts 模式）

- [ ] **Step 1: AreaMap.tsx**

```tsx
// src/pages/AreaMap.tsx
import AreaRail from '../components/AreaRail';

export default function AreaMap() {
  return (
    <div className="fade-up" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
      <div className="card" style={{ flex: 2, minWidth: 300, padding: '24px 26px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
          <span className="serif" style={{ fontSize: 18, fontWeight: 800 }}>御堂筋軸・區域示意</span>
          <span style={{ fontSize: 12, color: 'var(--brown)' }}>北 ↓ 南</span>
        </div>
        <AreaRail highlightAreas={null} showCounts={true} />
      </div>
      <div style={{ flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card" style={{ padding: '18px 20px' }}>
          <div className="serif" style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>西側・市郊</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 13 }}>
            {[
              ['此花區', '日本環球影城（JR 夢咲線）'],
              ['大阪港・天保山', '海遊館＋摩天輪'],
              ['池田市', '杯麵博物館（車程約 30 分）'],
              ['門真市', '三井 Outlet＋LaLaport'],
              ['淀屋橋', '堂島濱塔免費夜景'],
            ].map(([b, rest]) => (
              <div key={b} style={{ display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--navy)', fontWeight: 700 }}>◆</span>
                <span><b>{b}</b>：{rest}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: 'rgba(46,58,82,.06)', border: '1px dashed rgba(46,58,82,.4)', borderRadius: 10, padding: '16px 20px', fontSize: 12.5, color: '#4A5468', lineHeight: 1.7 }}>
          尚未收錄各店座標，此頁以路線示意呈現。之後可把 Google Maps 清單（82 個標記）匯入升級成真地圖。
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 目視驗證 + 全頁走查**

Run: `npm test && npm run build`，preview 六頁全部走一遍 + `preview_resize` mobile（375px）檢查換行與 sticky header。
Expected: 測試全綠、六頁完整、地圖頁 ♥ 統計隨收藏變動、手機寬度不破版。

- [ ] **Step 3: Commit**

```bash
git add src/pages/AreaMap.tsx
git commit -m "feat: 地圖頁（區域示意 + 收藏統計）"
```

---

### Task 17: Cloudflare Worker + D1

**Files:**
- Create: `worker/wrangler.toml`, `worker/schema.sql`, `worker/src/index.ts`, `worker/package.json`
- Test: `worker/test/worker.test.ts`

**Interfaces:**
- Produces: HTTP API（Task 18 前端串接）：
  - `GET /api/state` → `200 Record<string, boolean>`；未授權 `401 {"error":"unauthorized"}`
  - `PUT /api/state/:key` body `{"value": boolean}` → `200 {"ok":true}`
  - 驗證 header：`Authorization: Bearer <DASH_TOKEN>`

- [ ] **Step 1: worker/package.json 與依賴**

```json
{
  "name": "osaka-dashboard-worker",
  "private": true,
  "type": "module",
  "scripts": {
    "deploy": "wrangler deploy",
    "dev": "wrangler dev",
    "test": "vitest run"
  }
}
```

```powershell
cd worker
npm install hono
npm install -D wrangler vitest @cloudflare/workers-types typescript
```

- [ ] **Step 2: wrangler.toml**

```toml
name = "osaka-dashboard"
main = "src/index.ts"
compatibility_date = "2026-07-01"

[[d1_databases]]
binding = "DB"
database_name = "osaka-trip"
database_id = "PLACEHOLDER_填入_wrangler_d1_create_的輸出"
```

- [ ] **Step 3: schema.sql**

```sql
CREATE TABLE IF NOT EXISTS state (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

- [ ] **Step 4: 寫失敗測試**

```ts
// worker/test/worker.test.ts
import { describe, it, expect } from 'vitest';
import app from '../src/index';

/** 極簡 in-memory D1 假件，只支援本 Worker 用到的語法 */
function fakeD1() {
  const rows = new Map<string, { key: string; value: string; updated_at: string }>();
  return {
    prepare(sql: string) {
      return {
        bind(...args: string[]) {
          return {
            async run() {
              rows.set(args[0], { key: args[0], value: args[1], updated_at: args[2] });
              return { success: true };
            },
          };
        },
        async all() {
          return { results: [...rows.values()] };
        },
      };
    },
  };
}

const env = { DB: fakeD1() as unknown, DASH_TOKEN: 'secret123' };
const auth = { Authorization: 'Bearer secret123' };

describe('worker API', () => {
  it('無 token 拒絕', async () => {
    const res = await app.request('/api/state', {}, env);
    expect(res.status).toBe(401);
  });

  it('錯 token 拒絕', async () => {
    const res = await app.request('/api/state', { headers: { Authorization: 'Bearer wrong' } }, env);
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
});
```

Run: `cd worker && npx vitest run`
Expected: FAIL（找不到 `../src/index`）

- [ ] **Step 5: 實作 worker/src/index.ts**

```ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = { DB: D1Database; DASH_TOKEN: string };
const app = new Hono<{ Bindings: Bindings }>();

app.use('/api/*', cors({
  origin: ['https://hsjinde.github.io', 'http://localhost:5173'],
  allowMethods: ['GET', 'PUT', 'OPTIONS'],
  allowHeaders: ['Authorization', 'Content-Type'],
}));

app.use('/api/*', async (c, next) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.DASH_TOKEN}`) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  await next();
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

`worker/tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "bundler",
    "strict": true, "types": ["@cloudflare/workers-types"], "noEmit": true
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 6: 跑測試確認通過**

Run: `cd worker && npx vitest run`
Expected: PASS（4 案例）

- [ ] **Step 7: 佈建到 Cloudflare**（遵循 `.claude/skills/cloudflare-use` 的 token 注入規範）

```powershell
# 於專案根目錄，token 從 .env 注入（不得輸出 token）
$env:CLOUDFLARE_API_TOKEN = Get-Content .env | Where-Object { $_ -match '^CLOUDFLARE_API_TOKEN=' } | ForEach-Object { ($_ -split '=', 2)[1] }
cd worker
npx wrangler d1 create osaka-trip
# → 把輸出的 database_id 填進 wrangler.toml
npx wrangler d1 execute osaka-trip --file=schema.sql --remote
npx wrangler deploy
npx wrangler secret put DASH_TOKEN
# → 請使用者提供一組通行密碼（或產一組隨機字串並告知使用者）
```

Expected: deploy 輸出 `https://osaka-dashboard.<subdomain>.workers.dev`。記下此 URL 供 Task 18/19。

注意：現有 D1 token 權限若只涵蓋既有資源，`d1 create` 可能 403——此時請使用者到 Cloudflare Dashboard 確認 token 有 Account→D1→Edit 與 Workers Scripts→Edit 權限。

- [ ] **Step 8: 線上煙霧測試**

```powershell
# 401（無 token）
curl -s -o /dev/null -w "%{http_code}" https://osaka-dashboard.<subdomain>.workers.dev/api/state
# 200（帶通行密碼）
curl -s -H "Authorization: Bearer <通行密碼>" https://osaka-dashboard.<subdomain>.workers.dev/api/state
```
Expected: `401` 與 `{}`。

- [ ] **Step 9: Commit**

```bash
git add worker/
git commit -m "feat: Cloudflare Worker + D1 狀態 API"
```

---

### Task 18: 前端串接 Worker（React Query + 樂觀更新 + 離線佇列）

**Files:**
- Create: `src/api/state.ts`
- Modify: `src/state/store.tsx`（內部改用 Worker，**API 不變**）、`src/main.tsx`（QueryClientProvider）、`src/App.tsx`（header 加 ⚙ 設定與離線指示）
- Test: `src/api/__tests__/state.test.ts`
- Modify: `.env`（`VITE_API_BASE=https://osaka-dashboard.<subdomain>.workers.dev`）

**Interfaces:**
- Consumes: Task 17 API、Task 10 store API（不變）
- Produces:

```ts
// src/api/state.ts
export function getToken(): string | null;            // localStorage 'osaka-dash-token'
export function setToken(t: string): void;
export function fetchState(): Promise<Record<string, boolean>>;  // throws on !ok
export function putState(key: string, value: boolean): Promise<void>;
export function queuePut(key: string, value: boolean): void;     // 離線佇列（localStorage 'osaka-state-queue'）
export function flushQueue(): Promise<number>;                   // 回傳成功送出筆數
```

- [ ] **Step 1: 寫失敗測試（佇列邏輯，fetch 用 vi.stubGlobal 模擬）**

```ts
// src/api/__tests__/state.test.ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queuePut, flushQueue, setToken } from '../state';

describe('offline queue', () => {
  beforeEach(() => {
    localStorage.clear();
    setToken('t');
  });

  it('queuePut 累積、flushQueue 送出並清空', async () => {
    queuePut('fav:a', true);
    queuePut('fav:b', false);
    queuePut('fav:a', false); // 同 key 後蓋前
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(String(url));
      return new Response('{"ok":true}', { status: 200 });
    }));
    const n = await flushQueue();
    expect(n).toBe(2); // a、b 各一筆（a 取最後值）
    expect(localStorage.getItem('osaka-state-queue')).toBeNull();
  });

  it('送出失敗保留佇列', async () => {
    queuePut('fav:a', true);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('err', { status: 500 })));
    await expect(flushQueue()).resolves.toBe(0);
    expect(JSON.parse(localStorage.getItem('osaka-state-queue')!)).toHaveProperty('fav:a');
  });
});
```

Run: `npx vitest run src/api/__tests__/state.test.ts`
Expected: FAIL（找不到 `../state`）

- [ ] **Step 2: 實作 src/api/state.ts**

```ts
// src/api/state.ts
const BASE = import.meta.env.VITE_API_BASE as string | undefined;
const TOKEN_KEY = 'osaka-dash-token';
const QUEUE_KEY = 'osaka-state-queue';

export function getToken(): string | null { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t: string): void { localStorage.setItem(TOKEN_KEY, t); }
export function configured(): boolean { return !!BASE && !!getToken(); }

function headers(): HeadersInit {
  return { Authorization: `Bearer ${getToken() ?? ''}`, 'Content-Type': 'application/json' };
}

export async function fetchState(): Promise<Record<string, boolean>> {
  const res = await fetch(`${BASE}/api/state`, { headers: headers() });
  if (!res.ok) throw new Error(`GET state ${res.status}`);
  return res.json();
}

export async function putState(key: string, value: boolean): Promise<void> {
  const res = await fetch(`${BASE}/api/state/${encodeURIComponent(key)}`, {
    method: 'PUT', headers: headers(), body: JSON.stringify({ value }),
  });
  if (!res.ok) throw new Error(`PUT state ${res.status}`);
}

type Queue = Record<string, boolean>;
function readQueue(): Queue {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '{}'); } catch { return {}; }
}

export function queuePut(key: string, value: boolean): void {
  const q = readQueue();
  q[key] = value;
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export async function flushQueue(): Promise<number> {
  const q = readQueue();
  const entries = Object.entries(q);
  if (entries.length === 0) return 0;
  let sent = 0;
  for (const [key, value] of entries) {
    try {
      await putState(key, value);
      delete q[key];
      sent++;
    } catch { break; }
  }
  if (Object.keys(q).length === 0) localStorage.removeItem(QUEUE_KEY);
  else localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  return sent;
}
```

- [ ] **Step 3: 跑測試確認通過**

Run: `npx vitest run src/api/__tests__/state.test.ts`
Expected: PASS（2 案例）

- [ ] **Step 4: store.tsx 改接 Worker（對外 API 不變）**

```tsx
// src/state/store.tsx（覆寫）
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { entities, todos } from '../data';
import { configured, fetchState, flushQueue, putState, queuePut } from '../api/state';

const LS_KEY = 'osaka-trip-state';
type StateMap = Record<string, boolean>;

function defaults(): StateMap {
  const d: StateMap = {};
  for (const e of entities) if (e.favorite) d[`fav:${e.id}`] = true;
  for (const t of todos) if (t.checkedInVault) d[t.key] = true;
  return d;
}
function loadLocal(): StateMap {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}'); } catch { return {}; }
}
function saveLocal(s: StateMap) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* 忽略 */ }
}

interface TripState {
  favs: StateMap; todosState: StateMap;
  toggleFav(entityId: string): void; toggleTodo(key: string): void;
  isFav(entityId: string): boolean; favCount: number; offline: boolean;
}
const Ctx = createContext<TripState | null>(null);

export function TripStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StateMap>(() => ({ ...defaults(), ...loadLocal() }));
  const [offline, setOffline] = useState(false);

  // 啟動：拉遠端狀態合併（遠端優先），並補送離線佇列
  useEffect(() => {
    if (!configured()) { setOffline(true); return; }
    let cancelled = false;
    (async () => {
      try {
        await flushQueue();
        const remote = await fetchState();
        if (cancelled) return;
        setState((s) => { const merged = { ...s, ...remote }; saveLocal(merged); return merged; });
        setOffline(false);
      } catch { if (!cancelled) setOffline(true); }
    })();
    const onOnline = () => { flushQueue().then((n) => { if (n > 0) setOffline(false); }); };
    window.addEventListener('online', onOnline);
    return () => { cancelled = true; window.removeEventListener('online', onOnline); };
  }, []);

  const toggle = useCallback((key: string) => {
    setState((s) => {
      const value = !s[key];
      const next = { ...s, [key]: value };
      saveLocal(next);
      if (configured()) {
        putState(key, value).then(() => setOffline(false)).catch(() => { queuePut(key, value); setOffline(true); });
      } else {
        setOffline(true);
      }
      return next;
    });
  }, []);

  const value = useMemo<TripState>(() => {
    const favs: StateMap = {}; const todosState: StateMap = {};
    for (const [k, v] of Object.entries(state)) {
      if (k.startsWith('fav:')) favs[k] = v;
      else if (k.startsWith('todo:')) todosState[k] = v;
    }
    return {
      favs, todosState,
      toggleFav: (id) => toggle(`fav:${id}`),
      toggleTodo: (key) => toggle(key),
      isFav: (id) => !!state[`fav:${id}`],
      favCount: Object.entries(favs).filter(([, v]) => v).length,
      offline,
    };
  }, [state, toggle, offline]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTripState(): TripState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTripState 必須在 TripStateProvider 內使用');
  return ctx;
}
```

（實作後發現不需要 React Query 也能完成樂觀更新＋佇列，且少一個依賴；spec 提及 TanStack Query 作為手段而非目標——若執行者判斷用 React Query 實作更穩，可改用 `useQuery(['state'])` + `useMutation` 包裝同樣行為，對外 API 不變。兩者皆符合驗收。）

- [ ] **Step 5: App.tsx header 加設定鈕與離線指示**

在 header 倒數徽章後加：

```tsx
import { useTripState } from './state/store';
import { getToken, setToken } from './api/state';
// App() 內：
const { offline } = useTripState();
// JSX（倒數徽章之後）：
<button className="btn-plain" title="設定通行密碼" style={{ fontSize: 18, cursor: 'pointer' }}
  onClick={() => {
    const t = window.prompt('輸入儀表板通行密碼（存在此裝置）', getToken() ?? '');
    if (t) { setToken(t); location.reload(); }
  }}>⚙</button>
{offline && (
  <span style={{ fontSize: 11, color: 'var(--brown)', border: '1px dashed var(--brown)', borderRadius: 4, padding: '2px 8px' }}>
    離線模式・變更暫存本機
  </span>
)}
```

（`useTripState` 需在 Provider 內——App 已被 Provider 包住，直接可用。）

- [ ] **Step 6: .env 補 `VITE_API_BASE=<Task 17 的 worker URL>`，端對端驗證**

Run: `npm run dev` → preview：⚙ 輸入通行密碼 → 按幾個 ♥ → 換無痕視窗（同密碼）確認收藏同步；`worker` 停用密碼測離線條顯示。
用 `node .claude/skills/cloudflare-use/scripts/d1-query.cjs "SELECT * FROM state;"`（若腳本存在）或 curl GET 驗證 D1 有資料。
Expected: 跨視窗同步成功、D1 有 `fav:` 列。

- [ ] **Step 7: 全測試**

Run: `npm test && cd worker && npx vitest run && cd ..`
Expected: 全綠。

- [ ] **Step 8: Commit**

```bash
git add src/ .env.example
git commit -m "feat: 收藏/待辦跨裝置同步（Worker + 樂觀更新 + 離線佇列）"
```

（順手建 `.env.example` 記錄 `NOTES_DIR`/`VITE_API_BASE`/`CLOUDFLARE_*` 欄位名，不含值。）

---

### Task 19: CI/CD 與上線

**Files:**
- Create: `.github/workflows/deploy.yml`
- Create: `D:\大阪-vault\.github\workflows\notify-dashboard.yml`
- Modify: 無

**Interfaces:**
- Consumes: Task 7 build:data、Task 18 `VITE_API_BASE`

- [ ] **Step 1: deploy.yml**

```yaml
name: deploy
on:
  push:
    branches: [main]
  repository_dispatch:
    types: [vault-updated]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/checkout@v4
        with:
          repository: hsjinde/Osaka-vault
          path: vault
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build:data
        env:
          NOTES_DIR: ${{ github.workspace }}/vault
      - run: npm run build
        env:
          VITE_API_BASE: ${{ vars.VITE_API_BASE }}
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: vault 通知 workflow（寫入 D:\大阪-vault）**

```yaml
# D:\大阪-vault\.github\workflows\notify-dashboard.yml
name: notify-dashboard
on:
  push:
    branches: [main]
jobs:
  dispatch:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Osaka-web rebuild
        run: |
          curl -sf -X POST \
            -H "Authorization: Bearer ${{ secrets.OSAKA_WEB_PAT }}" \
            -H "Accept: application/vnd.github+json" \
            https://api.github.com/repos/hsjinde/Osaka-web/dispatches \
            -d '{"event_type":"vault-updated"}'
```

commit 進 vault 並 push（同 Task 6 Step 3 方式）。

注意：vault 預設分支需確認（`git -C "D:\大阪-vault" branch --show-current`），若是 `master` 就把 `branches: [main]` 改成實際名稱。

- [ ] **Step 3: 建 GitHub repo 並推送（需使用者配合的手動步驟，逐一引導）**

1. 請使用者到 https://github.com/new 建立 `hsjinde/Osaka-web`（public，GitHub Pages 免費版需 public）
2. 本地：

```powershell
git branch -M main
git remote add origin https://github.com/hsjinde/Osaka-web.git
git push -u origin main
```

3. 請使用者到 repo Settings → Pages → Source 選 **GitHub Actions**
4. 請使用者到 repo Settings → Secrets and variables → Actions → **Variables** 加 `VITE_API_BASE` = worker URL
5. 請使用者建立 fine-grained PAT（Settings → Developer settings → Fine-grained tokens）：Repository access 僅 `Osaka-web`，權限 Contents: Read and write（repository_dispatch 需要）→ 把 PAT 存到 **Osaka-vault** repo 的 Secrets 取名 `OSAKA_WEB_PAT`

- [ ] **Step 4: 端對端驗證**

1. `workflow_dispatch` 手動跑一次 deploy → Expected: Actions 綠勾、`https://hsjinde.github.io/Osaka-web/` 開得起來、六頁正常
2. 在 Obsidian 改 `wiki/dashboard/每日行程.md` 任一時段文字 → push vault → Expected: notify-dashboard 綠勾 → Osaka-web deploy 自動觸發 → 約 2 分鐘後網站顯示新文字
3. 手機開網站 → ⚙ 輸入通行密碼 → 按 ♥ → 電腦重新整理同步

- [ ] **Step 5: Commit**

```bash
git add .github/
git commit -m "ci: GitHub Pages 部署 + vault 更新自動重建"
git push
```

---

### Task 20: README 使用說明

**Files:**
- Create: `README.md`

- [ ] **Step 1: 撰寫 README.md**

```markdown
# 大阪行程儀表板

和風紙質風格的大阪旅遊儀表板。內容來自 [Osaka-vault](https://github.com/hsjinde/Osaka-vault)（Obsidian），
收藏與待辦狀態存 Cloudflare D1 跨裝置同步。

**網站：** https://hsjinde.github.io/Osaka-web/

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
    npm test           # 解析器 + store 測試
    cd worker && npx vitest run   # Worker API 測試

`.env` 欄位見 `.env.example`。

## 架構

- **內容**：vault markdown --(build:data + Zod)--> JSON --> Vite build --> GitHub Pages
- **狀態**：前端 --(Bearer 通行密碼)--> Cloudflare Worker --> D1（osaka-trip）
- **自動重建**：Osaka-vault push --> repository_dispatch --> Osaka-web deploy workflow

設計文件：`docs/superpowers/specs/2026-07-05-osaka-dashboard-design.md`
```

- [ ] **Step 2: Commit + push**

```bash
git add README.md
git commit -m "docs: README 使用說明"
git push
```

---

## Self-Review 紀錄

- **Spec 覆蓋**：§2 三資料流→Task 7/17/18/19；§3 vault 格式→Task 4/5/6；§4 前端結構→Task 8–16；§5 Worker/D1→Task 17；§6 CI/CD→Task 19；§7 錯誤處理→Task 7（建置報錯）/18（離線）；§8 測試→Task 2–5/10/17/18；README→Task 20。無缺口。
- **偏差註記**：spec 提及 TanStack Query；Task 18 提供不用它的等價實作並註明兩者皆可（對外 API 不變）。spec 的「頁尾統計」以建置時間呈現（Task 9）。
- **型別一致性**：`Entity/Day/DaySlot/TodoItem/Meta` 全部源自 `src/data/schema.ts`（Task 3）；`useTripState` API 在 Task 10 定義、Task 18 保持不變；Worker API 介面 Task 17 定義、Task 18 遵循。

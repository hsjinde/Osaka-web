# 交通票券圖片顯示（entity 圖片管線）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 5 個交通 entity 已嵌入的 6 張路線圖／列車外觀圖顯示在網站交通頁，做法沿用攻略既有的「vault 相對嵌入 → build 改寫 R2 網址 → 上傳 R2」機制並擴及所有 entity。

**Architecture:** build 端把 entity body 的 Obsidian 圖片嵌入 `![[x]]` 轉標準 markdown 並改寫成 R2 encode 網址（新增純函式集中在 `scripts/lib/guide-images.ts`）；前端交通頁把「砍基本資訊」的 regex 收斂成不吞圖；圖片上傳改在 CI（Linux）用現有 secret 執行。vault 內容完全不動。

**Tech Stack:** TypeScript、Vite/React、Zod、`tsx`（跑 build/sync 腳本）、Vitest（測試）、oxlint（lint）、Cloudflare R2 + wrangler、GitHub Actions。

## Global Constraints

- 測試框架 **Vitest**（非 Jest）；元件測試用 `@testing-library/react` + `jsdom`。單檔測試：`npx vitest run <path>`。
- Lint 用 **oxlint**（非 ESLint）：`npm run lint`。型別檢查走 `npm run build`（`tsc -b && vite build`）。
- 專案為 ESM（`package.json` `"type": "module"`）；新檔用 ESM `import`。腳本以 `tsx` 執行。
- **不改 vault**（`D:\Osaka-vault`）：不搬圖、不改名、不改嵌入語法。
- **不手改 `src/data/*.json`**（build 產物；CI 由 vault 重建）。本機驗證跑完 `build:data` 後**丟棄** `src/data` 變更。
- **攻略圖片網址輸出不得回歸**：`guideImageKey` 重構後輸出需與現況完全相同（不套 encode）。
- R2 public base：`process.env.R2_PUBLIC_URL_PREFIX || 'https://img.19980803.xyz'`（尾斜線去除）。
- R2 bucket：`process.env.CLOUDFLARE_R2_BUCKET_NAME || 'core-pulse-assets'`。
- R2 key 規則：`osaka/<guides|entities>/<圖片父資料夾>/<檔名>`。
- `worker/` 為獨立專案，本計畫不涉及。
- Commit 只在使用者同意時進行；本計畫在 `main` 上，執行時先開 feature 分支（或 worktree）再動工。

---

## File Structure

| 檔案 | 動作 | 責任 |
|---|---|---|
| `scripts/lib/guide-images.ts` | 修改 | 圖片工具集中處：新增 `embedsToImageMarkdown`、`imageKey`、`toPublicUrl`、`entityImageUrl`、`collectEntityImageFiles`；`guideImageKey` 重構為 `imageKey(…,'guides')` 薄包裝 |
| `scripts/lib/__tests__/guide-images.test.ts` | 修改 | 上述新函式的單元測試（純函式 + 暫存 vault fs 測試） |
| `scripts/lib/parse-entity.ts` | 修改 | `stripWikilinks` 前先跑 `embedsToImageMarkdown`，讓圖片嵌入存活 |
| `scripts/lib/__tests__/parse-entity.test.ts` | 修改 | 驗證圖片嵌入轉標準 markdown、summary 不受影響 |
| `scripts/build-data.ts` | 修改 | `assetRoots`/`r2Base` 上移；entity 解析後用 `entityImageUrl` 改寫 body 圖片網址 |
| `src/lib/entity-body.ts` | 建立 | 純函式 `stripEntityCardBody`：砍基本資訊項目與來源段，但保留圖片 |
| `src/lib/__tests__/entity-body.test.ts` | 建立 | `stripEntityCardBody` 單元測試 |
| `src/pages/Transport.tsx` | 修改 | 改用 `stripEntityCardBody` 取代 inline regex |
| `scripts/sync-guide-images.ts` | 修改 | 上傳 R2 時也涵蓋 entity 圖片（`collectEntityImageFiles`） |
| `.github/workflows/deploy.yml` | 修改 | `deploy-cf-pages` job 加一步 `sync:images`，用現有 secret |

依賴順序：Task 1 → 2 → 3（資料管線）；Task 4（前端，獨立）；Task 5 → 6（上傳，依賴 Task 1 的 `collectEntityImageFiles`）。

---

### Task 1：圖片工具新函式（`scripts/lib/guide-images.ts`）

**Files:**
- Modify: `scripts/lib/guide-images.ts`
- Test: `scripts/lib/__tests__/guide-images.test.ts`

**Interfaces:**
- Consumes: 既有 `resolveGuideImage`、`extractImageSrcs`（同檔）；`CATEGORIES`（`../../src/data/schema`）。
- Produces（後續任務會用到的簽名）：
  - `embedsToImageMarkdown(s: string): string`
  - `imageKey(absPath: string, prefix: 'guides' | 'entities'): string`
  - `toPublicUrl(base: string, key: string): string`
  - `entityImageUrl(src: string, entityDir: string, assetRoots: string[], r2Base: string): string | null`
  - `collectEntityImageFiles(vault: string, assetRoots: string[]): Map<string, string>`（key→絕對路徑）
  - `guideImageKey(absPath: string): string`（輸出不變）

- [ ] **Step 1：擴充測試 import 並加 `embedsToImageMarkdown` 失敗測試**

在 `scripts/lib/__tests__/guide-images.test.ts` 最上方，把 import 改成：

```ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  guideImageKey,
  imageKey,
  toPublicUrl,
  embedsToImageMarkdown,
  entityImageUrl,
  collectEntityImageFiles,
  rewriteImageUrls,
} from '../guide-images';
```

並在檔案尾端新增：

```ts
describe('embedsToImageMarkdown', () => {
  it('圖片嵌入轉標準 markdown（含中文檔名）', () => {
    expect(embedsToImageMarkdown('![[a.jpg]]')).toBe('![](a.jpg)');
    expect(embedsToImageMarkdown('![[JR-HARUKA-路線圖.jpg]]')).toBe('![](JR-HARUKA-路線圖.jpg)');
  });
  it('丟棄 |尺寸 與 #anchor', () => {
    expect(embedsToImageMarkdown('![[a.png|300]]')).toBe('![](a.png)');
    expect(embedsToImageMarkdown('![[dir/b.gif#x]]')).toBe('![](dir/b.gif)');
  });
  it('副檔名大小寫皆可', () => {
    expect(embedsToImageMarkdown('![[a.JPG]]')).toBe('![](a.JPG)');
  });
  it('非圖片嵌入（無圖片副檔名）不轉', () => {
    expect(embedsToImageMarkdown('![[某筆記]]')).toBe('![[某筆記]]');
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run scripts/lib/__tests__/guide-images.test.ts`
Expected: FAIL（`embedsToImageMarkdown` 未匯出 / 不是 function）

- [ ] **Step 3：實作 `embedsToImageMarkdown`**

在 `scripts/lib/guide-images.ts` 尾端新增：

```ts
/** 把 Obsidian 圖片嵌入 `![[檔.副檔名]]`（可含 |尺寸 或 #anchor）轉成標準 markdown `![](檔.副檔名)`。
 *  非圖片副檔名的嵌入（如 `![[某筆記]]`）不動。 */
export function embedsToImageMarkdown(s: string): string {
  return s.replace(
    /!\[\[([^\]|#]+?\.(?:png|jpe?g|gif|webp|avif|svg))(?:[|#][^\]]*)?\]\]/gi,
    '![]($1)',
  );
}
```

- [ ] **Step 4：跑測試確認 `embedsToImageMarkdown` 通過**

Run: `npx vitest run scripts/lib/__tests__/guide-images.test.ts -t embedsToImageMarkdown`
Expected: PASS

- [ ] **Step 5：加 `imageKey` / `toPublicUrl` 失敗測試**

在 `guide-images.test.ts` 尾端新增：

```ts
describe('imageKey', () => {
  it('entities 前綴＋父資料夾＋檔名', () => {
    expect(imageKey('/v/assets/交通/JR-HARUKA-路線圖.jpg', 'entities'))
      .toBe('osaka/entities/交通/JR-HARUKA-路線圖.jpg');
  });
  it('guideImageKey 等於 imageKey(…, guides)（輸出不回歸）', () => {
    const abs = '/v/原始資料/attachments/threads-zsf4315/image_01.webp';
    expect(guideImageKey(abs)).toBe(imageKey(abs, 'guides'));
    expect(guideImageKey(abs)).toBe('osaka/guides/threads-zsf4315/image_01.webp');
  });
});

describe('toPublicUrl', () => {
  it('中文路徑逐段百分比編碼，/ 不編', () => {
    const key = 'osaka/entities/交通/JR-HARUKA-路線圖.jpg';
    expect(toPublicUrl('https://img.19980803.xyz', key)).toBe(
      'https://img.19980803.xyz/osaka/entities/' +
        encodeURIComponent('交通') + '/' + encodeURIComponent('JR-HARUKA-路線圖.jpg'),
    );
  });
  it('ASCII 不變、末段 - . _ 不編', () => {
    expect(toPublicUrl('https://x', 'a/b/c-d_e.png')).toBe('https://x/a/b/c-d_e.png');
  });
});
```

- [ ] **Step 6：跑測試確認失敗**

Run: `npx vitest run scripts/lib/__tests__/guide-images.test.ts`
Expected: FAIL（`imageKey` / `toPublicUrl` 未匯出）

- [ ] **Step 7：實作 `imageKey` / `toPublicUrl`，並把 `guideImageKey` 重構為薄包裝**

把 `scripts/lib/guide-images.ts` 中現有的：

```ts
export function guideImageKey(absPath: string): string {
  const folder = path.basename(path.dirname(absPath));
  return `osaka/guides/${folder}/${path.basename(absPath)}`;
}
```

改成：

```ts
/** 由圖片檔絕對路徑算出 R2 key：`osaka/<prefix>/<父資料夾>/<檔名>`。 */
export function imageKey(absPath: string, prefix: 'guides' | 'entities'): string {
  const folder = path.basename(path.dirname(absPath));
  return `osaka/${prefix}/${folder}/${path.basename(absPath)}`;
}

/** 保留原簽名，內部改用 imageKey（輸出不變）。 */
export function guideImageKey(absPath: string): string {
  return imageKey(absPath, 'guides');
}

/** 由 base + key 組公開網址；key 逐段 encodeURIComponent（中文安全，`/` 不編）。 */
export function toPublicUrl(base: string, key: string): string {
  return `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;
}
```

- [ ] **Step 8：跑測試確認 imageKey/toPublicUrl 通過且 guideImageKey 不回歸**

Run: `npx vitest run scripts/lib/__tests__/guide-images.test.ts`
Expected: PASS（含既有 `guideImageKey` 測試仍綠）

- [ ] **Step 9：加 `entityImageUrl` / `collectEntityImageFiles` 失敗測試（暫存 vault）**

在 `guide-images.test.ts` 尾端新增：

```ts
describe('entityImageUrl / collectEntityImageFiles（暫存 vault）', () => {
  function makeVault(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-'));
    fs.mkdirSync(path.join(root, 'assets/交通'), { recursive: true });
    fs.mkdirSync(path.join(root, 'wiki/entities/交通'), { recursive: true });
    fs.writeFileSync(path.join(root, 'assets/交通/foo.png'), 'x');
    fs.writeFileSync(
      path.join(root, 'wiki/entities/交通/X.md'),
      '---\ntitle: X\n---\n\n介紹\n\n![[foo.png]]\n',
    );
    return root;
  }

  it('entityImageUrl 解析到 assets 內的圖並組 encode 網址', () => {
    const root = makeVault();
    const assetRoots = [path.join(root, 'assets'), path.join(root, '原始資料/attachments')];
    const dir = path.join(root, 'wiki/entities/交通');
    expect(entityImageUrl('foo.png', dir, assetRoots, 'https://img.19980803.xyz'))
      .toBe('https://img.19980803.xyz/osaka/entities/' + encodeURIComponent('交通') + '/foo.png');
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('解析不到回 null', () => {
    const root = makeVault();
    const dir = path.join(root, 'wiki/entities/交通');
    expect(entityImageUrl('missing.png', dir, [path.join(root, 'assets')], 'https://x')).toBeNull();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('collectEntityImageFiles 掃出 entity 圖片（key→絕對路徑）', () => {
    const root = makeVault();
    const assetRoots = [path.join(root, 'assets'), path.join(root, '原始資料/attachments')];
    const files = collectEntityImageFiles(root, assetRoots);
    expect(files.get('osaka/entities/交通/foo.png')).toBe(path.join(root, 'assets/交通/foo.png'));
    fs.rmSync(root, { recursive: true, force: true });
  });
});
```

- [ ] **Step 10：跑測試確認失敗**

Run: `npx vitest run scripts/lib/__tests__/guide-images.test.ts`
Expected: FAIL（`entityImageUrl` / `collectEntityImageFiles` 未匯出）

- [ ] **Step 11：實作 `entityImageUrl` / `collectEntityImageFiles`**

在 `scripts/lib/guide-images.ts` 最上方 import 區加：

```ts
import { CATEGORIES } from '../../src/data/schema';
```

在檔案尾端新增：

```ts
/** entity 圖片 src → R2 encode 公開網址；解析不到回 null。 */
export function entityImageUrl(
  src: string,
  entityDir: string,
  assetRoots: string[],
  r2Base: string,
): string | null {
  const abs = resolveGuideImage(src, entityDir, assetRoots);
  return abs ? toPublicUrl(r2Base, imageKey(abs, 'entities')) : null;
}

/** 掃 vault 各分類 entity 檔，回傳可上傳的圖片（R2 key → 絕對路徑，已去重）。 */
export function collectEntityImageFiles(vault: string, assetRoots: string[]): Map<string, string> {
  const files = new Map<string, string>();
  for (const cat of CATEGORIES) {
    const dir = path.join(vault, 'wiki/entities', cat);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.md'))) {
      const body = embedsToImageMarkdown(fs.readFileSync(path.join(dir, f), 'utf8'));
      for (const src of extractImageSrcs(body)) {
        const abs = resolveGuideImage(src, dir, assetRoots);
        if (abs) files.set(imageKey(abs, 'entities'), abs);
      }
    }
  }
  return files;
}
```

- [ ] **Step 12：跑整檔測試 + lint 確認全綠**

Run: `npx vitest run scripts/lib/__tests__/guide-images.test.ts && npm run lint`
Expected: PASS（所有 guide-images 測試綠、lint 無誤）

- [ ] **Step 13：Commit**

```bash
git add scripts/lib/guide-images.ts scripts/lib/__tests__/guide-images.test.ts
git commit -m "feat(images): 圖片工具新增 entity 嵌入/key/encode/收集函式" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2：parse-entity 讓圖片嵌入存活（`scripts/lib/parse-entity.ts`）

**Files:**
- Modify: `scripts/lib/parse-entity.ts:13`
- Test: `scripts/lib/__tests__/parse-entity.test.ts`

**Interfaces:**
- Consumes: `embedsToImageMarkdown`（Task 1）。
- Produces: `parseEntity(...)` 產出的 `entity.body` 內圖片為標準 `![](檔名)`（供 Task 3 改寫）。

- [ ] **Step 1：加失敗測試**

在 `scripts/lib/__tests__/parse-entity.test.ts` 的 `describe('parseEntity', …)` 內新增：

```ts
  it('圖片嵌入 ![[圖.jpg]] 轉標準 markdown 且不被 stripWikilinks 破壞', () => {
    const raw = REST.replace(
      '道頓堀區域的鰻魚飯專賣店。',
      '道頓堀區域的鰻魚飯專賣店。\n\n![[招牌.jpg]]',
    );
    const e = parseEntity('餐廳', 'X.md', raw);
    expect(e.body).toContain('![](招牌.jpg)');
    expect(e.body).not.toContain('![[招牌.jpg]]');
    expect(e.summary).toBe('道頓堀區域的鰻魚飯專賣店。');
  });
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run scripts/lib/__tests__/parse-entity.test.ts -t 圖片嵌入`
Expected: FAIL（`e.body` 含 `!招牌.jpg`／`![[招牌.jpg]]`，非 `![](招牌.jpg)`）

- [ ] **Step 3：改 parse-entity**

在 `scripts/lib/parse-entity.ts` 最上方 import 區加：

```ts
import { embedsToImageMarkdown } from './guide-images';
```

把：

```ts
    const body = stripWikilinks(content.trim());
```

改成：

```ts
    const body = stripWikilinks(embedsToImageMarkdown(content.trim()));
```

- [ ] **Step 4：跑 parse-entity 全測試確認通過（含既有測試不回歸）**

Run: `npx vitest run scripts/lib/__tests__/parse-entity.test.ts`
Expected: PASS（新測試 + 既有 7 個測試全綠）

- [ ] **Step 5：Commit**

```bash
git add scripts/lib/parse-entity.ts scripts/lib/__tests__/parse-entity.test.ts
git commit -m "feat(images): parse-entity 保留圖片嵌入為標準 markdown" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3：build-data 改寫 entity 圖片網址（`scripts/build-data.ts`）

**Files:**
- Modify: `scripts/build-data.ts`（entity 解析迴圈 + `assetRoots`/`r2Base` 位置）

**Interfaces:**
- Consumes: `entityImageUrl`、`rewriteImageUrls`（Task 1 / 既有）；`parseEntity`（Task 2 產出含 `![](src)` 的 body）。
- Produces: `src/data/entities.json` 內圖片 src 為 `https://img.19980803.xyz/osaka/entities/…`（encode）。

- [ ] **Step 1：改 import**

在 `scripts/build-data.ts` 把：

```ts
import { resolveGuideImage, guideImageKey, rewriteImageUrls } from './lib/guide-images';
```

改成（單行；`resolveGuideImage`/`guideImageKey` 仍供攻略段使用，`entityImageUrl` 新增）：

```ts
import { resolveGuideImage, guideImageKey, rewriteImageUrls, entityImageUrl } from './lib/guide-images';
```

- [ ] **Step 2：把 `r2Base`/`assetRoots` 上移到 entity 迴圈前，並在解析後改寫 body**

找到現有 entity 迴圈：

```ts
  const errors: string[] = [];
  const entities: Entity[] = [];
  for (const cat of CATEGORIES) {
    const dir = path.join(vault, 'wiki/entities', cat);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((f) => isEntityFile(cat, f))) {
      try {
        entities.push(parseEntity(cat, f, fs.readFileSync(path.join(dir, f), 'utf8')));
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
  }
```

改成（在迴圈**前**定義 `r2Base`/`assetRoots`，迴圈內改寫）：

```ts
  const r2Base = (process.env.R2_PUBLIC_URL_PREFIX || 'https://img.19980803.xyz').replace(/\/+$/, '');
  const assetRoots = [path.join(vault, 'assets'), path.join(vault, '原始資料/attachments')];

  const errors: string[] = [];
  const entities: Entity[] = [];
  for (const cat of CATEGORIES) {
    const dir = path.join(vault, 'wiki/entities', cat);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((f) => isEntityFile(cat, f))) {
      try {
        const e = parseEntity(cat, f, fs.readFileSync(path.join(dir, f), 'utf8'));
        e.body = rewriteImageUrls(e.body, (src) => entityImageUrl(src, dir, assetRoots, r2Base));
        entities.push(e);
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
  }
```

- [ ] **Step 3：刪掉攻略段落裡重複的 `r2Base`/`assetRoots` 定義**

找到攻略段落現有的：

```ts
  const guides: Guide[] = [];
  const guidesDir = path.join(vault, '原始資料/別人行程');
  const r2Base = (process.env.R2_PUBLIC_URL_PREFIX || 'https://img.19980803.xyz').replace(/\/+$/, '');
  const assetRoots = [path.join(vault, 'assets'), path.join(vault, '原始資料/attachments')];
```

改成（移除已上移的兩行）：

```ts
  const guides: Guide[] = [];
  const guidesDir = path.join(vault, '原始資料/別人行程');
```

- [ ] **Step 4：對真實 vault 跑 build:data，驗證 6 張圖都變成 encode 的 R2 網址**

Run:
```bash
NOTES_DIR=D:/Osaka-vault npm run build:data
node -e "const e=require('./src/data/entities.json');const t=e.filter(x=>x.category==='交通');const urls=t.flatMap(x=>[...x.body.matchAll(/!\[\]\(([^)]+)\)/g)].map(m=>m[1]));console.log(urls.join('\n'));console.log('count=',urls.length);console.log('allR2=',urls.every(u=>u.startsWith('https://img.19980803.xyz/osaka/entities/')));"
```
Expected: 印出 **6** 條網址，全部以 `https://img.19980803.xyz/osaka/entities/` 開頭（`count= 6`、`allR2= true`），且含百分比編碼（如 `%E4%BA%A4%E9%80%9A`）。建置訊息顯示 `✅ 建置完成`。

- [ ] **Step 5：丟棄 build 產物變更（不提交 JSON）**

Run: `git checkout -- src/data`
Expected: 工作區 `src/data/*.json` 回到提交前狀態（CI 會由 vault 重建；本計畫只提交程式）。

- [ ] **Step 6：跑既有 build-data 單元測試確認不回歸**

Run: `npx vitest run scripts/lib/__tests__/build-data.test.ts`
Expected: PASS

- [ ] **Step 7：Commit**

```bash
git add scripts/build-data.ts
git commit -m "feat(images): build-data 改寫 entity 圖片為 R2 encode 網址" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4：交通頁 strip 收斂（`src/lib/entity-body.ts` + `src/pages/Transport.tsx`）

**Files:**
- Create: `src/lib/entity-body.ts`
- Test: `src/lib/__tests__/entity-body.test.ts`
- Modify: `src/pages/Transport.tsx:17`

**Interfaces:**
- Produces: `stripEntityCardBody(body: string): string`（交通頁卡片用；砍基本資訊項目與來源段，保留圖片）。

- [ ] **Step 1：寫失敗測試**

建立 `src/lib/__tests__/entity-body.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { stripEntityCardBody } from '../entity-body';

const AFTER_BASIC = `介紹文字。

## 基本資訊
- 營運：JR西日本
- 座位：指定席

![](https://img.x/route.jpg)
*路線圖說明*

## 所需時間
- 35 分鐘

## 來源
- 官網`;

const BEFORE_BASIC = `介紹文字。

![](https://img.x/train.jpg)
*外觀*

## 基本資訊
- 路線：關西機場 → 難波
- 官網：<https://x>

## 票價
- ¥1000`;

describe('stripEntityCardBody', () => {
  it('砍基本資訊項目，但保留其後緊接的圖片', () => {
    const out = stripEntityCardBody(AFTER_BASIC);
    expect(out).toContain('![](https://img.x/route.jpg)');
    expect(out).not.toContain('## 基本資訊');
    expect(out).not.toContain('營運：JR西日本');
    expect(out).toContain('## 所需時間');
  });
  it('圖片在基本資訊之前時保留，基本資訊項目仍被砍', () => {
    const out = stripEntityCardBody(BEFORE_BASIC);
    expect(out).toContain('![](https://img.x/train.jpg)');
    expect(out).not.toContain('## 基本資訊');
    expect(out).not.toContain('路線：關西機場');
    expect(out).toContain('## 票價');
  });
  it('砍來源段到結尾', () => {
    expect(stripEntityCardBody(AFTER_BASIC)).not.toContain('## 來源');
  });
  it('無基本資訊時其他內容不動', () => {
    const body = '介紹\n\n![](https://img.x/map.gif)\n\n## 路線一覽\n- A';
    expect(stripEntityCardBody(body)).toContain('![](https://img.x/map.gif)');
    expect(stripEntityCardBody(body)).toContain('## 路線一覽');
  });
});
```

- [ ] **Step 2：跑測試確認失敗**

Run: `npx vitest run src/lib/__tests__/entity-body.test.ts`
Expected: FAIL（找不到 `../entity-body`）

- [ ] **Step 3：實作 `stripEntityCardBody`**

建立 `src/lib/entity-body.ts`：

```ts
/** 交通頁卡片用：移除「## 基本資訊」標題與其後的項目/空行（遇到圖片/內文/下一個標題即停），
 *  以及「## 來源」到結尾。刻意不吞掉基本資訊後緊接的圖片。 */
export function stripEntityCardBody(body: string): string {
  return body
    .replace(/## 基本資訊\n(?:[ \t]*[-*][^\n]*\n?|[ \t]*\n)*/, '')
    .replace(/## 來源[\s\S]*$/, '');
}
```

- [ ] **Step 4：跑測試確認通過**

Run: `npx vitest run src/lib/__tests__/entity-body.test.ts`
Expected: PASS（4 個測試綠）

- [ ] **Step 5：交通頁改用 `stripEntityCardBody`**

在 `src/pages/Transport.tsx` 最上方 import 區加：

```ts
import { stripEntityCardBody } from '../lib/entity-body';
```

把：

```tsx
            <MarkdownBody>{t.body.replace(/## 基本資訊[\s\S]*?(?=\n## |$)/, '').replace(/## 來源[\s\S]*$/, '')}</MarkdownBody>
```

改成：

```tsx
            <MarkdownBody>{stripEntityCardBody(t.body)}</MarkdownBody>
```

- [ ] **Step 6：型別檢查 + lint**

Run: `npm run build && npm run lint`
Expected: PASS（`tsc -b` 無型別錯、vite build 成功、oxlint 無誤）

- [ ] **Step 7：Commit**

```bash
git add src/lib/entity-body.ts src/lib/__tests__/entity-body.test.ts src/pages/Transport.tsx
git commit -m "feat(images): 交通頁 strip 收斂為 stripEntityCardBody，不再吞圖" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5：sync 腳本涵蓋 entity 圖片（`scripts/sync-guide-images.ts`）

**Files:**
- Modify: `scripts/sync-guide-images.ts`

**Interfaces:**
- Consumes: `collectEntityImageFiles`（Task 1）。
- Produces: `npm run sync:images` 上傳的 R2 物件集合含 entity 圖片（key `osaka/entities/…`）。

> 註：此腳本為 top-level 立即執行的 CLI（import 即跑），核心收集邏輯已由 Task 1 的 `collectEntityImageFiles` 單元測試涵蓋；本任務只做「把 entity 圖併入上傳集合」的接線，驗證走 lint/型別 + Task 6 的 CI 實跑。

- [ ] **Step 1：import `collectEntityImageFiles`**

在 `scripts/sync-guide-images.ts` 把：

```ts
import { resolveGuideImage, guideImageKey, extractImageSrcs } from './lib/guide-images';
```

改成：

```ts
import { resolveGuideImage, guideImageKey, extractImageSrcs, collectEntityImageFiles } from './lib/guide-images';
```

- [ ] **Step 2：把 entity 圖片併入 `files` 集合**

找到攻略收集後、`if (files.size === 0)` 之前的位置（即建立並填完 `files` map 之後），插入：

```ts
// entity 圖片（交通等分類）一併上傳
for (const [key, abs] of collectEntityImageFiles(vault, assetRoots)) files.set(key, abs);
```

（`vault`、`assetRoots`、`files` 均為腳本內既有變數。）

- [ ] **Step 3：型別檢查 + lint + 全測試**

Run: `npm run build && npm run lint && npm test`
Expected: PASS（型別無誤、lint 無誤、所有 Vitest 綠——含 Task 1 的 `collectEntityImageFiles` 測試）

- [ ] **Step 4：Commit**

```bash
git add scripts/sync-guide-images.ts
git commit -m "feat(images): sync:images 併入 entity 圖片上傳" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6：CI 加圖片上傳步驟（`.github/workflows/deploy.yml`）

**Files:**
- Modify: `.github/workflows/deploy.yml`（`deploy-cf-pages` job）

**Interfaces:**
- Consumes: 現有 secret `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`；`sync:images`（Task 5）。
- Produces: 每次部署把攻略＋entity 圖片上傳 R2（bucket 走程式預設 `core-pulse-assets`）。

- [ ] **Step 1：在 `deploy-cf-pages` job 加上傳步驟**

在 `.github/workflows/deploy.yml` 的 `deploy-cf-pages` job 中，找到：

```yaml
      - run: npm ci
      - run: npm run build:data
        env:
          NOTES_DIR: ${{ github.workspace }}/vault
```

在 `npm ci` 之後、`build:data` 之前插入 `sync:images` 步驟，變成：

```yaml
      - run: npm ci
      - run: npm run sync:images
        env:
          NOTES_DIR: ${{ github.workspace }}/vault
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
      - run: npm run build:data
        env:
          NOTES_DIR: ${{ github.workspace }}/vault
```

- [ ] **Step 2：本機驗證 YAML 可解析**

Run:
```bash
node -e "const fs=require('fs');const s=fs.readFileSync('.github/workflows/deploy.yml','utf8');const i=s.indexOf('sync:images');console.log('has sync:images step =', i>=0);console.log('has CLOUDFLARE_API_TOKEN in workflow =', s.includes('secrets.CLOUDFLARE_API_TOKEN'));"
```
Expected: `has sync:images step = true`、`has CLOUDFLARE_API_TOKEN in workflow = true`。（YAML 縮排若有 CI parser 更佳；此處以字串存在性為本機關卡。）

- [ ] **Step 3：Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: deploy-cf-pages 加一步 sync:images 上傳 R2 圖片" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 4：CI 實跑驗證（合併/部署後）**

合併到 `main`（或 `workflow_dispatch` 觸發 deploy）後：
1. 開 Actions → `deploy` run → `deploy-cf-pages` job → `sync:images` 步驟，確認**無權限錯誤**（若見 403/AuthenticationError，代表該 token 缺 R2 寫入權限 → 到 Cloudflare 後台替此 token 補 **R2 → Edit**，或換具 R2 權限的 token 更新 secret）。
2. 瀏覽器開任一張圖的 public URL（例：`https://img.19980803.xyz/osaka/entities/交通/大阪地鐵-路線圖.gif`），確認可載入。
3. 開線上交通頁，確認 6 張圖（含 2 張 JR）都正常顯示。

---

## 全域驗證（全部任務完成後）

- [ ] `npm test` 全綠。
- [ ] `npm run lint` 無誤。
- [ ] `npm run build` 成功（型別 + 打包）。
- [ ] `NOTES_DIR=D:/Osaka-vault npm run dev`，交通頁 6 張 `<img>` 都在、版面正常（圖在 CI 首次上傳前為 404，屬預期）。
- [ ] 部署後線上交通頁圖片顯示（依 Task 6 Step 4）。

## 待確認外部項

- `CLOUDFLARE_API_TOKEN` 是否具 R2 寫入權限——由 Task 6 Step 4 的 CI log 得知；失敗則補權限。
- bucket = `core-pulse-assets`（已確認＝程式預設，無需設定）。

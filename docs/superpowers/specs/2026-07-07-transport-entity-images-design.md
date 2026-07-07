# 交通票券圖片顯示（entity 圖片管線）— 設計文件

日期：2026-07-07
狀態：草案（待使用者複審）

## 背景與目標

交通分頁的 5 個票券 entity（`JR-HARUKA關空特急`、`JR關空快速`、`南海電鐵Rapit`、
`大阪地鐵`、`近鐵周遊券`）在 vault 筆記裡已經用 Obsidian 嵌入語法放了路線圖／列車外觀，
但這些圖**目前完全沒顯示在網站**。目標是讓這 6 張圖顯示在交通頁，做法**沿用攻略（guides）
既有的圖片機制**並擴及所有 entity，且 **vault 內容完全不動**（維持 Obsidian 原生嵌入）。

vault 已存在的 6 張圖（皆位於 `D:\Osaka-vault\assets\交通\`）：

| entity 檔 | 嵌入 | 圖檔 | 大小 |
|---|---|---|---|
| `JR-HARUKA關空特急.md` | `![[JR-HARUKA-路線圖.jpg]]` | `assets/交通/JR-HARUKA-路線圖.jpg` | 284KB |
| `JR關空快速.md` | `![[JR關空快速-路線圖.jpg]]` | `assets/交通/JR關空快速-路線圖.jpg` | 290KB |
| `南海電鐵Rapit.md` | `![[南海Rapit-列車外觀.jpg]]` | `assets/交通/南海Rapit-列車外觀.jpg` | 136KB |
| `南海電鐵Rapit.md` | `![[南海Rapit-路線圖.png]]` | `assets/交通/南海Rapit-路線圖.png` | 15KB |
| `大阪地鐵.md` | `![[大阪地鐵-路線圖.gif]]` | `assets/交通/大阪地鐵-路線圖.gif` | 670KB |
| `近鐵周遊券.md` | `![[近鐵周遊券-範圍地圖.png]]` | `assets/交通/近鐵周遊券-範圍地圖.png` | 293KB |

## 現況與缺口

三段管線 `vault markdown → build:data → src/data/*.json → 網站`，圖片在攻略上是這樣運作：
vault 用相對嵌入 →`build-data` 把圖片 src 改寫成 R2 網址（[build-data.ts:77](../../../scripts/build-data.ts)）
→ 本機 `npm run sync:images` 把圖上傳 R2（[sync-guide-images.ts](../../../scripts/sync-guide-images.ts)），
CI 目前只做網址改寫、不上傳（本設計 §F 會改為 CI 也上傳）。**entity 沒有接上這條管線**，另有三個缺口：

1. **`parse-entity` 破壞圖片嵌入**：[parse-entity.ts:13](../../../scripts/lib/parse-entity.ts) 對 body 跑
   `stripWikilinks`，把 `![[圖.jpg]]` 變成 `!圖.jpg`（`[[…]]` 被取最後一段、`!` 殘留），壞掉。
2. **`build-data` 不改寫 entity 圖片網址**：只有攻略呼叫 `rewriteImageUrls`，entity 沒有。
3. **交通頁 strip 會吞圖**：[Transport.tsx:17](../../../src/pages/Transport.tsx) 用
   `/## 基本資訊[\s\S]*?(?=\n## |$)/` 砍掉「`## 基本資訊` 到下一個 `##`」之間**全部**內容。
   `JR-HARUKA` 與 `JR關空快速` 的圖剛好落在這段區間內 → 會被連帶砍掉（已用腳本驗證：6 張裡這 2 張被砍）。

前端渲染本身沒問題：`MarkdownBody`（react-markdown）會渲染 `![](url)`，且
[styles.css:53](../../../src/styles.css) 的 `.md-body img { max-width:100% }` 已處理 RWD。

## 決策（與使用者確認過）

| 議題 | 決定 |
|---|---|
| 方案 | **A：擴充建置管線至 entity**（vault 不動；比照攻略機制） |
| 對象 | 全部 5 個交通 entity 的 6 張圖（未來其他分類 entity 圖片也一併受惠） |
| 圖片來源 | 已在 vault `assets/交通/`，不搬移、不改名 |
| **上傳位置** | **CI 上傳**：`deploy.yml` 的 `deploy-cf-pages` job 加一步 `npm run sync:images`，用現有 `CLOUDFLARE_API_TOKEN` secret。免本機 `.env`。 |
| **R2 bucket** | `core-pulse-assets`（即程式預設，CI 無需額外設定 `CLOUDFLARE_R2_BUCKET_NAME`） |
| 中文檔名 | 保留；網址逐段 `encodeURIComponent`（給瀏覽器）。上傳在 **CI（Linux）**執行，故**無 Windows cmd 中文 key 亂碼問題**，`sync` 上傳機制不需改。 |
| R2 key 規則 | `osaka/entities/<圖片父資料夾>/<檔名>`（比照攻略 `osaka/guides/…`） |
| 攻略行為 | **不變**：guide 的網址產生維持現況（不加 encode），只重構去重、不改輸出 |
| 交通頁 strip | 收斂成「只砍 `## 基本資訊` 標題＋其項目/空行」，圖與後續內容保留 |
| 前端視覺 | 不改（`.md-body img` 已足夠）；不動配色/版式 |

## A. 圖片工具擴充（`scripts/lib/guide-images.ts`）

新增三個純函式（與既有圖片工具同模組，好測試、可被 build-data 與 sync 共用）：

- `embedsToImageMarkdown(s: string): string` — 把 Obsidian 圖片嵌入轉成標準 markdown：
  `![[檔名.副檔名]]` 與含尺寸/別名的 `![[檔名.副檔名|300]]`、`![[檔名.副檔名#anchor]]`
  → `![](檔名.副檔名)`（丟掉 `|`／`#` 之後的部分）。
  副檔名限定圖片類型 `png|jpe?g|gif|webp|avif|svg`（大小寫不拘）；**非圖片副檔名的
  `![[某筆記]]` 不轉**（維持交給 `stripWikilinks` 的現行行為）。
  regex：`/!\[\[([^\]|#]+?\.(?:png|jpe?g|gif|webp|avif|svg))(?:[|#][^\]]*)?\]\]/gi` → `![]($1)`。
- `imageKey(absPath: string, prefix: 'guides' | 'entities'): string` —
  `osaka/${prefix}/${父資料夾}/${檔名}`。現有 `guideImageKey` 改為 `imageKey(abs, 'guides')`
  的薄包裝（輸出不變）。
- `toPublicUrl(base: string, key: string): string` — 逐段 `encodeURIComponent` 後以 `/` 重組：
  `base + '/' + key.split('/').map(encodeURIComponent).join('/')`。中文檔名→百分比編碼，`/` 不被編、
  `-`/`.`/`_` 不被編。**僅 entity 使用**（攻略維持原本 `${r2Base}/${guideImageKey(abs)}`）。

## B. parse-entity：讓圖片嵌入存活（`scripts/lib/parse-entity.ts`）

在呼叫 `stripWikilinks` **之前**先跑 `embedsToImageMarkdown`：

```ts
const withImages = embedsToImageMarkdown(content.trim());
const body = stripWikilinks(withImages);
```

順序很重要：`![[圖.jpg|300]]` 若先進 `stripWikilinks` 會被 `[[a|b]]→b` 規則變成 `!300`；
先轉成 `![](圖.jpg)` 後，`stripWikilinks` 不會碰標準 markdown 圖片（無 `[[`）。
此時 `entity.body` 內圖片為 `![](檔名.jpg)`（src 仍是相對檔名，尚未指到 R2）。
**不改共用的 `stripWikilinks`**（`parse-todos`／`parse-guide` 也在用）。

`summary` 取「第一段非 `#` 開頭段落」——已驗證 6 個檔的圖片都不是第一段（第一段是介紹文字），
故 summary 不受影響，無需調整。

## C. build-data：改寫 entity 圖片網址（`scripts/build-data.ts`）

把 `assetRoots` 與 `r2Base` 的定義**上移**到 entity 解析迴圈之前（目前定義在攻略段落），
在解析每個 entity 後、push 之前，就地改寫 body（此時 category 目錄 `dir` 仍在作用域）：

```ts
const e = parseEntity(cat, f, fs.readFileSync(path.join(dir, f), 'utf8'));
e.body = rewriteImageUrls(e.body, (src) => {
  const abs = resolveGuideImage(src, dir, assetRoots);
  return abs ? toPublicUrl(r2Base, imageKey(abs, 'entities')) : null;
});
entities.push(e);
```

- `resolveGuideImage(src, dir, assetRoots)`：先試 `dir/src`（entity 目錄，通常不存在），
  再以 basename 在 `assetRoots`（`vault/assets`、`vault/原始資料/attachments`）遞迴找 →
  命中 `assets/交通/檔名`。
- 找不到 → 回 `null`，`rewriteImageUrls` 原樣保留該圖（best-effort，不擋建置；可 `console.warn`）。
- 產出：`entities.json` 內 6 張圖 src 變成
  `https://img.19980803.xyz/osaka/entities/%E4%BA%A4%E9%80%9A/JR-HARUKA-%E8%B7%AF%E7%B7%9A%E5%9C%96.jpg` 之類。

## D. 交通頁 strip 收斂（`src/pages/Transport.tsx`）

把 `## 基本資訊` 的移除改成「只砍標題＋其後的項目/空行」，遇到第一個非項目非空行（圖片/內文/下一個標題）就停：

- 抽出純函式 `stripEntityCardBody(body: string): string` 到 `src/lib/entity-body.ts`（可單元測試），交通頁改用它。
- 規則：
  ```ts
  body
    .replace(/## 基本資訊\n(?:[ \t]*[-*][^\n]*\n?|[ \t]*\n)*/, '')
    .replace(/## 來源[\s\S]*$/, '');
  ```
- 已用腳本模擬驗證：改後 6 張圖**全部留存**，其餘 4 張與舊行為一致（`南海` 兩張、`大阪地鐵`、`近鐵`）。
- `## 基本資訊` 內容在 5 個交通檔皆為純項目清單，故收斂規則不會殘留欄位文字。

## E. sync 腳本擴充（`scripts/sync-guide-images.ts`）

除攻略外，也掃 `wiki/entities/<分類>/*.md` 收集 entity 圖片一併上傳 R2：

- 對每個 entity 檔：`embedsToImageMarkdown(raw)` → `extractImageSrcs` → 逐一
  `resolveGuideImage(src, entityDir, assetRoots)`，命中者以 `imageKey(abs, 'entities')` 當 key 加入去重 map。
- **上傳機制不改**：沿用現有 `execSync`（`wrangler r2 object put`）。因正式路徑在 CI（Linux）執行，
  UTF-8 中文 key 正常，無 Windows cmd codepage 亂碼問題。（本機 Windows 手動跑仍有此風險——非支援路徑，見風險段。）
- bucket 取 `process.env.CLOUDFLARE_R2_BUCKET_NAME || 'core-pulse-assets'`——預設即 `core-pulse-assets`，CI 無需另設。

## F. CI 圖片上傳（`.github/workflows/deploy.yml`）

在 `deploy-cf-pages` job（已 checkout vault 到 `vault/`、已 `npm ci`）加一步跑上傳，用現有 secret：

```yaml
      - run: npm run sync:images
        env:
          NOTES_DIR: ${{ github.workspace }}/vault
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

- 無需新增 secret；bucket 走程式預設 `core-pulse-assets`。
- 每次部署重傳所有圖（攻略＋entity）；量小、`r2 object put` 冪等（覆蓋），可接受。
- **前提**：`CLOUDFLARE_API_TOKEN` 需具 **R2 寫入**權限（目前用於 Pages，R2 權限未確認）；
  若此步失敗，替該 token 補 R2 → Edit 或換 token。此為主要風險（見下）。

## 測試計畫（Vitest，root）

- `guide-images.test.ts`（或新測試檔）：
  - `embedsToImageMarkdown`：`![[a.jpg]]`→`![](a.jpg)`；`![[a.png|300]]`→`![](a.png)`；
    `![[a.gif#x]]`→`![](a.gif)`；非圖片 `![[某筆記]]` 不變；多張混合。
  - `imageKey`：`entities` 與 `guides` 前綴、父資料夾正確。
  - `toPublicUrl`：中文檔名逐段編碼、`/` 不編、ASCII 不變。
- `parse-entity.test.ts`：含 `![[圖.jpg]]` 的 body → 產出 `![](圖.jpg)`（未被 `stripWikilinks` 破壞），
  且 `summary`／`fields` 不受影響。
- `build-data` entity 改寫：以假 vault（比照現有測試作法）驗證 body 內相對圖 → R2 encode 網址；找不到者原樣保留。
- `stripEntityCardBody`：`## 基本資訊` 後緊接圖片時圖片留存；圖在基本資訊之前/之後皆正確；`## 來源` 到結尾被砍。

## 邊界與風險

- **token R2 權限（主要風險）**：現有 `CLOUDFLARE_API_TOKEN` 目前用於 Pages 部署，是否含 R2 寫入未確認。
  若 CI 上傳步驟失敗（權限），需替該 token 補 R2 → Edit 或換 token。除此之外整條管線無其他外部相依。
- **中文檔名／key**：網址逐段 `encodeURIComponent`（build 端）確保瀏覽器可取；R2 以原始 UTF-8 key 存，
  CF 會把百分比編碼路徑解回比對。上傳在 CI（Linux）故無 cmd codepage 亂碼。
  *Caveat*：本機 Windows 手動跑 `sync:images` 對中文 key 可能亂碼——非支援路徑（正式路徑走 CI）。
- **Obsidian 尺寸語法** `![[img|300]]`：轉換時丟棄尺寸，react-markdown 本就不支援。
- **CI 重複上傳**：每次部署重傳所有圖；量小、冪等，暫不最佳化。
- **guide 行為不回歸**：攻略網址產生維持不變（不套 encode），僅 `guideImageKey` 重構為薄包裝，輸出相同。

## 需要的外部輸入

- **R2 bucket**：`core-pulse-assets`（已確認＝程式預設，CI 無需設定）。✅
- **CI secret**：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID` 已在 GitHub Actions（已確認）。✅
- **待確認**：`CLOUDFLARE_API_TOKEN` 是否具 **R2 寫入**權限。無法本機驗證；由第一次 CI 上傳步驟結果得知
  （失敗則於 Cloudflare 後台補 R2 → Edit）。

程式碼與單元測試不依賴上述任何一項即可完成並驗證（`build:data` 產出正確網址、測試綠燈、
本機 `npm run dev` 預覽網址正確，只是圖在 CI 首次上傳前會 404）。

## 驗證方式

1. `npm test`（root）綠燈，含上述新測試。
2. `NOTES_DIR=D:/Osaka-vault npm run build:data` 成功；`entities.json` 6 張圖 src 變成
   `https://img.19980803.xyz/osaka/entities/…`（百分比編碼）。
3. `npm run lint`。
4. `npm run dev` 交通頁：6 張圖的 `<img>` 都在（含 2 張 JR，先前會被 strip），版面正常（圖 404 屬未上傳）。
5. 合併到 main（或 `workflow_dispatch` 觸發）後，`deploy-cf-pages` 的 `sync:images` 步驟成功：
   檢查 Actions log 無權限錯誤，並載入某張 public URL 確認可取回。
6. 部署完成後，線上交通頁 6 張圖正常顯示。

## 非目標

- 不改 vault 內容（不搬圖、不改名、不改嵌入語法）。
- 不動前端配色/版式/字體，不新增圖片燈箱或縮圖等功能。
- 不改攻略既有的圖片網址輸出。
- 不做 CI 上傳的冪等最佳化（重複上傳可接受）。

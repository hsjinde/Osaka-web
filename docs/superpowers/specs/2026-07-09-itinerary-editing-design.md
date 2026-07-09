# 每日行程時間軸編輯功能 — 設計

## 目標

在「每日行程 → 時間軸」檢視加入編輯能力，讓使用者能新增/修改/刪除/排序時段；
編輯即時反映到同頁的時間軸、卡片、地圖三檢視；並把整份行程 commit 回 Osaka-vault
（經 Worker 代理），觸發既有部署管線重建網站。

## 決策（brainstorming 結論）

- **編輯位置**：正式站可編輯，並直接 commit 到 GitHub（Osaka-vault repo）。
- **commit 管道**：經 Worker 代理。GitHub token 存 Worker secret，前端用現有 `DASH_TOKEN` 授權呼叫 Worker，
  前端永遠拿不到 GitHub token。
- **編輯範圍**：時段全功能（時間 / 標題 / 備註、新增、刪除、上下排序、待安排切換）。
  當天主題 / 日期 / 區域、整天新增刪除 **不開放編輯**。
- **選單來源**：實體庫全部分類（餐廳/景點/購物/交通/住宿），可搜尋；挑一個帶入名稱當標題，
  備註若空則帶入區域。也可純手打。

## 架構

### 兩層更新模型

1. **即時層（React state）**：編輯直接改記憶體中的 `days`，三檢視即時連動。
2. **發佈層（commit 回 vault）**：儲存時序列化整份行程，經 Worker commit 到 Osaka-vault，
   push 觸發 `vault-updated` → Osaka-web 重建 → 新 `days.json` 上線。

### 元件與資料流

```
DailyPlan (時間軸/卡片/地圖三檢視)
   └─ useItinerary()  ← src/state/itinerary.tsx（可編輯 days + localStorage override）
           │ 編輯
           ▼
   serializeDays(days) ─ src/lib/itinerary-md.ts
           │ POST { daySectionsMarkdown }
           ▼
   putItinerary() ─ src/api/itinerary.ts（帶 Bearer DASH_TOKEN）
           │
           ▼
   Worker PUT /api/itinerary ─ worker/src/index.ts
           │ GitHub contents API（前言保留 + 換行程區塊 + sha）
           ▼
   Osaka-vault: wiki/dashboard/每日行程.md  ─→ vault-updated ─→ Osaka-web 重建
```

## 各單元設計

### 1. `src/state/itinerary.tsx` — 可編輯行程狀態

- `ItineraryProvider` + `useItinerary()`：持有 `days: Day[]`，提供編輯操作與儲存。
- **override 疊層**：以 `days.json` 為底；若 localStorage 有 override 且其 `baseBuiltAt` **不早於**
  目前 `meta.builtAt`，才套用該 override。CI 重建後 `meta.builtAt` 變新 → 丟棄 override，改吃已發佈 JSON。
- override 形狀：`{ baseBuiltAt: string; days: Day[] }`，key `osaka-itinerary-override`。
- 介面（草案）：
  - `days: Day[]`
  - `updateSlot(dayIdx, slotIdx, patch: Partial<DaySlot>)`
  - `addSlot(dayIdx)` / `removeSlot(dayIdx, slotIdx)` / `moveSlot(dayIdx, slotIdx, dir: -1|1)`
  - `save(): Promise<void>`（序列化 → putItinerary → 成功後寫 override、失敗保留編輯並拋錯）
  - `reset()`（還原到上次已儲存 / 已發佈狀態）
  - `dirty: boolean`、`saving: boolean`
- 掛在 `App` 或 DailyPlan 外層（僅 DailyPlan 消費 `days`，掛在 DailyPlan 上層即可）。

### 2. DailyPlan 編輯 UI

- 時間軸標題列右上加「編輯」切換：僅在 `configured()`（有 API base + token）可用；
  未登入顯示唯讀，提示先登入。
- 編輯模式：每個時段一列，欄位 = 時間 input、標題（自由打字 + 實體搜尋下拉）、備註 input、
  待安排切換、刪除鈕、上/下移鈕；底部「＋ 新增時段」。
- 標題實體下拉：搜尋 `entities`（顯示 name／category／area），選取後 `title = entity.name`，
  `note` 為空則帶入 `entity.area`。
- 動作列：「儲存並提交」（呼叫 `save()`，含 loading / 成功 / 失敗提示）、「取消」（`reset()`）。
- 卡片、地圖檢視改讀 `useItinerary()` 的 `days`，隨編輯即時更新。

### 3. `src/lib/itinerary-md.ts` — 序列化

- `serializeDays(days: Day[]): string`：`parse-itinerary` 的反向，輸出從第一個 `## Day` 起的行程區塊。
  - Day 標頭：`## {label}｜{date}｜{theme}`
  - 區域：`> 區域：{areas.join('、')}`（無區域則省略該行）
  - 待安排時段：`- {time}｜（待安排）`（不輸出備註）
  - 一般時段：備註非空 `- {time}｜{title}｜{note}`；備註空 `- {time}｜{title}`
  - 每個 Day 之間空一行。
- **前言不失真**：前言（frontmatter + `# 每日行程` + 格式規則那行）不由前端產生，
  由 Worker 從 GitHub 現檔切「第一個 `## Day` 前」的部分保留，僅替換行程區塊。
- 測試：`serialize(parse(現檔)) === 現檔行程區塊`（round-trip）。

### 4. Worker `PUT /api/itinerary`

- 授權：沿用現有中介層，非 GET/OPTIONS/login 一律需 `Bearer DASH_TOKEN`。
- 流程：
  1. 讀 body `{ daySectionsMarkdown: string }`。
  2. `GET https://api.github.com/repos/{owner}/{repo}/contents/{path}?ref={branch}`
     （header `Authorization: Bearer {GITHUB_TOKEN}`、`User-Agent`、`Accept: application/vnd.github+json`）
     → 取 base64 `content` 解碼為 UTF-8、記下 `sha`。
  3. 前言 = 現檔第一個 `## Day` 之前的字串；新內容 = 前言 + `daySectionsMarkdown`。
  4. `PUT` 同路徑，body `{ message, content: base64(UTF-8), sha, branch }`，
     commit 訊息：`chore(itinerary): 從儀表板更新每日行程`。
- **base64 需正確處理中文**（TextEncoder → base64，避免 `btoa` 對非 Latin1 出錯）。
- 設定來源：
  - `worker/wrangler.toml` `[vars]`：`GH_OWNER=hsjinde`、`GH_REPO=Osaka-vault`、
    `GH_BRANCH=main`、`GH_ITINERARY_PATH=wiki/dashboard/每日行程.md`（非機密）。
  - `GITHUB_TOKEN`：fine-grained PAT（Osaka-vault → Contents: Read and write），
    以 `wrangler secret put GITHUB_TOKEN` 由使用者在自己的終端機設定。

### 5. `src/api/itinerary.ts` — 前端 API

- `putItinerary(daySectionsMarkdown: string): Promise<void>`：
  `PUT ${apiBase()}/api/itinerary`，帶 `Authorization: Bearer <token>`、`Content-Type: application/json`，
  body `{ daySectionsMarkdown }`；非 2xx 拋錯（含 409 sha 衝突訊息）。

## 錯誤處理

- **未登入**：編輯關閉（唯讀），提示先登入。
- **commit 失敗**（Worker/GitHub error、網路）：保留 localStorage override（不丟編輯），
  顯示錯誤、允許重試。
- **sha 衝突（409）**：提示「檔案已在他處變更，請重新整理後再試」。單使用者情境下罕見。
- **序列化不可逆內容**：格式規則已限制在前言區，行程區塊全為結構化行，round-trip 測試守住。

## 測試

- `src/lib/__tests__/itinerary-md.test.ts`：round-trip（含待安排、空備註、多區域、單一天）。
- `worker` vitest：mock GitHub fetch，驗證前言保留、sha 帶入、base64 UTF-8 正確、
  未帶 token 回 401。
- （選）DailyPlan 輕量測試：編輯 slot 後三檢視 state 更新。

## 刻意不做（YAGNI）

- 不做行程跨裝置即時同步（不進 D1）；他裝置在重建後才看到編輯。
- 天主題 / 日期 / 區域、整天新增刪除不開放編輯。
- 不在前端持有或處理 GitHub token。

## 使用者需手動一次的事

- 在 GitHub 建 fine-grained PAT（Osaka-vault → Contents: Read and write）。
- 部署 Worker 後，於自己終端機 `cd worker && npx wrangler secret put GITHUB_TOKEN` 設定。
- 補一份本機 `.env`（照 `.env.example`）。

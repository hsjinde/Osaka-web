# 動態效果強化設計（2026-07-09）

## 背景與目標

Osaka-web 目前的動態效果僅有 `fadeUp` 進場、`.card-tap` 點按縮放與摺疊過渡。
使用者希望網站有更多動態效果，並指定參考
[pulkitxm/claude-directory](https://github.com/pulkitxm/claude-directory)
（Claude 生成的 Web UI 實驗 gallery）。該 repo 為獨立示範專案集合而非可安裝套件，
故採「下載參考碼 + 挑選重製」兩段式納入。

## 決策

- **納入方式**：兩者都要——先下載相關原始碼當參考，再重製成符合本站風格的效果。
- **效果範圍**：滾動/進場動畫、和風主題微互動、頁面切換過渡、載入動畫，四類全做。
- **技術選擇**：純 CSS + 原生 API（IntersectionObserver），**零新依賴**；
  不引入 Motion/GSAP。

## A. 參考資源下載

- 用 git sparse-checkout 抓 claude-directory 的 `animations-loaders/`（12 個專案），
  放到 `docs/reference/claude-directory/`。
- **排除影片素材**（`*.mp4` 等），避免 repo 膨脹。
- 該目錄不在 `src/` 下，不進 Vite build，純參考用。

## B. 四類效果設計

### 1. 滾動進場動畫
- 新增 `useReveal` hook（`src/hooks/`）：IntersectionObserver 監看元素進入視窗，
  加上 `.reveal-in` class 觸發淡入上移；支援 stagger 延遲（CSS 變數 `--reveal-delay`）。
- 套用對象：實體卡片列表、每日行程區塊。
- 參考：container-scroll-animation、pallet-ross-landing 的卡片編排概念。

### 2. 和風主題微互動
- `Heart`：收藏切換時 scale pop 彈跳（keyframes）。
- `Stamp`：蓋章動畫——落章縮放 + 微旋轉 + 墨暈擴散感。
- 卡片 hover/tap：延伸現有 `.card-tap`，強化「紙張抬起」陰影。

### 3. 頁面切換過渡
- `App.tsx` tab 切換時以 `key={tab}` 重掛載頁面容器，觸發淡入 + 微滑動過渡。

### 4. 載入動畫
- 新增和風朱印風格的純 CSS loader 元件（`src/components/`），
  用於初次載入與同步中狀態。
- 參考：qclay-hexagon-loader 的結構，改為朱印/家紋視覺。

## 共通原則

- 所有效果收在現有 `prefers-reduced-motion: reduce` 的關閉範圍內。
- 不動資料管線（build-data）與 Worker。
- 顏色沿用現有紙質色票（`src/styles.css` 既有變數）。
- 測試：hook 與元件行為以 Vitest + Testing Library 驗證（動畫本身以 class 切換為斷言點）。

## 不做的事（YAGNI）

- 不引入動畫函式庫。
- 不搬 gallery 的 hero/landing/3D/shader 類專案。
- 不做滾動劫持（scroll-jacking）類效果——與儀表板閱讀體驗衝突。

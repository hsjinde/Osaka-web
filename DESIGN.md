---
name: 大阪旅券 OSAKA TRIP
description: 和風紙質的大阪家庭旅遊儀表板——御朱印帳般的手帳，明亮而有印章儀式感。
colors:
  seal-red: "#B23A1E"
  seal-red-light: "#C24A2A"
  sumi-ink: "#29231A"
  washi-paper: "#F1EBDD"
  fude-card: "#FBF7EC"
  ai-navy: "#2E3A52"
  matcha-green: "#4A6B4F"
  kin-gold: "#E8B44A"
  cha-brown: "#8A7C64"
  cha-brown-light: "#A2957F"
  cha-brown-dark: "#6E6350"
  hairline: "#29231A24"
  hairline-strong: "#29231A40"
  stamp-paper: "#F7F2E6"
typography:
  display:
    fontFamily: "Shippori Mincho, serif"
    fontSize: "72px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "normal"
  headline:
    fontFamily: "Shippori Mincho, serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0.12em"
  title:
    fontFamily: "Shippori Mincho, serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Noto Sans TC, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.75
    letterSpacing: "normal"
  label:
    fontFamily: "Noto Sans TC, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.25em"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
components:
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.sumi-ink}"
    rounded: "{rounded.pill}"
    padding: "7px 16px"
  chip-on:
    backgroundColor: "{colors.sumi-ink}"
    textColor: "{colors.stamp-paper}"
    rounded: "{rounded.pill}"
    padding: "7px 16px"
  chip-on-red:
    backgroundColor: "{colors.seal-red}"
    textColor: "{colors.stamp-paper}"
    rounded: "{rounded.pill}"
    padding: "7px 16px"
  card:
    backgroundColor: "{colors.fude-card}"
    textColor: "{colors.sumi-ink}"
    rounded: "{rounded.lg}"
    padding: "22px 24px"
  input-search:
    backgroundColor: "{colors.fude-card}"
    textColor: "{colors.sumi-ink}"
    rounded: "{rounded.md}"
    padding: "10px 34px 10px 14px"
  button-edit:
    backgroundColor: "transparent"
    textColor: "{colors.seal-red}"
    rounded: "{rounded.sm}"
    padding: "7px 16px"
  banner-dark:
    backgroundColor: "{colors.ai-navy}"
    textColor: "{colors.stamp-paper}"
    rounded: "{rounded.lg}"
    padding: "18px 22px"
  stamp:
    textColor: "{colors.seal-red}"
    rounded: "{rounded.pill}"
    size: "42px"
---

# Design System: 大阪旅券 OSAKA TRIP

## 1. Overview

**Creative North Star: 「大阪旅券・御朱印帳」**

這個介面是一本蓋滿朱印的旅遊手帳。不是行銷頁、不是冷淡的效率工具，而是一本全家共同維護、
期待出發的關西通行證——有和紙的質感、有襯線標題的儀式感、有一枚枚朱印章記錄「這裡去過、
這件辦好了」。使用者在行前規劃、在大阪街頭單手查詢，介面要像翻手帳一樣好翻、好查、看得懂。

系統以**朱印紅**（seal-red `#B23A1E`）為唯一主聲音，落在主行動、當前分頁、警示與收藏動作上；
其餘和風色（藍 `#2E3A52`、綠 `#4A6B4F`、金 `#E8B44A`）各守一種狀態語意，絕不整頁齊放。
底色是溫潤的和紙米（washi-paper `#F1EBDD`）疊一層極淡的橫向紙紋，卡片用更亮一階的
fude-card `#FBF7EC`。字體是 **Shippori Mincho 襯線 + Noto Sans TC 黑體**的對比配對——
襯線扛標題與大數字的儀式感，黑體扛正文與密集資訊的可讀性。

方向上，這套系統正**往更明亮活潑推**：色彩更飽和、對比更清楚、留白更透氣，讓朱印紅與金真正跳出來。
它明確拒絕：**沉悶灰撲撲的「安靜和風」**（低飽和、昏黃、褪色老照片感）；**淡化和風改走
Linear／Notion 中性產品 UI**（識別度不能丟）；以及**無個性的 AI 暖白樣板**（米底＋灰字＋
圓角卡片無限複製、沒印章沒襯線沒紙感）。這裡的暖色靠印章、襯線、紙紋掙來，不是靠把白色染暖。

**Key Characteristics:**
- 和紙米底 + 極淡橫向紙紋，卡片亮一階，層次靠色調不靠陰影
- 朱印紅是唯一主聲音；藍／綠／金各守一種狀態語意
- Shippori Mincho 襯線扛標題與大數字，Noto Sans TC 黑體扛正文
- 印章／圓戳／歪斜旋轉／虛線分隔的手作紙品儀式感
- 行動優先：橫向捲動分頁、觸控目標 ≥36px、單手可用

## 2. Colors

一組溫潤和風的印刷色盤：和紙米作紙，朱印紅作章，藍綠金各司一職。避免任何色彩失去飽和度而發灰。

### Primary
- **朱印紅 Seal Red** (`#B23A1E`)：唯一的主聲音。主行動（登入編輯）、當前分頁 chip、大數字倒數、
  警示提醒（⚠）、收藏愛心開啟態、印章邊框與文字。它的稀有就是重點——出現即代表「這裡要注意」。
- **朱印紅・亮 Seal Red Light** (`#C24A2A`)：hover／按壓時的較亮一階，僅作互動回饋。

### Secondary
- **藍 Ai Navy** (`#2E3A52`)：深色橫幅（收藏統計 banner）與表頭底色的沉穩對比面，
  把亮色系從頭到尾拉出一個深錨點。
- **綠 Matcha Green** (`#4A6B4F`)：完成／確認狀態專用——待辦打勾、飯店「已確認」徽章。綠＝done。
- **金 Kin Gold** (`#E8B44A`)：收藏／已標記的高光數字、搜尋命中反白。金＝「你標記的寶物」。

### Neutral
- **墨 Sumi Ink** (`#29231A`)：正文與標題主色；chip 選中態底色。近黑帶暖，不是純黑。
- **和紙米 Washi Paper** (`#F1EBDD`)：body 底色，疊一層 1.8% 墨色的橫向紙紋。
- **卡紙 Fude Card** (`#FBF7EC`)：卡片／輸入框底，比 body 亮一階，靠色調分層。
- **茶 Cha Brown** (`#8A7C64`) / **茶・淺** (`#A2957F`) / **茶・深** (`#6E6350`)：
  次要文字、佔位字、標籤、頁尾——暖灰梯度，深茶用於需要更高對比的次要文字。
- **界線 Hairline** (`#29231A24`, 14% 墨) / **Hairline Strong** (`#29231A40`, 25% 墨)：
  卡片邊框、虛線分隔、輸入框描邊。

### Named Rules
**The One Seal Rule.** 朱印紅是**唯一**的主聲音，任一畫面上作為填色的面積 ≤10%。它可以描邊、可以做小徽章、
可以蓋一枚章，但不可以整片鋪。它的稀有就是它的力量。

**The No-Grey Rule.** 禁止任何「為了優雅」而發灰的低飽和色。文字要嘛走墨／茶梯度、要嘛走和風彩色；
色塊上的文字用該色調的深階或文字色的透明度，絕不用中性灰。往更亮推時，飽和度只增不減。

## 3. Typography

**Display / Heading Font:** Shippori Mincho（襯線，fallback `serif`），字重 500–800
**Body Font:** Noto Sans TC（黑體，fallback `sans-serif`），字重 400–700
**Numeric / Code Font:** `ui-monospace, monospace`（僅訂單編號等機械識別碼）

**Character:** 一組經典的對比配對——Shippori Mincho 的明朝襯線帶來手帳與印刷的儀式感，
專扛標題與大數字；Noto Sans TC 的黑體乾淨中性，扛正文、標籤與密集資訊。兩者形狀對比夠大，
不會糊在一起。這是產品介面，字級走**固定 px 級距、非流體 clamp**。

### Hierarchy
- **Display** (Shippori Mincho, 800, 72px, lh 1)：首頁倒數大數字這類「一眼焦點」的英雄數字，朱印紅。
- **Headline** (Shippori Mincho, 700, 21px, letter-spacing 0.12em)：頁面／卡片主標題（如「大阪旅券」「飯店名」）。
- **Title** (Shippori Mincho, 700, 18px)：區塊標題（如「出發前待辦」）。
- **Body** (Noto Sans TC, 400, 13.5px, lh 1.75)：正文與攻略內文；長文控制在 65–75ch。
- **Label** (Noto Sans TC, 600, 12px, letter-spacing 0.25em, 常為大寫)：英文小標籤（`OSAKA TRIP`、
  `HOTEL`、`DEPARTURE COUNTDOWN`）與資訊標籤，走茶色。

### Named Rules
**The Serif-for-Ceremony Rule.** 襯線 Shippori Mincho 只給標題、大數字、印章這類「有儀式感」的角色；
正文、按鈕文字、密集資料一律 Noto Sans TC 黑體。禁止用襯線排正文或 UI 標籤。

## 4. Elevation

這套系統**幾乎全平**——深度靠色調分層（body 米 → 卡片亮一階）與 1px 邊框／虛線分隔，不靠陰影堆疊。
陰影只在兩處出現且都是「實」的、非柔散的：印章／logo 的硬投影（`2px 2px 0`，像蓋章的紙感位移），
與卡片 hover 時的一次性抬升回饋。

### Shadow Vocabulary
- **蓋章硬影 Stamp Offset** (`box-shadow: 2px 2px 0 rgba(41,35,26,.18)`)：logo 方章、印章元件。
  硬邊、無模糊，模擬紙上蓋章的位移，帶輕微旋轉。
- **卡片抬升 Card Lift** (`box-shadow: 0 6px 18px rgba(41,35,26,.16)`)：僅 `.card-tap` hover 時，
  伴隨 `translateY(-2px) rotate(-.2deg)`。休息態無影。

### Named Rules
**The Flat-Paper Rule.** 表面預設全平，靠紙色與界線分層。陰影是**狀態的回應**（hover、蓋章），
不是裝飾。禁止在休息態的卡片／按鈕上疊柔散大陰影（尤其 1px 邊框＋大模糊陰影的「幽靈卡」組合）。

## 5. Components

整體性格是**手作紙品・印章儀式感**：歪斜的旋轉、硬邊的蓋章、虛線的分隔、圓形的朱印。這些是識別度的來源，要守住。

### Chips（主導航與篩選）
- **Style:** 膠囊形（`999px`），透明底、墨色 1px 描邊、字距 0.05em、min-height 36px。
- **State:** 選中態填墨色底（`#29231A`）＋紙色字；導航用的 red 變體選中態填朱印紅底。橫向捲動列（`.hscroll`，隱藏捲軸）。
- **用途:** 頂部分頁導航即一排 red chips；篩選器用同一套 chip 語彙。

### Cards / Containers
- **Corner Style:** 10px 圓角（`{rounded.lg}`）。
- **Background:** fude-card `#FBF7EC`，比 body 亮一階。
- **Border:** 1px `hairline`；區塊內分隔用虛線（`dash-top` / `dash-bottom`）。
- **Shadow Strategy:** 休息態無影；可點卡片（`.card-tap`）hover 抬升（見 Elevation）。
- **Internal Padding:** 22px 24px（`{spacing}` 級距）。

### Buttons
- **主行動（登入編輯）:** 透明底、朱印紅描邊與紅字、6px 圓角、7px 16px、min-height 38px、字重 600。
- **次行動（登出等）:** 茶深字、`hairline-strong` 1px 描邊、6px 圓角。
- **Hover / Focus:** `:focus-visible` 一律朱印紅 2px 外框、offset 2px。過場 150ms。
- **禁止:** 純色大實心按鈕鋪滿朱印紅（違反 One Seal Rule）；圖示按鈕維持 `.btn-plain` 無框。

### Inputs / Fields
- **Style:** fude-card 底、`hairline-strong` 1px 描邊、8px 圓角、佔位字用 cha-brown-light（非淺灰）。
- **Focus:** 朱印紅 `:focus-visible` 外框。
- **Mobile:** ≤640px 時字級升至 16px 以避免 iOS 縮放。

### Navigation
- **Header:** sticky、`rgba(241,235,221,.94)` 半透明 + `blur(10px)` backdrop、底部 1px hairline。
  左側方形朱印 logo（歪斜 `-3deg` + 蓋章硬影），右側同步印章與倒數膠囊。
- **分頁列:** red chips 橫向捲動，當前態填朱印紅。

### 印章 Stamp（招牌元件）
- 42px 圓形，朱印紅 1.6px 描邊、Shippori Mincho 字、`rotate(-6deg)`、極淡紅底。蓋章進場動畫
  `stampIn`（從 -14deg scale 1.5 落定）。未蓋態改茶色描邊、透明底。這是「去過／辦好」的核心狀態語彙。

### 同步印章 Sync Seal（招牌元件）
- 26px 圓形朱印，同步中以 `sealPulse` 呼吸（旋轉 + 縮放 + 透明度），傳達「正在跨裝置同步」。

### 收藏愛心 Heart
- ♡ 開關，開啟態朱印紅，`heartPop` 彈跳動畫。觸控命中區加大（padding 12px / margin -10px）。

## 6. Do's and Don'ts

### Do:
- **Do** 把朱印紅當唯一主聲音，填色面積 ≤10%（The One Seal Rule）：主行動、當前分頁、警示、收藏開啟態。
- **Do** 用色調分層（body 米 → 卡片亮一階）＋ 1px 界線／虛線做深度，休息態全平（The Flat-Paper Rule）。
- **Do** 讓襯線 Shippori Mincho 只扛標題、大數字、印章；正文與 UI 標籤一律 Noto Sans TC 黑體。
- **Do** 往更明亮活潑推時，只增飽和度與對比，讓朱印紅、金、藍綠真正跳出來（The No-Grey Rule）。
- **Do** 用印章／圓戳／歪斜旋轉／蓋章硬影／虛線分隔承載和風識別度——這些是靈魂，要守住。
- **Do** 行動優先：橫向捲動分頁、觸控目標 ≥36–44px、輸入框 ≤640px 升 16px、`:focus-visible` 朱紅外框。
- **Do** 每個狀態都給清楚一致的視覺回饋：已收藏、待辦已辦（綠打勾）、同步中（印章呼吸）、離線（虛線徽章）、唯讀（降透明度）。

### Don't:
- **Don't** 把和風做成**沉悶灰撲撲的「安靜和風」**——低飽和、昏黃、褪色老照片感。這是明確要離開的方向。
- **Don't** 淡化和風、改走 **Linear／Notion 那種乾淨中性的產品 UI**；Shippori Mincho 襯線、朱印章、紙紋、朱印紅不能為了「現代感」抹平。
- **Don't** 落入**無個性的 AI 暖白樣板**：米底＋灰字＋圓角卡片無限複製、沒印章沒襯線沒紙感的「一看就 AI」暖白頁。暖色要靠印章／襯線／紙紋掙來，不是靠把白色染暖。
- **Don't** 用中性灰做色塊上的文字或佔位字（The No-Grey Rule）；用該色調深階或文字色透明度。
- **Don't** 在休息態卡片／按鈕上疊 1px 邊框＋大模糊柔散陰影的「幽靈卡」；陰影只回應狀態。
- **Don't** 把 chip／卡片圓角推到 16px 以上（卡片頂到 10–16px；膠囊只給 chip／印章）。
- **Don't** 為了塞滿而塞滿造成資訊超載；密度服務「旅途中快速查」，不是炫技。

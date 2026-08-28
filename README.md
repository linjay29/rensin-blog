# 林士傑醫師/屏東仁心骨科診所 — 部落格

純靜態網站，無框架、無打包工具。只有一支 Node 腳本負責維護「最後更新日期」與首頁卡片索引。

## 快速上手

```bash
npm run dev      # 本機預覽 http://localhost:4321
npm run build    # 重算更新日期、重建首頁卡片與 sitemap
```

## 目錄結構

```
public/
  index.html                    首頁（卡片索引直接寫死在 HTML 裡）
  config.js                     Supabase 連線設定
  robots.txt / sitemap.xml      sitemap 由 build 自動產生
  404.html                      找不到頁面時顯示（兩個平台都會自動採用）
  assets/                       ← 全站共用資源
    site.css                    全站樣式
    counter.js                  瀏覽計數器
    filter.js                   首頁分類篩選
    logo.png                    診所標誌（頁首）
    clinic-card.jpg             診所名片（首頁 HERO）
    doctor-portrait.jpg         醫師照片（簡介）
  20190621-whey-chest/
    index.html
    assets/                     ← 這一篇專用的圖，跟文章放在一起
      cover.jpg
  20260802-clinic-guide/index.html
  20260802-frozen-shoulder/index.html

tools/
  build.mjs                     更新日期 + 卡片索引 + 分類鈕 + sitemap
  new-post.mjs                  新增文章的樣板產生器（支援搬舊文）
  serve.mjs                     本機預覽用的極簡靜態伺服器

supabase-setup.sql              計數器的資料庫建置腳本
.github/workflows/deploy.yml    推上 main → GitHub Pages + Cloudflare Pages
```

### 圖片放哪裡

| 圖的用途 | 放哪 | 在文章 HTML 裡怎麼寫 |
|---|---|---|
| 全站共用（首頁 HERO、之後的 logo） | `public/assets/` | `../assets/xxx.jpg` |
| 只有某一篇用到 | `public/<文章資料夾>/assets/` | `assets/xxx.jpg` |

**文章專用的圖一律跟文章放在一起。**
這樣刪掉一篇文章就是刪掉一個資料夾，不會在共用的 `assets/` 裡
留下一堆不知道還有沒有人在用的孤兒檔案。文章數量一多，這件事差很多。

## 網址規則

一篇文章 = 一個資料夾 = 一個網址。

| 資料夾 | 網址 |
|---|---|
| `public/20260802-frozen-shoulder/` | `https://rensin-clinic.sclin.net/20260802-frozen-shoulder/` |

資料夾命名固定為 `YYYYMMDD-slug`（小寫英文、數字、連字號）。
`build.mjs` 只認得這個格式，其他資料夾會被忽略。

## 新增一篇文章

```bash
npm run new -- knee-arthritis "退化性膝關節炎的三個階段" "骨科衛教"
```

會建立 `public/20260802-knee-arthritis/index.html`（日期用當天），
填好裡面的 `TODO`，然後：

```bash
npm run build
```

首頁就會多一張卡片，而且排在最前面。**不需要手動改 `index.html`。**

### 從舊站搬文章過來

搬舊文一定要加 `--date`，用**原始的發表日期**：

```bash
npm run new -- whey-chest "健身＋乳清＝豐胸？" "健身訓練" \
  --date=2019-06-21 \
  --origin=https://drjaylife.blogspot.com/2019/06/blog-post_21.html
```

| 參數 | 作用 |
|---|---|
| `--date=YYYY-MM-DD` | 決定資料夾名稱與 `post:published`。**不給就會用今天** |
| `--origin=網址` | 自動加上 `post:origin` meta 與文章開頭的出處註記 |

> ⚠️ **`--date` 忘了給，2019 年的舊文就會排到首頁最前面。**
> 首頁是照發表日期排的，詳見下一節。

搬文章的完整步驟：

1. `npm run new -- <slug> "標題" "分類" --date=... --origin=...`
2. 把原文的圖抓下來，放進 `public/<資料夾>/assets/`
3. 填內容，把 `TODO` 換掉
4. **確認圖片授權**——沒有出處的圖不要放（見下面「圖片授權」一節）
5. `npm run build`

### 分類

目前有文章的分類：`診所公告`、`骨科衛教`、`健身訓練`。
要加新的直接寫在 `post:tag` 裡，首頁的分類鈕會自動多一顆，卡片上的標籤也會照著顯示。

> **`關於我` 與 `運動醫學` 目前都沒有文章。**
> 「開張了」於 2026-08-26 移除，「越野跑不受傷的三個準備」於 2026-08-28 移除。
> 首頁與各文章頁尾的「關於我」連結改指向首頁的 `#about`「關於林士傑醫師」區塊，
> 不是指向分類篩選——因為點進一個沒有文章的分類只會看到空畫面。
> 日後若再寫一篇 `post:tag` 為 `關於我` 的文章，篩選鈕會自動長回來，
> 屆時再把那幾個頁尾連結換成 `?tag=關於我#posts` 即可。

**建議維持在 6 類以內。** 分類的用處是讓人「一眼決定要不要往下看」，
超過六七個之後篩選鈕會排成兩三行，反而失去作用。
真的需要更細的區分時，用文章標題去講，不要一直開新分類。

### 首頁分類篩選

首頁的分類鈕由 `build.mjs` 自動產生（`<!-- TAGS:START -->` ~ `<!-- TAGS:END -->` 之間，
**不要手動編輯**），行為在 `public/assets/filter.js`：

- 卡片**全部靜態寫在 HTML 裡**，篩選只是把不符合的 `hidden` 起來。
  沒有 JavaScript 就是全部顯示，搜尋引擎看到的一直是完整清單。
- 點分類鈕會把網址同步成 `?tag=骨科衛教#posts`，可以直接分享或加書籤。
- 網址帶了不存在的分類會自動退回「全部」，不會出現空白頁。

## 更新日期是怎麼算的

`build.mjs` 對每篇文章依序判斷：

1. 檔案還沒進 git（全新文章）→ **今天**
2. 檔案有未提交的修改 → **今天**
3. 檔案是乾淨的 → 取該檔**最後一次 commit 的日期**
4. 沒有 git → 檔案的 mtime

算出來的日期會寫回三個地方：文章的 `<meta name="post:updated">`、
文章頁面上的「最後更新」、以及首頁卡片。

GitHub Actions 每次部署前都會再跑一次（用 `fetch-depth: 0` 取完整歷史），
所以線上看到的日期永遠是對的。

> 手動改文章裡的 `post:updated` 沒有意義，下次 build 會被蓋掉。

## 首頁是照「發表日期」排的，不是更新日期

這件事很重要，因為舊站的文章會陸續搬進來。

`post:published` 是**你寫這篇文章的那一天**，由資料夾名稱決定（`20190621-` → 2019-06-21），
搬文章時用 `--date` 指定。它**不會**被 build 蓋掉。

`post:updated` 是**檔案最後被改動的那一天**，由 git 自動算，你改不動它。

首頁卡片依 **`published` 由新到舊**排序。

> **為什麼不照更新日期排？**
> 因為搬十篇舊文進來，這十篇的更新日期全都會是「搬家的那一天」。
> 照更新日期排的話，首頁會變成一整排同一天、順序還是隨機的舊文，
> 而你今年新寫的文章反而被擠到後面去。
> 照發表日期排，2019 年的文章就會乖乖待在 2026 年的文章後面。

卡片上的日期顯示規則：

- 兩個日期一樣（沒改過）→ 只顯示發表日期
- 兩個日期不一樣 → 顯示發表日期，後面再補一個「更新 ⋯」

所以搬過來的舊文會顯示成 `2019-06-21` + `更新 2026-08-26`，
讀者一眼看得出這是舊文重新整理過，而不是今天新寫的。

## 中文斷行檢查（build 會擋）

`build.mjs` 最後一步會掃所有 HTML，發現**句中斷行**就中止建置。

> **為什麼要擋。** 中文沒有詞間空格，但 HTML 會把原始碼的換行摺成一個半形空格。
> 斷行只要落在句中（特別是 `<strong>`、`<a>` 前後），畫面上就會多一道空隙：
>
> ```html
> …骨科門診，並任
> <strong>微美時尚診所</strong>…
> ```
>
> 顯示成「並任 微美時尚診所」。2026-08-28 全站一次抓出 32 處，全是這個成因。

### 規則

| 位置 | 可否斷行 |
|---|---|
| 句末標點後（`。` `！` `？` `；`） | ✅ 可以。全形句號本身已帶尾隙，看不出來，一句一行最好讀 |
| 句中標點後（`、` `，` `：` `）` `」`） | ❌ 不行，空隙會露出來 |
| 沒有標點的句中 | ❌ 絕對不行，最明顯 |

**長清單（如主治項目）整條寫成一行**，不要為了原始碼寬度而斷。

### 偵測是怎麼做的

不能只做純文字比對——把標籤剝光之後，相鄰的 `<li>`、`<td>` 看起來也像句中斷行。
（初版用純文字掃出 98 處，真正有問題的只有 7 處。）

實際作法：

1. 移除註解與 `<script>`／`<style>`
2. 區塊標籤與 `<br>` 換成哨兵字元，當作硬邊界
3. **標籤與標籤之間的純空白直接抹掉**——那多半是 flex／grid 容器裡的並列項目
   （`.nav` 的連結、`.card-foot`、`.post-meta`），瀏覽器會丟棄項目間的空白
4. 剝掉行內標籤，依邊界切段，每段各自摺疊空白
5. 只在同一段行內文字流裡找「全形字 + 半形空格 + 全形字」

`span` 也列為邊界，因為本站的 span 不是 flex 項目就是獨立標籤，不會和前後文字連成一段。

## 首頁卡片為什麼寫死在 HTML

SEO。Google 雖然會執行 JavaScript，但那是在第二波「渲染佇列」才做的，
可能延遲數天甚至被跳過。**首波抓取只看原始 HTML。**
所以文章列表直接靜態輸出在 `<!-- POSTS:START -->` 與 `<!-- POSTS:END -->` 之間，
爬蟲第一次抓首頁就能看到全部文章和連結。

那兩行標記中間的內容由腳本產生，**不要手動編輯**。

## 瀏覽計數器

- 每篇文章一個獨立計數器，id 是 `rensin-<資料夾名>`
- 首頁自己也有一個：`rensin-home`
- 首頁卡片上顯示的是各篇文章的即時數字（唯讀，不會因為有人逛首頁就加一）
- 同一個瀏覽器分頁重新整理只讀不加（用 `sessionStorage` 擋）

安全性：前端只拿得到 anon key，資料表開了 RLS 且沒有任何 policy，
直接讀取會回 401。所有操作都經過 `security definer` 的函式，
前端無法竄改數值、無法歸零。

### 目前的設定

`public/config.js` 沿用既有的 Supabase 專案，計數器 id 以 `rensin-` 開頭做區隔，
不會跟其他站台互相干擾。**開箱即用，不用另外設定。**

不過該專案還沒有批次查詢函式 `get_counters()`，
所以首頁目前是逐篇查詢（4 篇 = 4 次請求，能正常運作，只是慢一點點）。
想加速的話，到 Supabase 的 SQL Editor 跑一次 `supabase-setup.sql`，
前端會自動改用批次查詢，不必改任何程式碼。

### 上線前想把測試數字歸零

在 Supabase SQL Editor 執行：

```sql
update public.page_counter set count = 0 where id like 'rensin-%';
```

## 部署

推送到 `main` 觸發三個 job：

1. **build** — 跑 `tools/build.mjs`，把 `public/` 打包成 artifact
2. **github-pages** — 用 `actions/deploy-pages` 發布
3. **cloudflare-pages** — 用 `wrangler-action` 發布到 Cloudflare Pages 專案 `rensin-blog`

### 目前狀態（2026-08-28）

正式網址 **<https://rensin-clinic.sclin.net>**，由 **Cloudflare Pages** 提供，已上線。

| 項目 | 狀態 |
|---|---|
| Cloudflare Pages 專案 `rensin-blog` | ✅ 已建立並持續自動部署 |
| custom domain `rensin-clinic.sclin.net` | ✅ active，憑證由 Cloudflare 簽發 |
| DNS `rensin-clinic` CNAME → `rensin-blog.pages.dev` | ✅ 已建立（Proxied） |
| repo secrets | ✅ `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` 已設定 |
| GitHub Pages <https://linjay29.github.io/rensin-blog/> | ✅ 備援，正常部署 |

> **DNS 為什麼要手動加？** wrangler 的 OAuth 憑證只有 `zone:read`，
> 且 Cloudflare 的 DNS API 直接拒絕 OAuth token（回 `code 10000`）。
> 要用程式加，得另開一組帶 **Zone → DNS → Edit** 的 API Token。

### 踩過：GitHub Pages 被卡死的部署擋住（2026-08-28，已解除）

連續推送之後，一個 Pages deployment 卡在 GitHub 後端且不會結束，
接下來每次部署都撞上它：

```
Deployment request failed for <sha> due to in progress deployment.
Please cancel <前一個 sha> first or wait for it to complete.
```

**試過三種處置全部無效**：打 API 取消（回報 `deployment_cancelled` 但沒解除）、
開全新 run、重跑失敗的 job。GitHub 自己的 API 當時還互相矛盾——
deployments API 說 `failure`、Pages API 說 `cancelled`、deploy 動作說「進行中」。

**最後是等它自己過期解除的**，約一小時多，跟任何處置都無關。

兩個後續：

- `concurrency` 的 `cancel-in-progress` 已改為 `false`（見 deploy.yml 的註解）。
  它取消得掉 workflow run，卻取消不掉伺服器端已開始的 Pages deployment，
  正是這次卡死的成因。改成排隊就不會再撞。
- **這個 job 失敗時不要用「Re-run failed jobs」**，重跑會在同一個 run 裡
  再上傳一份同名 artifact，導致 `Multiple artifacts named "github-pages"`。
  要開全新的 run：`gh workflow run Deploy --ref main`。

### ⚠️ 兩個踩過的坑

**1. 免費方案的 GitHub Pages 不支援 private repository。**
repo 是私有時，建立 Pages 站台的 API 會回 422
`Your current plan does not support GitHub Pages for this repository`。
若日後又轉回 private，Pages 會失效。切換指令：

```bash
gh repo edit linjay29/rensin-blog --visibility public --accept-visibility-change-consequences
```

**2. workflow 的 `GITHUB_TOKEN` 無法「建立」Pages 站台。**
即使 repo 已公開、`configure-pages` 設了 `enablement: true`，仍會失敗於
`Create Pages site failed: Resource not accessible by integration`。
站台必須先用個人帳號建立一次（之後的部署 workflow 就能自己跑）：

```bash
gh api -X POST repos/linjay29/rensin-blog/pages -f "build_type=workflow"
```

（Cloudflare Pages 沒有這兩個限制，private repo 也能部署，只要 secrets 設好。）

### Cloudflare 所需的 Repository secrets

**Settings → Secrets and variables → Actions** 新增：

- `CLOUDFLARE_API_TOKEN` — 於 Cloudflare 後台建立，需要 **Cloudflare Pages: Edit** 權限
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare 帳號 ID

未設定時 GitHub Pages 仍會正常部署，Cloudflare 的 job 會失敗。

### 自訂子網域

已設為 `rensin-clinic.sclin.net`。日後要再換網域的話，除了 Cloudflare Pages
專案的 **Custom domains** 之外，這三個檔案裡的網址也要一起改：

- `tools/build.mjs` 的 `SITE_URL`
- `public/robots.txt` 的 Sitemap 那一行
- `public/index.html` 的 `<link rel="canonical">`

### 靜態資源的版本號（改完樣式卻沒生效時看這裡）

`site.css`、`counter.js`、`filter.js` 在 HTML 裡都帶一個 `?v=` 雜湊：

```html
<link rel="stylesheet" href="assets/site.css?v=a4fcdb65">
```

這串由 `build.mjs` 依**檔案內容**算出來，內容一改、網址就變。

> **為什麼需要。** Cloudflare Pages 對 assets 送的是
> `Cache-Control: public, max-age=14400`（4 小時）。
> 網址不變的話，瀏覽器會在這 4 小時內直接用快取裡的舊 CSS，
> 卻搭配剛部署的新 HTML —— 新加的 class 沒有樣式、被刪掉的舊規則還在生效。
>
> 實際踩過一次：頁首改版後，舊 CSS 讓 `.hero--banner` 失效退回深藍綠漸層、
> `.brand .mark` 仍套用舊的漸層方塊，畫面上就是「Hero 變綠、logo 後面一塊綠」。
> 重新部署也修不好，因為壞的是瀏覽器端的快取。

`stampAssetVersions()` 會先吃掉舊的 `?v=` 再重掛，重複 build 不會越接越長。
**新增其他共用的 css/js 時，記得加進 `build.mjs` 的 `VERSIONED` 陣列。**

### 為什麼要有 `public/404.html`

**Cloudflare Pages 在沒有 404.html 時，會把首頁內容用 HTTP 200 回給任何不存在的網址。**
也就是說 `/隨便打的網址` 看起來像一個正常存在的頁面。
對 Google 來說這叫 soft 404，會被判定成大量重複內容，很傷 SEO。

放了 `404.html` 之後，不存在的路徑才會正確回 **404**（已驗證）。
GitHub Pages 也會自動採用同一個檔案，兩邊行為一致。

## 手機版排版

驗證過 320px、375px 與 1280px 三種寬度，頁面本身都沒有橫向捲動：

- 內距與字級用 `clamp()`，不寫死 px
- 中文長句自動換行，網址／英文長詞用 `overflow-wrap:anywhere` 斷開
- flex／grid 子項設 `min-width:0`，避免內容把容器撐破
- HERO 圖 `width:100%; height:auto` 等比例縮放，容器 `max-width` 綁定內文欄寬，**永遠不會比內文寬**
- 表格分兩種：
  - `.table-scroll--kv` 兩欄式資訊表 → 手機上自動換行塞得進去
  - `.table-scroll--wide` 多欄比較表 → 在自己的容器內橫向捲動，不影響整頁

## 圖片授權

目前站上的圖片**全部是自有素材**，沒有引用外部授權圖：

| 檔案 | 用途 | 來源 |
|---|---|---|
| `assets/logo.png` | 頁首標誌 | 診所自有 |
| `assets/clinic-card.jpg` | 首頁 HERO | 診所名片 |
| `assets/doctor-portrait.jpg` | 簡介照片 | 醫師本人 |
| `20190621-whey-chest/assets/cover.jpg` | 該篇標題圖 | 作者自製 |

> 先前首頁與部分文章曾使用一張 Flickr 的 CC BY 2.0 越野跑照片，
> 隨該篇文章於 2026-08-28 刪除後一併移除，相關標示也已清除。

**日後若要用外部圖片**，必須在該頁 footer 標明 **標題、作者、來源、授權** 四項
（CC BY 的要求），且只在實際顯示該圖的頁面標示——
標在沒有用到那張圖的頁面上，等於標錯。

### 搬舊文時的圖片檢查

舊站（Blogspot）不少文章的配圖是當年從網路上找的，**沒有標出處**。
搬過來之前先分成三類處理：

| 圖的來源 | 怎麼做 |
|---|---|
| 你自己做的（標題圖、自己拍的照片、自己畫的圖） | 直接用，footer 註明「作者自行製作」 |
| 知道出處、授權允許 | 用，並照上面的格式在 footer 標示四項 |
| **不知道出處** | **不要放**。用文字、`callout` 或表格把資訊講清楚就好 |

> 已經這樣處理過的例子：`20190621-whey-chest`。
> 原文有三張圖，只留下作者自製的標題圖；
> 另外兩張（乳房解剖示意圖、乳清蛋白產品照）查不到出處，改用文字與 `callout` 呈現，
> 資訊沒有少。文章 footer 也註明了這件事。

自己拍的示範影片沒有這個問題——放 YouTube，用 `youtube-nocookie.com` 嵌入即可
（見 `20190621-whey-chest` 的 `.embed` 用法）。

## 醫療內容免責

站上所有文章皆為一般衛教資訊，不能取代醫師的診察、診斷或治療。
每一篇文末都放了免責聲明區塊，新增文章時請保留。

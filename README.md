# 林士傑醫師｜仁心骨科診所 — 部落格

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
  assets/
    site.css                    全站樣式
    counter.js                  瀏覽計數器
    hero-trail-running.jpg      HERO 照片（CC BY 2.0）
  20260802-introduction/index.html
  20260802-clinic-guide/index.html
  20260802-frozen-shoulder/index.html
  20260802-trail-running/index.html

tools/
  build.mjs                     更新日期 + 卡片索引 + sitemap
  new-post.mjs                  新增文章的樣板產生器
  serve.mjs                     本機預覽用的極簡靜態伺服器

supabase-setup.sql              計數器的資料庫建置腳本
.github/workflows/deploy.yml    推上 main → GitHub Pages + Cloudflare Pages
```

## 網址規則

一篇文章 = 一個資料夾 = 一個網址。

| 資料夾 | 網址 |
|---|---|
| `public/20260802-introduction/` | `https://<你的子網域>/20260802-introduction/` |

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

### 分類

`關於我`、`診所公告`、`骨科衛教`、`運動醫學`。要加新的直接寫，卡片上的標籤會照著顯示。

## 更新日期是怎麼算的

`build.mjs` 對每篇文章依序判斷：

1. 檔案還沒進 git（全新文章）→ **今天**
2. 檔案有未提交的修改 → **今天**
3. 檔案是乾淨的 → 取該檔**最後一次 commit 的日期**
4. 沒有 git → 檔案的 mtime

算出來的日期會寫回三個地方：文章的 `<meta name="post:updated">`、
文章頁面上的「最後更新」、以及首頁卡片。首頁卡片依這個日期排序，**最新的在前**。

GitHub Actions 每次部署前都會再跑一次（用 `fetch-depth: 0` 取完整歷史），
所以線上看到的日期永遠是對的。

> 手動改文章裡的 `post:updated` 沒有意義，下次 build 會被蓋掉。

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

### Cloudflare 所需的 Repository secrets

**Settings → Secrets and variables → Actions** 新增：

- `CLOUDFLARE_API_TOKEN` — 於 Cloudflare 後台建立，需要 **Cloudflare Pages: Edit** 權限
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare 帳號 ID

未設定時 GitHub Pages 仍會正常部署，Cloudflare 的 job 會失敗。

### 自訂子網域

要用 `blog.你的網域` 的話：Cloudflare Pages 專案 → **Custom domains** → 加上子網域。
接著把這三個檔案裡的網址一起改掉：

- `tools/build.mjs` 的 `SITE_URL`
- `public/robots.txt` 的 Sitemap 那一行
- `public/index.html` 的 `<link rel="canonical">`

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

HERO 照片：[《Trail Running Lago Orta》](https://www.flickr.com/photos/47332444@N03/5304116937)
by Julia Baykova，取自 Flickr，採 [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) 授權。
使用 Flickr 提供之 1024px 尺寸，未另行修改。出處標示於每一頁的 footer。

要換圖或加新圖時，請沿用同樣格式在 footer 標明 **標題、作者、來源、授權**（CC BY 的四項要求）。

## 醫療內容免責

站上所有文章皆為一般衛教資訊，不能取代醫師的診察、診斷或治療。
每一篇文末都放了免責聲明區塊，新增文章時請保留。

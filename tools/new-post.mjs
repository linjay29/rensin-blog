#!/usr/bin/env node
/* ===========================================================================
   新增一篇文章
   ---------------------------------------------------------------------------
   用法：
     node tools/new-post.mjs <slug> "文章標題" ["分類"] [--date=YYYY-MM-DD] [--origin=網址]

   例（新文章，用今天的日期）：
     node tools/new-post.mjs knee-arthritis "退化性膝關節炎的三個階段" "骨科衛教"

   例（從舊站搬文章，用原始發表日期）：
     node tools/new-post.mjs whey-chest "健身＋乳清＝豐胸？" "健身訓練" \
       --date=2019-06-21 --origin=https://drjaylife.blogspot.com/2019/06/blog-post_21.html

   會建立 public/<日期>-<slug>/index.html（例如 20190621-whey-chest/），
   接著自動跑一次 build.mjs 重建首頁。

   ⚠️ 搬舊文一定要給 --date，否則首頁排序會把 2019 年的文章排到最前面。
   =========================================================================== */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");

/* 先把 --flag=value 挑掉，剩下的才是位置參數 */
const argv = process.argv.slice(2);
const flags = Object.fromEntries(
  argv
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const i = a.indexOf("=");
      return i === -1 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)];
    })
);
const [rawSlug, title, tag = "骨科衛教"] = argv.filter((a) => !a.startsWith("--"));

if (!rawSlug || !title) {
  console.error(`用法： node tools/new-post.mjs <slug> "文章標題" ["分類"] [--date=YYYY-MM-DD] [--origin=網址]

  slug     只能用小寫英文、數字與連字號，例如 knee-arthritis
  分類     預設「骨科衛教」，其他常用：診所公告、運動醫學、關於我、健身訓練
  --date   發表日期，不給就用今天。搬舊文請務必指定原始發表日期。
  --origin 舊站原文網址，給了就會在文章開頭自動加一行出處註記。`);
  process.exit(1);
}

if (!/^[a-z0-9][a-z0-9-]*$/.test(rawSlug)) {
  console.error(`slug「${rawSlug}」不合法：只能用小寫英文、數字與連字號。`);
  process.exit(1);
}

/* 發表日期：--date 指定，否則今天 */
const now = new Date();
const p = (n) => String(n).padStart(2, "0");
const today = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;

const iso = flags.date === undefined ? today : String(flags.date);
if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
  console.error(`--date「${iso}」格式不對，要 YYYY-MM-DD，例如 --date=2019-06-21`);
  process.exit(1);
}
const stamp = iso.replace(/-/g, "");

const slug = `${stamp}-${rawSlug}`;
const dir = path.join(PUBLIC, slug);

if (fs.existsSync(dir)) {
  console.error(`資料夾已存在：public/${slug}／請換一個 slug。`);
  process.exit(1);
}

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const T = esc(title);
const TAG = esc(tag);
const counter = `rensin-${slug}`;

/* --origin：舊站轉錄用。給了就多寫兩個 meta 與一段出處註記。 */
const ORIGIN = typeof flags.origin === "string" ? esc(flags.origin) : "";
const originMeta = ORIGIN
  ? `\n<!-- 舊站轉錄：原文出處與原始發表時間，供日後對照 -->\n` +
    `<meta name="post:origin"      content="${ORIGIN}">\n` +
    `<meta name="post:origin-date" content="${iso}">\n`
  : "";
const originNote = ORIGIN
  ? `        <p class="origin-note">
          本文原載於舊站 <a href="${ORIGIN}" rel="noopener">原文連結</a>（${iso}），
          搬遷至此並重新排版，內容未作實質更動。
        </p>\n\n`
  : "";

const html = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${T}｜林士傑醫師</title>
<meta name="description" content="TODO：一到兩句的文章摘要，會顯示在搜尋結果。">
<meta name="author" content="林士傑醫師">
<meta property="og:title" content="${T}">
<meta property="og:description" content="TODO：一到兩句的文章摘要。">
<meta property="og:type" content="article">
<meta property="og:locale" content="zh_TW">

<!-- 供 tools/build.mjs 讀取；post:updated 由腳本自動維護，請勿手改 -->
<meta name="post:title"     content="${T}">
<meta name="post:summary"   content="TODO：首頁卡片上顯示的摘要，兩三句話。">
<meta name="post:tag"       content="${TAG}">
<meta name="post:author"    content="林士傑醫師">
<meta name="post:published" content="${iso}">
<meta name="post:updated"   content="${iso}">
<meta name="post:counter"   content="${counter}">
${originMeta}
<link rel="stylesheet" href="../assets/site.css">
<script src="../config.js"></script>
<script src="../assets/counter.js" defer></script>
</head>
<body>

<header class="site-header">
  <div class="wrap wrap-wide">
    <a class="brand" href="../">
      <span class="mark" aria-hidden="true">仁</span>
      <span class="name">林士傑醫師/屏東仁心骨科診所</span>
    </a>
    <nav class="nav" aria-label="主選單">
      <a href="../#about">關於醫師</a>
      <a href="../#posts">文章</a>
      <a href="../#clinic">診所資訊</a>
    </nav>
  </div>
</header>

<main>
  <article>

    <div class="hero">
      <div class="wrap">
        <p class="eyebrow">${TAG}</p>
        <h1>${T}</h1>
        <p class="lede">TODO：一句話點出這篇要講什麼。</p>

        <!-- 要放圖就取消下面註解。務必用有授權的圖，並在 footer 標示出處。
        <figure class="hero-figure">
          <img src="../assets/你的圖檔.jpg" width="1600" height="1000"
               loading="eager" decoding="async" alt="TODO：描述圖片內容">
          <figcaption>TODO：圖說</figcaption>
        </figure>
        -->
      </div>
    </div>

    <div class="wrap">
      <p class="post-meta">
        <span class="author">作者：林士傑醫師</span>
        <span>發表 <time datetime="${iso}">${iso}</time></span>
        <span>最後更新 <time data-post-updated datetime="${iso}">${iso}</time></span>
        <span class="counter" data-counter-self="${counter}" hidden><b class="num">0</b> 次瀏覽</span>
      </p>
    </div>

    <div class="wrap">
      <div class="prose">

${originNote}        <p>TODO：開頭段落。</p>

        <h2>小標題</h2>
        <p>內文。</p>

        <div class="callout">
          <span class="label">重點</span>
          <p>想強調的一句話。</p>
        </div>

        <!-- 表格範例：
             欄位少 → class="table-scroll table-scroll--kv"（兩欄式資訊表）
             欄位多 → class="table-scroll table-scroll--wide"（手機上在容器內橫捲）
        -->

        <hr>

        <div class="callout warn">
          <span class="label">重要聲明</span>
          <p>
            本文為一般衛教資訊，<strong>不能取代醫師的診察、診斷或治療</strong>。
            每個人的狀況都不同，實際處置請與您的主治醫師討論。
          </p>
        </div>

        <a class="back-link" href="../">← 回到文章列表</a>
      </div>
    </div>

  </article>
</main>

<footer class="site-footer">
  <div class="wrap wrap-wide">
    <div class="footer-grid">
      <div>
        <h4>屏東仁心骨科診所</h4>
        <ul>
          <li>屏東縣屏東市自由路西段 118 號 1-3 樓</li>
          <li><a href="tel:+886877519682">(08) 751-9682</a></li>
          <li>僅現場掛號，額滿停掛</li>
        </ul>
      </div>
      <div>
        <h4>文章分類</h4>
        <ul>
          <li><a href="../#posts">全部文章</a></li>
        </ul>
      </div>
      <div>
        <h4>本站</h4>
        <ul>
          <li>作者：林士傑醫師</li>
          <li>本文最後更新：<time data-post-updated datetime="${iso}">${iso}</time></li>
        </ul>
      </div>
    </div>

    <div class="credit">
      <p>
        主視覺照片：<a href="https://www.flickr.com/photos/47332444@N03/5304116937" rel="noopener">《Trail Running Lago Orta》</a>
        by Julia Baykova，取自 Flickr，採
        <a href="https://creativecommons.org/licenses/by/2.0/" rel="license noopener">CC BY 2.0</a>
        授權。使用 Flickr 提供之 1024px 尺寸，未另行修改。
      </p>
      <p>
        本站內容為一般健康資訊，<strong>不能取代醫師的診察、診斷或治療</strong>。
        身體不適請至醫療院所就診。
      </p>
      <p>© 2026 林士傑醫師/屏東仁心骨科診所</p>
    </div>
  </div>
</footer>

</body>
</html>
`;

fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "index.html"), html, "utf8");

console.log(`✓ 已建立 public/${slug}/index.html`);
console.log(`  網址會是  /${slug}/`);
console.log(`  計數器 id  ${counter}\n`);

execFileSync("node", [path.join(ROOT, "tools", "build.mjs")], { cwd: ROOT, stdio: "inherit" });

console.log(`\n接下來：把檔案裡的 TODO 換成實際內容，再跑一次 npm run build。`);

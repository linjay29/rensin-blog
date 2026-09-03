#!/usr/bin/env node
/* ===========================================================================
   建置腳本 — 自動維護「最後更新日期」與首頁卡片索引
   ---------------------------------------------------------------------------
   做三件事：

   1. 掃描 public/ 底下所有 YYYYMMDD-slug/index.html 文章
   2. 依「最後一次真正改動的時間」重寫每篇的 post:updated 與畫面上的更新日期
      · 檔案有未提交的修改 → 今天
      · 檔案乾淨且在 git 裡   → 該檔最後一次 commit 的日期
      · 沒有 git             → 檔案的 mtime
   3. 重建首頁 <!-- POSTS:START --> ~ <!-- POSTS:END --> 之間的卡片，
      依「發表日期」排序（最新的在前），並產生 sitemap.xml
   4. 重建首頁 <!-- TAGS:START --> ~ <!-- TAGS:END --> 之間的分類篩選鈕

   卡片是「直接寫進 HTML」的靜態內容，不靠 JavaScript 讀 JSON 生成，
   搜尋引擎抓首頁時就看得到全部文章。

   用法：  node tools/build.mjs        （或 npm run build）
   =========================================================================== */

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");
const INDEX = path.join(PUBLIC, "index.html");

/* 正式站網址，只用來產生 sitemap.xml。換網域時改這裡。
   （另外還有兩個地方要一起改：public/robots.txt 的 Sitemap 行、
     public/index.html 的 <link rel="canonical">） */
const SITE_URL = "https://rensin-clinic.sclin.net";

/* 文章資料夾命名規則：20260802-introduction */
const SLUG_RE = /^\d{8}-[a-z0-9][a-z0-9-]*$/;

/* ------------------------------------------------------------------ 小工具 */

const todayISO = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const git = (args) => {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
};

const HAS_GIT = git(["rev-parse", "--is-inside-work-tree"]) === "true";

/* 讀 <meta name="post:xxx" content="..."> */
function readMeta(html, key) {
  const re = new RegExp(
    `<meta\\s+name=["']${key.replace(":", "\\:")}["']\\s+content=["']([^"']*)["']`,
    "i"
  );
  const m = html.match(re);
  return m ? m[1] : null;
}

/* 這個檔案「最後真的被改動」是哪一天 --------------------------------------- */
function lastChanged(absFile) {
  const rel = path.relative(ROOT, absFile).split(path.sep).join("/");

  if (HAS_GIT) {
    const tracked = git(["ls-files", "--error-unmatch", rel]) !== null;
    if (!tracked) return todayISO();                       // 全新檔案

    // --quiet 有差異時回傳非 0 → git() 吃到例外回 null
    const clean = git(["diff", "--quiet", "HEAD", "--", rel]) !== null;
    if (!clean) return todayISO();                         // 改過但還沒 commit

    const committed = git(["log", "-1", "--format=%cs", "--", rel]);
    if (committed) return committed;                       // 例：2026-08-02
  }

  const d = fs.statSync(absFile).mtime;
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* 中文句中斷行檢查 ---------------------------------------------------------
   中文沒有詞間空格，但 HTML 會把原始碼的換行摺成一個半形空格。
   只要斷行落在句中（尤其 <strong>、<a> 前後），畫面上就會多出可見的空隙，
   例如「並任 微美時尚診所」「檢測、 高層次超音波…」。

   偵測要點：不能只做純文字比對。把標籤剝光之後，相鄰的 <li>、<td>
   看起來也像句中斷行，但它們是不同區塊，實際不會產生空格
   （2026-08-28 用純文字掃出 98 處，真正有問題的只有 7 處）。

   作法：把「區塊級標籤」與 <br> 換成硬邊界，剝掉行內標籤後依邊界切段，
   每段各自摺疊空白，只在同一段行內文字流裡找「全形字 + 半形空格 + 全形字」。
   =========================================================================== */

/* 全形字：CJK 標點（不含 U+3000 全形空格，那是刻意用在標語上的）、
   中日韓文字、全形英數符號 */
const FULLWIDTH = "\\u3001-\\u303F\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uFF01-\\uFF65";

/* 句末標點之後允許斷行：。！？；
   全形句號本身已帶尾隙，後面多一個半形空格看不出來，
   而每句一行是可讀性最好的寫法，不必為此把整段擠成一行。
   句中、頓號（、）、逗號（，）、括號後的空格則會露出來，一律視為錯誤。 */
const SENTENCE_END = "\\u3002\\uFF01\\uFF1F\\uFF1B";
const BAD_SPACE = new RegExp(`[${FULLWIDTH}] [${FULLWIDTH}]`);
const ALLOWED = new RegExp(`[${SENTENCE_END}] `);

/* 這些標籤兩側視為硬邊界，跨越它們的空白不會顯示成句中空格。
   span 也列入：本站的 span 不是 flex 項目（.card-foot、.post-meta —— flex
   項目之間的空白會被瀏覽器丟棄），就是獨立標籤（.callout .label），
   都不會和前後文字連成同一段。 */
const BLOCK_TAGS =
  "html|head|body|div|p|ul|ol|li|dl|dt|dd|table|thead|tbody|tfoot|tr|td|th|" +
  "h1|h2|h3|h4|h5|h6|section|article|header|footer|nav|main|aside|figure|" +
  "figcaption|blockquote|pre|hr|form|caption|option|br|script|style|span";

/* 邊界哨兵。不能用空格，否則會和內文本身的空白混在一起分不出來。 */
const SEP = String.fromCharCode(0);

function findCjkSpacing(html) {
  let s = html;

  s = s.replace(/<!--[\s\S]*?-->/g, "");                    // 註解不產生空白
  s = s.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "");    // 程式碼不是內文

  // 區塊標籤與 <br> → 硬邊界
  s = s.replace(new RegExp(`</?(?:${BLOCK_TAGS})\\b[^>]*>`, "gi"), SEP);

  // 標籤與標籤之間的純空白 → 直接抹掉，不算句中空格。
  // 這種位置多半是 flex／grid 容器裡的並列項目（.nav 的連結、
  // .card-foot 與 .post-meta 的欄位），瀏覽器會丟棄項目間的空白。
  // 真正會顯示出來的，是「文字」旁邊的換行，那才是要抓的。
  s = s.replace(/>\s+</g, "><");

  s = s.replace(/<[^>]+>/g, "");                             // 其餘為行內標籤，直接剝掉

  const hits = [];
  const scan = new RegExp(`[${FULLWIDTH}] [${FULLWIDTH}]`, "g");

  for (const seg of s.split(SEP)) {
    // 摺疊空白，同瀏覽器：只摺半形空白。全形空格（U+3000）在
    // white-space:normal 下不會被瀏覽器摺疊，是刻意留在標題上的間距。
    const text = seg.replace(/[ \t\r\n\f\v]+/g, " ").trim();
    if (!text || !BAD_SPACE.test(text)) continue;

    scan.lastIndex = 0;
    let m;
    while ((m = scan.exec(text)) !== null) {
      if (ALLOWED.test(m[0])) continue;                      // 句末標點後可斷行
      const from = Math.max(0, m.index - 12);
      hits.push(text.slice(from, m.index + m[0].length + 12));
      scan.lastIndex = m.index + 1;                          // 允許相鄰的重疊比對
    }
  }
  return hits;
}

function checkCjkSpacing() {
  const files = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".html")) files.push(p);
    }
  })(PUBLIC);

  let total = 0;
  for (const file of files.sort()) {
    const hits = findCjkSpacing(fs.readFileSync(file, "utf8"));
    if (!hits.length) continue;
    if (!total) console.error("\n✗ 發現中文句中斷行（畫面上會多出空格）：");
    console.error(`  ${path.relative(ROOT, file).split(path.sep).join("/")}`);
    for (const h of hits) console.error(`     …${h}…`);
    total += hits.length;
  }

  if (total) {
    console.error(
      `\n共 ${total} 處。原始碼的換行會被瀏覽器摺成一個半形空格，` +
        `\n中文沒有詞間空格，斷在句中就會露出來。` +
        `\n修法：把斷點移到標點之後，或整句（整條清單）不要斷行。\n`
    );
    process.exit(1);
  }
  console.log(`→ 中文斷行檢查：${files.length} 個頁面，無問題`);
}

/* 靜態資源加版本號（cache busting）---------------------------------------
   Cloudflare Pages 對 assets 送的是 Cache-Control: max-age=14400（4 小時）。
   HTML 更新了但 site.css 的網址沒變，瀏覽器就會拿舊的 CSS 配新的 HTML，
   結果是新加的 class 沒有樣式、被刪掉的舊規則還在生效 —— 畫面壞掉但重新
   部署也修不好，只能叫人硬重新整理。

   解法：把檔案內容的雜湊掛在網址後面。內容一改，網址就變，
   舊的快取自然失效，新的一定拿得到。 */
const ASSET_HASHES = new Map();

function assetHash(relPath) {
  if (ASSET_HASHES.has(relPath)) return ASSET_HASHES.get(relPath);
  const file = path.join(PUBLIC, relPath);
  let h = "";
  if (fs.existsSync(file)) {
    h = crypto.createHash("md5").update(fs.readFileSync(file)).digest("hex").slice(0, 8);
  }
  ASSET_HASHES.set(relPath, h);
  return h;
}

/* 會加上版本號的檔案（相對於 public/）*/
const VERSIONED = ["assets/site.css", "assets/counter.js", "assets/filter.js"];

function stampAssetVersions(html) {
  let out = html;
  for (const rel of VERSIONED) {
    const v = assetHash(rel);
    if (!v) continue;
    const name = rel.replace(/^assets\//, "");
    // 比對 assets/x.css、../assets/x.css、/assets/x.css，
    // 先吃掉舊的 ?v=xxxx 再重掛，重複執行不會越接越長
    const re = new RegExp(
      `((?:\\.\\./|/)?assets/${name.replace(/\./g, "\\.")})(\\?v=[0-9a-f]+)?`,
      "g"
    );
    out = out.replace(re, `$1?v=${v}`);
  }
  return out;
}

/* og:url / og:image 一定要是絕對網址 -----------------------------------------
   Facebook、LINE 抓分享預覽時不會自己補上網域，
   寫成相對路徑（assets/cover.jpg）的話預覽圖就是空的。
   這裡統一用 SITE_URL 補成絕對網址，順便把 og:url 也補上。 */
function stampOpenGraph(html, slug) {
  const base = `${SITE_URL}/${slug}/`;
  let out = html;

  // og:image：已經是 http(s) 就不動，相對路徑才補
  out = out.replace(
    /(<meta\s+property=["']og:image["']\s+content=["'])([^"']*)(["'])/i,
    (all, open, val, close) =>
      /^https?:\/\//i.test(val) ? all : `${open}${base}${val.replace(/^\.?\//, "")}${close}`
  );

  // og:url：有就更新，沒有就補在 og:image（或 og:locale）後面
  if (/<meta\s+property=["']og:url["']/i.test(out)) {
    out = out.replace(
      /(<meta\s+property=["']og:url["']\s+content=["'])[^"']*(["'])/i,
      `$1${base}$2`
    );
  } else {
    out = out.replace(
      /(<meta\s+property=["']og:(?:image|locale)["'][^>]*>)/i,
      `$1\n<meta property="og:url" content="${base}">`
    );
  }

  return out;
}

/* 把更新日期寫回文章 HTML -------------------------------------------------- */
function stampUpdated(html, date) {
  let out = html;

  // 1) <meta name="post:updated" content="...">
  out = out.replace(
    /(<meta\s+name=["']post:updated["']\s+content=["'])[^"']*(["'])/i,
    `$1${date}$2`
  );

  // 2) 畫面上所有帶 data-post-updated 的元素（datetime 屬性 + 內文）
  out = out.replace(
    /(<(time|span)\b[^>]*\bdata-post-updated\b[^>]*>)([\s\S]*?)(<\/\2>)/gi,
    (_all, open, tag, _inner, close) => {
      const opened = open.replace(/(\bdatetime=["'])[^"']*(["'])/i, `$1${date}$2`);
      return `${opened}${date}${close}`;
    }
  );

  return out;
}

/* ------------------------------------------------------------------ 主流程 */

function collectPosts() {
  return fs
    .readdirSync(PUBLIC, { withFileTypes: true })
    .filter((e) => e.isDirectory() && SLUG_RE.test(e.name))
    .map((e) => {
      const slug = e.name;
      const file = path.join(PUBLIC, slug, "index.html");
      if (!fs.existsSync(file)) {
        console.warn(`  ! 略過 ${slug}／找不到 index.html`);
        return null;
      }

      const html = fs.readFileSync(file, "utf8");
      const title = readMeta(html, "post:title");
      if (!title) {
        console.warn(`  ! 略過 ${slug}／缺少 <meta name="post:title">`);
        return null;
      }

      return {
        slug,
        file,
        html,
        title,
        summary: readMeta(html, "post:summary") || "",
        tag: readMeta(html, "post:tag") || "文章",
        author: readMeta(html, "post:author") || "林士傑醫師",
        published: readMeta(html, "post:published") || slugToDate(slug),
        counter: readMeta(html, "post:counter") || `rensin-${slug}`,
        cover: findCover(slug),
        updated: lastChanged(file)
      };
    })
    .filter(Boolean);
}

/* 卡片封面：約定俗成放在 <slug>/assets/cover.（jpg|png|webp）。
   找不到就回傳 null，卡片維持純文字版面——舊文沒有配圖也不會破版。 */
function findCover(slug) {
  for (const ext of ["jpg", "jpeg", "png", "webp"]) {
    const rel = `${slug}/assets/cover.${ext}`;
    if (fs.existsSync(path.join(PUBLIC, rel))) return rel;
  }
  return null;
}

function slugToDate(slug) {
  const d = slug.slice(0, 8);
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

function renderCard(p) {
  /* 發表日期一定顯示；改過的文章才多顯示一行「更新」。
     舊文搬家時這兩個日期會差很多，分開顯示才不會讓 2019 年的文章
     看起來像今天寫的。 */
  const dates =
    p.updated === p.published
      ? `<span>${p.published}</span>`
      : `<span>${p.published}</span>\n              <span>更新 ${p.updated}</span>`;

  /* 有封面就放圖。alt 留空：標題就在圖的正下方，讀螢幕的人不需要聽兩次。 */
  const cover = p.cover
    ? `\n          <span class="card-cover"><img src="${p.cover}" alt="" loading="lazy" decoding="async"></span>`
    : "";

  return `        <a class="card" href="${p.slug}/" data-tag="${escapeHtml(p.tag)}">${cover}
          <span class="card-body">
            <span class="tag">${escapeHtml(p.tag)}</span>
            <h3>${escapeHtml(p.title)}</h3>
            <p>${escapeHtml(p.summary)}</p>
            <span class="card-foot">
              <span>${escapeHtml(p.author)}</span>
              ${dates}
              <span class="counter" data-counter-view="${escapeHtml(p.counter)}" hidden><b class="num">0</b> 次瀏覽</span>
            </span>
          </span>
        </a>`;
}

/* 分類篩選鈕：依文章數量由多到少排，數量相同時照筆畫（localeCompare）*/
function renderTagFilter(posts) {
  const counts = new Map();
  for (const p of posts) counts.set(p.tag, (counts.get(p.tag) || 0) + 1);

  const tags = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hant")
  );

  const buttons = [
    `        <button type="button" class="chip is-on" data-filter="*">全部 <b>${posts.length}</b></button>`,
    ...tags.map(
      ([tag, n]) =>
        `        <button type="button" class="chip" data-filter="${escapeHtml(tag)}">${escapeHtml(tag)} <b>${n}</b></button>`
    )
  ];
  return buttons.join("\n");
}

function writeSitemap(posts, siteUpdated) {
  const urls = [
    { loc: `${SITE_URL}/`, lastmod: siteUpdated },
    ...posts.map((p) => ({ loc: `${SITE_URL}/${p.slug}/`, lastmod: p.updated }))
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n  </url>`).join("\n")}
</urlset>
`;
  fs.writeFileSync(path.join(PUBLIC, "sitemap.xml"), xml, "utf8");
}

function main() {
  console.log("→ 掃描文章…");
  const posts = collectPosts();
  if (!posts.length) {
    console.error("找不到任何文章，停止。");
    process.exit(1);
  }

  /* 1) 把更新日期寫回每篇文章 */
  for (const p of posts) {
    const next = stampAssetVersions(
      stampOpenGraph(stampUpdated(p.html, p.updated), p.slug)
    );
    if (next !== p.html) {
      fs.writeFileSync(p.file, next, "utf8");
      console.log(`  ✎ ${p.slug} → 更新日期 ${p.updated}`);
    } else {
      console.log(`  · ${p.slug}   更新日期 ${p.updated}（無變動）`);
    }
  }

  /* 2) 排序：發表日期新的在前
     ------------------------------------------------------------------
     ⚠️ 這裡刻意「不」用最後更新日期排序。
     舊站文章搬過來時，每一篇的更新日期都會是搬家的那一天，
     照更新日期排的話，首頁會變成一整排同一天、順序還是隨機的舊文。
     照發表日期排，2019 年的文章就會乖乖待在 2026 年的文章後面。 */
  posts.sort(
    (a, b) =>
      b.published.localeCompare(a.published) ||
      b.updated.localeCompare(a.updated) ||
      b.slug.localeCompare(a.slug)
  );

  /* 3) 重建首頁卡片 */
  let index = fs.readFileSync(INDEX, "utf8");
  const START = "<!-- POSTS:START -->";
  const END = "<!-- POSTS:END -->";
  const s = index.indexOf(START);
  const e = index.indexOf(END);
  if (s === -1 || e === -1 || e < s) {
    console.error(`public/index.html 找不到 ${START} / ${END} 標記，停止。`);
    process.exit(1);
  }

  const cards = posts.map(renderCard).join("\n");
  index = index.slice(0, s + START.length) + "\n" + cards + "\n" + index.slice(e);

  /* 4) 重建分類篩選鈕（沒有這兩個標記就跳過，不擋建置） */
  const T_START = "<!-- TAGS:START -->";
  const T_END = "<!-- TAGS:END -->";
  const ts = index.indexOf(T_START);
  const te = index.indexOf(T_END);
  if (ts !== -1 && te !== -1 && te > ts) {
    const chips = renderTagFilter(posts);
    index = index.slice(0, ts + T_START.length) + "\n" + chips + "\n" + index.slice(te);
    console.log("→ 分類篩選鈕已重建");
  }

  /* 5) 首頁自己的最後更新時間 = 全站「最後被改動」的那一篇
     （注意：不是 posts[0]，因為卡片是照發表日期排的） */
  const siteUpdated = posts.reduce(
    (max, p) => (p.updated > max ? p.updated : max),
    posts[0].updated
  );
  index = index.replace(
    /(<span\b[^>]*\bdata-site-updated\b[^>]*>)([\s\S]*?)(<\/span>)/i,
    `$1${siteUpdated}$3`
  );

  index = stampAssetVersions(index);
  fs.writeFileSync(INDEX, index, "utf8");
  console.log(`→ 首頁卡片已重建：${posts.length} 篇，發表日新的在前`);
  console.log(`  排序：${posts.map((p) => `${p.slug}(發表 ${p.published})`).join(" › ")}`);

  /* 6) 404.html 不是文章，但同樣載入 site.css，也要蓋版本號 */
  const notFound = path.join(PUBLIC, "404.html");
  if (fs.existsSync(notFound)) {
    const before = fs.readFileSync(notFound, "utf8");
    const after = stampAssetVersions(before);
    if (after !== before) {
      fs.writeFileSync(notFound, after, "utf8");
      console.log("→ 404.html 資源版本號已更新");
    }
  }

  console.log(
    `→ 靜態資源版本：${VERSIONED.filter((r) => assetHash(r))
      .map((r) => `${r.replace("assets/", "")}=${assetHash(r)}`)
      .join("  ")}`
  );

  writeSitemap(posts, siteUpdated);
  console.log("→ sitemap.xml 已產生");

  /* 7) 最後才檢查，此時 HTML 已是實際要部署的內容 */
  checkCjkSpacing();

  console.log("完成。");
}

main();

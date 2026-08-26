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
        updated: lastChanged(file)
      };
    })
    .filter(Boolean);
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
      : `<span>${p.published}</span>\n            <span>更新 ${p.updated}</span>`;

  return `        <a class="card" href="${p.slug}/" data-tag="${escapeHtml(p.tag)}">
          <span class="tag">${escapeHtml(p.tag)}</span>
          <h3>${escapeHtml(p.title)}</h3>
          <p>${escapeHtml(p.summary)}</p>
          <span class="card-foot">
            <span>${escapeHtml(p.author)}</span>
            ${dates}
            <span class="counter" data-counter-view="${escapeHtml(p.counter)}" hidden><b class="num">0</b> 次瀏覽</span>
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
    const next = stampOpenGraph(stampUpdated(p.html, p.updated), p.slug);
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

  fs.writeFileSync(INDEX, index, "utf8");
  console.log(`→ 首頁卡片已重建：${posts.length} 篇，發表日新的在前`);
  console.log(`  排序：${posts.map((p) => `${p.slug}(發表 ${p.published})`).join(" › ")}`);

  writeSitemap(posts, siteUpdated);
  console.log("→ sitemap.xml 已產生");
  console.log("完成。");
}

main();

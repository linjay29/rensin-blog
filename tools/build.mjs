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
      依最後更新時間排序（最新的在前），並產生 sitemap.xml

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

/* 正式站網址，只用來產生 sitemap.xml。換網域時改這裡。 */
const SITE_URL = "https://rensin-blog.pages.dev";

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
  return `        <a class="card" href="${p.slug}/">
          <span class="tag">${escapeHtml(p.tag)}</span>
          <h3>${escapeHtml(p.title)}</h3>
          <p>${escapeHtml(p.summary)}</p>
          <span class="card-foot">
            <span>${escapeHtml(p.author)}</span>
            <span>更新 ${p.updated}</span>
            <span class="counter" data-counter-view="${escapeHtml(p.counter)}" hidden><b class="num">0</b> 次瀏覽</span>
          </span>
        </a>`;
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
    const next = stampUpdated(p.html, p.updated);
    if (next !== p.html) {
      fs.writeFileSync(p.file, next, "utf8");
      console.log(`  ✎ ${p.slug} → 更新日期 ${p.updated}`);
    } else {
      console.log(`  · ${p.slug}   更新日期 ${p.updated}（無變動）`);
    }
  }

  /* 2) 排序：最後更新新的在前；同日則發表日新的在前 */
  posts.sort(
    (a, b) =>
      b.updated.localeCompare(a.updated) ||
      b.published.localeCompare(a.published) ||
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

  /* 4) 首頁自己的最後更新時間 = 全站最新的那一篇 */
  const siteUpdated = posts[0].updated;
  index = index.replace(
    /(<span\b[^>]*\bdata-site-updated\b[^>]*>)([\s\S]*?)(<\/span>)/i,
    `$1${siteUpdated}$3`
  );

  fs.writeFileSync(INDEX, index, "utf8");
  console.log(`→ 首頁卡片已重建：${posts.length} 篇，最新在前`);
  console.log(`  排序：${posts.map((p) => `${p.slug}(${p.updated})`).join(" › ")}`);

  writeSitemap(posts, siteUpdated);
  console.log("→ sitemap.xml 已產生");
  console.log("完成。");
}

main();

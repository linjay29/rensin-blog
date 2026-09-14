/* 把 public/_draft-<slug>/ 複製成 public/preview/<slug>/，部署到線上給傑哥用手機看。
   - 加 noindex，robots.txt 也擋掉 /preview/
   - 相對路徑多一層，所以 ../ 要變成 ../../
   用法：node tools/preview-publish.mjs            → 全部草稿
        node tools/preview-publish.mjs <slug>...  → 指定幾篇        */
import fs from "node:fs";
import path from "node:path";

const PUB = path.join(process.cwd(), "public");
const OUT = path.join(PUB, "preview");

const drafts = fs.readdirSync(PUB).filter((d) => d.startsWith("_draft-"));
const want = process.argv.slice(2);
const pick = want.length
  ? drafts.filter((d) => want.some((w) => d.includes(w)))
  : drafts;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const index = [];
for (const d of pick) {
  const slug = d.replace(/^_draft-/, "");
  const from = path.join(PUB, d);
  const to = path.join(OUT, slug);
  fs.cpSync(from, to, { recursive: true });

  const f = path.join(to, "index.html");
  let s = fs.readFileSync(f, "utf8");
  s = s.replace(/(href|src)="\.\.\//g, '$1="../../');
  s = s.replace(
    /<meta name="viewport"[^>]*>/,
    (m) => `${m}\n<meta name="robots" content="noindex,nofollow">`,
  );
  fs.writeFileSync(f, s);

  const title = (s.match(/<meta name="post:title"\s+content="([^"]*)"/) || [])[1] || slug;
  const tag = (s.match(/<meta name="post:tag"\s+content="([^"]*)"/) || [])[1] || "";
  index.push({ slug, title, tag });
  console.log(`  preview/${slug}/  ${title}`);
}

const list = index
  .map((p) => `      <li><a href="${p.slug}/">${p.title}</a>　<small>${p.tag}</small></li>`)
  .join("\n");

fs.writeFileSync(
  path.join(OUT, "index.html"),
  `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>草稿預覽</title>
<link rel="stylesheet" href="../assets/site.css">
</head>
<body>
<main class="wrap">
  <div class="prose">
    <h1>草稿預覽</h1>
    <p>還沒上線的稿子，只有拿到網址的人看得到，搜尋不到。</p>
    <ul>
${list}
    </ul>
  </div>
</main>
</body>
</html>
`,
);
console.log(`共 ${index.length} 篇 → public/preview/`);

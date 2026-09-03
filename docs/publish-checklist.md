# 發布一篇文章的完整流程

一篇文章不是 push 上線就結束，網站只是落地頁。真正帶人進來的是 FB 貼文、
IG 貼文與 IG 限動這三個入口，而三個入口要的文案與圖檔規格都不一樣。
這份清單就是把「上線 → 生素材 → 三個平台發布」一次走完的順序。

以下用 `<slug>` 代表 `YYYYMMDD-短名`，例如 `20260903-fall-tailbone`。

---

## A. 文章上線

- [ ] **定稿**：草稿在 `public/_draft-<slug>/`，定稿後把資料夾改名成 `public/<slug>/`
      （`_draft-` 開頭的資料夾 build 不收，deploy 也會在打包前刪掉，網址打對也開不了）
- [ ] **封面圖**：`public/<slug>/assets/cover.jpg`
      首頁卡片會自動抓這個路徑，不用另外設定；沒有這張圖就是純文字卡
- [ ] **內文圖**：其餘配圖放同一個 `assets/`，在 HTML 裡用相對路徑引用
- [ ] **build 通過**

      ```bash
      node tools/build.mjs
      ```

      會重算更新日期、重建首頁卡片與 sitemap，並跑中文斷行檢查。
      有錯就會擋下來，不要繞過。

- [ ] **commit + push 到 main**，GitHub Actions 自動部署（約 40 秒）
- [ ] **驗證線上**

      ```bash
      curl -s -o /dev/null -w "%{http_code}\n" https://rensin-clinic.sclin.net/<slug>/
      ```

      文章頁要 200、首頁要看得到新卡片、其他草稿網址要 404

---

## B. 生社群素材

- [ ] **無字原圖**：Gemini 生成時一律要求 `No text, no lettering, no numbers`，
      中文一律由我們自己合成（AI 畫的中文字必壞）。原圖收進
      `assets-src/<slug>/cover-src.jpg`（`assets-src/` 不進版控、不部署）
- [ ] **重點文字檔**：`assets-src/<slug>/social-card.txt`，UTF-8，一行一項

      ```
      標題
      重點一（不超過 18 字）
      重點二
      重點三
      林士傑醫師
      ```

- [ ] **生圖**（一次產出方形與限動兩張）

      ```bash
      powershell -NoProfile -ExecutionPolicy Bypass -File tools/social-card.ps1 -Src assets-src/<slug>/cover-src.jpg -Text assets-src/<slug>/social-card.txt -Out assets-src/<slug>/social-fb.png
      ```

      產出 `social-fb.png`（2048×2048）與 `social-fb-story.png`（1080×1920）

- [ ] **文案**：`assets-src/<slug>/social.txt`，一個檔案裝三份——
      FB 貼文、FB 第一則留言、IG 貼文

---

## C. 三個平台的差別

|            | FB 貼文                  | IG 貼文                    | IG 限動                |
| ---------- | ------------------------ | -------------------------- | ---------------------- |
| 圖         | 方形 2048×2048           | 方形 2048×2048             | 直式 1080×1920         |
| 連結能不能點 | 內文可以但會降觸及；留言可以 | **都不能點**                 | 連結貼紙可以           |
| 連結放哪   | **第一則留言**             | 寫「連結在個人檔案」          | **連結貼紙**             |
| 文案長度   | 可以鋪陳，段落正常          | 短句、多換行，前兩行是鉤子     | 不放字，留白給貼紙       |
| hashtag    | 5～6 個                   | 15 個左右                   | 不用                   |

IG 留言的連結**一樣不能點**，所以 IG 沒有「放留言」這招。
IG 真正的點擊幾乎都來自限動的連結貼紙。

---

## D. 發布順序

- [ ] **FB**：貼方形圖 + FB 文案（內文不放連結）→ 自己在第一則留言貼文章連結
- [ ] **IG 貼文**：貼方形圖 + IG 文案（結尾「連結在個人檔案」）
- [ ] **IG 限動**：直式圖 → 貼紙 → 連結 → 貼上文章網址 →
      貼紙文字改成「看完整說明」→ 拖到圖片下方那塊空白 → 發布
- [ ] **限動存精選**：發布後點「更多 → 精選」，收進「衛教文章」，24 小時後還在
- [ ] **bio 連結**固定指到 https://rensin-clinic.sclin.net/
      （首頁就是文章列表，新文章自動排最上面，不必每篇改一次 bio）

---

## E. 我每次發布完要交付的清單

文章上線之後，一次把下面這些列給傑哥，不要讓他自己去翻對話：

1. 文章網址（線上驗證過的）
2. FB 貼文文案
3. FB 第一則留言（文章連結）
4. FB／IG 貼文圖：`social-fb.png` 2048×2048
5. IG 貼文文案（含 hashtag）
6. IG 限動圖：`social-fb-story.png` 1080×1920
7. 限動連結貼紙要貼的網址

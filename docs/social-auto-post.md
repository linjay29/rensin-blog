# FB／IG 自動發文

一句話就把文章的 FB 與 IG 一起送出去。

**權杖是傑哥的，存在本機 `.env`，不進版控、session 不經手。**
下面「你要做的」全部由傑哥本人操作；我只負責寫程式與跑指令。

---

## 為什麼後台那個權限清單不用管

2026-09-13 卡在開發者後台的「權限與功能」清單載不出來。
**那一頁是給「應用程式審查」用的**——要讓**別人的帳號**授權你的 App 才需要送審。

我們只發**自己的粉專與自己的 IG**，而傑哥本人就是這個 App 的管理員。
這種情況叫「**開發模式 + 管理員自用**」，直接在 Graph API 測試工具裡勾權限產生權杖就好，
不必送審、不必等審核。

---

## 你要做的（一次性，約 15 分鐘）

### 1. 先確認 IG 是商業帳號，而且連到粉專

- IG App →「設定和隱私」→「帳號類型和工具」→ 切換成**商業帳號**（不是個人、不是創作者也可以，但商業最單純）
- FB 粉專 →「設定」→「連結的帳號」→ 確認 Instagram 已連結

⚠️ **IG 沒連到粉專，API 就發不了**，這是最常卡住的一步。

### 2. 在應用程式裡加產品

developers.facebook.com → 你的 App（**App ID 1777217390094603**）→「新增產品」：

- **Facebook 登入**
- **Instagram Graph API**（有些版面叫「Instagram」）

### 3. 產生使用者權杖（重點在這一步）

到 **Graph API 測試工具**（developers.facebook.com/tools/explorer）：

1. 右上角「Meta App」選你的 App
2. 「User or Page」選 **User Token**
3. 「Permissions」勾這五個：
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `instagram_basic`
   - `instagram_content_publish`
4. 按「Generate Access Token」→ 跳出 FB 登入視窗 → 同意

這一步跑完你會拿到一串**短效**使用者權杖（一兩個小時就過期），先複製下來。

### 4. 換成長效權杖，再拿粉專權杖

把短效權杖給我，我跑兩個指令換成長效的？**不行——權杖不經我手。**
所以這兩步你自己在瀏覽器貼網址跑：

**(a) 換長效使用者權杖（60 天）**

```
https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=<APP_ID>&client_secret=<APP_SECRET>&fb_exchange_token=<短效權杖>
```

**(b) 用長效使用者權杖拿粉專權杖（不會過期）**

```
https://graph.facebook.com/v21.0/me/accounts?access_token=<長效使用者權杖>
```

回傳裡找到「林士傑醫師/仁心骨科診所」，記下它的 `id`（粉專 ID）與 `access_token`（粉專權杖）。

**(c) 拿 IG 商業帳號 ID**

```
https://graph.facebook.com/v21.0/<粉專ID>?fields=instagram_business_account&access_token=<粉專權杖>
```

### 5. 寫進本機 .env

在專案根目錄建 `.env`（`.gitignore` 已經擋掉，不會進版控）：

```
FB_PAGE_ID=<粉專 ID>
FB_PAGE_TOKEN=<粉專權杖>
IG_USER_ID=<IG 商業帳號 ID>
```

寫好跟我說一聲，我跑 `node tools/social-post.mjs --check` 驗證能不能連上。
**我不會打開 .env，也不會把內容印出來。**

---

## 我這邊負責的

- `tools/social-post.mjs`：讀 `.env`，發 FB 貼文 → 在第一則留言貼網址 → 發 IG 圖文
- 社群圖要放在**網站上**（IG 的 API 只吃公開網址，讀不到本機檔案）：
  出圖後放 `public/<slug>/assets/social-fb.jpg`，部署完才發文
- 文案沿用既有規格：FB 正文不放網址、網址放第一則留言；IG 前兩行是鉤子、CTA 寫「連結在個人檔案」

---

## 常見錯誤

| 訊息 | 意思 | 怎麼辦 |
|---|---|---|
| `(#200) Requires pages_manage_posts` | 權杖沒帶到那個權限 | 回步驟 3 重勾重產生 |
| `The user is not an Instagram Business` | IG 不是商業帳號或沒連粉專 | 回步驟 1 |
| `Media URL is not accessible` | 圖片網址不是公開的 | 圖要先部署到網站才能發 |
| `Error validating access token: Session has expired` | 權杖過期 | 粉專權杖若由長效使用者權杖取得就不會過期；重跑步驟 4 |

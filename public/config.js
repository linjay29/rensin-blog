/* Supabase 連線設定 ------------------------------------------------------
 *
 * 到 Supabase 專案的 Settings → API 取得這兩個值後填入：
 *
 *   url      = Project URL          例如 https://abcdefgh.supabase.co
 *   anonKey  = Publishable key（sb_publishable_... 開頭）
 *              舊專案則是 Legacy 分頁裡的 anon key
 *
 * 這組金鑰本來就是設計成放在前端的公開值，寫在這裡是正常用法，
 * 真正的權限由資料庫的 RLS 與 supabase-setup.sql 裡的函式控制。
 *
 * ⚠️ 絕對不要填 sb_secret_... 或 service_role key —— 那是全權限金鑰。
 *
 * 兩個值留空時，計數器會自動隱藏，網站其他部分照常運作。
 *
 * 目前沿用既有的 Supabase 專案，計數器 id 一律以 rensin- 開頭做區隔，
 * 不會和其他站台的數字互相干擾。要換成獨立專案時，改這兩個值並到新專案
 * 執行一次 supabase-setup.sql 即可。
 * ---------------------------------------------------------------------- */

window.SITE_CONFIG = {
  supabase: {
    url: "https://einthbblnuwitmimownw.supabase.co",
    anonKey: "sb_publishable_AXwlkEvxcea0mkU5yq0P9A_9hhhKepK"
  }
};

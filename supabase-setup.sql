-- ---------------------------------------------------------------------------
-- 文章瀏覽計數器 · Supabase 建置腳本
--
-- 使用方式：
--   1. 進入 Supabase 專案 → 左側 SQL Editor → New query
--   2. 把這整份貼上 → Run
--   3. 到 Settings → API 複製 Project URL 與 anon key，填進 public/config.js
--
-- 設計說明：
--   前端只拿得到 anon key，因此「不開放」直接讀寫資料表，
--   一律透過下面三個函式操作。函式以 security definer 執行，
--   前端無法竄改數值、無法歸零、也無法讀取其他資料。
--
--   本站每篇文章一個 id（rensin-<slug>），首頁自己也有一個（rensin-home）。
-- ---------------------------------------------------------------------------

-- 1) 計數資料表 --------------------------------------------------------------
create table if not exists public.page_counter (
  id         text        primary key,
  count      bigint      not null default 0,
  updated_at timestamptz not null default now()
);

comment on table public.page_counter is '各頁面的累計瀏覽次數';

-- 2) 開啟 RLS 且不建立任何 policy
--    → anon 角色對這張表完全沒有直接存取權限
alter table public.page_counter enable row level security;

-- 3) 遞增函式 ----------------------------------------------------------------
create or replace function public.increment_counter(counter_id text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count bigint;
begin
  -- 防止有人塞入超長字串灌爆資料表
  if counter_id is null or length(counter_id) > 64 then
    raise exception 'invalid counter_id';
  end if;

  insert into public.page_counter as c (id, count, updated_at)
  values (counter_id, 1, now())
  on conflict (id) do update
    set count = c.count + 1,
        updated_at = now()
  returning c.count into new_count;

  return new_count;
end;
$$;

comment on function public.increment_counter(text) is '瀏覽數加一並回傳新值，供前端 anon 角色呼叫';

-- 4) 唯讀查詢函式（單筆）-----------------------------------------------------
--    同一工作階段重新整理時，只讀值、不累加
create or replace function public.get_counter(counter_id text)
returns bigint
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select count from public.page_counter where id = counter_id), 0);
$$;

comment on function public.get_counter(text) is '只回傳目前瀏覽數，不做任何寫入';

-- 5) 唯讀查詢函式（批次）-----------------------------------------------------
--    首頁一次要顯示所有文章卡片的瀏覽數，用這個省下 N 次往返
create or replace function public.get_counters(counter_ids text[])
returns table (id text, count bigint)
language sql
security definer
stable
set search_path = public
as $$
  select c.id, c.count
  from public.page_counter c
  where c.id = any(counter_ids)
    and coalesce(array_length(counter_ids, 1), 0) <= 200;
$$;

comment on function public.get_counters(text[]) is '批次回傳多個頁面的瀏覽數，不做任何寫入';

-- 6) 權限 --------------------------------------------------------------------
revoke all on function public.increment_counter(text)  from public;
revoke all on function public.get_counter(text)        from public;
revoke all on function public.get_counters(text[])     from public;
grant execute on function public.increment_counter(text)  to anon, authenticated;
grant execute on function public.get_counter(text)        to anon, authenticated;
grant execute on function public.get_counters(text[])     to anon, authenticated;

-- 7) 初始化本站的計數列（可省略，函式會自動建立）----------------------------
insert into public.page_counter (id, count) values
  ('rensin-home',                        0),
  ('rensin-20260802-introduction',       0),
  ('rensin-20260802-clinic-guide',       0),
  ('rensin-20260802-frozen-shoulder',    0),
  ('rensin-20260802-trail-running',      0)
on conflict (id) do nothing;

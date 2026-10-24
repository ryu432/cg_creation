-- 端末間の同期のためのデータ。
-- タスク・プロジェクト・ルーティン・設定を、1件ずつ JSON のまま保存する
-- （アプリでタスクに項目を足しても、データベースを作り直さずに済むように）。
--
-- 安全のための決まり：
--   - 読み書きできるのは、ログインした本人の行だけ（RLS）。ログインしていない人は何もできない
--   - 同じ行を2つの端末から更新したときは、アプリで後から変更したほう（updated_at が新しいほう）を残す
--   - 削除は消さずに deleted = true にする（ほかの端末に「消えた」ことを伝えるため）

create table public.records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- 'task' / 'project' / 'routine' / 'setting'
  kind text not null check (kind in ('task', 'project', 'routine', 'setting')),
  -- アプリが作った ID（設定は 'planSettings' などの名前）
  id text not null check (char_length(id) between 1 and 100),
  data jsonb not null default '{}'::jsonb check (octet_length(data::text) <= 65536),
  deleted boolean not null default false,
  -- アプリで変更した時刻（どちらの変更を残すかの判断に使う）
  updated_at timestamptz not null,
  -- サーバーに届いた時刻（「前回から変わった分だけ」を取り出すのに使う。アプリからは書き換えられない）
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, kind, id)
);

create index records_user_server_updated_at on public.records (user_id, server_updated_at);

-- 古い変更で新しい変更を上書きしない。サーバーに届いた時刻はここで必ず付け直す
create function public.records_before_write() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.updated_at < old.updated_at then
      return null; -- この行は更新しない
    end if;
    -- 持ち主と種類・ID は変えさせない
    new.user_id := old.user_id;
    new.kind := old.kind;
    new.id := old.id;
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger records_before_write
before insert or update on public.records
for each row execute function public.records_before_write();

-- 本人の行だけ
alter table public.records enable row level security;

create policy "本人の行を読める" on public.records
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "本人の行を追加できる" on public.records
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "本人の行を更新できる" on public.records
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "本人の行を消せる" on public.records
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ログインしていない人には、表そのものを触らせない（RLS に加えた二重の守り）
revoke all on public.records from anon, public;
grant select, insert, update, delete on public.records to authenticated;

-- アカウントの削除：本人のアカウントと、その人のデータをすべて消す
create function public.delete_account() returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'ログインしていません';
  end if;
  delete from auth.users where id = me; -- records は on delete cascade で一緒に消える
end;
$$;

revoke all on function public.delete_account() from anon, public;
grant execute on function public.delete_account() to authenticated;

-- トリガー用の関数は直接呼ばせない
revoke all on function public.records_before_write() from anon, authenticated, public;

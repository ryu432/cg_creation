-- 同期データの安全確認（pgTAP）。`supabase test db` で実行する。
-- いちばん大事なのは「他人のデータを読めない・書けない・消せない」こと。
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- テスト用のユーザー A・B
insert into auth.users (id, instance_id, aud, role, email)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.com');

-- ===== A としてログイン =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$ insert into public.records (kind, id, data, updated_at)
     values ('task', 't1', '{"title":"Aのタスク"}', '2026-01-01T10:00:00Z') $$,
  'A は自分のタスクを追加できる'
);
select is((select count(*) from public.records), 1::bigint, 'A には自分のタスクが1件見える');
select is(
  (select user_id::text from public.records where id = 't1'),
  'aaaaaaaa-0000-0000-0000-000000000001',
  '持ち主は自動で A になる'
);
select ok(
  (select server_updated_at > '2026-01-01T00:00:00Z' from public.records where id = 't1'),
  'サーバーに届いた時刻はサーバーが付ける'
);

-- ===== B としてログイン =====
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);

select is((select count(*) from public.records), 0::bigint, 'B には A のタスクが見えない');
select is(
  (select count(*) from public.records where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  0::bigint,
  'B が A を指定して探しても見えない'
);
select throws_ok(
  $$ insert into public.records (user_id, kind, id, data, updated_at)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'task', 'evil', '{}', now()) $$,
  '42501',
  null,
  'B は A のデータとして追加できない'
);
update public.records set data = '{"title":"書き換え"}', updated_at = '2030-01-01T00:00:00Z' where id = 't1';
delete from public.records where id = 't1';
select lives_ok(
  $$ insert into public.records (kind, id, data, updated_at) values ('task', 't1', '{"title":"Bのタスク"}', now()) $$,
  'B は同じ ID でも自分のタスクとして追加できる（A とは別の行）'
);
select is((select count(*) from public.records), 1::bigint, 'B には自分のタスクだけが見える');

-- ===== A に戻って、B の操作の影響がないか確かめる =====
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(
  (select data->>'title' from public.records where id = 't1'),
  'Aのタスク',
  'B は A のタスクを書き換えられない・消せない'
);

-- どちらの変更を残すか（アプリで後から変更したほう）
update public.records set data = '{"title":"古い変更"}', updated_at = '2025-12-31T00:00:00Z' where id = 't1';
select is(
  (select data->>'title' from public.records where id = 't1'),
  'Aのタスク',
  '古い変更では、新しい内容を上書きしない'
);
update public.records set data = '{"title":"新しい変更"}', updated_at = '2026-01-02T00:00:00Z' where id = 't1';
select is(
  (select data->>'title' from public.records where id = 't1'),
  '新しい変更',
  '新しい変更は反映される'
);

-- 持ち主を B に書き換えようとしても変わらない
update public.records set user_id = 'bbbbbbbb-0000-0000-0000-000000000002', updated_at = '2026-01-03T00:00:00Z' where id = 't1';
select is(
  (select user_id::text from public.records where id = 't1'),
  'aaaaaaaa-0000-0000-0000-000000000001',
  '持ち主は書き換えられない'
);

-- 削除は「消えた」印を付ける
update public.records set deleted = true, updated_at = '2026-01-04T00:00:00Z' where id = 't1';
select is((select deleted from public.records where id = 't1'), true, '削除の印を付けられる');

-- おかしなデータは入れられない
select throws_ok(
  $$ insert into public.records (kind, id, data, updated_at) values ('password', 'x', '{}', now()) $$,
  '23514',
  null,
  '決まった種類以外は入れられない'
);
select throws_ok(
  $$ insert into public.records (kind, id, data, updated_at)
     values ('task', 'big', jsonb_build_object('note', repeat('あ', 30000)), now()) $$,
  '23514',
  null,
  '大きすぎるデータは入れられない'
);
select throws_ok(
  $$ insert into public.records (kind, id, data, updated_at) values ('task', '', '{}', now()) $$,
  '23514',
  null,
  '空の ID は入れられない'
);

-- ===== ログインしていない人 =====
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$ select * from public.records $$,
  '42501',
  null,
  'ログインしていない人は読めない'
);
select throws_ok(
  $$ insert into public.records (user_id, kind, id, data, updated_at)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'task', 'x', '{}', now()) $$,
  '42501',
  null,
  'ログインしていない人は書けない'
);
select throws_ok(
  $$ select public.delete_account() $$,
  '42501',
  null,
  'ログインしていない人はアカウント削除を呼べない'
);

-- ===== B がアカウントを削除 =====
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
select public.delete_account();

reset role;
select is(
  (select count(*) from public.records where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  0::bigint,
  'アカウントを削除すると、その人のデータは全部消える'
);
select is(
  (select count(*) from public.records where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  1::bigint,
  'ほかの人のデータは消えない'
);

select * from finish();
rollback;

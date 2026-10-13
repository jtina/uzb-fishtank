-- Class Fish Tank: database setup for Supabase.
--
-- Run this whole file once in Supabase → SQL Editor. It only creates fishtank_* tables and functions,
-- and is safe to run again after an update.
--
-- Then set the teacher PIN by running this line on its own (it is not saved in this file):
--   select fishtank_set_pin('1234');
--
-- How it is protected: the tables have row level security on and no policies, so the public
-- (anon) key cannot read or write them. The app only calls the fishtank_* functions below, and each
-- one checks the PIN on the server. After 10 wrong PINs from one address in 10 minutes, that address
-- is blocked until the 10 minutes are up.

create extension if not exists pgcrypto with schema extensions;

-- ---------- Tables ----------

create table if not exists public.fishtank_config (
  id int primary key default 1 check (id = 1),
  pin_hash text,
  title text,
  max_feed int not null default 50,
  updated_at timestamptz not null default now()
);
insert into public.fishtank_config (id) values (1) on conflict (id) do nothing;

create table if not exists public.fishtank_students (
  id text primary key,
  name text not null,
  type text not null,
  color int not null default 0,
  food int not null default 0 check (food >= 0),
  created_at timestamptz not null default clock_timestamp()
);

create table if not exists public.fishtank_decor (
  id text primary key,
  kind text not null,
  x real not null default 50,
  size real not null default 1,
  flip boolean not null default false,
  z int not null default 0
);

create table if not exists public.fishtank_pin_failures (
  ip text not null,
  at timestamptz not null default now()
);
create index if not exists fishtank_pin_failures_ip_at on public.fishtank_pin_failures (ip, at);

alter table public.fishtank_config enable row level security;
alter table public.fishtank_students enable row level security;
alter table public.fishtank_decor enable row level security;
alter table public.fishtank_pin_failures enable row level security;
revoke all on public.fishtank_config, public.fishtank_students, public.fishtank_decor, public.fishtank_pin_failures from anon, authenticated;

-- ---------- PIN check (internal) ----------

-- Returns null when the PIN is right, otherwise an error code. Wrong PINs are recorded, so this
-- returns instead of raising (raising would roll the record back).
create or replace function public._fishtank_pin_error(p_pin text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_headers json := nullif(current_setting('request.headers', true), '')::json;
  v_ip text := coalesce(nullif(trim(split_part(v_headers->>'x-forwarded-for', ',', 1)), ''), 'unknown');
  v_hash text;
begin
  delete from fishtank_pin_failures where at < now() - interval '1 day';
  if (select count(*) from fishtank_pin_failures where ip = v_ip and at > now() - interval '10 minutes') >= 10 then
    return 'too_many_attempts';
  end if;
  select pin_hash into v_hash from fishtank_config where id = 1;
  if v_hash is null then
    return 'pin_not_set';
  end if;
  if p_pin is null or crypt(p_pin, v_hash) <> v_hash then
    insert into fishtank_pin_failures (ip) values (v_ip);
    return 'wrong_pin';
  end if;
  return null;
end $$;

create or replace function public.fishtank_set_pin(p_new text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_new !~ '^\d{4}$' then
    raise exception 'The PIN must be exactly 4 digits';
  end if;
  update fishtank_config set pin_hash = crypt(p_new, gen_salt('bf')), updated_at = now() where id = 1;
  delete from fishtank_pin_failures;
end $$;

-- ---------- App functions (every one needs the PIN) ----------

create or replace function public.fishtank_load(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_err text := _fishtank_pin_error(p_pin);
begin
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  return jsonb_build_object(
    'title', (select title from fishtank_config where id = 1),
    'maxFeed', (select max_feed from fishtank_config where id = 1),
    'students', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'type', type, 'color', color, 'food', food) order by created_at, id) from fishtank_students), '[]'::jsonb),
    'decor', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'x', x, 'size', size, 'flip', flip) order by z, id) from fishtank_decor), '[]'::jsonb)
  );
end $$;

-- Adds or updates a student's name, fish type and color. Feeds only change through fishtank_add_food.
create or replace function public.fishtank_save_student(p_pin text, p_student jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_err text := _fishtank_pin_error(p_pin);
begin
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  insert into fishtank_students (id, name, type, color)
  values (
    left(p_student->>'id', 64),
    left(coalesce(p_student->>'name', ''), 60),
    left(coalesce(p_student->>'type', 'spotty'), 20),
    greatest(0, least(13, coalesce((p_student->>'color')::int, 0)))
  )
  on conflict (id) do update set name = excluded.name, type = excluded.type, color = excluded.color;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.fishtank_delete_student(p_pin text, p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_err text := _fishtank_pin_error(p_pin);
begin
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  delete from fishtank_students where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- Adds (or with a negative delta, removes) feeds in one step, so two devices feeding at once both count.
create or replace function public.fishtank_add_food(p_pin text, p_id text, p_delta int)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_err text := _fishtank_pin_error(p_pin); v_food int;
begin
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  update fishtank_students set food = greatest(0, food + greatest(-1000, least(1000, p_delta)))
  where id = p_id returning food into v_food;
  return jsonb_build_object('ok', true, 'food', v_food);
end $$;

create or replace function public.fishtank_reset_food(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_err text := _fishtank_pin_error(p_pin);
begin
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  update fishtank_students set food = 0 where food <> 0;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.fishtank_save_decor(p_pin text, p_decor jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_err text := _fishtank_pin_error(p_pin);
begin
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  insert into fishtank_decor (id, kind, x, size, flip, z)
  values (
    left(p_decor->>'id', 64),
    left(coalesce(p_decor->>'kind', 'rock'), 20),
    greatest(0, least(100, coalesce((p_decor->>'x')::real, 50))),
    greatest(0.3, least(3, coalesce((p_decor->>'size')::real, 1))),
    coalesce((p_decor->>'flip')::boolean, false),
    coalesce((select max(z) + 1 from fishtank_decor), 0)
  )
  on conflict (id) do update set kind = excluded.kind, x = excluded.x, size = excluded.size, flip = excluded.flip;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.fishtank_delete_decor(p_pin text, p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_err text := _fishtank_pin_error(p_pin);
begin
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  delete from fishtank_decor where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- Sets the drawing order: the first id is drawn at the back.
create or replace function public.fishtank_order_decor(p_pin text, p_ids text[])
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_err text := _fishtank_pin_error(p_pin);
begin
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  update fishtank_decor d set z = o.i
  from unnest(p_ids) with ordinality as o(id, i)
  where d.id = o.id;
  return jsonb_build_object('ok', true);
end $$;

-- A null title means "not renamed", which shows the default title in the current language.
create or replace function public.fishtank_save_config(p_pin text, p_title text, p_max_feed int)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_err text := _fishtank_pin_error(p_pin);
begin
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  update fishtank_config
  set title = left(nullif(trim(p_title), ''), 80),
      max_feed = greatest(2, least(999, coalesce(p_max_feed, 50))),
      updated_at = now()
  where id = 1;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- Permissions ----------

revoke all on function public._fishtank_pin_error(text) from public, anon, authenticated;
revoke all on function public.fishtank_set_pin(text) from public, anon, authenticated;

revoke all on function public.fishtank_load(text) from public;
revoke all on function public.fishtank_save_student(text, jsonb) from public;
revoke all on function public.fishtank_delete_student(text, text) from public;
revoke all on function public.fishtank_add_food(text, text, int) from public;
revoke all on function public.fishtank_reset_food(text) from public;
revoke all on function public.fishtank_save_decor(text, jsonb) from public;
revoke all on function public.fishtank_delete_decor(text, text) from public;
revoke all on function public.fishtank_order_decor(text, text[]) from public;
revoke all on function public.fishtank_save_config(text, text, int) from public;

grant execute on function public.fishtank_load(text) to anon, authenticated;
grant execute on function public.fishtank_save_student(text, jsonb) to anon, authenticated;
grant execute on function public.fishtank_delete_student(text, text) to anon, authenticated;
grant execute on function public.fishtank_add_food(text, text, int) to anon, authenticated;
grant execute on function public.fishtank_reset_food(text) to anon, authenticated;
grant execute on function public.fishtank_save_decor(text, jsonb) to anon, authenticated;
grant execute on function public.fishtank_delete_decor(text, text) to anon, authenticated;
grant execute on function public.fishtank_order_decor(text, text[]) to anon, authenticated;
grant execute on function public.fishtank_save_config(text, text, int) to anon, authenticated;

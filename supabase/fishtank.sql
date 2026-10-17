-- Class Fish Tank: database setup for Supabase.
--
-- Run this whole file in Supabase → SQL Editor. It only creates fishtank_* tables and functions, and is safe
-- to run again after an update (an earlier single-aquarium setup is upgraded and its data kept).
--
-- Each aquarium has its own PIN, and the PIN entered on the lock screen decides which aquarium opens.
-- Set PINs by running these lines on their own, with XXXX / YYYY replaced by 4-digit PINs
-- (don't save real PINs in this file, the repo is public):
--   select fishtank_set_pin('XXXX');            -- the class aquarium ("main")
--   select fishtank_set_pin('YYYY', 'test');    -- a separate test aquarium
-- To delete an aquarium and everything in it:  delete from fishtank_tanks where id = 'test';
--
-- How it is protected: the tables have row level security on and no policies, so the public
-- (anon) key cannot read or write them. The app only calls the fishtank_* functions below, and each
-- one checks the PIN on the server. After 10 wrong PINs from one address in 10 minutes, that address
-- is blocked until the 10 minutes are up.

create extension if not exists pgcrypto with schema extensions;

-- ---------- Tables ----------

create table if not exists public.fishtank_tanks (
  id text primary key check (id ~ '^[a-z0-9_-]{1,30}$'),
  pin_hash text,
  title text,
  max_feed int not null default 50,
  names text not null default 'hover' check (names in ('hover', 'always')),
  look text not null default 'sunny' check (look in ('sunny', 'night')),
  min_size real not null default 0.75,
  max_size real not null default 1.5,
  speed real not null default 1,
  bg_day text not null default 'classic',   -- tank background for Sunny Reef: 'classic', 'reef' or 'img:<id>'
  bg_night text not null default 'classic', -- and for Night Glow
  zone_line real not null default 0,        -- top fish zone: line height as a fraction of the tank (0 = off)
  zone_top int not null default 5,          -- how many top fish may swim above it
  updated_at timestamptz not null default now()
);
insert into public.fishtank_tanks (id) values ('main') on conflict (id) do nothing;

-- Upgrade from the single-aquarium version, which kept its settings in fishtank_config.
do $$
begin
  if to_regclass('public.fishtank_config') is not null then
    update public.fishtank_tanks t
    set pin_hash = coalesce(t.pin_hash, c.pin_hash), title = coalesce(t.title, c.title), max_feed = c.max_feed
    from public.fishtank_config c
    where t.id = 'main' and c.id = 1;
    drop table public.fishtank_config;
  end if;
end $$;
alter table public.fishtank_tanks add column if not exists names text not null default 'hover' check (names in ('hover', 'always'));
alter table public.fishtank_tanks add column if not exists look text not null default 'sunny' check (look in ('sunny', 'night'));
alter table public.fishtank_tanks add column if not exists min_size real not null default 0.75;
alter table public.fishtank_tanks add column if not exists max_size real not null default 1.5;
alter table public.fishtank_tanks add column if not exists speed real not null default 1;
alter table public.fishtank_tanks drop column if exists food_day; -- the automatic daily reset was removed
alter table public.fishtank_tanks add column if not exists bg_day text not null default 'classic';
alter table public.fishtank_tanks add column if not exists bg_night text not null default 'classic';
alter table public.fishtank_tanks add column if not exists zone_line real not null default 0;
alter table public.fishtank_tanks add column if not exists zone_top int not null default 5;
drop function if exists public._fishtank_pin_error(text);
drop function if exists public.fishtank_set_pin(text);

create table if not exists public.fishtank_students (
  id text primary key,
  tank text not null default 'main' references public.fishtank_tanks (id) on delete cascade,
  name text not null,
  type text not null,
  color int not null default 0,
  food int not null default 0 check (food >= 0),
  created_at timestamptz not null default clock_timestamp()
);

create table if not exists public.fishtank_decor (
  id text primary key,
  tank text not null default 'main' references public.fishtank_tanks (id) on delete cascade,
  kind text not null,
  x real not null default 50,
  size real not null default 1,
  flip boolean not null default false,
  z int not null default 0
);

-- Upgrade: rows from the single-aquarium version belong to "main".
alter table public.fishtank_students add column if not exists tank text not null default 'main' references public.fishtank_tanks (id) on delete cascade;
alter table public.fishtank_decor add column if not exists tank text not null default 'main' references public.fishtank_tanks (id) on delete cascade;
create index if not exists fishtank_students_tank on public.fishtank_students (tank);
create index if not exists fishtank_decor_tank on public.fishtank_decor (tank);

create table if not exists public.fishtank_pin_failures (
  ip text not null,
  at timestamptz not null default now()
);
create index if not exists fishtank_pin_failures_ip_at on public.fishtank_pin_failures (ip, at);

-- Feedings per student per day, for the leaderboard (kept for a year).
create table if not exists public.fishtank_feed_log (
  student_id text not null references public.fishtank_students (id) on delete cascade,
  tank text not null references public.fishtank_tanks (id) on delete cascade,
  day date not null,
  feeds int not null default 0 check (feeds >= 0),
  primary key (student_id, day)
);
create index if not exists fishtank_feed_log_tank_day on public.fishtank_feed_log (tank, day);

-- Uploaded tank backgrounds (data URLs, resized in the browser). Shared by all aquariums.
create table if not exists public.fishtank_images (
  id text primary key,
  data text not null,
  created_at timestamptz not null default now()
);

alter table public.fishtank_tanks enable row level security;
alter table public.fishtank_students enable row level security;
alter table public.fishtank_decor enable row level security;
alter table public.fishtank_pin_failures enable row level security;
alter table public.fishtank_feed_log enable row level security;
alter table public.fishtank_images enable row level security;
revoke all on public.fishtank_tanks, public.fishtank_students, public.fishtank_decor, public.fishtank_pin_failures, public.fishtank_feed_log, public.fishtank_images from anon, authenticated;

-- ---------- Days (Tashkent time) ----------

-- The leaderboard's days are calendar days in Tashkent time (UTC+5, no daylight saving).
create or replace function public._fishtank_day(p_at timestamptz default now())
returns date
language sql
stable
as $$ select (p_at at time zone 'Asia/Tashkent')::date $$;

-- ---------- PIN check (internal) ----------

-- Finds the aquarium whose PIN matches. Sets o_err instead of raising, because raising would roll back the
-- record of a wrong PIN.
create or replace function public._fishtank_auth(p_pin text, out o_tank text, out o_err text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_headers json := nullif(current_setting('request.headers', true), '')::json;
  v_ip text := coalesce(nullif(trim(split_part(v_headers->>'x-forwarded-for', ',', 1)), ''), 'unknown');
begin
  delete from fishtank_pin_failures where at < now() - interval '1 day';
  if (select count(*) from fishtank_pin_failures where ip = v_ip and at > now() - interval '10 minutes') >= 10 then
    o_err := 'too_many_attempts';
    return;
  end if;
  if not exists (select 1 from fishtank_tanks where pin_hash is not null) then
    o_err := 'pin_not_set';
    return;
  end if;
  if p_pin is not null then
    select id into o_tank from fishtank_tanks where pin_hash is not null and crypt(p_pin, pin_hash) = pin_hash limit 1;
  end if;
  if o_tank is null then
    insert into fishtank_pin_failures (ip) values (v_ip);
    o_err := 'wrong_pin';
  end if;
end $$;
drop function if exists public._fishtank_roll(text); -- the automatic daily reset was removed; sizes reset by hand

-- Sets an aquarium's PIN, creating the aquarium if it is new. Two aquariums can't share a PIN.
create or replace function public.fishtank_set_pin(p_new text, p_tank text default 'main')
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_new !~ '^\d{4}$' then
    raise exception 'The PIN must be exactly 4 digits';
  end if;
  if p_tank !~ '^[a-z0-9_-]{1,30}$' then
    raise exception 'The aquarium name may only use a-z, 0-9, - and _';
  end if;
  if exists (select 1 from fishtank_tanks where id <> p_tank and pin_hash is not null and crypt(p_new, pin_hash) = pin_hash) then
    raise exception 'Another aquarium already uses this PIN';
  end if;
  -- a new test aquarium starts with the Reef backgrounds
  insert into fishtank_tanks (id, pin_hash, bg_day, bg_night)
  values (p_tank, crypt(p_new, gen_salt('bf')), case when p_tank = 'test' then 'reef' else 'classic' end, case when p_tank = 'test' then 'reef' else 'classic' end)
  on conflict (id) do update set pin_hash = excluded.pin_hash, updated_at = now();
  delete from fishtank_pin_failures;
end $$;

-- ---------- App functions (every one needs the PIN, and only touches that PIN's aquarium) ----------

create or replace function public.fishtank_load(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_tank text; v_err text;
begin
  select o_tank, o_err into v_tank, v_err from _fishtank_auth(p_pin);
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  return jsonb_build_object(
    'tank', v_tank,
    'title', (select title from fishtank_tanks where id = v_tank),
    'maxFeed', (select max_feed from fishtank_tanks where id = v_tank),
    'names', (select names from fishtank_tanks where id = v_tank),
    'look', (select look from fishtank_tanks where id = v_tank),
    'minSize', (select min_size from fishtank_tanks where id = v_tank),
    'maxSize', (select max_size from fishtank_tanks where id = v_tank),
    'speed', (select speed from fishtank_tanks where id = v_tank),
    'bgDay', (select bg_day from fishtank_tanks where id = v_tank),
    'bgNight', (select bg_night from fishtank_tanks where id = v_tank),
    'zoneLine', (select zone_line from fishtank_tanks where id = v_tank),
    'zoneTop', (select zone_top from fishtank_tanks where id = v_tank),
    'today', _fishtank_day()::text,
    'history', coalesce((select jsonb_agg(jsonb_build_object('d', day::text, 'id', student_id, 'n', feeds) order by day, student_id)
                         from fishtank_feed_log where tank = v_tank and day > _fishtank_day() - 7 and feeds > 0), '[]'::jsonb),
    'students', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'type', type, 'color', color, 'food', food) order by created_at, id) from fishtank_students where tank = v_tank), '[]'::jsonb),
    'decor', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'x', x, 'size', size, 'flip', flip) order by z, id) from fishtank_decor where tank = v_tank), '[]'::jsonb)
  );
end $$;

-- Adds or updates a student's name, fish type and color. Feeds only change through fishtank_add_food.
create or replace function public.fishtank_save_student(p_pin text, p_student jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_tank text; v_err text;
begin
  select o_tank, o_err into v_tank, v_err from _fishtank_auth(p_pin);
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  insert into fishtank_students (id, tank, name, type, color)
  values (
    left(p_student->>'id', 64),
    v_tank,
    left(coalesce(p_student->>'name', ''), 60),
    left(coalesce(p_student->>'type', 'spotty'), 20),
    greatest(0, least(13, coalesce((p_student->>'color')::int, 0)))
  )
  on conflict (id) do update set name = excluded.name, type = excluded.type, color = excluded.color
  where fishtank_students.tank = v_tank;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.fishtank_delete_student(p_pin text, p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_tank text; v_err text;
begin
  select o_tank, o_err into v_tank, v_err from _fishtank_auth(p_pin);
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  delete from fishtank_students where id = p_id and tank = v_tank;
  return jsonb_build_object('ok', true);
end $$;

-- Adds (or with a negative delta, removes) feeds in one step, so two devices feeding at once both count.
-- p_log = false (used for imported feed counts) changes the size without counting as today's feedings.
drop function if exists public.fishtank_add_food(text, text, int);
create or replace function public.fishtank_add_food(p_pin text, p_id text, p_delta int, p_log boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_tank text; v_err text; v_food int; v_delta int := greatest(-1000, least(1000, p_delta));
begin
  select o_tank, o_err into v_tank, v_err from _fishtank_auth(p_pin);
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  update fishtank_students set food = greatest(0, food + v_delta)
  where id = p_id and tank = v_tank returning food into v_food;
  if v_food is not null and p_log then
    insert into fishtank_feed_log (student_id, tank, day, feeds) values (p_id, v_tank, _fishtank_day(), greatest(0, v_delta))
    on conflict (student_id, day) do update set feeds = greatest(0, fishtank_feed_log.feeds + v_delta);
    delete from fishtank_feed_log where tank = v_tank and day < _fishtank_day() - 366;
  end if;
  return jsonb_build_object('ok', true, 'food', v_food);
end $$;

create or replace function public.fishtank_reset_food(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_tank text; v_err text;
begin
  select o_tank, o_err into v_tank, v_err from _fishtank_auth(p_pin);
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  update fishtank_students set food = 0 where tank = v_tank and food <> 0;
  return jsonb_build_object('ok', true);
end $$;

-- Removes every student from this PIN's aquarium (never touches other aquariums).
create or replace function public.fishtank_delete_all_students(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_tank text; v_err text;
begin
  select o_tank, o_err into v_tank, v_err from _fishtank_auth(p_pin);
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  delete from fishtank_students where tank = v_tank;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.fishtank_save_decor(p_pin text, p_decor jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_tank text; v_err text;
begin
  select o_tank, o_err into v_tank, v_err from _fishtank_auth(p_pin);
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  insert into fishtank_decor (id, tank, kind, x, size, flip, z)
  values (
    left(p_decor->>'id', 64),
    v_tank,
    left(coalesce(p_decor->>'kind', 'rock'), 20),
    greatest(0, least(100, coalesce((p_decor->>'x')::real, 50))),
    greatest(0.3, least(3, coalesce((p_decor->>'size')::real, 1))),
    coalesce((p_decor->>'flip')::boolean, false),
    coalesce((select max(z) + 1 from fishtank_decor where tank = v_tank), 0)
  )
  on conflict (id) do update set kind = excluded.kind, x = excluded.x, size = excluded.size, flip = excluded.flip
  where fishtank_decor.tank = v_tank;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.fishtank_delete_decor(p_pin text, p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_tank text; v_err text;
begin
  select o_tank, o_err into v_tank, v_err from _fishtank_auth(p_pin);
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  delete from fishtank_decor where id = p_id and tank = v_tank;
  return jsonb_build_object('ok', true);
end $$;

-- Sets the drawing order: the first id is drawn at the back.
create or replace function public.fishtank_order_decor(p_pin text, p_ids text[])
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_tank text; v_err text;
begin
  select o_tank, o_err into v_tank, v_err from _fishtank_auth(p_pin);
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  update fishtank_decor d set z = o.i
  from unnest(p_ids) with ordinality as o(id, i)
  where d.id = o.id and d.tank = v_tank;
  return jsonb_build_object('ok', true);
end $$;

-- A null title means "not renamed", which shows the default title in the current language.
create or replace function public.fishtank_save_config(p_pin text, p_title text, p_max_feed int)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_tank text; v_err text;
begin
  select o_tank, o_err into v_tank, v_err from _fishtank_auth(p_pin);
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  update fishtank_tanks
  set title = left(nullif(trim(p_title), ''), 80),
      max_feed = greatest(2, least(999, coalesce(p_max_feed, 50))),
      updated_at = now()
  where id = v_tank;
  return jsonb_build_object('ok', true);
end $$;

-- Whether fish names show always or only on hover / tap; shared so a phone can switch it on the class screen.
create or replace function public.fishtank_save_names(p_pin text, p_names text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_tank text; v_err text;
begin
  select o_tank, o_err into v_tank, v_err from _fishtank_auth(p_pin);
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  update fishtank_tanks set names = case when p_names = 'always' then 'always' else 'hover' end, updated_at = now()
  where id = v_tank;
  return jsonb_build_object('ok', true);
end $$;

-- The look (Sunny Reef / Night Glow); shared so a phone can switch it on the class screen.
create or replace function public.fishtank_save_look(p_pin text, p_look text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_tank text; v_err text;
begin
  select o_tank, o_err into v_tank, v_err from _fishtank_auth(p_pin);
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  update fishtank_tanks set look = case when p_look = 'night' then 'night' else 'sunny' end, updated_at = now()
  where id = v_tank;
  return jsonb_build_object('ok', true);
end $$;

-- Fish size range (1 = normal picture size) and swim speed for this aquarium.
create or replace function public.fishtank_save_fish_settings(p_pin text, p_min_size real, p_max_size real, p_speed real)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_tank text; v_err text; v_min real;
begin
  select o_tank, o_err into v_tank, v_err from _fishtank_auth(p_pin);
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  v_min := greatest(0.2, least(4, coalesce(p_min_size, 0.75)));
  update fishtank_tanks
  set min_size = v_min,
      max_size = greatest(v_min, least(4, coalesce(p_max_size, 1.5))),
      speed = greatest(0.25, least(3, coalesce(p_speed, 1))),
      updated_at = now()
  where id = v_tank;
  return jsonb_build_object('ok', true);
end $$;

-- Feedings on one day (for leaderboard days older than the week that fishtank_load sends).
create or replace function public.fishtank_day_feeds(p_pin text, p_day date)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_tank text; v_err text;
begin
  select o_tank, o_err into v_tank, v_err from _fishtank_auth(p_pin);
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  return jsonb_build_object('feeds', coalesce((select jsonb_agg(jsonb_build_object('d', day::text, 'id', student_id, 'n', feeds))
    from fishtank_feed_log where tank = v_tank and day = p_day and feeds > 0), '[]'::jsonb));
end $$;

-- Top fish zone: only the top p_top fish swim above a line at p_line (fraction of the tank height; 0 = off).
create or replace function public.fishtank_save_zone(p_pin text, p_line real, p_top int)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_tank text; v_err text;
begin
  select o_tank, o_err into v_tank, v_err from _fishtank_auth(p_pin);
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  update fishtank_tanks
  set zone_line = case when coalesce(p_line, 0) <= 0 then 0 else greatest(0.1, least(0.9, p_line)) end,
      zone_top = greatest(1, least(50, coalesce(p_top, 5))),
      updated_at = now()
  where id = v_tank;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- Backgrounds (managed from the test aquarium) ----------

-- Removes uploaded backgrounds that no aquarium uses any more.
create or replace function public._fishtank_clean_images()
returns void
language sql
security definer
set search_path = public, extensions
as $$
  delete from fishtank_images i
  where not exists (select 1 from fishtank_tanks t where t.bg_day = 'img:' || i.id or t.bg_night = 'img:' || i.id);
$$;

create or replace function public._fishtank_valid_bg(p_bg text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select p_bg in ('classic', 'reef') or (p_bg like 'img:%' and exists (select 1 from fishtank_images where id = substr(p_bg, 5)));
$$;

-- Uploads a background picture (test aquarium only). Returns its id.
create or replace function public.fishtank_upload_image(p_pin text, p_data text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_tank text; v_err text; v_id text := replace(gen_random_uuid()::text, '-', '');
begin
  select o_tank, o_err into v_tank, v_err from _fishtank_auth(p_pin);
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  if v_tank <> 'test' then return jsonb_build_object('error', 'not_allowed'); end if;
  if p_data !~ '^data:image/(webp|jpeg|png);base64,' or length(p_data) > 4000000 then
    return jsonb_build_object('error', 'bad_image');
  end if;
  insert into fishtank_images (id, data) values (v_id, p_data);
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.fishtank_get_image(p_pin text, p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_tank text; v_err text;
begin
  select o_tank, o_err into v_tank, v_err from _fishtank_auth(p_pin);
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  return jsonb_build_object('data', (select data from fishtank_images where id = p_id));
end $$;

-- Sets the test aquarium's day and night backgrounds.
create or replace function public.fishtank_save_bg(p_pin text, p_day text, p_night text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_tank text; v_err text;
begin
  select o_tank, o_err into v_tank, v_err from _fishtank_auth(p_pin);
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  if v_tank <> 'test' then return jsonb_build_object('error', 'not_allowed'); end if;
  if not (_fishtank_valid_bg(p_day) and _fishtank_valid_bg(p_night)) then return jsonb_build_object('error', 'bad_image'); end if;
  update fishtank_tanks set bg_day = p_day, bg_night = p_night, updated_at = now() where id = v_tank;
  perform _fishtank_clean_images();
  return jsonb_build_object('ok', true);
end $$;

-- Copies the test aquarium's backgrounds to every aquarium.
create or replace function public.fishtank_apply_bg_all(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_tank text; v_err text;
begin
  select o_tank, o_err into v_tank, v_err from _fishtank_auth(p_pin);
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  if v_tank <> 'test' then return jsonb_build_object('error', 'not_allowed'); end if;
  update fishtank_tanks t set bg_day = s.bg_day, bg_night = s.bg_night, updated_at = now()
  from fishtank_tanks s where s.id = v_tank and t.id <> v_tank;
  perform _fishtank_clean_images();
  return jsonb_build_object('ok', true);
end $$;

-- ---------- Permissions ----------

revoke all on function public._fishtank_auth(text) from public, anon, authenticated;
revoke all on function public.fishtank_set_pin(text, text) from public, anon, authenticated;

revoke all on function public.fishtank_load(text) from public;
revoke all on function public.fishtank_save_student(text, jsonb) from public;
revoke all on function public.fishtank_delete_student(text, text) from public;
revoke all on function public.fishtank_add_food(text, text, int, boolean) from public;
revoke all on function public._fishtank_day(timestamptz) from public, anon, authenticated;
revoke all on function public.fishtank_reset_food(text) from public;
revoke all on function public.fishtank_delete_all_students(text) from public;
revoke all on function public.fishtank_save_decor(text, jsonb) from public;
revoke all on function public.fishtank_delete_decor(text, text) from public;
revoke all on function public.fishtank_order_decor(text, text[]) from public;
revoke all on function public.fishtank_save_config(text, text, int) from public;
revoke all on function public.fishtank_save_names(text, text) from public;
revoke all on function public.fishtank_save_look(text, text) from public;
revoke all on function public.fishtank_save_fish_settings(text, real, real, real) from public;
revoke all on function public.fishtank_day_feeds(text, date) from public;
revoke all on function public.fishtank_save_zone(text, real, int) from public;
revoke all on function public.fishtank_upload_image(text, text) from public;
revoke all on function public.fishtank_get_image(text, text) from public;
revoke all on function public.fishtank_save_bg(text, text, text) from public;
revoke all on function public.fishtank_apply_bg_all(text) from public;
revoke all on function public._fishtank_clean_images() from public, anon, authenticated;
revoke all on function public._fishtank_valid_bg(text) from public, anon, authenticated;

grant execute on function public.fishtank_load(text) to anon, authenticated;
grant execute on function public.fishtank_save_student(text, jsonb) to anon, authenticated;
grant execute on function public.fishtank_delete_student(text, text) to anon, authenticated;
grant execute on function public.fishtank_add_food(text, text, int, boolean) to anon, authenticated;
grant execute on function public.fishtank_reset_food(text) to anon, authenticated;
grant execute on function public.fishtank_delete_all_students(text) to anon, authenticated;
grant execute on function public.fishtank_save_decor(text, jsonb) to anon, authenticated;
grant execute on function public.fishtank_delete_decor(text, text) to anon, authenticated;
grant execute on function public.fishtank_order_decor(text, text[]) to anon, authenticated;
grant execute on function public.fishtank_save_config(text, text, int) to anon, authenticated;
grant execute on function public.fishtank_save_names(text, text) to anon, authenticated;
grant execute on function public.fishtank_save_look(text, text) to anon, authenticated;
grant execute on function public.fishtank_save_fish_settings(text, real, real, real) to anon, authenticated;
grant execute on function public.fishtank_day_feeds(text, date) to anon, authenticated;
grant execute on function public.fishtank_save_zone(text, real, int) to anon, authenticated;
grant execute on function public.fishtank_upload_image(text, text) to anon, authenticated;
grant execute on function public.fishtank_get_image(text, text) to anon, authenticated;
grant execute on function public.fishtank_save_bg(text, text, text) to anon, authenticated;
grant execute on function public.fishtank_apply_bg_all(text) to anon, authenticated;

-- One-time steps, remembered here so re-running this file doesn't repeat them.
create table if not exists public.fishtank_meta (key text primary key, done_at timestamptz not null default now());
alter table public.fishtank_meta enable row level security;
revoke all on public.fishtank_meta from anon, authenticated;

-- The feed log started with the leaderboard update, so feeds given earlier that day were missing from it.
-- Count each fish's current feeds as today's feedings, once.
do $$
begin
  if not exists (select 1 from public.fishtank_meta where key = 'feed_log_backfill') then
    insert into public.fishtank_feed_log (student_id, tank, day, feeds)
    select id, tank, public._fishtank_day(), food from public.fishtank_students where food > 0
    on conflict (student_id, day) do update set feeds = greatest(public.fishtank_feed_log.feeds, excluded.feeds);
    insert into public.fishtank_meta (key) values ('feed_log_backfill');
  end if;
end $$;

-- The test aquarium gets the Reef backgrounds, once.
do $$
begin
  if not exists (select 1 from public.fishtank_meta where key = 'test_reef_bg') then
    update public.fishtank_tanks set bg_day = 'reef', bg_night = 'reef' where id = 'test' and bg_day = 'classic' and bg_night = 'classic';
    insert into public.fishtank_meta (key) values ('test_reef_bg');
  end if;
end $$;

-- Make the API see new or changed functions right away.
notify pgrst, 'reload schema';

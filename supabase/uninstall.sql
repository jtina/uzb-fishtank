-- Class Fish Tank: remove everything supabase/fishtank.sql created (all aquariums, students, decorations,
-- feed history, PINs and the fishtank_* functions). This cannot be undone.
--
-- 1. First run only the PREVIEW query below and check that every listed name is one of the app's
--    (fishtank_... tables, fishtank_... / _fishtank_... functions) and nothing of your own.
-- 2. Then run the REMOVE block.
--
-- The pgcrypto extension is left in place on purpose: Supabase usually has it installed already and other
-- things may use it.

-- PREVIEW: what would be removed
select 'table' as kind, tablename as name from pg_tables
 where schemaname = 'public' and tablename like 'fishtank\_%'
union all
select 'function', p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and (p.proname like 'fishtank\_%' or p.proname like '\_fishtank\_%')
order by 1, 2;

-- REMOVE
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and (p.proname like 'fishtank\_%' or p.proname like '\_fishtank\_%') loop
    execute 'drop function ' || r.fn;
  end loop;
  -- children first, so no CASCADE is needed (CASCADE could reach objects that are not the app's)
  drop table if exists public.fishtank_feed_log;
  drop table if exists public.fishtank_students;
  drop table if exists public.fishtank_decor;
  drop table if exists public.fishtank_pin_failures;
  drop table if exists public.fishtank_meta;
  drop table if exists public.fishtank_config;
  drop table if exists public.fishtank_tanks;
end $$;
notify pgrst, 'reload schema';

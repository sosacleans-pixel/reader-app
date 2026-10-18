-- 22-Day app · RLS status check (read-only). Paste into the Supabase SQL editor and run.
-- Save the three result grids (or screenshots) with the date, for the compliance file.
-- Expected after the migrations: rls_enabled = true on all six tables; every table has owner-only
-- policies (auth.uid() = user_id, or = id for profiles); anon has NO privileges on any of them.

-- 1) RLS on/off per table (missing tables show table_exists = false)
select t.tablename,
       (c.oid is not null)              as table_exists,
       coalesce(c.relrowsecurity, false)   as rls_enabled,
       coalesce(c.relforcerowsecurity, false) as rls_forced,
       (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename) as policy_count
from (values ('day_logs'), ('streaks'), ('workout_prefs'), ('push_subscriptions'), ('consents'), ('profiles')) as t(tablename)
left join pg_class c on c.relname = t.tablename and c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
order by 1;

-- 2) Every policy on those tables
select tablename, policyname, cmd, roles, permissive, qual as using_expr, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('day_logs', 'streaks', 'workout_prefs', 'push_subscriptions', 'consents', 'profiles')
order by tablename, cmd, policyname;

-- 3) Table privileges for the API roles (anon should have none)
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('day_logs', 'streaks', 'workout_prefs', 'push_subscriptions', 'consents', 'profiles')
  and grantee in ('anon', 'authenticated')
group by table_name, grantee
order by table_name, grantee;

-- 4) The attorney's two whole-schema queries (R6), for the record
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename;
select * from pg_policies where schemaname = 'public' order by tablename, policyname;

-- 5) Column-level grants (consents: authenticated may INSERT only these columns; created_at stays server-set)
select table_name, grantee, privilege_type, string_agg(column_name, ', ' order by column_name) as columns
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'consents' and grantee in ('anon', 'authenticated') and privilege_type = 'INSERT'
group by table_name, grantee, privilege_type;

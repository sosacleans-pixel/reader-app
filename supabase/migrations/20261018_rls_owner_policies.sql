-- 22-Day app · Coach Salim Heyaime LLC
-- Owner-only Row Level Security on every user table, plus no anonymous access.
-- Run AFTER 20261018_consents.sql. Safe to re-run: it only ADDS policies that are missing
-- and never drops or rewrites an existing policy. Run rls_check.sql before and after.
--
-- Tables: day_logs, streaks, workout_prefs, push_subscriptions (owner column user_id),
--         consents (append-only: select + insert only, see 20261018_consents.sql),
--         profiles (owner column id; read-only for users, filled by the handle_new_user trigger).

do $$
declare
  t text;
  c text;
  pol text;
begin
  -- 1) The four app tables: owner-only select/insert/update/delete.
  foreach t in array array['day_logs', 'streaks', 'workout_prefs', 'push_subscriptions'] loop
    if to_regclass('public.' || t) is null then
      raise notice 'skip %: table does not exist', t;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);

    -- Tighten anonymous access: anon gets nothing. Signed-in users get exactly the four verbs (RLS still applies).
    execute format('revoke all on table public.%I from anon', t);
    execute format('revoke all on table public.%I from authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);

    foreach c in array array['select', 'insert', 'update', 'delete'] loop
      -- An existing policy for this command (or a FOR ALL policy) counts as present.
      if exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = t and cmd in (upper(c), 'ALL')
      ) then
        raise notice '%: % policy already present, left as is', t, c;
        continue;
      end if;

      pol := format('%s own %s', t, c);
      if c = 'select' or c = 'delete' then
        execute format('create policy %I on public.%I for %s to authenticated using (auth.uid() = user_id)', pol, t, c);
      elsif c = 'insert' then
        execute format('create policy %I on public.%I for insert to authenticated with check (auth.uid() = user_id)', pol, t);
      else
        execute format('create policy %I on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', pol, t);
      end if;
      raise notice '%: created policy "%"', t, pol;
    end loop;
  end loop;

  -- 2) consents: select + insert own only (append-only ledger).
  if to_regclass('public.consents') is not null then
    alter table public.consents enable row level security;
    revoke all on table public.consents from anon;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'consents' and cmd in ('SELECT', 'ALL')) then
      create policy "consents select own" on public.consents for select to authenticated using (auth.uid() = user_id);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'consents' and cmd in ('INSERT', 'ALL')) then
      create policy "consents insert own" on public.consents for insert to authenticated with check (auth.uid() = user_id);
    end if;
  else
    raise notice 'consents does not exist yet: run 20261018_consents.sql first';
  end if;

  -- 3) profiles: users read their own row only; no anon access.
  if to_regclass('public.profiles') is not null then
    alter table public.profiles enable row level security;
    revoke all on table public.profiles from anon;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and cmd in ('SELECT', 'ALL')) then
      create policy "profiles select own" on public.profiles for select to authenticated using (auth.uid() = id);
    end if;
  end if;
end
$$;

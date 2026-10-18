-- 22-Day app · Coach Salim Heyaime LLC
-- Consent and Terms-acceptance records (append-only ledger), stored on the server.
-- Run once in the Supabase SQL editor (project olncfwohfpgpmygxjpcm). Safe to re-run.
--
-- One row per event: kind = 'chd' (consumer health data check-ins) or 'terms' (Terms of Use),
-- action = 'granted' or 'withdrawn'. The latest row per kind is the user's current state.
-- created_at is set by the server and cannot be supplied by the client (column-level grant below),
-- so it is a trustworthy timestamp. client_created_at is the device time, for reference only.

create extension if not exists pgcrypto;

create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('chd', 'terms')),
  action text not null check (action in ('granted', 'withdrawn')),
  version text not null check (char_length(version) between 1 and 64),
  consent_text text not null check (char_length(consent_text) between 1 and 1000),
  client_created_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists consents_user_kind_created_idx
  on public.consents (user_id, kind, created_at desc);

alter table public.consents enable row level security;

-- No anonymous access at all. Signed-in users may read and add their OWN rows only.
-- No update/delete grants: the record is append-only for users (withdrawal is a new row).
-- Account deletion removes the rows via the delete-account function (service role) and the FK cascade.
revoke all on table public.consents from anon, authenticated;
grant select on table public.consents to authenticated;
grant insert (user_id, kind, action, version, consent_text, client_created_at) on table public.consents to authenticated;

drop policy if exists "consents select own" on public.consents;
create policy "consents select own"
  on public.consents for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "consents insert own" on public.consents;
create policy "consents insert own"
  on public.consents for insert to authenticated
  with check (auth.uid() = user_id);

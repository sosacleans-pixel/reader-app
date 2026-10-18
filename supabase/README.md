# 22-Day app · privacy rights backend (preview/privacy-rights)

Coach Salim Heyaime LLC · project `olncfwohfpgpmygxjpcm` · app https://app.coachsalimheyaime.com

Nothing in this folder has been run against Supabase. Everything below is for Salim to do by hand, in this order.
No secret is stored in this repo. The service-role key is read from the function environment only.

> Note: this repo is the GitHub Pages site, so files here are publicly readable (the repo is public anyway).
> They contain no secrets. If you'd rather not serve them at app.coachsalimheyaime.com/supabase/, move this folder
> to a private repo before merging. The service worker already skips /supabase/.

## 1. SQL (Supabase Dashboard → SQL Editor)

1. Run `migrations/rls_check.sql` and save the output (before).
2. Run `migrations/20261018_consents.sql`: creates `public.consents` (append-only ledger of `chd` and `terms`
   grants and withdrawals, with server-set `created_at` and the policy `version`), owner-only RLS, no anon access.
3. Run `migrations/20261018_rls_owner_policies.sql`: enables RLS and adds owner-only select/insert/update/delete
   policies (`auth.uid() = user_id`) on `day_logs`, `streaks`, `workout_prefs`, `push_subscriptions` **only where a
   policy for that command is missing** (existing `for all` policies are kept), revokes all `anon` privileges on them
   and on `profiles`/`consents`, and grants `authenticated` only select/insert/update/delete. Safe to re-run.
4. Run `migrations/rls_check.sql` again and save the output (after). Expected: RLS on for all six tables, no `anon`
   rows in the privileges grid, `consents` = select for authenticated + column-level insert.

Tested on a local Postgres 17 with a stub `auth` schema: both migrations apply cleanly twice, and the A/B test
below passed (user B saw 0 rows of A in every table, B's updates/deletes touched nothing, B could not insert a row
for A or back-date `created_at`, anon got "permission denied" on every table).

## 2. Edge functions (Supabase CLI, logged in as the project owner)

```bash
supabase link --project-ref olncfwohfpgpmygxjpcm
# Account deletion. Keep JWT verification ON (no --no-verify-jwt).
supabase functions deploy delete-account
# Reminder emails: one-click unsubscribe link + List-Unsubscribe headers.
supabase secrets set UNSUBSCRIBE_SECRET="$(openssl rand -base64 32)"
supabase functions deploy email-unsubscribe --no-verify-jwt
supabase functions deploy send-reminders --no-verify-jwt
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically into every function,
so there is nothing to set for delete-account. Never paste the service-role key into the app, the repo or chat.
`send-reminders` still needs its existing secrets (VAPID_*, RESEND_API_KEY, CRON_SECRET); with no
`UNSUBSCRIBE_SECRET` it now skips reminder emails rather than send one without an unsubscribe link (push still goes).

Smoke test after deploy (signed in on the preview, Your account → Delete my account and data, with a throwaway
account), or with curl: `OPTIONS` from `https://app.coachsalimheyaime.com` returns 204 with that origin;
`POST` with no token returns 401.

## 3. RLS test plan with a second account

Use two throwaway accounts, A and B, on the preview build. In each browser, the session token is in
localStorage `sb-olncfwohfpgpmygxjpcm-auth-token` (DevTools → Application). Keep these tokens private and delete
both accounts afterwards.

1. As A: keep Day 1 with a reflection, turn on reminders (creates `workout_prefs`, `streaks`, maybe `push_subscriptions`),
   tick both consent boxes. Note A's user id.
2. As B, in DevTools console on the app (B signed in), for each table T in
   `day_logs, streaks, workout_prefs, push_subscriptions, consents, profiles`:
   ```js
   const s = JSON.parse(localStorage.getItem('sb-olncfwohfpgpmygxjpcm-auth-token'));
   const H = { apikey: '<anon key from the bundle>', Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' };
   const SB = 'https://olncfwohfpgpmygxjpcm.supabase.co/rest/v1/';
   const A = '<A user id>';
   await (await fetch(SB + 'day_logs?user_id=eq.' + A, { headers: H })).json();               // expect []
   await fetch(SB + 'day_logs?user_id=eq.' + A, { method: 'PATCH', headers: { ...H, Prefer: 'return=representation' }, body: '{"reflection":"x"}' }).then(r => r.json()); // expect []
   await fetch(SB + 'day_logs?user_id=eq.' + A, { method: 'DELETE', headers: { ...H, Prefer: 'return=representation' } }).then(r => r.json());                          // expect []
   await fetch(SB + 'day_logs', { method: 'POST', headers: H, body: JSON.stringify({ user_id: A, calendar_date: '2026-01-01', program_day: 1, completed_at: new Date().toISOString() }) }).then(r => r.status); // expect 401/403
   ```
   (Use `id=eq.` for `profiles`. For `consents`, PATCH/DELETE must fail with 401/403: no grant.)
3. As anon (no Authorization header, only `apikey`): every `GET` returns 401 / "permission denied".
4. As A again: all of A's rows are still there and unchanged.
5. Delete B with the in-app button; check in Table Editor that B has no rows in any table and no auth user.
6. Save the results with the date in the compliance file.

## 4. Email deletion / access requests (runbook)

Requests to coachsalimheyaime@gmail.com ("we complete requests within 45 days"):
1. Log the request: date received, requester email, request type (delete / access / correct / withdraw consent / appeal).
2. Verify identity: the request must come from, or be confirmed by a reply from, the account's sign-in email.
3. Delete: Supabase Dashboard → Authentication → Users → find the email → Delete user. Every table has
   `on delete cascade` to `auth.users`, so the rows go with it. Confirm with this read-only query (replace the id):
   ```sql
   select 'day_logs', count(*) from day_logs where user_id = '<uid>' union all
   select 'streaks', count(*) from streaks where user_id = '<uid>' union all
   select 'workout_prefs', count(*) from workout_prefs where user_id = '<uid>' union all
   select 'push_subscriptions', count(*) from push_subscriptions where user_id = '<uid>' union all
   select 'consents', count(*) from consents where user_id = '<uid>' union all
   select 'profiles', count(*) from profiles where id = '<uid>';
   ```
   Access: export the same tables (`select * ... where user_id = '<uid>'`) as JSON and email it.
4. Reply in writing that it's done, within 45 days. Log the completion date and outcome; keep the log 24 months.
   Appeals: answer within 45 days.
5. Backups: deleted data drops out of Supabase backups when they roll over (see "Salim to check").

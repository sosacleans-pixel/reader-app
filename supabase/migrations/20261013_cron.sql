-- Run AFTER deploying the send-reminders function. Enable extensions pg_cron + pg_net first
-- (Dashboard > Database > Extensions). Store secrets in Vault, not in this file:
--   select vault.create_secret('https://olncfwohfpgpmygxjpcm.supabase.co', 'project_url');
--   select vault.create_secret('<a long random string = CRON_SECRET>', 'cron_secret');
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('send-workout-reminders', '*/15 * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='project_url') || '/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type','application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name='cron_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 25000);
$$);

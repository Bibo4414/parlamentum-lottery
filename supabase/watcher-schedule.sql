-- The watcher's schedule. Run once in Supabase → SQL Editor, after the watcher function is deployed and its secrets
-- are set (see docs/REVIEW.md, "Deploying"). It looks at the game every 10 minutes even when nobody opens the page,
-- so the House's last 200 trades never scroll away unseen; page loads still make it look sooner.
--
-- Replace the two <...> values before running. They are stored in Vault (encrypted at rest) and never in the repo.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('https://<project-ref>.supabase.co', 'lottery_project_url');
select vault.create_secret('<the CRON_SECRET you set on the function>', 'lottery_watcher_cron_secret');

select cron.schedule('lottery-watcher', '*/10 * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'lottery_project_url') || '/functions/v1/watcher',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'lottery_watcher_cron_secret')),
    body := '{"action":"cron"}'::jsonb,
    timeout_milliseconds := 30000)
$$);

-- To see the runs:   select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'lottery-watcher') order by start_time desc limit 10;
-- To stop it:       select cron.unschedule('lottery-watcher');

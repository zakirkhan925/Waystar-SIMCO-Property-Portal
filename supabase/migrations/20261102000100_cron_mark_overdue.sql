-- Schedule the nightly overdue sweep.
--
-- public.mark_overdue() recomputes every unpaid installment past its due date and refreshes
-- the cancellation flags. Until now nothing called it: installment status, days_overdue and
-- accrued penalties only moved when some other action happened to touch that sale. On a live
-- system that means ageing silently stops — a buyer who pays nothing is never marked overdue,
-- and the recoveries screen quietly understates what is owed.
--
-- Timing: pg_cron schedules in UTC. Pakistan is UTC+5 with no daylight saving, so 19:30 UTC
-- is 00:30 the following day in Karachi — just after the local date rolls over, which is what
-- private.today_pk() compares against.

create extension if not exists pg_cron;

-- mark_overdue() is SECURITY DEFINER and revoked from anon, public and authenticated.
-- The job runs as the role that schedules it (postgres), which is allowed to execute it.
-- cron.schedule() upserts by job name, so re-running this migration re-points the same job
-- rather than stacking duplicates.
select cron.schedule(
  'mark-overdue-daily',
  '30 19 * * *',
  $job$ select public.mark_overdue(); $job$
);

comment on extension pg_cron is
  'Runs public.mark_overdue() nightly at 00:30 Asia/Karachi (19:30 UTC). See cron.job_run_details for history.';

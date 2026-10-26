-- 0009_pup_push.sql: two notifications a day (founder 2026-10-26: "make it send notification 1 time a day saying that its
-- sad because you didnt log in at 6pm, and another 1 notification a day that is a positive quote from Confucius to
-- motivate studying at 9am"). Run after 0002. Idempotent.
--
-- A phone that turns Daily reminders on in Settings saves its Web Push subscription here (pup_push_save), with its time
-- zone and its dog's name; each time MDosce opens it marks the local day as opened (pup_push_opened). The edge function
-- pup-push (supabase/functions/pup-push), called by pg_cron every 10 minutes, sends at 9 AM local a line from Confucius
-- and at 6 PM local, only on a day the app was not opened, the dog's sad note; quote_on / sad_on keep each to once a
-- day. The table is closed to the public key: the three functions below are the only way in, and the sender uses the
-- service role. The VAPID private key lives in Vault as 'pup_push_vapid' (set once by hand, never in this file); only
-- the service role can read it (pup_push_key).

create table if not exists public.pup_push (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  tz text,
  dog text,
  player uuid references public.pup_players(id) on delete set null,
  active boolean not null default true,
  opened_on date,
  sad_on date,
  quote_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pup_push enable row level security;
revoke all on public.pup_push from anon, authenticated;

create or replace function public.pup_push_save(p_sub jsonb, p_tz text, p_dog text, p_token uuid default null, p_day date default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare ep text := p_sub ->> 'endpoint'; k1 text := p_sub #>> '{keys,p256dh}'; k2 text := p_sub #>> '{keys,auth}'; who uuid;
begin
  if ep is null or ep !~ '^https://' or length(ep) > 1000 or k1 is null or length(k1) > 200 or k2 is null or length(k2) > 100 then
    raise exception 'That is not a push subscription' using errcode = 'P0001';
  end if;
  if p_token is not null then select id into who from public.pup_players where token = p_token; end if;
  insert into public.pup_push (endpoint, p256dh, auth, tz, dog, player, active, opened_on, updated_at)
  values (ep, k1, k2, left(coalesce(p_tz, ''), 60), left(coalesce(p_dog, ''), 30), who, true, p_day, now())
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, tz = excluded.tz, dog = excluded.dog,
    player = coalesce(excluded.player, pup_push.player), active = true, opened_on = coalesce(excluded.opened_on, pup_push.opened_on), updated_at = now();
end $$;

create or replace function public.pup_push_off(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  update public.pup_push set active = false, updated_at = now() where endpoint = p_endpoint;
$$;

-- the app opened today (the phone's own date): no sad note tonight; the dog's name may have changed
create or replace function public.pup_push_opened(p_endpoint text, p_day date, p_dog text default null) returns void
language sql security definer set search_path = public as $$
  update public.pup_push set opened_on = greatest(coalesce(opened_on, p_day), p_day), dog = coalesce(left(p_dog, 30), dog), updated_at = now()
   where endpoint = p_endpoint and p_day between current_date - 1 and current_date + 1;
$$;

create or replace function public.pup_push_key() returns text
language sql security definer set search_path = public, vault as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'pup_push_vapid' limit 1;
$$;

revoke all on function public.pup_push_key() from public, anon, authenticated;
grant execute on function public.pup_push_save(jsonb, text, text, uuid, date) to anon, authenticated;
grant execute on function public.pup_push_off(text) to anon, authenticated;
grant execute on function public.pup_push_opened(text, date, text) to anon, authenticated;

-- the schedule: every 10 minutes, POST the edge function (deployed with --no-verify-jwt: a call sends only what is due,
-- once a day each, so an extra call is harmless)
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule(jobid) from cron.job where jobname = 'pup-push';
select cron.schedule('pup-push', '*/10 * * * *', $$ select net.http_post(
  url := 'https://pquajwxvlpvaygrkzfkl.supabase.co/functions/v1/pup-push',
  headers := '{"Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb) $$);

notify pgrst, 'reload schema';

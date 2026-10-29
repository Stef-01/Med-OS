-- 0006_pup_study.sql: a day of study on the leaderboard (founder 2026-10-29: "have a study session length leaderboard too
-- so can show who has answered most qs in one day and time spent too in one day on leaderboard with toggle"). Run after
-- 0005. Idempotent. The host logs what its player answers and how long they study (pup_study_log, a few calls a minute
-- at most); the leaderboard gains each player's questions and seconds for the viewer's day and their best day of each.
-- A day is the player's own date (p_day), held to within a day of the server's, so a night owl's study counts on their
-- day; a call adds at most 200 questions and 15 minutes, a day holds at most 3,000 questions and 24 hours.
-- The same rules run in server-core.mjs (study, leaderboard).

create table if not exists public.pup_study (
  player uuid not null references public.pup_players(id) on delete cascade,
  day date not null,
  answered int not null default 0,
  secs int not null default 0,
  primary key (player, day)
);
alter table public.pup_study enable row level security;
revoke all on public.pup_study from anon, authenticated;

create or replace function public.pup_day(p_day text) returns date
language sql immutable set search_path = public as $$
  select case when p_day ~ '^\d{4}-\d{2}-\d{2}$' and abs(p_day::date - (now() at time zone 'utc')::date) <= 1 then p_day::date
    else (now() at time zone 'utc')::date end
$$;

create or replace function public.pup_study_log(p_token uuid, p_answered int, p_secs int, p_day text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token); d date := public.pup_day(p_day); r public.pup_study;
begin
  insert into public.pup_study (player, day, answered, secs)
    values (me.id, d, greatest(0, least(200, coalesce(p_answered, 0))), greatest(0, least(900, coalesce(p_secs, 0))))
  on conflict (player, day) do update set
    answered = least(3000, public.pup_study.answered + excluded.answered),
    secs = least(86400, public.pup_study.secs + excluded.secs)
  returning * into r;
  return jsonb_build_object('day', r.day, 'answered', r.answered, 'secs', r.secs);
end $$;

drop function if exists public.pup_leaderboard(uuid);
create or replace function public.pup_leaderboard(p_token uuid, p_day text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token); d date := public.pup_day(p_day);
begin
  update public.pup_players set seen_at = now() where id = me.id;
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'look', p.look, 'rating', p.rating, 'ranked', p.ranked,
      'wins', p.wins, 'losses', p.losses, 'draws', p.draws, 'seen_at', p.seen_at,
      'week', (select count(*) from public.pup_duels x where x.status = 'done' and x.updated_at > now() - interval '7 days' and x.result ->> 'winner' = p.id::text),
      'month', (select count(*) from public.pup_duels x where x.status = 'done' and x.updated_at > now() - interval '30 days' and x.result ->> 'winner' = p.id::text),
      'qday', coalesce((select s.answered from public.pup_study s where s.player = p.id and s.day = d), 0),
      'tday', coalesce((select s.secs from public.pup_study s where s.player = p.id and s.day = d), 0),
      'qbest', coalesce((select max(s.answered) from public.pup_study s where s.player = p.id), 0),
      'tbest', coalesce((select max(s.secs) from public.pup_study s where s.player = p.id), 0))
    order by p.rating desc) from public.pup_players p), '[]'::jsonb);
end $$;

revoke all on function public.pup_day(text) from public, anon, authenticated;
grant execute on function public.pup_study_log(uuid, int, int, text) to anon, authenticated;
grant execute on function public.pup_leaderboard(uuid, text) to anon, authenticated;
notify pgrst, 'reload schema';

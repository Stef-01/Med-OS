-- 0003_pup_ranked.sql: ranked duels, the ladder and the matchmaking queue. Run after 0001 and 0002, in the same
-- project. Idempotent. The same rules run in JavaScript (src/duel/ranked.mjs, server-core.mjs), pinned by
-- test/ranked.test.mjs.
--
--   pup_players   + rating (Elo from 1000) and ranked (games played ranked)
--   pup_queue     one ticket a player: their rating when they asked, when they joined, when they last asked, and the
--                 duel once they are matched
--   a trigger     strips `ranked` from any duel's setup unless the queue is making it (the pup.ranked setting), so a
--                 challenge between mates can never pass itself off as ranked
--   a trigger     moves both ratings when a ranked duel is done (K 32, zero-sum; walking out is a loss)
--   pup_queue / pup_unqueue / pup_leaderboard   the three new entry points

alter table public.pup_players add column if not exists rating int not null default 1000;
alter table public.pup_players add column if not exists ranked int not null default 0;
create index if not exists pup_players_rating on public.pup_players (rating desc);

create table if not exists public.pup_queue (
  player    uuid        primary key references public.pup_players (id) on delete cascade,
  rating    int         not null,
  joined_at timestamptz not null default now(),
  polled_at timestamptz not null default now(),
  duel      uuid        references public.pup_duels (id) on delete cascade
);
alter table public.pup_queue enable row level security;
revoke all on public.pup_queue from anon, authenticated;

-- ---- triggers ----

create or replace function public.pup_unrank() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if coalesce(current_setting('pup.ranked', true), '') = 'on' then new.setup := new.setup || '{"ranked":true}'::jsonb;
  else new.setup := new.setup - 'ranked'; end if;
  return new;
end $$;
drop trigger if exists pup_unrank on public.pup_duels;
create trigger pup_unrank before insert on public.pup_duels for each row execute function public.pup_unrank();

-- a's change when a scores s against b (ranked.mjs eloDelta: rounded on its size, half away from zero)
create or replace function public.pup_elo(ra int, rb int, s numeric) returns int
language sql immutable as $$
  select (sign(s - 1 / (1 + power(10::numeric, (rb - ra)::numeric / 400))) * round(abs(32 * (s - 1 / (1 + power(10::numeric, (rb - ra)::numeric / 400))))))::int
$$;

create or replace function public.pup_rate() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare ra int; rb int; x int; win text := new.result ->> 'winner';
begin
  select rating into ra from public.pup_players where id = new.a;
  select rating into rb from public.pup_players where id = new.b;
  x := public.pup_elo(ra, rb, case when win is null then 0.5 when win = new.a::text then 1 else 0 end);
  update public.pup_players set rating = rating + x, ranked = ranked + 1 where id = new.a;
  update public.pup_players set rating = rating - x, ranked = ranked + 1 where id = new.b;
  return new;
end $$;
drop trigger if exists pup_rate on public.pup_duels;
create trigger pup_rate after update of status on public.pup_duels for each row
  when (new.status = 'done' and old.status is distinct from 'done' and coalesce((new.setup ->> 'ranked')::boolean, false)) execute function public.pup_rate();

-- ---- entry points ----

-- ask for a match (again every few seconds while searching): a duel once paired, else how long you have waited
create or replace function public.pup_queue(p_token uuid, p_setup jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token); mine public.pup_queue; opp public.pup_queue; d jsonb; did uuid; waited numeric; win numeric;
begin
  perform pg_advisory_xact_lock(hashtext('pup_queue'));   -- one pairing at a time: nobody is matched twice
  update public.pup_players set seen_at = now() where id = me.id;
  delete from public.pup_queue where duel is null and polled_at < now() - interval '15 seconds';
  select * into mine from public.pup_queue where player = me.id;
  if found and mine.duel is not null then
    delete from public.pup_queue where player = me.id;
    return jsonb_build_object('duel', (select public.pup_duel_row(x) from public.pup_duels x where x.id = mine.duel));
  end if;
  insert into public.pup_queue (player, rating) values (me.id, me.rating)
    on conflict (player) do update set polled_at = now(), rating = excluded.rating
    returning * into mine;
  -- the nearest rating inside the window the longer wait gives (ranked.mjs windowFor, pickOpponent)
  select q.* into opp from public.pup_queue q
   where q.player <> me.id and q.duel is null and q.polled_at >= now() - interval '15 seconds'
     and abs(q.rating - mine.rating) <= (case when extract(epoch from now() - least(q.joined_at, mine.joined_at)) * 1000 >= 60000 then 2147483647
          else 100 + 50 * floor(extract(epoch from now() - least(q.joined_at, mine.joined_at)) * 1000 / 10000) end)
   order by abs(q.rating - mine.rating), q.joined_at limit 1;
  if not found then
    waited := extract(epoch from now() - mine.joined_at) * 1000;
    win := case when waited >= 60000 then null else 100 + 50 * floor(waited / 10000) end;
    return jsonb_build_object('queued', true, 'since', mine.joined_at, 'window', win);
  end if;
  perform set_config('pup.ranked', 'on', true);
  d := public.pup_challenge(p_token, opp.player, p_setup);
  perform set_config('pup.ranked', 'off', true);
  did := (d ->> 'id')::uuid;
  perform public.pup_post((select token from public.pup_players where id = opp.player), did, did::text || '/accept', 'accept', '{}'::jsonb);
  update public.pup_queue set duel = did where player = opp.player;
  delete from public.pup_queue where player = me.id;
  return jsonb_build_object('duel', (select public.pup_duel_row(x) from public.pup_duels x where x.id = did));
end $$;

create or replace function public.pup_unqueue(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token);
begin
  delete from public.pup_queue where player = me.id;
  return jsonb_build_object('queued', false);
end $$;

-- everyone on the ladder, with their wins in the last 7 days
create or replace function public.pup_leaderboard(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token);
begin
  update public.pup_players set seen_at = now() where id = me.id;
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'look', p.look, 'rating', p.rating, 'ranked', p.ranked,
      'wins', p.wins, 'losses', p.losses, 'draws', p.draws, 'seen_at', p.seen_at,
      'week', (select count(*) from public.pup_duels d where d.status = 'done' and d.updated_at > now() - interval '7 days' and d.result ->> 'winner' = p.id::text))
    order by p.rating desc) from public.pup_players p), '[]'::jsonb);
end $$;

revoke all on function public.pup_elo(int, int, numeric) from public, anon, authenticated;
grant execute on function public.pup_queue(uuid, jsonb) to anon, authenticated;
grant execute on function public.pup_unqueue(uuid) to anon, authenticated;
grant execute on function public.pup_leaderboard(uuid) to anon, authenticated;

notify pgrst, 'reload schema';

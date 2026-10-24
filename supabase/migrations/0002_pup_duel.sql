-- Pup Duel: players, duels and the event log (docs/architecture.md, "Data model").
-- Run once in the Supabase SQL editor of the project your host's config names. Idempotent: safe to run again.
--
-- Security, sized for mates (founder 2026-10-24: "no complex security or auth"): a player is a name and a 4-digit
-- PIN, checked here with bcrypt. The tables are closed to the anon key; it can only call the functions below, and
-- every write carries the device token pup_login returns. Nobody can read a PIN or post as someone else with the
-- anon key; anyone with the site and the key can make a player and read players' names, which is the point.
-- server-core.mjs is these functions again in JavaScript (local play, tests); test/sql-parity.test.mjs pins the two.

-- crypt() and gen_salt(): Supabase has pgcrypto in the extensions schema (on the functions' search_path below);
-- a plain Postgres gets it in public
create extension if not exists pgcrypto;

create table if not exists public.pup_players (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  name_key   text        not null unique,
  pin_hash   text        not null,
  token      uuid        not null default gen_random_uuid(),
  look       jsonb       not null default '{}'::jsonb,
  wins       int         not null default 0,
  losses     int         not null default 0,
  draws      int         not null default 0,
  created_at timestamptz not null default now(),
  seen_at    timestamptz not null default now()
);
create unique index if not exists pup_players_token on public.pup_players (token);

create table if not exists public.pup_duels (
  id         uuid        primary key default gen_random_uuid(),
  a          uuid        not null references public.pup_players (id) on delete cascade,
  b          uuid        not null references public.pup_players (id) on delete cascade,
  status     text        not null default 'invited' check (status in ('invited', 'live', 'done', 'declined', 'cancelled')),
  setup      jsonb       not null,
  result     jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (a <> b)
);
create index if not exists pup_duels_a on public.pup_duels (a, updated_at desc);
create index if not exists pup_duels_b on public.pup_duels (b, updated_at desc);

create table if not exists public.pup_events (
  n     bigint      generated always as identity primary key,
  id    text        not null unique,
  duel  uuid        not null references public.pup_duels (id) on delete cascade,
  by    uuid        not null references public.pup_players (id) on delete cascade,
  kind  text        not null check (kind in ('accept', 'decline', 'answer', 'timeout', 'emote', 'leave', 'final', 'rematch')),
  body  jsonb       not null default '{}'::jsonb,
  at    timestamptz not null default now()
);
create index if not exists pup_events_duel on public.pup_events (duel, n);

-- closed to the anon key: the functions are the only way in
alter table public.pup_players enable row level security;
alter table public.pup_duels   enable row level security;
alter table public.pup_events  enable row level security;
revoke all on public.pup_players, public.pup_duels, public.pup_events from anon, authenticated;

-- ---- helpers ----

create or replace function public.pup_norm_name(p text) returns text
language sql immutable as $$ select regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g') $$;

create or replace function public.pup_profile(p public.pup_players) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', p.id, 'name', p.name, 'look', p.look, 'wins', p.wins, 'losses', p.losses,
                            'draws', p.draws, 'seen_at', p.seen_at)
$$;

create or replace function public.pup_me(p_token uuid) returns public.pup_players
language plpgsql security definer set search_path = public, extensions as $$
declare r public.pup_players;
begin
  select * into r from public.pup_players where token = p_token;
  if not found then raise exception 'Sign in again' using errcode = 'P0001'; end if;
  return r;
end $$;

create or replace function public.pup_duel_row(d public.pup_duels) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', d.id, 'a', d.a, 'b', d.b, 'status', d.status, 'setup', d.setup, 'result', d.result,
                            'created_at', d.created_at, 'updated_at', d.updated_at)
$$;

create or replace function public.pup_event_row(e public.pup_events) returns jsonb
language sql stable as $$
  select jsonb_build_object('n', e.n, 'id', e.id, 'duel', e.duel, 'by', e.by, 'kind', e.kind, 'body', e.body, 'at', e.at)
$$;

-- ---- accounts ----

create or replace function public.pup_register(p_name text, p_pin text, p_look jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare n text := public.pup_norm_name(p_name); r public.pup_players;
begin
  if n !~ '^[A-Za-z0-9 ._-]{2,20}$' or n !~ '[A-Za-z0-9]' then raise exception 'Pick a name of 2 to 20 letters or numbers' using errcode = 'P0001'; end if;
  if coalesce(p_pin, '') !~ '^[0-9]{4}$' then raise exception 'The PIN is 4 digits' using errcode = 'P0001'; end if;
  if octet_length(coalesce(p_look, '{}'::jsonb)::text) > 2048 then raise exception 'That look is too big' using errcode = 'P0001'; end if;
  begin
    insert into public.pup_players (name, name_key, pin_hash, look)
    values (n, lower(n), crypt(p_pin, gen_salt('bf', 8)), coalesce(p_look, '{}'::jsonb))
    returning * into r;
  exception when unique_violation then
    raise exception 'That name is taken' using errcode = 'P0001';
  end;
  return public.pup_profile(r) || jsonb_build_object('token', r.token);
end $$;

create or replace function public.pup_login(p_name text, p_pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r public.pup_players;
begin
  select * into r from public.pup_players where name_key = lower(public.pup_norm_name(p_name));
  if not found or r.pin_hash <> crypt(coalesce(p_pin, ''), r.pin_hash) then
    perform pg_sleep(0.4);
    raise exception 'Wrong name or PIN' using errcode = 'P0001';
  end if;
  update public.pup_players set seen_at = now() where id = r.id returning * into r;
  return public.pup_profile(r) || jsonb_build_object('token', r.token);
end $$;

create or replace function public.pup_touch(p_token uuid, p_look jsonb default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token);
begin
  if p_look is not null and octet_length(p_look::text) > 2048 then raise exception 'That look is too big' using errcode = 'P0001'; end if;
  update public.pup_players set seen_at = now(), look = coalesce(p_look, look) where id = me.id returning * into me;
  return public.pup_profile(me);
end $$;

create or replace function public.pup_roster(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token);
begin
  update public.pup_players set seen_at = now() where id = me.id;
  return coalesce((select jsonb_agg(public.pup_profile(p) order by p.seen_at desc) from public.pup_players p), '[]'::jsonb);
end $$;

-- ---- duels ----

create or replace function public.pup_challenge(p_token uuid, p_opponent uuid, p_setup jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token); d public.pup_duels; q jsonb; nq int;
begin
  if p_opponent = me.id then raise exception 'Pick a mate, not yourself' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.pup_players where id = p_opponent) then raise exception 'No such player' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_setup -> 'questions') is distinct from 'array' then raise exception 'A duel needs questions' using errcode = 'P0001'; end if;
  nq := jsonb_array_length(p_setup -> 'questions');
  if nq < 1 or nq > 15 then raise exception 'A duel has 1 to 15 questions' using errcode = 'P0001'; end if;
  if (p_setup ->> 'rounds')::int is distinct from nq then raise exception 'Rounds must match the questions' using errcode = 'P0001'; end if;
  if coalesce((p_setup ->> 'secs')::int, 0) not between 5 and 120 then raise exception 'A question lasts 5 to 120 seconds' using errcode = 'P0001'; end if;
  if octet_length(p_setup::text) > 65536 then raise exception 'That duel is too big' using errcode = 'P0001'; end if;
  for q in select * from jsonb_array_elements(p_setup -> 'questions') loop
    if jsonb_typeof(q -> 'options') is distinct from 'array' or jsonb_array_length(q -> 'options') not between 2 and 6
       or coalesce((q ->> 'answer')::int, -1) not between 0 and jsonb_array_length(q -> 'options') - 1 then
      raise exception 'A question needs 2 to 6 options and its answer' using errcode = 'P0001';
    end if;
  end loop;
  insert into public.pup_duels (a, b, setup) values (me.id, p_opponent, p_setup) returning * into d;
  update public.pup_players set seen_at = now() where id = me.id;
  return public.pup_duel_row(d);
end $$;

create or replace function public.pup_inbox(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token);
begin
  update public.pup_players set seen_at = now() where id = me.id;
  return coalesce((select jsonb_agg(public.pup_duel_row(d) order by d.updated_at desc) from (
    (select * from public.pup_duels where (a = me.id or b = me.id) and status in ('invited', 'live'))
    union all
    (select * from public.pup_duels where (a = me.id or b = me.id) and status not in ('invited', 'live') order by updated_at desc limit 20)
  ) d), '[]'::jsonb);
end $$;

create or replace function public.pup_post(p_token uuid, p_duel uuid, p_id text, p_kind text, p_body jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token); d public.pup_duels; e public.pup_events; res jsonb; w uuid;
begin
  select * into d from public.pup_duels where id = p_duel for update;
  if not found or me.id not in (d.a, d.b) then raise exception 'Not your duel' using errcode = 'P0001'; end if;
  if p_kind not in ('accept', 'decline', 'answer', 'timeout', 'emote', 'leave', 'final', 'rematch') then raise exception 'Unknown move' using errcode = 'P0001'; end if;
  if coalesce(p_id, '') = '' or length(p_id) > 200 or left(p_id, length(p_duel::text) + 1) <> p_duel::text || '/' then raise exception 'Bad move id' using errcode = 'P0001'; end if;
  if octet_length(coalesce(p_body, '{}'::jsonb)::text) > 4096 then raise exception 'That move is too big' using errcode = 'P0001'; end if;

  select * into e from public.pup_events where id = p_id;            -- a retry, or a second copy: the stored row
  if found then return public.pup_event_row(e); end if;

  insert into public.pup_events (id, duel, by, kind, body) values (p_id, p_duel, me.id, p_kind, coalesce(p_body, '{}'::jsonb))
  returning * into e;

  if p_kind = 'accept' and d.status = 'invited' and me.id = d.b then
    update public.pup_duels set status = 'live', updated_at = now() where id = d.id;
  elsif p_kind = 'decline' and d.status = 'invited' and me.id = d.b then
    update public.pup_duels set status = 'declined', updated_at = now() where id = d.id;
  elsif p_kind = 'leave' and d.status = 'invited' then
    update public.pup_duels set status = case when me.id = d.a then 'cancelled' else 'declined' end, updated_at = now() where id = d.id;
  elsif p_kind = 'final' and d.status = 'live' then
    -- the first final records the result; both phones computed it from the same log
    res := coalesce(p_body, '{}'::jsonb);
    w := nullif(res ->> 'winner', '')::uuid;
    update public.pup_duels set status = 'done', result = res, updated_at = now() where id = d.id;
    if w is null then
      update public.pup_players set draws = draws + 1 where id in (d.a, d.b);
    elsif w in (d.a, d.b) then
      update public.pup_players set wins = wins + 1 where id = w;
      update public.pup_players set losses = losses + 1 where id in (d.a, d.b) and id <> w;
    end if;
  else
    update public.pup_duels set updated_at = now() where id = d.id;
  end if;
  update public.pup_players set seen_at = now() where id = me.id;
  return public.pup_event_row(e);
end $$;

create or replace function public.pup_log(p_token uuid, p_duel uuid, p_after bigint default 0) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token); d public.pup_duels;
begin
  select * into d from public.pup_duels where id = p_duel;
  if not found or me.id not in (d.a, d.b) then raise exception 'Not your duel' using errcode = 'P0001'; end if;
  return jsonb_build_object('duel', public.pup_duel_row(d), 'rows', coalesce((
    select jsonb_agg(public.pup_event_row(e) order by e.n)
    from (select * from public.pup_events where duel = p_duel and n > coalesce(p_after, 0) order by n limit 200) e
  ), '[]'::jsonb));
end $$;

-- the anon key may call the entry points, and nothing else
revoke all on function public.pup_me(uuid) from public, anon, authenticated;
grant execute on function public.pup_register(text, text, jsonb) to anon, authenticated;
grant execute on function public.pup_login(text, text) to anon, authenticated;
grant execute on function public.pup_touch(uuid, jsonb) to anon, authenticated;
grant execute on function public.pup_roster(uuid) to anon, authenticated;
grant execute on function public.pup_challenge(uuid, uuid, jsonb) to anon, authenticated;
grant execute on function public.pup_inbox(uuid) to anon, authenticated;
grant execute on function public.pup_post(uuid, uuid, text, text, jsonb) to anon, authenticated;
grant execute on function public.pup_log(uuid, uuid, bigint) to anon, authenticated;

-- Realtime: the duel's fast path uses public broadcast channels (pup-duel-<id>, pup-player-<id>), which need no
-- table or policy here. If the project's Realtime settings allow private channels only, turn public access back on,
-- or the duel runs on polling alone (still within 5 s).

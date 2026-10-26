-- Pup Duel: players, duels and the event log (docs/architecture.md, "Data model").
-- Run once in the Supabase SQL editor of the project your host's config names. Idempotent: safe to run again.
--
-- Security, sized for mates (founder 2026-10-24: "no complex security or auth"): a player is a name and a 4-digit
-- PIN, checked here with bcrypt; five wrong PINs for a name in 10 minutes and that name waits. The tables are closed
-- to the anon key; it can only call the functions below, and every write carries the device token pup_login returns.
-- A move's id is fixed by its kind, round and maker, so nobody can take another's; the status and the win/loss
-- record follow the log (pup_outcome), never a phone's claim. Anyone with the site and the key can make a player
-- and read players' names, which is the point.
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

create table if not exists public.pup_fails (
  name_key text        not null,
  at       timestamptz not null default now()
);
create index if not exists pup_fails_key on public.pup_fails (name_key, at);

-- closed to the anon key: the functions are the only way in
alter table public.pup_players enable row level security;
alter table public.pup_duels   enable row level security;
alter table public.pup_events  enable row level security;
alter table public.pup_fails   enable row level security;
revoke all on public.pup_players, public.pup_duels, public.pup_events, public.pup_fails from anon, authenticated;

-- ---- helpers ----

-- trimmed, single spaces, ASCII whitespace only (accounts.mjs normName says the same)
create or replace function public.pup_norm_name(p text) returns text
language sql immutable as $$
  select regexp_replace(regexp_replace(coalesce(p, ''), '^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$', '', 'g'), '[ \t\n\r\f\v]+', ' ', 'g')
$$;

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

-- a wrong PIN is an answer, not an exception, so the failure it records is kept: {error}
create or replace function public.pup_login(p_name text, p_pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r public.pup_players; k text := lower(public.pup_norm_name(p_name));
begin
  delete from public.pup_fails where at < now() - interval '10 minutes';
  if (select count(*) from public.pup_fails where name_key = k) >= 5 then
    return jsonb_build_object('error', 'Too many wrong PINs: try again in 10 minutes');
  end if;
  select * into r from public.pup_players where name_key = k;
  if not found or r.pin_hash <> crypt(coalesce(p_pin, ''), r.pin_hash) then
    insert into public.pup_fails (name_key) values (k);
    return jsonb_build_object('error', 'Wrong name or PIN');
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
  -- one open challenge between two players: a second (the other tapped Rematch too, or my other phone did) gets the
  -- open one back, to accept or to wait on, so a storm of taps settles on one duel (evals, 2026-10-25). The pair's
  -- lock makes two challenges at the same moment take turns
  perform pg_advisory_xact_lock(hashtextextended(least(me.id::text, p_opponent::text) || greatest(me.id::text, p_opponent::text), 0));
  select * into d from public.pup_duels where status = 'invited' and ((a = me.id and b = p_opponent) or (a = p_opponent and b = me.id))
    order by created_at, id limit 1;
  if not found then
    insert into public.pup_duels (a, b, setup) values (me.id, p_opponent, p_setup) returning * into d;
  end if;
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

-- the duel as the log says it stands: core.mjs reduce() in PL/pgSQL (test/sql.test.mjs replays random logs through
-- both and compares). The phones fold the same rows the same way; this is the copy the record is kept from.
create or replace function public.pup_outcome(p_duel uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
-- (the column "by" is quoted: PL/pgSQL reads a bare by as its own keyword)
declare
  d public.pup_duels; e public.pup_events; qs jsonb; q jsonb; body jsonb;
  nq int; t int; phase text := 'invited'; rnd int := 0; reason text := ''; winner uuid := null;
  sa int := 0; sb int := 0; ra int := 0; rb int := 0; ta bigint := 0; tb bigint := 0;
  ua int := 0; ub int := 0; ia int := 0; ib int := 0; ha boolean := false; hb boolean := false;
  who uuid; tfor uuid; ch int; ms int; ok boolean; pts int; nopt int; c numeric;
begin
  select * into d from public.pup_duels where id = p_duel;
  if not found then return null; end if;
  qs := d.setup -> 'questions'; nq := coalesce(jsonb_array_length(qs), 0); t := coalesce((d.setup ->> 'secs')::int, 20) * 1000;
  for e in select * from public.pup_events where duel = p_duel order by n loop
    continue when e."by" not in (d.a, d.b);
    body := coalesce(e.body, '{}'::jsonb); tfor := null;
    if e.kind = 'accept' then
      if phase = 'invited' and e."by" = d.b then phase := 'live'; end if;
    elsif e.kind = 'decline' then
      if phase = 'invited' and e."by" = d.b then phase := 'declined'; end if;
    elsif e.kind = 'leave' then
      if phase = 'invited' then phase := case when e."by" = d.a then 'cancelled' else 'declined' end;
      elsif phase = 'live' then phase := 'done'; reason := 'leave'; winner := case when e."by" = d.a then d.b else d.a end;
      end if;
    elsif e.kind = 'answer' then
      if phase = 'live' and jsonb_typeof(body -> 'round') = 'number' and (body ->> 'round')::numeric = rnd
         and ((e."by" = d.a and not ha) or (e."by" = d.b and not hb)) then
        q := qs -> rnd; nopt := jsonb_array_length(q -> 'options'); ch := null; ms := 0;
        if jsonb_typeof(body -> 'choice') = 'number' then
          c := (body ->> 'choice')::numeric;
          if c = trunc(c) and c >= 0 and c < nopt then ch := c::int; end if;
        end if;
        if jsonb_typeof(body -> 'ms') = 'number' then ms := greatest(0, least(t, round((body ->> 'ms')::numeric)))::int; end if;
        ok := ch is not null and ch = (q ->> 'answer')::int;
        if e."by" = d.a then
          pts := case when ok then 500 + (1000 * (t - ms) + t) / (2 * t) + 100 * least(ua, 3) else 0 end;
          sa := sa + pts; ua := case when ok then ua + 1 else 0 end; ia := 0; ha := true;
          if ok then ra := ra + 1; ta := ta + ms; end if;
        else
          pts := case when ok then 500 + (1000 * (t - ms) + t) / (2 * t) + 100 * least(ub, 3) else 0 end;
          sb := sb + pts; ub := case when ok then ub + 1 else 0 end; ib := 0; hb := true;
          if ok then rb := rb + 1; tb := tb + ms; end if;
        end if;
      end if;
    elsif e.kind = 'timeout' then
      who := case when jsonb_typeof(body -> 'for') = 'string' and (body ->> 'for') in (d.a::text, d.b::text) then (body ->> 'for')::uuid end;
      if phase = 'live' and jsonb_typeof(body -> 'round') = 'number' and (body ->> 'round')::numeric = rnd
         and who is not null and who <> e."by" and ((who = d.a and not ha) or (who = d.b and not hb)) then
        if who = d.a then ua := 0; ia := ia + 1; ha := true; else ub := 0; ib := ib + 1; hb := true; end if;
        tfor := who;
      end if;
    end if;
    if phase = 'live' and ha and hb then   -- the round closes when both are in
      rnd := rnd + 1; ha := false; hb := false;
      if rnd >= nq then
        phase := 'done'; reason := 'end';
        winner := case when sa <> sb then (case when sa > sb then d.a else d.b end)
                       when sa > 0 and ta <> tb then (case when ta < tb then d.a else d.b end) end;
      end if;
    end if;
    if tfor is not null and phase = 'live' and ((tfor = d.a and ia >= 3) or (tfor = d.b and ib >= 3)) then
      phase := 'done'; reason := 'forfeit'; winner := e."by";
    end if;
  end loop;
  return jsonb_build_object('phase', phase, 'score', jsonb_build_object(d.a::text, sa, d.b::text, sb),
    'right', jsonb_build_object(d.a::text, ra, d.b::text, rb), 'winner', winner, 'reason', reason, 'rounds', nq);
end $$;

create or replace function public.pup_post(p_token uuid, p_duel uuid, p_id text, p_kind text, p_body jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token); d public.pup_duels; e public.pup_events; o jsonb; w uuid; want text; body jsonb := coalesce(p_body, '{}'::jsonb);
begin
  select * into d from public.pup_duels where id = p_duel for update;
  if not found or me.id not in (d.a, d.b) then raise exception 'Not your duel' using errcode = 'P0001'; end if;
  if p_kind not in ('accept', 'decline', 'answer', 'timeout', 'emote', 'leave', 'final', 'rematch') then raise exception 'Unknown move' using errcode = 'P0001'; end if;
  -- a move's id is the one its kind, round and maker give it (core.mjs idFor): nobody can take another's id first
  want := case p_kind
    when 'answer' then p_duel::text || '/a/' || coalesce(body ->> 'round', '') || '/' || me.id::text
    when 'timeout' then p_duel::text || '/t/' || coalesce(body ->> 'round', '') || '/' || coalesce(body ->> 'for', '')
    when 'accept' then p_duel::text || '/accept'
    when 'decline' then p_duel::text || '/decline'
    when 'emote' then null
    else p_duel::text || '/' || p_kind || '/' || me.id::text end;
  if coalesce(p_id, '') = '' or length(p_id) > 200
     or (want is not null and p_id <> want)
     or (want is null and left(p_id, length(p_duel::text || '/e/' || me.id::text || '/')) <> p_duel::text || '/e/' || me.id::text || '/') then
    raise exception 'Bad move id' using errcode = 'P0001';
  end if;
  if octet_length(body::text) > 4096 then raise exception 'That move is too big' using errcode = 'P0001'; end if;

  select * into e from public.pup_events where id = p_id;            -- a retry, or a second copy: the stored row
  if found then return public.pup_event_row(e); end if;

  insert into public.pup_events (id, duel, by, kind, body) values (p_id, p_duel, me.id, p_kind, body)
  returning * into e;

  -- the status and the record follow the log, once, whatever any phone says
  o := public.pup_outcome(d.id);
  if d.status in ('invited', 'live') and o ->> 'phase' <> d.status then
    update public.pup_duels set status = o ->> 'phase', result = case when o ->> 'phase' = 'done' then o else result end, updated_at = now() where id = d.id;
    if o ->> 'phase' = 'done' then
      w := (o ->> 'winner')::uuid;
      if w is null then
        update public.pup_players set draws = draws + 1 where id in (d.a, d.b);
      else
        update public.pup_players set wins = wins + 1 where id = w;
        update public.pup_players set losses = losses + 1 where id in (d.a, d.b) and id <> w;
      end if;
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
  ), '[]'::jsonb), 'now', now());
end $$;

-- the anon key may call the entry points, and nothing else
revoke all on function public.pup_me(uuid) from public, anon, authenticated;
revoke all on function public.pup_outcome(uuid) from public, anon, authenticated;
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

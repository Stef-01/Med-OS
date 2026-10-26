-- 0008_library.sql: your questions, your friends, what you share (docs/library.md; founder 2026-10-25: "upload MCQs ...
-- instantly have their MCQs live on the system ... duel with a mix of each other's questions and easily share
-- flashcards with each other, a whole friending system"). Run after 0002 (the accounts, pup_players and pup_me).
-- Idempotent.
--
-- The account is Duel a Mate's. Every table here is closed to the public key (RLS on, no policy): the only way in is
-- the functions below, each with the player's token (pup_me), so nobody reads a deck that is not theirs or shared
-- with them by a friend. A question is the MCQ pool's item (public/js/mcq/schema.mjs, kind "user") plus its kind
-- (cat), checked in the browser (public/js/library/item.mjs) and held here to its size and shape.
--
-- Limits: 50 decks and 2,000 questions an account, 16 KB a question, 500 in one upload, 100 friends and requests.

create table if not exists public.lib_decks (
  id         uuid        primary key default gen_random_uuid(),
  owner      uuid        not null references public.pup_players (id) on delete cascade,
  name       text        not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner, name)
);
create table if not exists public.lib_items (
  owner      uuid        not null references public.pup_players (id) on delete cascade,
  id         text        not null check (id ~ '^u-[a-z0-9]{6,24}$'),
  deck       uuid        not null references public.lib_decks (id) on delete cascade,
  item       jsonb       not null check (octet_length(item::text) <= 16384),
  created_at timestamptz not null default now(),
  primary key (owner, id)
);
create index if not exists lib_items_deck on public.lib_items (deck);
-- a friendship is one row, the pair in id order (a < b): pending until the one who did not ask accepts
create table if not exists public.lib_friends (
  a          uuid        not null references public.pup_players (id) on delete cascade,
  b          uuid        not null references public.pup_players (id) on delete cascade,
  asked_by   uuid        not null,
  status     text        not null default 'pending' check (status in ('pending', 'friends')),
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);
create index if not exists lib_friends_b on public.lib_friends (b);
create table if not exists public.lib_shares (
  deck       uuid        not null references public.lib_decks (id) on delete cascade,
  friend     uuid        not null references public.pup_players (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (deck, friend)
);
create index if not exists lib_shares_friend on public.lib_shares (friend);
alter table public.lib_decks enable row level security;
alter table public.lib_items enable row level security;
alter table public.lib_friends enable row level security;
alter table public.lib_shares enable row level security;

-- are two players friends (accepted)?
create or replace function public.lib_are_friends(p uuid, q uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lib_friends where a = least(p, q) and b = greatest(p, q) and status = 'friends')
$$;

-- questions into a deck (found by name, made when new): { deck, added, total }. A question already in the account (by
-- id) moves to this deck with its new text. Each is checked for shape here too: a phone cannot store markup or a bad key
create or replace function public.lib_upload(p_token uuid, p_deck text, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token); nm text := btrim(regexp_replace(coalesce(p_deck, ''), '\s+', ' ', 'g'));
  d public.lib_decks; it jsonb; n int := 0; tot int; nopt int;
begin
  if char_length(nm) < 1 or char_length(nm) > 40 then raise exception 'Name the deck (1 to 40 characters)' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 then raise exception 'Nothing to save' using errcode = 'P0001'; end if;
  if jsonb_array_length(p_items) > 500 then raise exception 'At most 500 questions at once' using errcode = 'P0001'; end if;
  select * into d from public.lib_decks where owner = me.id and name = nm;
  if not found then
    if (select count(*) from public.lib_decks where owner = me.id) >= 50 then raise exception 'You have 50 decks: delete one first' using errcode = 'P0001'; end if;
    insert into public.lib_decks (owner, name) values (me.id, nm) returning * into d;
  end if;
  for it in select jsonb_array_elements(p_items) loop
    nopt := case when jsonb_typeof(it -> 'options') = 'array' then jsonb_array_length(it -> 'options') else 0 end;
    if jsonb_typeof(it) <> 'object' or coalesce(it ->> 'id', '') !~ '^u-[a-z0-9]{6,24}$'
       or jsonb_typeof(it -> 'stem') <> 'string' or char_length(it ->> 'stem') < 20
       or nopt not between 4 and 5 or jsonb_typeof(it -> 'answer') <> 'number' or (it ->> 'answer')::numeric not between 0 and nopt - 1
       or coalesce(it ->> 'cat', '') not in ('skills', 'clinical', 'physio', 'anatomy') or coalesce(it ->> 'topic', '') = ''
       or (it -> 'provenance' ->> 'kind') is distinct from 'user' then
      raise exception 'Question % is not in the right shape', n + 1 using errcode = 'P0001';
    end if;
    if octet_length(it::text) > 16384 then raise exception 'Question % is over 16 KB', n + 1 using errcode = 'P0001'; end if;
    if it::text ~* '<\s*/?\s*[a-z][^>]*>' then raise exception 'Question % has HTML in it: plain text only', n + 1 using errcode = 'P0001'; end if;
    insert into public.lib_items (owner, id, deck, item) values (me.id, it ->> 'id', d.id, it)
    on conflict (owner, id) do update set deck = excluded.deck, item = excluded.item;
    n := n + 1;
  end loop;
  select count(*) into tot from public.lib_items where owner = me.id;
  if tot > 2000 then raise exception 'That would make % questions: 2,000 is the most an account holds', tot using errcode = 'P0001'; end if;
  update public.lib_decks set updated_at = now() where id = d.id;
  update public.pup_players set seen_at = now() where id = me.id;
  return jsonb_build_object('deck', d.id, 'name', d.name, 'added', n, 'total', tot);
end $$;

-- everything you can study: { me, decks: [your decks, each with items and who it is shared with],
-- shared: [friends' decks shared with you, each with items and its owner] }
create or replace function public.lib_library(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token);
begin
  update public.pup_players set seen_at = now() where id = me.id;
  return jsonb_build_object('me', me.id,
    'decks', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'updated_at', d.updated_at,
        'shared', coalesce((select jsonb_agg(s.friend) from public.lib_shares s where s.deck = d.id), '[]'::jsonb),
        'items', coalesce((select jsonb_agg(i.item order by i.created_at, i.id) from public.lib_items i where i.deck = d.id), '[]'::jsonb))
      order by d.updated_at desc) from public.lib_decks d where d.owner = me.id), '[]'::jsonb),
    'shared', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'owner', p.id, 'owner_name', p.name, 'updated_at', d.updated_at,
        'items', coalesce((select jsonb_agg(i.item order by i.created_at, i.id) from public.lib_items i where i.deck = d.id), '[]'::jsonb))
      order by d.updated_at desc)
      from public.lib_shares s join public.lib_decks d on d.id = s.deck join public.pup_players p on p.id = d.owner
      where s.friend = me.id and public.lib_are_friends(me.id, d.owner)), '[]'::jsonb));
end $$;

-- delete one of your questions (p_item), or a whole deck of yours (p_item null): the number of questions gone
create or replace function public.lib_delete(p_token uuid, p_deck uuid, p_item text default null) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token); n int;
begin
  if not exists (select 1 from public.lib_decks where id = p_deck and owner = me.id) then raise exception 'Not your deck' using errcode = 'P0001'; end if;
  if p_item is null then
    select count(*) into n from public.lib_items where deck = p_deck;
    delete from public.lib_decks where id = p_deck;
  else
    delete from public.lib_items where owner = me.id and deck = p_deck and id = p_item;
    get diagnostics n = row_count;
  end if;
  return n;
end $$;

-- rename a deck of yours
create or replace function public.lib_rename(p_token uuid, p_deck uuid, p_name text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token); nm text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  if char_length(nm) < 1 or char_length(nm) > 40 then raise exception 'Name the deck (1 to 40 characters)' using errcode = 'P0001'; end if;
  begin
    update public.lib_decks set name = nm, updated_at = now() where id = p_deck and owner = me.id;
  exception when unique_violation then raise exception 'You have a deck called that already' using errcode = 'P0001';
  end;
  if not found then raise exception 'Not your deck' using errcode = 'P0001'; end if;
  return jsonb_build_object('id', p_deck, 'name', nm);
end $$;

-- ask someone to be friends, by their name: 'sent', or 'friends' when they had already asked you
create or replace function public.friend_request(p_token uuid, p_name text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token); o public.pup_players; f public.lib_friends;
begin
  select * into o from public.pup_players where name_key = lower(public.pup_norm_name(p_name));
  if not found then raise exception 'Nobody is called that' using errcode = 'P0001'; end if;
  if o.id = me.id then raise exception 'That is you' using errcode = 'P0001'; end if;
  select * into f from public.lib_friends where a = least(me.id, o.id) and b = greatest(me.id, o.id);
  if found then
    if f.status = 'friends' then return jsonb_build_object('status', 'friends', 'id', o.id, 'name', o.name); end if;
    if f.asked_by = o.id then
      update public.lib_friends set status = 'friends' where a = f.a and b = f.b;
      return jsonb_build_object('status', 'friends', 'id', o.id, 'name', o.name);
    end if;
    return jsonb_build_object('status', 'sent', 'id', o.id, 'name', o.name);
  end if;
  if (select count(*) from public.lib_friends where me.id in (a, b)) >= 100 then raise exception 'You have 100 friends and requests: remove one first' using errcode = 'P0001'; end if;
  insert into public.lib_friends (a, b, asked_by) values (least(me.id, o.id), greatest(me.id, o.id), me.id);
  return jsonb_build_object('status', 'sent', 'id', o.id, 'name', o.name);
end $$;

-- answer a request (accept true), or end a friendship or a request either way (accept false): the shares between the
-- two go with it
create or replace function public.friend_respond(p_token uuid, p_other uuid, p_accept boolean) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token); f public.lib_friends;
begin
  select * into f from public.lib_friends where a = least(me.id, p_other) and b = greatest(me.id, p_other);
  if not found then raise exception 'No such request' using errcode = 'P0001'; end if;
  if p_accept then
    if f.asked_by = me.id and f.status = 'pending' then raise exception 'They have not answered yet' using errcode = 'P0001'; end if;
    update public.lib_friends set status = 'friends' where a = f.a and b = f.b;
    return 'friends';
  end if;
  delete from public.lib_friends where a = f.a and b = f.b;
  delete from public.lib_shares s using public.lib_decks d where s.deck = d.id
    and ((d.owner = me.id and s.friend = p_other) or (d.owner = p_other and s.friend = me.id));
  return 'removed';
end $$;

-- your friends and requests: [{ id, name, look, status: 'friends' | 'incoming' | 'outgoing', seen_at }]
create or replace function public.friend_list(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'look', p.look, 'seen_at', p.seen_at,
      'status', case when f.status = 'friends' then 'friends' when f.asked_by = me.id then 'outgoing' else 'incoming' end)
    order by f.status, p.name_key)
    from public.lib_friends f join public.pup_players p on p.id = case when f.a = me.id then f.b else f.a end
    where me.id in (f.a, f.b)), '[]'::jsonb);
end $$;

-- share a deck of yours with a friend (p_on), or stop: the friends it is shared with now
create or replace function public.lib_share(p_token uuid, p_deck uuid, p_friend uuid, p_on boolean) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token);
begin
  if not exists (select 1 from public.lib_decks where id = p_deck and owner = me.id) then raise exception 'Not your deck' using errcode = 'P0001'; end if;
  if p_on then
    if not public.lib_are_friends(me.id, p_friend) then raise exception 'Only with a friend' using errcode = 'P0001'; end if;
    insert into public.lib_shares (deck, friend) values (p_deck, p_friend) on conflict do nothing;
  else
    delete from public.lib_shares where deck = p_deck and friend = p_friend;
  end if;
  return coalesce((select jsonb_agg(friend) from public.lib_shares where deck = p_deck), '[]'::jsonb);
end $$;

revoke all on function public.lib_are_friends(uuid, uuid) from public, anon, authenticated;
grant execute on function public.lib_upload(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.lib_library(uuid) to anon, authenticated;
grant execute on function public.lib_delete(uuid, uuid, text) to anon, authenticated;
grant execute on function public.lib_rename(uuid, uuid, text) to anon, authenticated;
grant execute on function public.friend_request(uuid, text) to anon, authenticated;
grant execute on function public.friend_respond(uuid, uuid, boolean) to anon, authenticated;
grant execute on function public.friend_list(uuid) to anon, authenticated;
grant execute on function public.lib_share(uuid, uuid, uuid, boolean) to anon, authenticated;

notify pgrst, 'reload schema';

-- the week among friends (added 2026-10-26; research: Duolingo's friends layer, scored on effort only): you and each
-- friend with the answers given in the last 7 days and the days studied, from each one's own Study record on their
-- account (osce_state ns 'u:<id>:lib', shard 'k/days', written by study-kit/sync.mjs). Counts only: nobody sees another's
-- answers, cards or notes. [{ id, name, me, week, days }], the most first
create or replace function public.friend_week(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token); since text := to_char((now() at time zone 'Australia/Sydney')::date - 6, 'YYYY-MM-DD');
begin
  return coalesce((select jsonb_agg(x order by (x ->> 'week')::int desc, x ->> 'name') from (
    select jsonb_build_object('id', pe.id, 'name', pe.name, 'me', pe.id = me.id,
      'week', coalesce((select sum(coalesce((e.value ->> 'n')::int, 0)) from jsonb_each(case when jsonb_typeof(s.value) = 'object' then s.value else '{}'::jsonb end) e where e.key >= since), 0),
      'days', coalesce((select count(*) from jsonb_each(case when jsonb_typeof(s.value) = 'object' then s.value else '{}'::jsonb end) e where e.key >= since and coalesce((e.value ->> 'n')::int, 0) > 0), 0)) as x
    from (select me.id, me.name union select p.id, p.name from public.lib_friends f join public.pup_players p on p.id = case when f.a = me.id then f.b else f.a end where me.id in (f.a, f.b) and f.status = 'friends') pe
    left join public.osce_state s on s.ns = 'u:' || pe.id::text || ':lib' and s.id = 'k/days') q), '[]'::jsonb);
end $$;
grant execute on function public.friend_week(uuid) to anon, authenticated;
notify pgrst, 'reload schema';

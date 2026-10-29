-- 0011_playlists.sql: community playlists of questions (founder 2026-10-26: "a seperate button on the standard question
-- selection ui called playlist where people can click to see more creative spotify styled community playlist style
-- library for Questions where people can make their personal questions live and they can get favourited and can see
-- trending questions ... a completley different set to the games standard question library set"). Run after 0008
-- (the decks) and 0002 (the accounts). Idempotent. The plan: docs/playlists-handover.md.
--
-- A playlist is one of your decks published: a snapshot of its questions (so it stays what was published if the deck
-- changes; publishing again refreshes it), a title, a blurb and a cover seed. Anyone signed in can browse, favourite and
-- play; trending is favourites x3 plus plays in the last 7 days. Plays count once a player a day. Three different
-- players reporting a playlist hide it. Every table is closed to the public key (RLS on, no policy); the functions are
-- the only way in, each with the player's token (pup_me). Nothing here touches the standard bank (duel/pack.json).
-- The founder's ban holds: a playlist naming NDIS or grants is refused.

create table if not exists public.lib_playlists (
  id         uuid        primary key default gen_random_uuid(),
  owner      uuid        not null references public.pup_players (id) on delete cascade,
  deck       uuid        references public.lib_decks (id) on delete set null,
  title      text        not null check (char_length(title) between 1 and 60),
  blurb      text        not null default '' check (char_length(blurb) <= 200),
  cover      int         not null default 0,
  questions  jsonb       not null check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) between 1 and 100),
  n          int         not null,
  favs       int         not null default 0,
  plays      int         not null default 0,
  hidden     boolean     not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner, deck)
);
create index if not exists lib_playlists_new on public.lib_playlists (created_at desc) where not hidden;
create table if not exists public.lib_playlist_favs (
  playlist uuid not null references public.lib_playlists (id) on delete cascade,
  player   uuid not null references public.pup_players (id) on delete cascade,
  at       timestamptz not null default now(),
  primary key (playlist, player)
);
create table if not exists public.lib_playlist_plays (
  playlist uuid not null references public.lib_playlists (id) on delete cascade,
  player   uuid not null references public.pup_players (id) on delete cascade,
  day      date not null default current_date,
  primary key (playlist, player, day)
);
create table if not exists public.lib_playlist_reports (
  playlist uuid not null references public.lib_playlists (id) on delete cascade,
  player   uuid not null references public.pup_players (id) on delete cascade,
  reason   text not null default '' check (char_length(reason) <= 200),
  at       timestamptz not null default now(),
  primary key (playlist, player)
);
alter table public.lib_playlists enable row level security;
alter table public.lib_playlist_favs enable row level security;
alter table public.lib_playlist_plays enable row level security;
alter table public.lib_playlist_reports enable row level security;

-- a playlist as a card in a list (no questions: they come with pl_get)
create or replace function public.pl_card(p public.lib_playlists, p_me uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'title', p.title, 'blurb', p.blurb, 'cover', p.cover, 'n', p.n, 'favs', p.favs, 'plays', p.plays,
    'owner', p.owner, 'owner_name', (select name from public.pup_players where id = p.owner), 'mine', p.owner = p_me,
    'fav', exists (select 1 from public.lib_playlist_favs f where f.playlist = p.id and f.player = p_me),
    'week', (select count(*) from public.lib_playlist_plays w where w.playlist = p.id and w.day > current_date - 7)
      + 3 * (select count(*) from public.lib_playlist_favs f where f.playlist = p.id and f.at > now() - interval '7 days'),
    'created_at', p.created_at, 'updated_at', p.updated_at)
$$;

-- publish one of your decks (or publish it again: the snapshot, title and blurb refresh): the card
create or replace function public.pl_publish(p_token uuid, p_deck uuid, p_title text, p_blurb text default '') returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token); d public.lib_decks; qs jsonb; nn int; p public.lib_playlists;
  t text := btrim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g')); b text := btrim(regexp_replace(coalesce(p_blurb, ''), '\s+', ' ', 'g'));
begin
  select * into d from public.lib_decks where id = p_deck and owner = me.id;
  if not found then raise exception 'That is not one of your decks' using errcode = 'P0001'; end if;
  if char_length(t) < 1 or char_length(t) > 60 then raise exception 'Name the playlist (1 to 60 characters)' using errcode = 'P0001'; end if;
  if char_length(b) > 200 then raise exception 'The description is at most 200 characters' using errcode = 'P0001'; end if;
  if (t || ' ' || b) ~ '<\s*/?\s*[a-zA-Z][^>]*>' then raise exception 'Plain text only' using errcode = 'P0001'; end if;
  select coalesce(jsonb_agg(i.item order by i.created_at, i.id), '[]'::jsonb), count(*) into qs, nn from (select * from public.lib_items where deck = d.id order by created_at, id limit 100) i;
  if nn < 1 then raise exception 'The deck has no questions yet' using errcode = 'P0001'; end if;
  if (t || ' ' || b || ' ' || qs::text) ~* '\m(ndis|grants?)\M' then raise exception 'That topic cannot be published here' using errcode = 'P0001'; end if;
  insert into public.lib_playlists (owner, deck, title, blurb, cover, questions, n)
  values (me.id, d.id, t, b, abs(hashtext(d.id::text)) % 1000, qs, nn)
  on conflict (owner, deck) do update set title = excluded.title, blurb = excluded.blurb, questions = excluded.questions, n = excluded.n, updated_at = now()
  returning * into p;
  update public.pup_players set seen_at = now() where id = me.id;
  return public.pl_card(p, me.id);
end $$;

create or replace function public.pl_unpublish(p_token uuid, p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare me public.pup_players := public.pup_me(p_token);
begin
  delete from public.lib_playlists where id = p_id and owner = me.id;
  return found;
end $$;

-- browse: p_sort trending | new | top | faves | mine; p_q searches the title, the blurb and the owner's name
create or replace function public.pl_list(p_token uuid, p_sort text default 'trending', p_q text default '', p_limit int default 30, p_offset int default 0) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token); q text := btrim(coalesce(p_q, '')); lim int := least(greatest(coalesce(p_limit, 30), 1), 60);
begin
  if coalesce(p_sort, '') not in ('trending', 'new', 'top', 'faves', 'mine') then raise exception 'Unknown order' using errcode = 'P0001'; end if;
  if char_length(q) > 60 then q := left(q, 60); end if;
  return coalesce((select jsonb_agg(c order by ord) from (
    select public.pl_card(p, me.id) as c,
      row_number() over (order by
        case when p_sort = 'trending' then -(public.pl_card(p, me.id) ->> 'week')::int end,
        case when p_sort in ('top', 'trending') then -p.favs end,
        case when p_sort in ('top', 'trending') then -p.plays end,
        p.created_at desc) as ord
    from public.lib_playlists p join public.pup_players o on o.id = p.owner
    where (not p.hidden or p.owner = me.id)
      and (p_sort <> 'mine' or p.owner = me.id)
      and (p_sort <> 'faves' or exists (select 1 from public.lib_playlist_favs f where f.playlist = p.id and f.player = me.id))
      and (q = '' or p.title ilike '%' || q || '%' or p.blurb ilike '%' || q || '%' or o.name ilike '%' || q || '%')
    order by ord limit lim offset greatest(coalesce(p_offset, 0), 0)) s), '[]'::jsonb);
end $$;

-- one playlist with its questions
create or replace function public.pl_get(p_token uuid, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token); p public.lib_playlists;
begin
  select * into p from public.lib_playlists where id = p_id and (not hidden or owner = me.id);
  if not found then raise exception 'That playlist is gone' using errcode = 'P0001'; end if;
  return public.pl_card(p, me.id) || jsonb_build_object('questions', p.questions);
end $$;

-- favourite or not: the count after
create or replace function public.pl_fav(p_token uuid, p_id uuid, p_on boolean) returns int
language plpgsql security definer set search_path = public as $$
declare me public.pup_players := public.pup_me(p_token); cnt int;
begin
  if not exists (select 1 from public.lib_playlists where id = p_id and not hidden) then raise exception 'That playlist is gone' using errcode = 'P0001'; end if;
  if p_on then insert into public.lib_playlist_favs (playlist, player) values (p_id, me.id) on conflict do nothing;
  else delete from public.lib_playlist_favs where playlist = p_id and player = me.id; end if;
  select count(*) into cnt from public.lib_playlist_favs where playlist = p_id;
  update public.lib_playlists set favs = cnt where id = p_id;
  return cnt;
end $$;

-- a play (once a player a day): the play count
create or replace function public.pl_play(p_token uuid, p_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare me public.pup_players := public.pup_me(p_token); cnt int;
begin
  if not exists (select 1 from public.lib_playlists where id = p_id and not hidden) then raise exception 'That playlist is gone' using errcode = 'P0001'; end if;
  insert into public.lib_playlist_plays (playlist, player) values (p_id, me.id) on conflict do nothing;
  select count(*) into cnt from public.lib_playlist_plays where playlist = p_id;
  update public.lib_playlists set plays = cnt where id = p_id;
  return cnt;
end $$;

-- report (not your own): three different players hide it
create or replace function public.pl_report(p_token uuid, p_id uuid, p_reason text default '') returns boolean
language plpgsql security definer set search_path = public as $$
declare me public.pup_players := public.pup_me(p_token);
begin
  if exists (select 1 from public.lib_playlists where id = p_id and owner = me.id) then raise exception 'That is your own playlist' using errcode = 'P0001'; end if;
  insert into public.lib_playlist_reports (playlist, player, reason) values (p_id, me.id, left(coalesce(p_reason, ''), 200)) on conflict do nothing;
  update public.lib_playlists set hidden = true where id = p_id and (select count(*) from public.lib_playlist_reports r where r.playlist = p_id) >= 3;
  return true;
end $$;

revoke all on function public.pl_card(public.lib_playlists, uuid) from public, anon, authenticated;
grant execute on function public.pl_publish(uuid, uuid, text, text) to anon, authenticated;
grant execute on function public.pl_unpublish(uuid, uuid) to anon, authenticated;
grant execute on function public.pl_list(uuid, text, text, int, int) to anon, authenticated;
grant execute on function public.pl_get(uuid, uuid) to anon, authenticated;
grant execute on function public.pl_fav(uuid, uuid, boolean) to anon, authenticated;
grant execute on function public.pl_play(uuid, uuid) to anon, authenticated;
grant execute on function public.pl_report(uuid, uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';

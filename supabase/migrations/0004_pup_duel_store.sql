-- Pup Duel: the store. Bones earned by duels, the item shop and the locker's loadouts (src/duel/wallet.mjs says the
-- rules in words; src/duel/store-core.mjs is these functions again in JavaScript, pinned by test/store-parity.test.mjs).
-- Run after 0001_pup_duel.sql, in the same project. Idempotent: safe to run again (the price table is re-seeded).
--
-- Server-authoritative: a phone never says what it earned or what it paid. Bones come from the duels' own records
-- (pup_duels.result, which pup_post folds from the log), once per duel and player (pup_earnings' primary key), and
-- the balance can never go below zero (a check constraint, under a row lock). A purchase names the piece, the price
-- the phone showed and the phone's date: the server works out the price itself from the seeded table and today's
-- deal (pup_shop_deal, wardrobe.mjs shopFor in PL/pgSQL), refuses a price that differs, and refuses a date more than
-- the time zones away. Every look a player saves keeps only the pieces they own (the trigger on pup_players), so a
-- mate's lobby can never show a piece nobody paid for. No health system: nothing here drains.
--
-- The tables are closed to the anon key, as 0001's are; four functions are open (pup_wallet, pup_buy, pup_buy_set,
-- pup_loadout), each with the device token pup_login returns.

-- ---- the price table (seeded below from src/pup/wardrobe.mjs by scripts/seed-store.mjs) ----

create table if not exists public.pup_catalogue (
  id        text    primary key,
  ord       int     not null,              -- the catalogue's order: shopFor's seeded shuffle walks it
  slot      text    not null check (slot in ('head', 'face', 'neck', 'back')),
  rarity    text    not null,
  price     int     not null check (price >= 0),
  deal      int     not null check (deal >= 0),   -- its price on a day it is the daily deal
  exclusive boolean not null default false  -- not sold (Optimus's monthly challenge piece)
);
create table if not exists public.pup_sets (
  id    text   primary key,
  ord   int    not null,
  items text[] not null
);

-- ---- a player's side ----

create table if not exists public.pup_wallets (
  player uuid primary key references public.pup_players (id) on delete cascade,
  bones  int  not null check (bones >= 0),
  earned int  not null default 0,
  spent  int  not null default 0
);
create table if not exists public.pup_earnings (
  duel   uuid        not null references public.pup_duels (id) on delete cascade,
  player uuid        not null references public.pup_players (id) on delete cascade,
  bones  int         not null check (bones >= 0),
  at     timestamptz not null default now(),
  primary key (duel, player)
);
create table if not exists public.pup_owned (
  player uuid        not null references public.pup_players (id) on delete cascade,
  item   text        not null,
  at     timestamptz not null default now(),
  primary key (player, item)
);
create table if not exists public.pup_spends (
  n      bigint      generated always as identity primary key,
  player uuid        not null references public.pup_players (id) on delete cascade,
  kind   text        not null check (kind in ('item', 'set')),
  ref    text        not null,
  bones  int         not null check (bones >= 0),
  at     timestamptz not null default now()
);
create index if not exists pup_spends_player on public.pup_spends (player, n);
create table if not exists public.pup_loadouts (
  player uuid        not null references public.pup_players (id) on delete cascade,
  slot   int         not null check (slot between 1 and 3),
  name   text        not null,
  look   jsonb       not null default '{}'::jsonb,
  at     timestamptz not null default now(),
  primary key (player, slot)
);

alter table public.pup_catalogue enable row level security;
alter table public.pup_sets      enable row level security;
alter table public.pup_wallets   enable row level security;
alter table public.pup_earnings  enable row level security;
alter table public.pup_owned     enable row level security;
alter table public.pup_spends    enable row level security;
alter table public.pup_loadouts  enable row level security;
revoke all on public.pup_catalogue, public.pup_sets, public.pup_wallets, public.pup_earnings, public.pup_owned, public.pup_spends, public.pup_loadouts from anon, authenticated;

-- ---- earning (wallet.mjs earnFor) ----

-- what a finished duel's record pays one of its players: 1 a right answer, 2 for playing to the end, 5 for a win with
-- at least one right
create or replace function public.pup_earn(p_result jsonb, p_player uuid) returns int
language sql immutable as $$
  select case when p_result ->> 'phase' = 'done' and jsonb_typeof(p_result -> 'right' -> p_player::text) = 'number' then
    greatest(0, floor((p_result -> 'right' ->> p_player::text)::numeric))::int * 1
    + case when p_result ->> 'reason' = 'end' then 2 else 0 end
    + case when p_result ->> 'winner' = p_player::text and floor((p_result -> 'right' ->> p_player::text)::numeric) >= 1 then 5 else 0 end
  else 0 end
$$;

-- the wallet, made on first use with the welcome 20, locked for this call; then every finished duel of the player's
-- that has not paid them yet pays them now, once
create or replace function public.pup_settle(p_player uuid) returns public.pup_wallets
language plpgsql security definer set search_path = public, extensions as $$
declare w public.pup_wallets; d public.pup_duels; e int;
begin
  insert into public.pup_wallets (player, bones) values (p_player, 20) on conflict (player) do nothing;
  select * into w from public.pup_wallets where player = p_player for update;
  for d in select * from public.pup_duels x where (x.a = p_player or x.b = p_player) and x.status = 'done' and x.result is not null
             and not exists (select 1 from public.pup_earnings g where g.duel = x.id and g.player = p_player) loop
    e := public.pup_earn(d.result, p_player);
    insert into public.pup_earnings (duel, player, bones) values (d.id, p_player, e) on conflict (duel, player) do nothing;
    if found then
      update public.pup_wallets set bones = bones + e, earned = earned + e where player = p_player returning * into w;
    end if;
  end loop;
  return w;
end $$;

-- ---- looks: only owned pieces (wallet.mjs ownedLook) ----

create or replace function public.pup_owned_look(p_player uuid, p_look jsonb) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare w jsonb := '{}'::jsonb; k text; v jsonb;
begin
  if jsonb_typeof(p_look) is distinct from 'object' or not (p_look ? 'wear') then return p_look; end if;
  if jsonb_typeof(p_look -> 'wear') = 'object' then
    for k, v in select * from jsonb_each(p_look -> 'wear') loop
      if jsonb_typeof(v) = 'string' and exists (select 1 from public.pup_owned o join public.pup_catalogue c on c.id = o.item
                                                where o.player = p_player and o.item = v #>> '{}' and c.slot = k) then
        w := w || jsonb_build_object(k, v);
      end if;
    end loop;
  end if;
  return jsonb_set(p_look, '{wear}', w);
end $$;

-- every look a player is given (pup_register, pup_touch) is kept with owned pieces only
create or replace function public.pup_fit_look() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  new.look := public.pup_owned_look(new.id, new.look);
  return new;
end $$;
drop trigger if exists pup_players_owned_look on public.pup_players;
create trigger pup_players_owned_look before insert or update of look on public.pup_players
  for each row execute function public.pup_fit_look();

-- ---- today's shop (wardrobe.mjs shopFor, in PL/pgSQL: the same seeded shuffle, so the same deal on every phone) ----

-- JavaScript's 32-bit arithmetic over bigint: Math.imul(a, b) >>> 0
create or replace function public.pup_imul(a bigint, b bigint) returns bigint
language sql immutable as $$
  select (((a & 4294967295) * (b & 65535)) + ((((a & 4294967295) * ((b >> 16) & 65535)) & 65535) << 16)) & 4294967295
$$;
-- one step of wardrobe.mjs rng (mulberry32): the next state and the next 32-bit draw (the draw / 2^32 is rnd())
create or replace function public.pup_rng(inout s bigint, out u bigint)
language plpgsql immutable as $$
declare t bigint;
begin
  s := (s + 1831565813) & 4294967295;
  t := public.pup_imul(s # (s >> 15), 1 | s);
  t := ((t + public.pup_imul(t # (t >> 7), 61 | t)) & 4294967295) # t;
  u := (t # (t >> 14)) & 4294967295;
end $$;
-- wardrobe.mjs shuffle: Fisher-Yates from the end, j = floor(rnd() * (i + 1))
create or replace function public.pup_shuffle(inout s bigint, inout a text[])
language plpgsql immutable as $$
declare i int; j int; u bigint; tmp text;
begin
  for i in reverse coalesce(array_length(a, 1), 0) - 1 .. 1 loop
    select r.s, r.u into s, u from public.pup_rng(s) r;
    j := ((u * (i + 1)) >> 32)::int;
    tmp := a[i + 1]; a[i + 1] := a[j + 1]; a[j + 1] := tmp;
  end loop;
end $$;
-- the daily deal on `p_day` ('YYYY-MM-DD'): the dearest of the six daily pieces, the first of them on a tie
create or replace function public.pup_shop_deal(p_day text) returns text
language plpgsql stable security definer set search_path = public, extensions as $$
declare s bigint := 2166136261; u bigint; i int; seed text := 'shop:' || p_day; nset int; setitems text[];
  pool text[]; fe text[]; da text[]; best text; bp int; p int;
begin
  for i in 1 .. length(seed) loop s := public.pup_imul(s # ascii(substr(seed, i, 1)), 16777619); end loop;
  select r.s, r.u into s, u from public.pup_rng(s) r;
  select count(*) into nset from public.pup_sets;
  if nset = 0 then return null; end if;
  select items into setitems from public.pup_sets order by ord offset ((u * nset) >> 32) limit 1;
  select array_agg(id order by ord) into pool from public.pup_catalogue where not exclusive and not (id = any (setitems));
  select array_agg(id order by ord) into fe from public.pup_catalogue where id = any (pool) and rarity in ('legendary', 'epic');
  select r.s, r.a into s, fe from public.pup_shuffle(s, coalesce(fe, '{}')) r;
  fe := fe[1:2];
  select array_agg(x order by n) into da from unnest(pool) with ordinality as t(x, n) where not (x = any (fe));
  select r.s, r.a into s, da from public.pup_shuffle(s, coalesce(da, '{}')) r;
  for i in 1 .. least(6, coalesce(array_length(da, 1), 0)) loop
    select price into p from public.pup_catalogue where id = da[i];
    if best is null or p > bp then best := da[i]; bp := p; end if;
  end loop;
  return best;
end $$;

-- a phone's date: a real day, the server's UTC date give or take the time zones (UTC-12 to UTC+14)
create or replace function public.pup_day_ok(p_day text) returns boolean
language plpgsql stable as $$
begin
  if coalesce(p_day, '') !~ '^\d{4}-\d{2}-\d{2}$' or p_day::date::text <> p_day then return false; end if;
  return p_day::date between ((now() at time zone 'utc') - interval '12 hours')::date and ((now() at time zone 'utc') + interval '14 hours')::date;
exception when others then
  return false;
end $$;

-- ---- what a phone sees ----

create or replace function public.pup_wallet_row(p_player uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'bones', w.bones, 'earned', w.earned,
    'owned', coalesce((select jsonb_agg(o.item order by c.ord) from public.pup_owned o join public.pup_catalogue c on c.id = o.item where o.player = p_player), '[]'::jsonb),
    'loadouts', coalesce((select jsonb_agg(jsonb_build_object('slot', l.slot, 'name', l.name, 'look', l.look) order by l.slot) from public.pup_loadouts l where l.player = p_player), '[]'::jsonb))
  from public.pup_wallets w where w.player = p_player
$$;

-- ---- the entry points ----

create or replace function public.pup_wallet(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token);
begin
  perform public.pup_settle(me.id);
  return public.pup_wallet_row(me.id);
end $$;

-- one piece at today's price (the deal's, if it is today's deal); p_price is what the phone showed
create or replace function public.pup_buy(p_token uuid, p_item text, p_price int, p_day text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token); w public.pup_wallets := public.pup_settle(me.id); it public.pup_catalogue; cost int;
begin
  select * into it from public.pup_catalogue where id = p_item;
  if not found or it.exclusive then raise exception 'No such piece' using errcode = 'P0001'; end if;
  if not public.pup_day_ok(p_day) then raise exception 'Check the date on this phone' using errcode = 'P0001'; end if;
  if exists (select 1 from public.pup_owned where player = me.id and item = p_item) then raise exception 'You own that already' using errcode = 'P0001'; end if;
  cost := case when public.pup_shop_deal(p_day) = p_item then it.deal else it.price end;
  if p_price is distinct from cost then raise exception 'The price changed: look again' using errcode = 'P0001'; end if;
  if w.bones < cost then raise exception 'Not enough bones' using errcode = 'P0001'; end if;
  insert into public.pup_owned (player, item) values (me.id, p_item);
  insert into public.pup_spends (player, kind, ref, bones) values (me.id, 'item', p_item, cost);
  update public.pup_wallets set bones = bones - cost, spent = spent + cost where player = me.id;
  return public.pup_wallet_row(me.id);
end $$;

-- a bundle: the parts the player lacks, SET_OFF less than their prices (wardrobe.mjs setPrice)
create or replace function public.pup_buy_set(p_token uuid, p_set text, p_price int) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token); w public.pup_wallets := public.pup_settle(me.id); st public.pup_sets; lack text[]; whole int; cost int;
begin
  select * into st from public.pup_sets where id = p_set;
  if not found then raise exception 'No such bundle' using errcode = 'P0001'; end if;
  select array_agg(x order by n) into lack from unnest(st.items) with ordinality as t(x, n)
    where not exists (select 1 from public.pup_owned where player = me.id and item = x);
  if lack is null then raise exception 'You own every piece in that bundle' using errcode = 'P0001'; end if;
  select coalesce(sum(price), 0) into whole from public.pup_catalogue where id = any (lack);
  cost := greatest(5, round(whole * (1 - public.pup_set_off()) / 5) * 5)::int;
  if p_price is distinct from cost then raise exception 'The price changed: look again' using errcode = 'P0001'; end if;
  if w.bones < cost then raise exception 'Not enough bones' using errcode = 'P0001'; end if;
  insert into public.pup_owned (player, item) select me.id, x from unnest(lack) x;
  insert into public.pup_spends (player, kind, ref, bones) values (me.id, 'set', p_set, cost);
  update public.pup_wallets set bones = bones - cost, spent = spent + cost where player = me.id;
  return public.pup_wallet_row(me.id);
end $$;

-- a saved loadout: number 1 to 3, a name (wallet.mjs loadoutName), a look kept with owned pieces only
create or replace function public.pup_loadout(p_token uuid, p_slot int, p_name text, p_look jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token); n text; l jsonb := coalesce(p_look, '{}'::jsonb);
begin
  perform public.pup_settle(me.id);
  if p_slot is null or p_slot not between 1 and 3 then raise exception 'A loadout is number 1 to 3' using errcode = 'P0001'; end if;
  if octet_length(l::text) > 2048 then raise exception 'That look is too big' using errcode = 'P0001'; end if;
  n := public.pup_norm_name(p_name);
  if n !~ '^[A-Za-z0-9 ._''-]{1,16}$' then n := 'Loadout ' || p_slot; end if;
  insert into public.pup_loadouts (player, slot, name, look) values (me.id, p_slot, n, public.pup_owned_look(me.id, l))
  on conflict (player, slot) do update set name = excluded.name, look = excluded.look, at = now();
  return public.pup_wallet_row(me.id);
end $$;

-- ---- the seed: every piece and bundle of src/pup/wardrobe.mjs ----
-- @seed-start (written by scripts/seed-store.mjs from src/pup/wardrobe.mjs; npm test fails when it is stale)
insert into public.pup_catalogue (id, ord, slot, rarity, price, deal, exclusive) values
  ('wizard', 0, 'head', 'epic', 50, 30, false),
  ('pirate', 1, 'head', 'rare', 35, 20, false),
  ('viking', 2, 'head', 'rare', 40, 25, false),
  ('detective', 3, 'head', 'uncommon', 25, 15, false),
  ('cowboy', 4, 'head', 'uncommon', 25, 15, false),
  ('headset', 5, 'head', 'rare', 30, 20, false),
  ('toque', 6, 'head', 'common', 15, 10, false),
  ('laurel', 7, 'head', 'exclusive', 0, 5, true),
  ('crown', 8, 'head', 'legendary', 100, 60, false),
  ('wizspecs', 9, 'face', 'uncommon', 20, 10, false),
  ('hearts', 10, 'face', 'uncommon', 20, 10, false),
  ('pixel', 11, 'face', 'epic', 50, 30, false),
  ('aviators', 12, 'face', 'rare', 30, 20, false),
  ('threed', 13, 'face', 'common', 15, 10, false),
  ('monocle', 14, 'face', 'rare', 35, 20, false),
  ('scarf', 15, 'neck', 'uncommon', 25, 15, false),
  ('chain', 16, 'neck', 'rare', 40, 25, false),
  ('lei', 17, 'neck', 'uncommon', 20, 10, false),
  ('bowtie', 18, 'neck', 'common', 10, 5, false),
  ('steth', 19, 'neck', 'common', 15, 10, false),
  ('bandana', 20, 'neck', 'common', 10, 5, false),
  ('durag', 21, 'head', 'rare', 35, 20, false),
  ('goldrag', 22, 'head', 'epic', 55, 35, false),
  ('headwrap', 23, 'head', 'rare', 35, 20, false),
  ('bucket', 24, 'head', 'uncommon', 20, 10, false),
  ('snapback', 25, 'head', 'common', 15, 10, false),
  ('scrubcap', 26, 'head', 'common', 10, 5, false),
  ('llama', 27, 'head', 'epic', 55, 35, false),
  ('banana', 28, 'head', 'epic', 60, 35, false),
  ('bear', 29, 'head', 'legendary', 90, 55, false),
  ('visor', 30, 'face', 'epic', 55, 35, false),
  ('goggles', 31, 'face', 'rare', 30, 20, false),
  ('clout', 32, 'face', 'rare', 35, 20, false),
  ('stars', 33, 'face', 'uncommon', 20, 10, false),
  ('frames', 34, 'face', 'common', 10, 5, false),
  ('patch', 35, 'face', 'common', 10, 5, false),
  ('ice', 36, 'neck', 'legendary', 110, 65, false),
  ('kente', 37, 'neck', 'rare', 40, 25, false),
  ('lanyard', 38, 'neck', 'common', 10, 5, false),
  ('pearls', 39, 'neck', 'uncommon', 25, 15, false),
  ('spikes', 40, 'neck', 'uncommon', 20, 10, false),
  ('medal', 41, 'neck', 'epic', 60, 35, false),
  ('wings', 42, 'back', 'legendary', 120, 70, false),
  ('jetpack', 43, 'back', 'legendary', 100, 60, false),
  ('llamapack', 44, 'back', 'epic', 65, 40, false),
  ('guitar', 45, 'back', 'epic', 55, 35, false),
  ('batwings', 46, 'back', 'rare', 40, 25, false),
  ('cape', 47, 'back', 'rare', 35, 20, false),
  ('potion', 48, 'back', 'uncommon', 25, 15, false),
  ('pickaxe', 49, 'back', 'uncommon', 20, 10, false),
  ('medkit', 50, 'back', 'common', 15, 10, false),
  ('balloon', 51, 'back', 'common', 10, 5, false),
  ('headmirror', 52, 'head', 'rare', 35, 20, false),
  ('nursecap', 53, 'head', 'common', 10, 5, false),
  ('gradcap', 54, 'head', 'uncommon', 25, 15, false),
  ('santa', 55, 'head', 'rare', 30, 20, false),
  ('witch', 56, 'head', 'epic', 55, 35, false),
  ('bunny', 57, 'head', 'uncommon', 20, 10, false),
  ('partyhat', 58, 'head', 'common', 15, 10, false),
  ('beanie', 59, 'head', 'common', 10, 5, false),
  ('tiara', 60, 'head', 'legendary', 95, 55, false),
  ('flowers', 61, 'head', 'uncommon', 20, 10, false),
  ('sunhat', 62, 'head', 'uncommon', 20, 10, false),
  ('tophat', 63, 'head', 'rare', 40, 25, false),
  ('beret', 64, 'head', 'uncommon', 20, 10, false),
  ('hardhat', 65, 'head', 'common', 15, 10, false),
  ('propeller', 66, 'head', 'rare', 30, 20, false),
  ('antlers', 67, 'head', 'uncommon', 20, 10, false),
  ('cateye', 68, 'face', 'uncommon', 20, 10, false),
  ('loupes', 69, 'face', 'epic', 50, 30, false),
  ('safety', 70, 'face', 'common', 10, 5, false),
  ('shutter', 71, 'face', 'uncommon', 25, 15, false),
  ('tints', 72, 'face', 'uncommon', 20, 10, false),
  ('taped', 73, 'face', 'common', 15, 10, false),
  ('heromask', 74, 'face', 'rare', 30, 20, false),
  ('sleepmask', 75, 'face', 'common', 10, 5, false),
  ('prism', 76, 'face', 'epic', 55, 35, false),
  ('wayfarers', 77, 'face', 'common', 15, 10, false),
  ('masquerade', 78, 'face', 'legendary', 85, 50, false),
  ('frosty', 79, 'face', 'rare', 35, 20, false),
  ('tie', 80, 'neck', 'common', 10, 5, false),
  ('bluebandana', 81, 'neck', 'common', 10, 5, false),
  ('bonetag', 82, 'neck', 'common', 15, 10, false),
  ('locket', 83, 'neck', 'uncommon', 20, 10, false),
  ('ruff', 84, 'neck', 'uncommon', 25, 15, false),
  ('knitscarf', 85, 'neck', 'uncommon', 20, 10, false),
  ('jingle', 86, 'neck', 'uncommon', 25, 15, false),
  ('whistle', 87, 'neck', 'common', 10, 5, false),
  ('camera', 88, 'neck', 'rare', 35, 20, false),
  ('rosette', 89, 'neck', 'epic', 50, 30, false),
  ('surgmask', 90, 'neck', 'common', 10, 5, false),
  ('cowbell', 91, 'neck', 'rare', 30, 20, false),
  ('dogtags', 92, 'neck', 'uncommon', 20, 10, false)
on conflict (id) do update set ord = excluded.ord, slot = excluded.slot, rarity = excluded.rarity, price = excluded.price, deal = excluded.deal, exclusive = excluded.exclusive;
delete from public.pup_catalogue where id not in ('wizard', 'pirate', 'viking', 'detective', 'cowboy', 'headset', 'toque', 'laurel', 'crown', 'wizspecs', 'hearts', 'pixel', 'aviators', 'threed', 'monocle', 'scarf', 'chain', 'lei', 'bowtie', 'steth', 'bandana', 'durag', 'goldrag', 'headwrap', 'bucket', 'snapback', 'scrubcap', 'llama', 'banana', 'bear', 'visor', 'goggles', 'clout', 'stars', 'frames', 'patch', 'ice', 'kente', 'lanyard', 'pearls', 'spikes', 'medal', 'wings', 'jetpack', 'llamapack', 'guitar', 'batwings', 'cape', 'potion', 'pickaxe', 'medkit', 'balloon', 'headmirror', 'nursecap', 'gradcap', 'santa', 'witch', 'bunny', 'partyhat', 'beanie', 'tiara', 'flowers', 'sunhat', 'tophat', 'beret', 'hardhat', 'propeller', 'antlers', 'cateye', 'loupes', 'safety', 'shutter', 'tints', 'taped', 'heromask', 'sleepmask', 'prism', 'wayfarers', 'masquerade', 'frosty', 'tie', 'bluebandana', 'bonetag', 'locket', 'ruff', 'knitscarf', 'jingle', 'whistle', 'camera', 'rosette', 'surgmask', 'cowbell', 'dogtags');
insert into public.pup_sets (id, ord, items) values
  ('drip', 0, array['durag', 'clout', 'ice', 'guitar']),
  ('squad', 1, array['llama', 'visor', 'medal', 'llamapack']),
  ('ward', 2, array['scrubcap', 'frames', 'lanyard', 'medkit']),
  ('storm', 3, array['snapback', 'goggles', 'bandana', 'jetpack']),
  ('hero', 4, array['crown', 'aviators', 'scarf', 'cape']),
  ('night', 5, array['pirate', 'patch', 'spikes', 'batwings']),
  ('party', 6, array['bear', 'stars', 'lei', 'balloon']),
  ('gold', 7, array['goldrag', 'pixel', 'chain', 'wings']),
  ('fest', 8, array['bucket', 'hearts', 'pearls', 'potion'])
on conflict (id) do update set ord = excluded.ord, items = excluded.items;
delete from public.pup_sets where id not in ('drip', 'squad', 'ward', 'storm', 'hero', 'night', 'party', 'gold', 'fest');
-- a bundle costs this much less than its parts (wardrobe.mjs SET_OFF)
create or replace function public.pup_set_off() returns numeric language sql immutable as $$ select 0.25::numeric $$;
-- @seed-end

-- the anon key may call the four entry points, and nothing else
revoke all on function public.pup_settle(uuid) from public, anon, authenticated;
revoke all on function public.pup_owned_look(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.pup_fit_look() from public, anon, authenticated;
revoke all on function public.pup_wallet_row(uuid) from public, anon, authenticated;
revoke all on function public.pup_shop_deal(text) from public, anon, authenticated;
revoke all on function public.pup_earn(jsonb, uuid) from public, anon, authenticated;
revoke all on function public.pup_day_ok(text) from public, anon, authenticated;
revoke all on function public.pup_imul(bigint, bigint) from public, anon, authenticated;
revoke all on function public.pup_rng(bigint) from public, anon, authenticated;
revoke all on function public.pup_shuffle(bigint, text[]) from public, anon, authenticated;
revoke all on function public.pup_set_off() from public, anon, authenticated;
grant execute on function public.pup_wallet(uuid) to anon, authenticated;
grant execute on function public.pup_buy(uuid, text, int, text) to anon, authenticated;
grant execute on function public.pup_buy_set(uuid, text, int) to anon, authenticated;
grant execute on function public.pup_loadout(uuid, int, text, jsonb) to anon, authenticated;

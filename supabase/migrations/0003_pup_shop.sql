-- 0002_pup_shop.sql: the duel's shop. Bones earned by playing, spent on wardrobe pieces; outfits saved on the server.
-- Run after 0001_pup_duel.sql, in the same project. Idempotent: run it again after the catalogue changes and the
-- prices follow. The same rules run in JavaScript (src/duel/shop.mjs, server-core.mjs), pinned by test/shop.test.mjs.
--
--   pup_items       the catalogue's ids, slots, rarities and full prices (src/pup/wardrobe.mjs ITEMS; the test fails
--                   when they drift, and `node scripts/shop-sql.mjs` prints the rows again)
--   pup_players     + wallet jsonb { bones, owned[], outfits[], ledger[], practice{day,got} }, made on first use:
--                   25 welcome bones plus what every duel before the shop would have paid, and every piece the old
--                   locker had opened (the commons, then two a win, cheapest first)
--   a trigger       pays both players when a duel is done (win 12, draw 8, a finished loss 5, a bone a right answer;
--                   nothing for walking out; a forfeit pays the loser their right answers)
--   a trigger       keeps every look to what its player owns
--   pup_wallet / pup_buy / pup_practice / pup_outfits   the four new entry points

create table if not exists public.pup_items (
  id        text primary key,
  slot      text not null check (slot in ('head', 'face', 'neck', 'back')),
  rarity    text not null,
  price     int  not null check (price >= 0),
  exclusive boolean not null default false
);
alter table public.pup_items enable row level security;
revoke all on public.pup_items from anon, authenticated;

insert into public.pup_items (id, slot, rarity, price, exclusive) values
  ('wizard', 'head', 'epic', 50, false),
  ('pirate', 'head', 'rare', 35, false),
  ('viking', 'head', 'rare', 40, false),
  ('detective', 'head', 'uncommon', 25, false),
  ('cowboy', 'head', 'uncommon', 25, false),
  ('headset', 'head', 'rare', 30, false),
  ('toque', 'head', 'common', 15, false),
  ('laurel', 'head', 'exclusive', 0, true),
  ('crown', 'head', 'legendary', 100, false),
  ('wizspecs', 'face', 'uncommon', 20, false),
  ('hearts', 'face', 'uncommon', 20, false),
  ('pixel', 'face', 'epic', 50, false),
  ('aviators', 'face', 'rare', 30, false),
  ('threed', 'face', 'common', 15, false),
  ('monocle', 'face', 'rare', 35, false),
  ('scarf', 'neck', 'uncommon', 25, false),
  ('chain', 'neck', 'rare', 40, false),
  ('lei', 'neck', 'uncommon', 20, false),
  ('bowtie', 'neck', 'common', 10, false),
  ('steth', 'neck', 'common', 15, false),
  ('bandana', 'neck', 'common', 10, false),
  ('durag', 'head', 'rare', 35, false),
  ('goldrag', 'head', 'epic', 55, false),
  ('headwrap', 'head', 'rare', 35, false),
  ('bucket', 'head', 'uncommon', 20, false),
  ('snapback', 'head', 'common', 15, false),
  ('scrubcap', 'head', 'common', 10, false),
  ('llama', 'head', 'epic', 55, false),
  ('banana', 'head', 'epic', 60, false),
  ('bear', 'head', 'legendary', 90, false),
  ('visor', 'face', 'epic', 55, false),
  ('goggles', 'face', 'rare', 30, false),
  ('clout', 'face', 'rare', 35, false),
  ('stars', 'face', 'uncommon', 20, false),
  ('frames', 'face', 'common', 10, false),
  ('patch', 'face', 'common', 10, false),
  ('ice', 'neck', 'legendary', 110, false),
  ('kente', 'neck', 'rare', 40, false),
  ('lanyard', 'neck', 'common', 10, false),
  ('pearls', 'neck', 'uncommon', 25, false),
  ('spikes', 'neck', 'uncommon', 20, false),
  ('medal', 'neck', 'epic', 60, false),
  ('wings', 'back', 'legendary', 120, false),
  ('jetpack', 'back', 'legendary', 100, false),
  ('llamapack', 'back', 'epic', 65, false),
  ('guitar', 'back', 'epic', 55, false),
  ('batwings', 'back', 'rare', 40, false),
  ('cape', 'back', 'rare', 35, false),
  ('potion', 'back', 'uncommon', 25, false),
  ('pickaxe', 'back', 'uncommon', 20, false),
  ('medkit', 'back', 'common', 15, false),
  ('balloon', 'back', 'common', 10, false)
on conflict (id) do update set slot = excluded.slot, rarity = excluded.rarity, price = excluded.price, exclusive = excluded.exclusive;

alter table public.pup_players add column if not exists wallet jsonb;

-- ---- helpers (closed to the anon key) ----

-- the newest line on top, twelve kept
create or replace function public.pup_logged(p_ledger jsonb, p_d int, p_why text) returns jsonb
language sql stable as $$
  select coalesce((select jsonb_agg(x order by i) from (
    select x, i from jsonb_array_elements(jsonb_build_array(jsonb_build_object('d', p_d, 'why', p_why, 'at', now())) || coalesce(p_ledger, '[]'::jsonb)) with ordinality t(x, i)
    order by i limit 12) s), '[]'::jsonb)
$$;

-- the wallet a player from before the shop starts with (shop.mjs legacyWallet, locker.mjs unlockOrder)
create or replace function public.pup_legacy(p_wins int, p_draws int, p_losses int) returns jsonb
language plpgsql stable set search_path = public, extensions as $$
declare b int := 25 + 12 * p_wins + 8 * p_draws + 5 * p_losses; c int; owned jsonb;
begin
  select count(*) into c from public.pup_items where rarity = 'common' and not exclusive;
  select coalesce(jsonb_agg(id order by k, price, id collate "C"), '[]'::jsonb) into owned from (
    select id, price, (rarity <> 'common')::int as k from public.pup_items where not exclusive
    order by k, price, id collate "C" limit c + 2 * greatest(0, p_wins)) s;
  return jsonb_build_object('bones', b, 'owned', owned, 'outfits', '[]'::jsonb,
    'ledger', jsonb_build_array(jsonb_build_object('d', b, 'why', case when p_wins + p_draws + p_losses > 0 then 'legacy' else 'welcome' end)),
    'practice', jsonb_build_object('day', '', 'got', 0));
end $$;

-- a look with only the pieces in `owned` (shop.mjs fitWear)
create or replace function public.pup_fit(p_look jsonb, p_owned jsonb) returns jsonb
language sql immutable as $$
  select case when jsonb_typeof(p_look) <> 'object' then p_look
    else p_look || jsonb_build_object('wear', coalesce((select jsonb_object_agg(k, v) from jsonb_each(coalesce(p_look -> 'wear', '{}'::jsonb)) w(k, v)
      where jsonb_typeof(v) = 'string' and p_owned ? (v #>> '{}')), '{}'::jsonb)) end
$$;

-- the player's wallet, made on first use, the row locked for the caller's change
create or replace function public.pup_wallet_of(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r public.pup_players;
begin
  select * into r from public.pup_players where id = p_id for update;
  if r.wallet is null then
    update public.pup_players set wallet = public.pup_legacy(r.wins, r.draws, r.losses) where id = p_id returning * into r;
  end if;
  return r.wallet;
end $$;

-- every look wears only what its player owns (a new player: the commons)
create or replace function public.pup_fit_look() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.wallet is null then new.wallet := public.pup_legacy(new.wins, new.draws, new.losses); end if;
  new.look := public.pup_fit(new.look, new.wallet -> 'owned');
  return new;
end $$;
drop trigger if exists pup_fit_look on public.pup_players;
create trigger pup_fit_look before insert or update of look on public.pup_players for each row execute function public.pup_fit_look();

-- a finished duel pays both players, once (shop.mjs duelPay)
create or replace function public.pup_pay() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare pid uuid; w jsonb; win text := new.result ->> 'winner'; why text; d int; r int;
begin
  foreach pid in array array[new.a, new.b] loop
    w := public.pup_wallet_of(pid);
    r := greatest(0, coalesce((new.result -> 'right' ->> pid::text)::int, 0));
    if win = pid::text then why := 'win'; d := 12 + r;
    elsif win is null then why := 'draw'; d := 8 + r;
    elsif new.result ->> 'reason' = 'leave' then why := 'loss'; d := 0;
    elsif new.result ->> 'reason' = 'forfeit' then why := 'forfeit'; d := r;
    else why := 'loss'; d := 5 + r; end if;
    update public.pup_players set wallet = w || jsonb_build_object('bones', (w ->> 'bones')::int + d, 'ledger', public.pup_logged(w -> 'ledger', d, why)) where id = pid;
  end loop;
  return new;
end $$;
drop trigger if exists pup_pay on public.pup_duels;
create trigger pup_pay after update of status on public.pup_duels for each row
  when (new.status = 'done' and old.status is distinct from 'done') execute function public.pup_pay();

-- ---- entry points ----

create or replace function public.pup_wallet(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token);
begin
  update public.pup_players set seen_at = now() where id = me.id;
  return public.pup_wallet_of(me.id);
end $$;

-- a purchase: the pieces, and what the phone says they cost today (a deal, a bundle); never under half their price
create or replace function public.pup_buy(p_token uuid, p_ids jsonb, p_total int) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token); w jsonb := public.pup_wallet_of(me.id); ids jsonb; tot int := 0; it public.pup_items; k text;
begin
  select coalesce(jsonb_agg(distinct x), '[]'::jsonb) into ids from jsonb_array_elements_text(case when jsonb_typeof(p_ids) = 'array' then p_ids else '[]'::jsonb end) x;
  if jsonb_array_length(ids) = 0 then raise exception 'Pick something to buy' using errcode = 'P0001'; end if;
  for k in select jsonb_array_elements_text(ids) loop
    select * into it from public.pup_items where id = k;
    if not found then raise exception 'No such piece' using errcode = 'P0001'; end if;
    if it.exclusive then raise exception 'That piece cannot be bought' using errcode = 'P0001'; end if;
    if (w -> 'owned') ? k then raise exception 'You own that already' using errcode = 'P0001'; end if;
    tot := tot + it.price;
  end loop;
  if p_total is null or p_total < floor(tot * 0.5) then raise exception 'That price is wrong' using errcode = 'P0001'; end if;
  if p_total > (w ->> 'bones')::int then raise exception 'Not enough bones' using errcode = 'P0001'; end if;
  w := w || jsonb_build_object('bones', (w ->> 'bones')::int - p_total, 'owned', (w -> 'owned') || ids, 'ledger', public.pup_logged(w -> 'ledger', -p_total, 'buy'));
  update public.pup_players set wallet = w, seen_at = now() where id = me.id;
  return w;
end $$;

-- practice against the bot: a bone a right answer, up to 15 a day (UTC)
create or replace function public.pup_practice(p_token uuid, p_right int) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token); w jsonb := public.pup_wallet_of(me.id);
  today text := to_char(now() at time zone 'utc', 'YYYY-MM-DD'); got int; d int;
begin
  got := case when w -> 'practice' ->> 'day' = today then coalesce((w -> 'practice' ->> 'got')::int, 0) else 0 end;
  d := greatest(0, least(greatest(0, least(15, coalesce(p_right, 0))), 15 - got));
  w := w || jsonb_build_object('practice', jsonb_build_object('day', today, 'got', got + d));
  if d > 0 then w := w || jsonb_build_object('bones', (w ->> 'bones')::int + d, 'ledger', public.pup_logged(w -> 'ledger', d, 'practice')); end if;
  update public.pup_players set wallet = w, seen_at = now() where id = me.id;
  return w || jsonb_build_object('paid', d);
end $$;

-- the saved outfits: up to 3 looks (or nulls for empty slots), each worn only in what its player owns
create or replace function public.pup_outfits(p_token uuid, p_outfits jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token); w jsonb := public.pup_wallet_of(me.id); x jsonb; res jsonb := '[]'::jsonb;
begin
  if coalesce(jsonb_typeof(p_outfits), '') <> 'array' or jsonb_array_length(p_outfits) > 3 then raise exception 'At most 3 outfits' using errcode = 'P0001'; end if;
  for x in select jsonb_array_elements(p_outfits) loop
    if jsonb_typeof(x) <> 'null' and octet_length(x::text) > 2048 then raise exception 'That look is too big' using errcode = 'P0001'; end if;
    res := res || jsonb_build_array(case when jsonb_typeof(x) = 'null' then x else public.pup_fit(x, w -> 'owned') end);
  end loop;
  w := w || jsonb_build_object('outfits', res);
  update public.pup_players set wallet = w, seen_at = now() where id = me.id;
  return w;
end $$;

revoke all on function public.pup_wallet_of(uuid) from public, anon, authenticated;
revoke all on function public.pup_legacy(int, int, int) from public, anon, authenticated;
grant execute on function public.pup_wallet(uuid) to anon, authenticated;
grant execute on function public.pup_buy(uuid, jsonb, int) to anon, authenticated;
grant execute on function public.pup_practice(uuid, int) to anon, authenticated;
grant execute on function public.pup_outfits(uuid, jsonb) to anon, authenticated;

-- PostgREST reads the new functions at once
notify pgrst, 'reload schema';

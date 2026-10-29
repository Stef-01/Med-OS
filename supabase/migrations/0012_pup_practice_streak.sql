-- 0005_pup_practice_streak.sql: practice against the bot has no daily cap (founder 2026-10-29: "make the bones reward for
-- AI unlimited per day and you get more the more you play for the day"). A bone a right answer (at most 15 a game),
-- times a streak that grows 0.2 with each game played that day, up to x3 (src/duel/shop.mjs practicePay, streakOf).
-- wallet.practice gains n, the games played that day.
create or replace function public.pup_practice(p_token uuid, p_right int) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token); w jsonb := public.pup_wallet_of(me.id);
  today text := to_char(now() at time zone 'utc', 'YYYY-MM-DD'); same boolean; got int; n int; r int; mult numeric; d int;
begin
  same := w -> 'practice' ->> 'day' = today;
  got := case when same then coalesce((w -> 'practice' ->> 'got')::int, 0) else 0 end;
  n := case when same then coalesce((w -> 'practice' ->> 'n')::int, 0) else 0 end;
  r := greatest(0, least(15, coalesce(p_right, 0)));
  mult := least(3.0, 1 + 0.2 * n);
  d := floor(r * mult)::int;
  w := w || jsonb_build_object('practice', jsonb_build_object('day', today, 'got', got + d, 'n', n + 1));
  if d > 0 then w := w || jsonb_build_object('bones', (w ->> 'bones')::int + d, 'ledger', public.pup_logged(w -> 'ledger', d, 'practice')); end if;
  update public.pup_players set wallet = w, seen_at = now() where id = me.id;
  return w || jsonb_build_object('paid', d);
end $$;
grant execute on function public.pup_practice(uuid, int) to anon, authenticated;

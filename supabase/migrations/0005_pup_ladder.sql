-- 0004_pup_ladder.sql: the leaderboard's three periods. Run after 0003. Idempotent.
--   pup_leaderboard now counts each player's duel wins in the last 7 days (week) and the last 30 days (month); all time
--   is the ranked rating, and the record (wins, losses, draws) it always had. The same rule runs in server-core.mjs.

create index if not exists pup_duels_done on public.pup_duels (updated_at desc) where status = 'done';

create or replace function public.pup_leaderboard(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token);
begin
  update public.pup_players set seen_at = now() where id = me.id;
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'look', p.look, 'rating', p.rating, 'ranked', p.ranked,
      'wins', p.wins, 'losses', p.losses, 'draws', p.draws, 'seen_at', p.seen_at,
      'week', (select count(*) from public.pup_duels d where d.status = 'done' and d.updated_at > now() - interval '7 days' and d.result ->> 'winner' = p.id::text),
      'month', (select count(*) from public.pup_duels d where d.status = 'done' and d.updated_at > now() - interval '30 days' and d.result ->> 'winner' = p.id::text))
    order by p.rating desc) from public.pup_players p), '[]'::jsonb);
end $$;

notify pgrst, 'reload schema';

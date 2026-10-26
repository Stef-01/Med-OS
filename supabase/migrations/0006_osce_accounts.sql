-- 0006_osce_accounts.sql: OSCE progress on your own account (founder 2026-10-25: "make progress for everything save so
-- you login in settings so has osce progress plus this dual a mate progress"). Run after 0001 and 0002. Idempotent.
--
-- The account is Duel a Mate's: a name and a 4-digit PIN (pup_players, 0002_pup_duel.sql), signed in once in Settings.
-- A signed-in device keeps its OSCE record in osce_state under the namespace 'u:<player id>:<ns>' (the same shards, the
-- same last-write-wins merge, the same keep-newer trigger), reached only through the two functions below with the
-- player's token. The open policies stay for a device that is not signed in (the shared record, as before) but no
-- longer reach a player's rows.

drop policy if exists osce_state_select on public.osce_state;
drop policy if exists osce_state_insert on public.osce_state;
drop policy if exists osce_state_update on public.osce_state;
create policy osce_state_select on public.osce_state for select to anon using (ns not like 'u:%');
create policy osce_state_insert on public.osce_state for insert to anon with check (ns not like 'u:%');
create policy osce_state_update on public.osce_state for update to anon using (ns not like 'u:%') with check (ns not like 'u:%');

-- every shard of a namespace on your account: [{ id, value, updated_at }]
create or replace function public.osce_pull(p_token uuid, p_ns text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token);
begin
  if coalesce(p_ns, '') !~ '^[a-z]{1,20}$' then raise exception 'Unknown progress' using errcode = 'P0001'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'value', s.value, 'updated_at', s.updated_at))
    from public.osce_state s where s.ns = 'u:' || me.id::text || ':' || p_ns), '[]'::jsonb);
end $$;

-- shards to your account: [{ id, value, updated_at }]; an older copy than the one stored is ignored (the trigger)
create or replace function public.osce_push(p_token uuid, p_ns text, p_rows jsonb) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare me public.pup_players := public.pup_me(p_token); r jsonb; n int := 0; scope text;
begin
  if coalesce(p_ns, '') !~ '^[a-z]{1,20}$' then raise exception 'Unknown progress' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then raise exception 'Too much at once' using errcode = 'P0001'; end if;
  scope := 'u:' || me.id::text || ':' || p_ns;
  for r in select jsonb_array_elements(p_rows) loop
    if jsonb_typeof(r -> 'id') <> 'string' or length(r ->> 'id') > 200 or octet_length(coalesce(r -> 'value', 'null'::jsonb)::text) > 262144 then
      raise exception 'A shard is too big' using errcode = 'P0001';
    end if;
    insert into public.osce_state (ns, id, value, updated_at)
    values (scope, r ->> 'id', case when jsonb_typeof(r -> 'value') = 'null' then null else r -> 'value' end, coalesce((r ->> 'updated_at')::timestamptz, now()))
    on conflict (ns, id) do update set value = excluded.value, updated_at = excluded.updated_at;
    n := n + 1;
  end loop;
  update public.pup_players set seen_at = now() where id = me.id;
  return n;
end $$;

grant execute on function public.osce_pull(uuid, text) to anon, authenticated;
grant execute on function public.osce_push(uuid, text, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';

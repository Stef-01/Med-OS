-- Shared practice record for the two of you (public/js/study-kit/sync.mjs). Optional: only needed when config.js names
-- a Supabase project. One row per shard (hist/<station>, bm/<station>, k/timing, k/people), last write wins.
-- The anon key in config.js can read and write these rows, so keep the site's URL between the two of you.

create table if not exists public.osce_state (
  ns         text        not null,
  id         text        not null,
  value      jsonb,
  updated_at timestamptz not null default now(),
  primary key (ns, id)
);

alter table public.osce_state enable row level security;

drop policy if exists osce_state_select on public.osce_state;
drop policy if exists osce_state_insert on public.osce_state;
drop policy if exists osce_state_update on public.osce_state;
create policy osce_state_select on public.osce_state for select to anon using (true);
create policy osce_state_insert on public.osce_state for insert to anon with check (true);
create policy osce_state_update on public.osce_state for update to anon using (true) with check (true);
-- no delete policy: a removed shard is written as value null, so the removal reaches the other device

-- server-side last-write-wins: a late upload of an older copy never overwrites a newer row
create or replace function public.osce_state_keep_newer() returns trigger
language plpgsql as $$
begin
  if new.updated_at <= old.updated_at then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists osce_state_keep_newer on public.osce_state;
create trigger osce_state_keep_newer before update on public.osce_state
  for each row execute function public.osce_state_keep_newer();

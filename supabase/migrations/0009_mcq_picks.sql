-- 0009_mcq_picks.sql: how everyone answered each bank question (founder 2026-10-26: a personal study ecosystem like the
-- best platforms; research: UWorld and AMBOSS show the share of students who chose each option after you answer).
-- Run after 0001. Idempotent.
--
-- One row per question and option: a counter. The table is closed to the public key (RLS on, no policy); the app adds
-- one answer with mcq_pick and reads a question's spread with mcq_picks. Only the bank's question ids (letters, digits,
-- dot, dash, underscore; never a student's own question, whose id starts u-) and options 0 to 5.

create table if not exists public.mcq_picks (
  qid    text     not null check (qid ~ '^[A-Za-z0-9._-]{3,80}$' and qid !~ '^u-'),
  choice smallint not null check (choice between 0 and 5),
  n      integer  not null default 0,
  primary key (qid, choice)
);
alter table public.mcq_picks enable row level security;

create or replace function public.mcq_pick(p_qid text, p_choice int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(p_qid, '') !~ '^[A-Za-z0-9._-]{3,80}$' or p_qid ~ '^u-' or coalesce(p_choice, -1) not between 0 and 5 then return; end if;
  insert into public.mcq_picks (qid, choice, n) values (p_qid, p_choice, 1)
  on conflict (qid, choice) do update set n = public.mcq_picks.n + 1;
end $$;

-- a question's spread: [n for option 0, n for option 1, ...] up to its highest option answered
create or replace function public.mcq_picks(p_qid text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(coalesce(p.n, 0) order by g.c), '[]'::jsonb)
  from generate_series(0, coalesce((select max(choice) from public.mcq_picks where qid = p_qid), -1)) as g(c)
  left join public.mcq_picks p on p.qid = p_qid and p.choice = g.c
$$;

grant execute on function public.mcq_pick(text, int) to anon, authenticated;
grant execute on function public.mcq_picks(text) to anon, authenticated;

notify pgrst, 'reload schema';

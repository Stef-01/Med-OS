-- 0010_mcq_reports.sql: a student reports a problem with a bank question (founder 2026-10-26: the custom MCQ system
-- improved recursively; research #15: a report button keeps a large AI-written bank honest). Run after 0001. Idempotent.
--
-- One row per report, the question's id, a reason from a fixed list and an optional note; closed to the public key (RLS
-- on, no policy): the app adds a report through mcq_report, and whoever maintains the pool reads the table with the
-- service key (node scripts or the dashboard). Only bank ids (a student's own question, u-..., is theirs to fix).

create table if not exists public.mcq_reports (
  id     bigint generated always as identity primary key,
  qid    text        not null check (qid ~ '^[A-Za-z0-9._-]{3,80}$' and qid !~ '^u-'),
  reason text        not null check (reason in ('key', 'outdated', 'unclear', 'typo', 'other')),
  note   text        not null default '' check (char_length(note) <= 300),
  at     timestamptz not null default now()
);
create index if not exists mcq_reports_qid on public.mcq_reports (qid);
alter table public.mcq_reports enable row level security;

create or replace function public.mcq_report(p_qid text, p_reason text, p_note text default '') returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(p_qid, '') !~ '^[A-Za-z0-9._-]{3,80}$' or p_qid ~ '^u-' or coalesce(p_reason, '') not in ('key', 'outdated', 'unclear', 'typo', 'other') then return false; end if;
  /* at most 50 reports a question a day: a stuck button cannot flood the table */
  if (select count(*) from public.mcq_reports where qid = p_qid and at > now() - interval '1 day') >= 50 then return false; end if;
  insert into public.mcq_reports (qid, reason, note) values (p_qid, p_reason, left(regexp_replace(coalesce(p_note, ''), '<[^>]*>', '', 'g'), 300));
  return true;
end $$;
grant execute on function public.mcq_report(text, text, text) to anon, authenticated;
notify pgrst, 'reload schema';

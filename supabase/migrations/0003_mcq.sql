-- Submit a question (public/js/osce/mcq-view.mjs): students' MCQs for the standard pool. Optional: only needed when
-- config.js names a Supabase project. Run once in the project's SQL editor, after 0001 (and 0002 for the duel).
--
-- The app inserts one row per question; the pool's pipeline reads them (node scripts/mcq-submissions.mjs), and a
-- question's status comes back in public/mcq/status.json at the next pool build, so nothing here is ever updated.
-- The anon key can read and insert, never update or delete: a submitted question stays as it was submitted.

create table if not exists public.mcq_submissions (
  id           text        primary key check (id ~ '^u-[a-z0-9]{6,24}$'),
  item         jsonb       not null,
  submitted_by text        not null default '' check (char_length(submitted_by) <= 80),
  created_at   timestamptz not null default now(),
  -- the row is the question it names, kind "user", and small enough to be one question
  constraint mcq_submissions_item_id   check (item->>'id' = id),
  constraint mcq_submissions_item_kind check (item->'provenance'->>'kind' = 'user'),
  constraint mcq_submissions_item_size check (pg_column_size(item) <= 32768)
);

create index if not exists mcq_submissions_created on public.mcq_submissions (created_at);

alter table public.mcq_submissions enable row level security;

drop policy if exists mcq_submissions_select on public.mcq_submissions;
drop policy if exists mcq_submissions_insert on public.mcq_submissions;
create policy mcq_submissions_select on public.mcq_submissions for select to anon using (true);
create policy mcq_submissions_insert on public.mcq_submissions for insert to anon with check (true);
-- no update and no delete policy: RLS refuses both

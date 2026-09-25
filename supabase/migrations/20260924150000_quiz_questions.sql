-- Quiz questions live in the database instead of static config files.
-- Apply in Supabase: SQL Editor → New query → paste → Run
-- (Or: supabase db push, if you use the CLI against this project.)
-- Safe to re-run.

begin;

create table if not exists public.quiz_questions (
  id            uuid primary key default gen_random_uuid(),
  -- Which quiz the question belongs to, e.g. 'bohr_models'.
  quiz_key      text not null check (quiz_key ~ '^[a-z0-9_]+$'),
  -- Stable identifier within a quiz (the ids the static config used).
  question_key  text not null check (length(btrim(question_key)) > 0),
  question      text not null check (length(btrim(question)) > 0),
  -- JSON array of answer choice strings, in display order.
  options       jsonb not null,
  correct_index integer not null,
  order_index   integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),

  constraint quiz_questions_quiz_question_key
    unique (quiz_key, question_key),
  constraint quiz_questions_options_is_array
    check (
      case
        when jsonb_typeof(options) = 'array'
          then jsonb_array_length(options) >= 2
        else false
      end
    ),
  constraint quiz_questions_correct_index_in_range
    check (
      case
        when jsonb_typeof(options) = 'array'
          then correct_index >= 0 and correct_index < jsonb_array_length(options)
        else false
      end
    )
);

-- Questions are maintained only through privileged server/admin operations.
-- Teachers and students both use Supabase Auth and may read active questions,
-- while anonymous and authenticated client sessions receive no write access.
alter table public.quiz_questions enable row level security;

revoke all privileges on table public.quiz_questions from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.quiz_questions
  from authenticated;

grant select
  on table public.quiz_questions
  to authenticated;

drop policy if exists "chemclicks_quiz_questions_select_active"
  on public.quiz_questions;

create policy "chemclicks_quiz_questions_select_active"
  on public.quiz_questions
  for select
  to authenticated
  using (is_active);

comment on policy "chemclicks_quiz_questions_select_active"
  on public.quiz_questions is
  'Authenticated teachers and students may read active quiz questions. Question writes require a privileged server/admin client.';

commit;

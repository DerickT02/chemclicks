-- Lewis quiz questions are only served after a server-side class assignment
-- check, so client sessions may no longer read them directly. The combined
-- lewis_bonding pool is retired in favor of lewis_covalent and lewis_ionic.
-- Apply in Supabase: SQL Editor → New query → paste → Run
-- (Or: supabase db push, if you use the CLI against this project.)
-- Safe to re-run.

begin;

update public.quiz_questions
set is_active = false
where quiz_key = 'lewis_bonding';

drop policy if exists "chemclicks_quiz_questions_select_active"
  on public.quiz_questions;

create policy "chemclicks_quiz_questions_select_active"
  on public.quiz_questions
  for select
  to authenticated
  using (is_active and quiz_key not in ('lewis_bonding', 'lewis_covalent', 'lewis_ionic'));

comment on policy "chemclicks_quiz_questions_select_active"
  on public.quiz_questions is
  'Authenticated users may read active quiz questions except assignment-gated Lewis quizzes, which are loaded by the server after an assignment check. Question writes require a privileged server/admin client.';

commit;

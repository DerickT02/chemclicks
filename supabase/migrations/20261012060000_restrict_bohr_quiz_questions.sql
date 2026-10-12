-- The Bohr quiz is graded on the server and counts toward lesson progress, but
-- its rows were still readable by any signed-in session, so a student could
-- read correct_index straight from the browser. The Bohr page now loads the
-- questions with the server's admin client after its assignment check, the same
-- way the Lewis quizzes do, so client sessions no longer need to read them.
--
-- Apply only after the app version that loads Bohr questions on the server is
-- deployed; an older version reads them with the student's session and would
-- show an empty quiz.
-- Safe to re-run.

begin;

drop policy if exists "chemclicks_quiz_questions_select_active"
  on public.quiz_questions;

create policy "chemclicks_quiz_questions_select_active"
  on public.quiz_questions
  for select
  to authenticated
  using (is_active and quiz_key not in ('bohr_models', 'lewis_bonding', 'lewis_covalent', 'lewis_ionic'));

comment on policy "chemclicks_quiz_questions_select_active"
  on public.quiz_questions is
  'Authenticated users may read active quiz questions except the assignment-gated Bohr and Lewis quizzes, which are loaded by the server after an assignment check. Question writes require a privileged server/admin client.';

commit;

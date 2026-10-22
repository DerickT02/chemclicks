-- Add optional diagram metadata for quiz questions.
-- Existing questions remain text-only because diagram_key is nullable.
-- Safe to re-run.

begin;

alter table public.quiz_questions
  add column if not exists diagram_key text;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'quiz_questions_diagram_key_format'
       and conrelid = 'public.quiz_questions'::regclass
  ) then
    alter table public.quiz_questions
      add constraint quiz_questions_diagram_key_format
      check (diagram_key is null or diagram_key ~ '^[a-z0-9]+$');
  end if;
end;
$$;

comment on column public.quiz_questions.diagram_key is
  'Optional covalent compound id used to render a live question diagram; null means text-only.';

commit;

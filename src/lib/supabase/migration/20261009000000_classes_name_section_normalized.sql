-- Classes: a teacher may not have two classes whose name/section pair matches
-- after trimming, collapsing inner whitespace, and lowercasing. Complements the
-- exact-match classes_teacher_name_section_key constraint, and is the
-- authoritative check when two create requests race past the server pre-check.
--
-- Apply in Supabase: SQL Editor → New query → paste → Run.
--
-- Index creation fails if existing rows already conflict. Run this read-only
-- query first; it must return zero rows:
--
--   select teacher_id,
--          lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))    as name_key,
--          lower(regexp_replace(btrim(section), '\s+', ' ', 'g')) as section_key,
--          count(*) as rows,
--          array_agg(id) as class_ids
--   from public.classes
--   group by 1, 2, 3
--   having count(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS classes_teacher_name_section_norm_key
  ON public.classes (
    teacher_id,
    lower(regexp_replace(btrim(name), '\s+', ' ', 'g')),
    lower(regexp_replace(btrim(section), '\s+', ' ', 'g'))
  );

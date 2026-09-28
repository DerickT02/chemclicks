-- Seed the teacher activity catalog for local/testing use.
-- Safe to re-run: skips rows whose type already exists.
-- Apply in Supabase: SQL Editor → New query → paste → Run
-- (Or: supabase db push, if you use the CLI against this project.)

begin;

insert into public.activities (id, title, type, order_index)
select gen_random_uuid(), v.title, v.type::public.activity_type, v.order_index
from (
  values
    ('Bohr Models Introduction', 'bohr_model_intro', 1),
    ('Bohr Model Stability', 'bohr_model_stability', 2),
    ('Lewis Dot Diagram', 'lewis_diagram', 3),
    ('Lewis Structures — Covalent', 'lewis_structures_covalent', 4),
    ('Lewis Structures — Ionic', 'lewis_structures_ionic', 5),
    ('Ruler — Tenths', 'measurement_ruler_tenths', 6),
    ('Ruler — Hundredths', 'measurement_ruler_hundredths', 7),
    ('Graduated Cylinder', 'measurement_graduated_cylinder', 8)
) as v(title, type, order_index)
where not exists (
  select 1 from public.activities a where a.type = v.type::public.activity_type
);

commit;

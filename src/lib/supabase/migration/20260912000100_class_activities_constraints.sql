begin;

-- Add scheduling columns if absent.
-- Existing columns must already be timestamptz; verify before applying.
alter table public.class_activities
  add column if not exists opens_at timestamptz,
  add column if not exists closes_at timestamptz;

alter table public.class_activities
  alter column class_id set not null,
  alter column activity_id set not null,
  alter column opens_at drop not null,
  alter column closes_at drop not null,
  alter column opens_at set default null,
  alter column closes_at set default null;

alter table public.class_activities
  add constraint class_activities_class_activity_key
    unique (class_id, activity_id),
  add constraint class_activities_date_window_check
    check (
      opens_at is null
      or closes_at is null
      or opens_at < closes_at
    );

comment on column public.class_activities.opens_at is
  'Inclusive opening instant. NULL means no opening restriction.';

comment on column public.class_activities.closes_at is
  'Exclusive closing instant. NULL means no closing restriction.';

commit;

begin;

alter table public.class_activities enable row level security;

-- Students currently use a custom application session.
-- Do not expose assignments directly to anonymous clients.
revoke all privileges on table public.class_activities from anon;

grant select, insert, update
  on table public.class_activities
  to authenticated;

drop policy if exists "chemclicks_class_activities_select_own"
  on public.class_activities;

drop policy if exists "chemclicks_class_activities_insert_own"
  on public.class_activities;

drop policy if exists "chemclicks_class_activities_update_own"
  on public.class_activities;

create policy "chemclicks_class_activities_select_own"
  on public.class_activities
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.classes c
      where c.id = class_activities.class_id
        and c.teacher_id = (select auth.uid())
    )
  );

create policy "chemclicks_class_activities_insert_own"
  on public.class_activities
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.classes c
      where c.id = class_activities.class_id
        and c.teacher_id = (select auth.uid())
    )
  );

create policy "chemclicks_class_activities_update_own"
  on public.class_activities
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.classes c
      where c.id = class_activities.class_id
        and c.teacher_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.classes c
      where c.id = class_activities.class_id
        and c.teacher_id = (select auth.uid())
    )
  );

commit;

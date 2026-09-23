begin;

-- The catalog is maintained only through privileged server/admin operations.
-- Teachers and students both use Supabase Auth and may read catalog metadata,
-- while anonymous and authenticated client sessions receive no write access.
alter table public.activities enable row level security;

revoke all privileges on table public.activities from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.activities
  from authenticated;

grant select
  on table public.activities
  to authenticated;

drop policy if exists "chemclicks_activities_select_catalog"
  on public.activities;

create policy "chemclicks_activities_select_catalog"
  on public.activities
  for select
  to authenticated
  using (true);

comment on policy "chemclicks_activities_select_catalog"
  on public.activities is
  'Authenticated teachers and students may read the activity catalog. Catalog writes require a privileged server/admin client.';

commit;

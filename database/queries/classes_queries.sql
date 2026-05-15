-- classes table
create table public.classes (
  id         uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  name       text not null,
  section    text not null,
  class_code text not null unique
             check (class_code ~ '^[A-Za-z0-9]{6}$'),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),

  constraint classes_teacher_name_section_key
    unique (teacher_id, name, section)
);

-- generate_class_code(): 6-char uppercase alphanumeric, guaranteed unique
create or replace function public.generate_class_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  code  text;
  i     int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.classes where class_code = code);
  end loop;
  return code;
end;
$$;
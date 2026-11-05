-- Table to store roles assigned to staff members independently of portal access logins.
create table if not exists public.staff_roles (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (staff_id, role_id)
);

alter table public.staff_roles enable row level security;

-- School isolation policy
create policy "staff_roles_school_isolation" on public.staff_roles
  for all using (school_id = auth_school_id());

create index if not exists staff_roles_staff_id_idx on public.staff_roles (staff_id);
create index if not exists staff_roles_school_id_idx on public.staff_roles (school_id);


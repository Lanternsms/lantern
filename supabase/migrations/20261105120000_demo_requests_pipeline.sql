-- Turn demo requests into a small sales pipeline managed from Platform Admin.
alter table public.demo_requests drop constraint if exists demo_requests_status_check;
update public.demo_requests set status = 'scheduled' where status = 'booked';
update public.demo_requests set status = 'lost' where status = 'closed';
alter table public.demo_requests
  add constraint demo_requests_status_check
  check (status in ('new', 'contacted', 'scheduled', 'demo_done', 'won', 'lost'));

alter table public.demo_requests
  add column if not exists demo_at timestamptz,
  add column if not exists admin_notes text,
  add column if not exists lost_reason text,
  add column if not exists contacted_at timestamptz,
  add column if not exists onboarded_school_id uuid references public.schools(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists demo_requests_status_idx on public.demo_requests (status);
create index if not exists demo_requests_demo_at_idx on public.demo_requests (demo_at);

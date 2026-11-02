-- Demo requests from the website's "Book a demo" form.
-- Written only by the server (service role); RLS on with no policies keeps it private.
create table if not exists public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  school text not null,
  role text not null,
  phone text not null,
  email text,
  students text,
  preferred_time text,
  notes text,
  status text not null default 'new' check (status in ('new', 'contacted', 'booked', 'closed'))
);

alter table public.demo_requests enable row level security;

create index if not exists demo_requests_created_at_idx on public.demo_requests (created_at desc);

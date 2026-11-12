drop function if exists public.attendance_class_summary(date, date, int);
drop function if exists public.attendance_class_summary(date, date);
drop function if exists public.attendance_school_daily(date, date);

create function public.attendance_class_summary(p_from date, p_to date, p_recent int default 12)
returns table(class_id uuid, marked bigint, present bigint, recent jsonb)
language sql stable security invoker
set search_path = public
as $$
  with daily as (
    select a.class_id, a.date,
           count(*) as marked,
           count(*) filter (where s.counts_as_present) as present
    from attendance a
    join attendance_statuses s on s.id = a.status_id
    where a.school_id = auth_school_id()
      and a.subject_id is null
      and a.date between p_from and p_to
    group by a.class_id, a.date
  ),
  ranked as (
    select class_id, date, marked, present,
           row_number() over (partition by class_id order by date desc) as rn
    from daily
  ),
  recent_slice as (
    select class_id, date, marked, present
    from ranked
    where rn <= p_recent
    order by class_id, date asc
  ),
  recent_agg as (
    select class_id,
           jsonb_agg(jsonb_build_object('d', date, 'm', marked, 'p', present) order by date asc) as recent
    from recent_slice
    group by class_id
  ),
  totals as (
    select class_id,
           sum(marked)::bigint as marked,
           sum(present)::bigint as present
    from daily
    group by class_id
  )
  select t.class_id, t.marked, t.present, coalesce(r.recent, '[]'::jsonb) as recent
  from totals t
  left join recent_agg r on r.class_id = t.class_id
$$;

revoke execute on function public.attendance_class_summary(date, date, int) from public, anon;
grant execute on function public.attendance_class_summary(date, date, int) to authenticated;

create function public.attendance_school_daily(p_from date, p_to date)
returns table(day date, marked bigint, present bigint)
language sql stable security invoker
set search_path = public
as $$
  select a.date as day,
         count(*)::bigint as marked,
         count(*) filter (where s.counts_as_present)::bigint as present
  from attendance a
  join attendance_statuses s on s.id = a.status_id
  where a.school_id = auth_school_id()
    and a.subject_id is null
    and a.date between p_from and p_to
  group by a.date
  order by a.date asc
$$;

revoke execute on function public.attendance_school_daily(date, date) from public, anon;
grant execute on function public.attendance_school_daily(date, date) to authenticated;


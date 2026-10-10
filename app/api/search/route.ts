import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Query = Awaited<ReturnType<ReturnType<typeof createClient>['from']>>

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (raw.length < 2) {
    return NextResponse.json({ students: [], staff: [], guardians: [], classes: [] })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found.' }, { status: 404 })
  }

  const schoolId = profile.school_id

  // Commas and parentheses are syntax-significant in PostgREST's .or() filter
  // string, so strip them before splitting into words. Cap at 5 words so a
  // pasted paragraph can't blow up the query into dozens of chained filters.
  const words = raw
    .replace(/[,()]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)

  // Each word must match SOME column (OR across columns), and every word
  // must match (AND across words) — chaining .or() calls ANDs them together,
  // so "John Doe" now requires both words to show up somewhere, in any order,
  // across any of the name/identifier columns.
  function matchAllWords(
    query: Query,
    columns: string[]
  ): Query {
    let q = query
    for (const word of words) {
      const term = `%${word}%`
      const condition = columns.map((col) => `${col}.ilike.${term}`).join(',')
      q = q.or(condition)
    }
    return q
  }

  const [students, staff, guardians, classes] = await Promise.all([
    matchAllWords(
      supabase
        .from('students')
        .select('id, first_name, last_name, middle_name, admission_no, status')
        .eq('school_id', schoolId),
      ['first_name', 'last_name', 'middle_name', 'admission_no']
    ).limit(5),
    matchAllWords(
      supabase
        .from('staff')
        .select('id, first_name, last_name, staff_no, email, status')
        .eq('school_id', schoolId),
      ['first_name', 'last_name', 'staff_no', 'email']
    ).limit(5),
    matchAllWords(
      supabase
        .from('guardians')
        .select('id, first_name, last_name, phone, email, relationship')
        .eq('school_id', schoolId),
      ['first_name', 'last_name', 'phone', 'email']
    ).limit(5),
    matchAllWords(
      supabase.from('classes').select('id, name, level').eq('school_id', schoolId),
      ['name']
    ).limit(5),
  ])

  return NextResponse.json({
    students: (students.data ?? []).map((s) => ({
      id: s.id,
      title: [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' '),
      subtitle: [s.admission_no, s.status].filter(Boolean).join(' · '),
      href: `/dashboard/students/${s.id}`,
    })),
    staff: (staff.data ?? []).map((s) => ({
      id: s.id,
      title: [s.first_name, s.last_name].filter(Boolean).join(' '),
      subtitle: [s.staff_no, s.email].filter(Boolean).join(' · '),
      href: `/dashboard/staff/${s.id}`,
    })),
    guardians: (guardians.data ?? []).map((g) => ({
      id: g.id,
      title: [g.first_name, g.last_name].filter(Boolean).join(' '),
      subtitle: [g.relationship, g.phone].filter(Boolean).join(' · '),
      href: `/dashboard/guardians/${g.id}`,
    })),
    classes: (classes.data ?? []).map((c) => ({
      id: c.id,
      title: c.name,
      subtitle: c.level != null ? `Level ${c.level}` : undefined,
      href: `/dashboard/academics/classes/${c.id}`,
    })),
  })
}
import { createClient } from '@/lib/supabase/server'
import PeriodsManager from './periods-manager'
import TimetableGridEditor from './timetable-grid-editor'

export const dynamic = 'force-dynamic'

export default async function TimetablePage({
    searchParams,
}: {
    searchParams: Promise<{ classId?: string; armId?: string }>
}) {
    const { classId, armId } = await searchParams
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', user.id)
        .single()

    const { data: session } = await supabase
        .from('academic_sessions')
        .select('id, name')
        .eq('school_id', profile!.school_id)
        .eq('is_current', true)
        .single()

    const { data: periods } = await supabase
        .from('timetable_periods')
        .select('*')
        .order('sort_order')

    const { data: classes } = await supabase
        .from('classes')
        .select('id, name, level, arms(id, name)')
        .order('level')

    const { data: subjects } = await supabase
        .from('subjects')
        .select('id, name')
        .order('name')

    const { data: teachers } = await supabase
        .from('staff')
        .select('profile_id, profiles(first_name, last_name)')
        .eq('status', 'active')

    let entries: any[] = []
    if (session && classId) {
        let query = supabase
            .from('timetable_entries')
            .select('*')
            .eq('session_id', session.id)
            .eq('class_id', classId)
        if (armId) {
            query = query.eq('arm_id', armId)
        } else {
            query = query.is('arm_id', null)
        }
        const { data } = await query
        entries = data ?? []
    }

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-xl font-semibold text-text-primary">Timetable</h1>
                <p className="text-sm text-text-secondary">
                    {session ? `Academic session: ${session.name}` : 'No current academic session set.'}
                </p>
            </div>

            <PeriodsManager periods={periods ?? []} />

            {session && (
                <TimetableGridEditor
                    sessionId={session.id}
                    periods={(periods ?? []).filter((p) => !p.is_break).length > 0 ? periods ?? [] : []}
                    classes={classes ?? []}
                    subjects={subjects ?? []}
                    teachers={(teachers ?? []).map((t: any) => ({
                        id: t.profile_id,
                        name: `${t.profiles?.first_name ?? ''} ${t.profiles?.last_name ?? ''}`.trim(),
                    }))}
                    selectedClassId={classId ?? ''}
                    selectedArmId={armId ?? null}
                    entries={entries}
                />
            )}
        </div>
    )
}
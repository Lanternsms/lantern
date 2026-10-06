'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function savePeriod(formData: FormData) {
    const supabase = await createClient()
    const id = formData.get('id') as string | null
    const name = formData.get('name') as string
    const start_time = formData.get('start_time') as string
    const end_time = formData.get('end_time') as string
    const is_break = formData.get('is_break') === 'on'
    const sort_order = Number(formData.get('sort_order'))

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', user.id)
        .single()
    if (!profile) return { error: 'Profile not found' }

    if (id) {
        const { error } = await supabase
            .from('timetable_periods')
            .update({ name, start_time, end_time, is_break, sort_order })
            .eq('id', id)
        if (error) return { error: error.message }
    } else {
        const { error } = await supabase
            .from('timetable_periods')
            .insert({ school_id: profile.school_id, name, start_time, end_time, is_break, sort_order })
        if (error) return { error: error.message }
    }

    revalidatePath('/dashboard/academics/timetable')
    return { success: true }
}

export async function deletePeriod(periodId: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('timetable_periods').delete().eq('id', periodId)
    if (error) return { error: error.message }
    revalidatePath('/dashboard/academics/timetable')
    return { success: true }
}

export async function saveTimetableEntry(params: {
    sessionId: string
    classId: string
    armId: string | null
    dayOfWeek: number
    periodId: string
    subjectId: string
    teacherId: string | null
    force?: boolean
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', user.id)
        .single()
    if (!profile) return { error: 'Profile not found' }

    // Check for teacher double-booking BEFORE writing, unless the caller forced through.
    if (!params.force && params.teacherId) {
        const { data: sameSlot } = await supabase
            .from('timetable_entries')
            .select('class_id, arm_id, classes(name), arms(name)')
            .eq('session_id', params.sessionId)
            .eq('day_of_week', params.dayOfWeek)
            .eq('period_id', params.periodId)
            .eq('teacher_id', params.teacherId)

        const elsewhere = (sameSlot || []).filter(
            (e: any) => !(e.class_id === params.classId && e.arm_id === (params.armId ?? null))
        )
        if (elsewhere.length > 0) {
            const names = elsewhere
                .map((e: any) => `${e.classes?.name ?? ''} ${e.arms?.name ?? ''}`.trim())
                .join(', ')
            // Return a conflict signal — nothing has been saved yet.
            return { conflict: `This teacher is already assigned to ${names} during the same day and period.` }
        }
    }

    // Manual upsert: onConflict with NULL arm_id doesn't work in PostgreSQL
    // because NULL != NULL breaks unique index matching. We do update → insert instead.
    let updateQuery = supabase
        .from('timetable_entries')
        .update({
            subject_id: params.subjectId,
            teacher_id: params.teacherId,
            updated_at: new Date().toISOString(),
        })
        .eq('session_id', params.sessionId)
        .eq('class_id', params.classId)
        .eq('day_of_week', params.dayOfWeek)
        .eq('period_id', params.periodId)

    if (params.armId) {
        updateQuery = updateQuery.eq('arm_id', params.armId)
    } else {
        updateQuery = updateQuery.is('arm_id', null)
    }

    const { data: updated, error: updateError } = await updateQuery.select('id')
    if (updateError) return { error: updateError.message }

    // If no row was updated, it doesn't exist yet — insert it
    if (!updated || updated.length === 0) {
        const { error: insertError } = await supabase
            .from('timetable_entries')
            .insert({
                school_id: profile.school_id,
                session_id: params.sessionId,
                class_id: params.classId,
                arm_id: params.armId,
                day_of_week: params.dayOfWeek,
                period_id: params.periodId,
                subject_id: params.subjectId,
                teacher_id: params.teacherId,
                updated_at: new Date().toISOString(),
            })
        if (insertError) return { error: insertError.message }
    }

    revalidatePath('/dashboard/academics/timetable')
    return { success: true }
}

export async function deleteTimetableEntry(entryId: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('timetable_entries').delete().eq('id', entryId)
    if (error) return { error: error.message }
    revalidatePath('/dashboard/academics/timetable')
    return { success: true }
}
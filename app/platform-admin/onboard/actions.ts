'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { hasValidPlatformAdminSession } from '@/lib/platform-admin/auth'

function slugify(input: string) {
    return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export async function createSchool(formData: FormData) {
    if (!(await hasValidPlatformAdminSession())) {
        return { error: 'Not authorized.' }
    }

    const schoolName = String(formData.get('schoolName') || '').trim()
    const slugInput = String(formData.get('slug') || '').trim()
    const adminFirstName = String(formData.get('adminFirstName') || '').trim()
    const adminLastName = String(formData.get('adminLastName') || '').trim()
    const adminEmail = String(formData.get('adminEmail') || '').trim().toLowerCase()
    const sessionName = String(formData.get('sessionName') || '').trim()
    const sessionStart = String(formData.get('sessionStart') || '')
    const sessionEnd = String(formData.get('sessionEnd') || '')
    const termName = String(formData.get('termName') || '').trim() || 'First Term'
    const termStart = String(formData.get('termStart') || '') || sessionStart
    const termEnd = String(formData.get('termEnd') || '') || sessionEnd

    if (!schoolName || !adminFirstName || !adminLastName || !adminEmail || !sessionName || !sessionStart || !sessionEnd) {
        return { error: 'Please fill in all required fields.' }
    }

    const slug = slugify(slugInput || schoolName)
    if (!slug) {
        return { error: 'Could not derive a valid slug — enter one manually.' }
    }

    const admin = createAdminClient()

    const { data: school, error: schoolError } = await admin
        .from('schools')
        .insert({ name: schoolName, slug })
        .select('id, slug')
        .single()

    if (schoolError || !school) {
        return { error: `Couldn't create school: ${schoolError?.message ?? 'unknown error'} (slug may already be taken)` }
    }

    async function rollback(createdUserId?: string) {
        await admin.from('schools').delete().eq('id', school!.id)
        if (createdUserId) await admin.auth.admin.deleteUser(createdUserId)
    }

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(adminEmail, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/accept-invite`,
    })
    if (inviteError || !invited?.user) {
        await rollback()
        return { error: `Couldn't invite admin: ${inviteError?.message ?? 'unknown error'}` }
    }
    const newUserId = invited.user.id

    const { error: profileError } = await admin.from('profiles').insert({
        id: newUserId,
        school_id: school.id,
        first_name: adminFirstName,
        last_name: adminLastName,
    })
    if (profileError) {
        await rollback(newUserId)
        return { error: `Couldn't create profile: ${profileError.message}` }
    }

    const { data: adminRole, error: roleError } = await admin
        .from('roles')
        .select('id')
        .is('school_id', null)
        .eq('name', 'admin')
        .single()
    if (roleError || !adminRole) {
        await rollback(newUserId)
        return { error: `Couldn't find the system admin role: ${roleError?.message ?? 'not found — check the roles table'}` }
    }

    const { error: userRoleError } = await admin.from('user_roles').insert({
        user_id: newUserId,
        role_id: adminRole.id,
        school_id: school.id,
    })
    if (userRoleError) {
        await rollback(newUserId)
        return { error: `Couldn't assign admin role: ${userRoleError.message}` }
    }

    const { data: session, error: sessionErr } = await admin
        .from('academic_sessions')
        .insert({ school_id: school.id, name: sessionName, start_date: sessionStart, end_date: sessionEnd, is_current: true })
        .select('id')
        .single()
    if (sessionErr || !session) {
        await rollback(newUserId)
        return { error: `Couldn't create academic session: ${sessionErr?.message ?? 'unknown error'}` }
    }

    const { error: termErr } = await admin.from('terms').insert({
        session_id: session.id,
        school_id: school.id,
        name: termName,
        start_date: termStart,
        end_date: termEnd,
        is_current: true,
    })
    if (termErr) {
        await rollback(newUserId)
        return { error: `Couldn't create term: ${termErr.message}` }
    }

    const { error: statusErr } = await admin.from('attendance_statuses').insert([
        { school_id: school.id, code: 'present', label: 'Present', counts_as_present: true },
        { school_id: school.id, code: 'absent', label: 'Absent', counts_as_present: false },
        { school_id: school.id, code: 'late', label: 'Late', counts_as_present: true },
        { school_id: school.id, code: 'excused', label: 'Excused', counts_as_present: false },
    ])
    if (statusErr) {
        await rollback(newUserId)
        return { error: `Couldn't seed attendance categories: ${statusErr.message}` }
    }

    return { success: true, schoolId: school.id, slug: school.slug, adminEmail }
}
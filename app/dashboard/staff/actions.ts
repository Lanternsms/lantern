/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { logSchoolAction } from '@/lib/audit/log-school-actions'

async function getSchoolId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
  if (!profile) redirect('/login')
  return profile.school_id
}

async function saveCustomFields(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolId: string,
  staffId: string,
  formData: FormData
) {
  const { data: definitions } = await supabase
    .from('custom_field_definitions')
    .select('id, field_key, field_type')
    .eq('entity_type', 'staff')

  if (!definitions || definitions.length === 0) return

  for (const def of definitions) {
    const raw = formData.get(`custom_${def.field_key}`)
    if (raw === null) continue
    const value = (def.field_type === 'boolean' ? raw === 'true' : raw) as any

    await supabase.from('custom_field_values').upsert(
      { school_id: schoolId, definition_id: def.id, entity_id: staffId, value },
      { onConflict: 'definition_id,entity_id' }
    )
  }
}

async function ensureStaffProfile(
  admin: ReturnType<typeof createAdminClient>,
  schoolId: string,
  staff: {
    id?: string
    profile_id?: string | null
    first_name: string
    last_name: string
    phone?: string | null
    email?: string | null
  }
): Promise<string> {
  if (staff.profile_id) return staff.profile_id

  let profileId: string | null = null

  // 1. If staff has an email, check if an existing profile or auth user exists
  if (staff.email) {
    const { data: existingUsers } = await admin.auth.admin.listUsers()
    const match = existingUsers?.users?.find((u) => u.email?.toLowerCase() === staff.email?.toLowerCase())
    if (match) {
      profileId = match.id
      await admin.from('profiles').upsert({
        id: profileId,
        school_id: schoolId,
        first_name: staff.first_name,
        last_name: staff.last_name,
        phone: staff.phone || null,
      })
    }
  }

  // 2. Try inserting directly into profiles with a generated UUID (no email invite sent)
  if (!profileId) {
    const candidateId = crypto.randomUUID()
    const { error: profileError } = await admin.from('profiles').insert({
      id: candidateId,
      school_id: schoolId,
      first_name: staff.first_name,
      last_name: staff.last_name,
      phone: staff.phone || null,
    })

    if (!profileError) {
      profileId = candidateId
    } else {
      // If direct profile insertion failed due to foreign key, create silent auth user
      const silentEmail = staff.email || `staff_${candidateId}@lantern.internal`
      const { data: newUser } = await admin.auth.admin.createUser({
        email: silentEmail,
        email_confirm: true,
        user_metadata: { first_name: staff.first_name, last_name: staff.last_name },
      })
      if (newUser?.user) {
        profileId = newUser.user.id
        await admin.from('profiles').upsert({
          id: profileId,
          school_id: schoolId,
          first_name: staff.first_name,
          last_name: staff.last_name,
          phone: staff.phone || null,
        })
      } else {
        throw new Error(profileError.message)
      }
    }
  }

  if (staff.id) {
    await admin.from('staff').update({ profile_id: profileId }).eq('id', staff.id)
  }

  return profileId
}

export async function createStaff(formData: FormData) {
  const supabase = await createClient()
  const schoolId = await getSchoolId(supabase)

  const email = (formData.get('email') as string)?.trim() || null
  const rawRoleIds = formData.getAll('role_ids').map((v) => String(v).trim()).filter(Boolean)
  const singleRoleId = (formData.get('role_id') as string)?.trim() || null
  const roleIds = Array.from(new Set([...rawRoleIds, ...(singleRoleId ? [singleRoleId] : [])]))
  const firstName = (formData.get('first_name') as string)?.trim()
  const lastName = (formData.get('last_name') as string)?.trim()
  const staffNo = (formData.get('staff_no') as string)?.trim()

  let profileId: string | null = null

  if (roleIds.length > 0) {
    const admin = createAdminClient()
    try {
      profileId = await ensureStaffProfile(admin, schoolId, {
        first_name: firstName,
        last_name: lastName,
        phone: (formData.get('phone') as string) || null,
        email,
      })
      for (const rId of roleIds) {
        await admin.from('user_roles').insert({
          user_id: profileId,
          role_id: rId,
          school_id: schoolId,
        })
      }
    } catch (e: any) {
      console.error('[createStaff] Failed to assign roles:', e)
    }
  }

  const { data: staff, error } = await supabase
    .from('staff')
    .insert({
      school_id: schoolId,
      profile_id: profileId,
      staff_no: staffNo,
      first_name: firstName,
      last_name: lastName,
      email: email,
      phone: (formData.get('phone') as string) || null,
      department_id: (formData.get('department_id') as string) || null,
      qualification: (formData.get('qualification') as string) || null,
      employment_date: (formData.get('employment_date') as string) || null,
      status: 'active',
    })
    .select('id')
    .single()

  if (error || !staff) {
    redirect(`/dashboard/staff/new?error=${encodeURIComponent(error?.message ?? 'Failed to create staff record')}`)
  }

  await saveCustomFields(supabase, schoolId, staff.id, formData)

  await logSchoolAction('staff_created', {
    metadata: {
      staffId: staff.id,
      staffNo,
      name: `${firstName} ${lastName}`.trim(),
      roleIds: roleIds.length > 0 ? roleIds : undefined,
      profileId: profileId || undefined,
    },
  })

  revalidatePath('/dashboard/staff')
  redirect(`/dashboard/staff/${staff.id}`)
}

export async function updateStaff(staffId: string, formData: FormData) {
  const supabase = await createClient()
  const schoolId = await getSchoolId(supabase)

  const { data: currentStaff } = await supabase
    .from('staff')
    .select('id, profile_id, school_id')
    .eq('id', staffId)
    .single()

  const email = (formData.get('email') as string)?.trim() || null
  const hasRolesField = formData.has('role_ids_present')
  const rawRoleIds = formData.getAll('role_ids').map((v) => String(v).trim()).filter(Boolean)
  const singleRoleId = (formData.get('role_id') as string)?.trim() || null
  const roleIds = Array.from(new Set([...rawRoleIds, ...(singleRoleId ? [singleRoleId] : [])]))
  const firstName = (formData.get('first_name') as string)?.trim()
  const lastName = (formData.get('last_name') as string)?.trim()

  let profileId = currentStaff?.profile_id ?? null

  if (hasRolesField || roleIds.length > 0) {
    const admin = createAdminClient()
    if (!profileId && roleIds.length > 0) {
      try {
        profileId = await ensureStaffProfile(admin, schoolId, {
          id: staffId,
          first_name: firstName,
          last_name: lastName,
          phone: (formData.get('phone') as string) || null,
          email,
        })
      } catch (e: any) {
        console.error('[updateStaff] Failed to create profile for roles:', e)
      }
    }

    if (profileId) {
      const { data: currentDbRoles } = await admin
        .from('user_roles')
        .select('role_id')
        .eq('user_id', profileId)
        .eq('school_id', schoolId)

      const currentDbSet = new Set((currentDbRoles ?? []).map((r: any) => r.role_id))
      const targetSet = new Set(roleIds)

      for (const rId of roleIds) {
        if (!currentDbSet.has(rId)) {
          await admin.from('user_roles').insert({
            user_id: profileId,
            role_id: rId,
            school_id: schoolId,
          })
        }
      }

      if (hasRolesField) {
        for (const rId of Array.from(currentDbSet)) {
          if (!targetSet.has(rId)) {
            await admin
              .from('user_roles')
              .delete()
              .eq('user_id', profileId)
              .eq('school_id', schoolId)
              .eq('role_id', rId)
          }
        }
      }
    }
  }

  const { error } = await supabase
    .from('staff')
    .update({
      first_name: firstName,
      last_name: lastName,
      email: email,
      phone: (formData.get('phone') as string) || null,
      department_id: (formData.get('department_id') as string) || null,
      qualification: (formData.get('qualification') as string) || null,
      employment_date: (formData.get('employment_date') as string) || null,
      status: formData.get('status') as string,
      profile_id: profileId,
    })
    .eq('id', staffId)

  if (error) {
    redirect(`/dashboard/staff/${staffId}/edit?error=${encodeURIComponent(error.message)}`)
  }

  await saveCustomFields(supabase, schoolId, staffId, formData)

  await logSchoolAction('staff_updated', {
    metadata: {
      staffId,
      name: `${firstName} ${lastName}`.trim(),
      status: formData.get('status'),
      roleIds: roleIds.length > 0 ? roleIds : undefined,
    },
  })

  revalidatePath(`/dashboard/staff/${staffId}`)
  redirect(`/dashboard/staff/${staffId}`)
}

// Invite staff to portal access (separate from role assignment)
export async function inviteStaffPortalAccess(staffId: string, formData: FormData) {
  const supabase = await createClient();
  const schoolId = await getSchoolId(supabase);

  // Fetch basic staff info
  const { data: staff, error: staffErr } = await supabase
    .from('staff')
    .select('first_name, last_name, phone, profile_id')
    .eq('id', staffId)
    .single();
  if (staffErr || !staff) {
    redirect(`/dashboard/staff/${staffId}?error=${encodeURIComponent('Staff not found')}`);
  }

  const email = (formData.get('email') as string)?.trim() ?? null;
  if (!email) {
    redirect(`/dashboard/staff/${staffId}?error=${encodeURIComponent('Email required for invitation')}`);
  }

  // Gather role ids (may be empty)
  const rawRoleIds = formData.getAll('role_ids').map((v) => String(v).trim()).filter(Boolean);
  const singleRoleId = (formData.get('role_id') as string)?.trim() || null;
  const roleIds = Array.from(new Set([...rawRoleIds, ...(singleRoleId ? [singleRoleId] : [])]));

  const admin = createAdminClient();
  let profileId: string | null = staff.profile_id ?? null;

  // Ensure a profile exists – create silent profile if necessary
  if (!profileId) {
    profileId = await ensureStaffProfile(admin, schoolId, {
      id: staffId,
      first_name: staff.first_name,
      last_name: staff.last_name,
      phone: staff.phone,
      email,
    });
  }

  // Assign roles if any
  if (profileId && roleIds.length > 0) {
    for (const rId of roleIds) {
      await admin.from('user_roles').insert({
        user_id: profileId,
        role_id: rId,
        school_id: schoolId,
      });
    }
  }

  // Link staff row to the newly created profile if it was created now
  if (profileId && !staff.profile_id) {
    await supabase.from('staff').update({ profile_id: profileId }).eq('id', staffId);
  }

  await logSchoolAction('staff_invited', {
    metadata: {
      staffId,
      email,
      roleIds: roleIds.length > 0 ? roleIds : undefined,
    },
  });

  revalidatePath(`/dashboard/staff/${staffId}`);
  redirect(`/dashboard/staff/${staffId}`);
}

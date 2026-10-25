import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NotificationSettingsClient, type CategoryPrefState } from './settings-client'
import { getMyPushSubscriptions } from '../actions'
import { resolveRecipientKinds, CATEGORY_POLICY_DEFAULTS } from '@/lib/messaging/policy'
import type { Category } from '@/lib/notifications/types'

export const metadata = {
  title: 'Notification Settings – Lantern',
  description: 'Manage your notification channels and preferences',
}

export default async function NotificationSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()

  if (!profile?.school_id) {
    redirect('/login')
  }

  // 1. Resolve user recipient kinds (guardian, student, staff)
  const kindsMap = await resolveRecipientKinds(supabase, profile.school_id, [user.id])
  const userKinds = kindsMap.get(user.id) || new Set(['staff'])

  // 2. Determine which categories are applicable for this user
  // Guardians: attendance, fees, results, announcements, account, system
  // Students: attendance, learning, results, announcements, account, system, qa
  // Staff: all categories
  const isGuardian = userKinds.has('guardian')
  const isStudent = userKinds.has('student')
  const isStaff = userKinds.has('staff')

  const allCategories: Array<{
    category: Category
    label: string
    description: string
    applicable: boolean
    in_app_locked?: boolean
    email_locked?: boolean
  }> = [
    {
      category: 'account',
      label: 'Account & Security',
      description: 'Role changes, invitations, login activity, and security alerts.',
      applicable: true,
      in_app_locked: true,
      email_locked: true,
    },
    {
      category: 'results',
      label: 'Academic Results',
      description: 'Published report cards, grade approvals, and assessment summaries.',
      applicable: isStaff || isGuardian || isStudent,
    },
    {
      category: 'attendance',
      label: 'Attendance',
      description: 'Daily morning attendance and subject period attendance marks.',
      applicable: isStaff || isGuardian || isStudent,
    },
    {
      category: 'fees',
      label: 'Fees & Payments',
      description: 'Payment receipts, fee schedules, and balance notices.',
      applicable: isStaff || isGuardian,
    },
    {
      category: 'announcements',
      label: 'School Announcements',
      description: 'Official school broadcasts, alerts, and calendar events.',
      applicable: true,
    },
    {
      category: 'learning',
      label: 'Learning & Activities',
      description: 'New lesson content, submitted assignments, and teacher feedback.',
      applicable: isStaff || isStudent,
    },
    {
      category: 'qa',
      label: 'Lesson Questions & Discussions',
      description: 'Questions asked in class lessons and teacher replies.',
      applicable: isStaff || isStudent,
    },
    {
      category: 'system',
      label: 'System & Maintenance',
      description: 'System notices and maintenance advisories.',
      applicable: isStaff,
      in_app_locked: true,
    },
  ]

  const applicableCategories = allCategories.filter((c) => c.applicable)

  // 3. Load user's saved preferences
  const { data: savedPrefs } = await supabase
    .from('notification_preferences')
    .select('category, in_app, email, push')
    .eq('user_id', user.id)

  const prefMap = new Map<string, { in_app: boolean; email: boolean | null; push: boolean | null }>()
  ;(savedPrefs ?? []).forEach((p) => {
    prefMap.set(p.category, {
      in_app: p.in_app,
      email: p.email,
      push: p.push,
    })
  })

  // 4. Load push subscriptions
  const subscriptions = await getMyPushSubscriptions()

  // 5. Build category matrix states
  const categoryMatrix: CategoryPrefState[] = applicableCategories.map((cat) => {
    const saved = prefMap.get(cat.category)
    const policy = CATEGORY_POLICY_DEFAULTS[cat.category] || { push: true, email: true }

    return {
      category: cat.category,
      label: cat.label,
      description: cat.description,
      in_app: saved?.in_app !== undefined ? saved.in_app : true,
      in_app_locked: cat.in_app_locked,
      push: saved?.push !== undefined ? saved.push : null,
      email: cat.email_locked ? true : saved?.email !== undefined ? saved.email : null,
      email_locked: cat.email_locked,
      push_default_label: policy.push ? 'On' : 'Off',
      email_default_label: policy.email ? 'On' : 'Off',
    }
  })

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Notification Settings</h1>
        <p className="text-xs text-text-secondary mt-1">
          Manage your device push alerts, email preferences, and install Lantern.
        </p>
      </div>

      <NotificationSettingsClient
        categories={categoryMatrix}
        subscriptions={subscriptions}
      />
    </div>
  )
}

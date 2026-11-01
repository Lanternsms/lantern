import 'server-only'
import type { NotificationTemplate } from './types'
import type { Category } from '@/lib/notifications/types'
import { signUnsubscribeToken } from './utils'

export interface TemplateContext {
  notificationId: string
  schoolName: string
  schoolId: string
  recipientId: string
  category: Category
  studentFirstName?: string | null
  appUrl?: string
}

/**
 * Extract child's FIRST name only.
 * Guaranteed never to return full names, nicknames, or other children.
 */
export function extractFirstName(name: string | null | undefined): string | null {
  if (!name) return null
  const cleaned = name.trim().split(/\s+/)[0]
  if (!cleaned) return null
  // Capitalize properly
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase()
}

/**
 * Base responsive HTML email wrapper with Lantern styling.
 */
function renderEmailHtml(params: {
  schoolName: string
  title: string
  lead: string
  actionUrl: string
  actionText: string
  manageUrl: string
  unsubUrl?: string | null
}): string {
  const { schoolName, title, lead, actionUrl, actionText, manageUrl, unsubUrl } = params

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8f9fb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2430; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8f9fb; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 24px 32px; background-color: #182350; text-align: left;">
              <span style="font-size: 18px; font-weight: 700; color: #ffffff; letter-spacing: -0.01em;">${escapeHtml(schoolName || 'Lantern')}</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #182350; line-height: 1.3;">${escapeHtml(title)}</h1>
              <p style="margin: 0 0 28px; font-size: 15px; line-height: 1.5; color: #4b5563;">${escapeHtml(lead)}</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #182350;">
                    <a href="${actionUrl}" style="display: inline-block; padding: 12px 24px; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">${escapeHtml(actionText)} &rarr;</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 28px 0 0; font-size: 12px; line-height: 1.5; color: #9ca3af;">
                For security and privacy, sensitive details (such as grades, amounts, or personal messages) are viewable only inside your verified account.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f8f9fb; border-top: 1px solid #e5e7eb; text-align: left; font-size: 12px; color: #6b7280; line-height: 1.6;">
              <a href="${manageUrl}" style="color: #182350; text-decoration: underline; font-weight: 500;">Manage notification preferences</a>
              ${unsubUrl ? `&nbsp;&bull;&nbsp;<a href="${unsubUrl}" style="color: #6b7280; text-decoration: underline;">Unsubscribe from this category</a>` : ''}
              <div style="margin-top: 8px; color: #9ca3af;">Sent by ${escapeHtml(schoolName || 'Lantern')} via Lantern School Management</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Render notification templates strictly adhering to privacy and lockscreen rules:
 * - child's FIRST name only
 * - NEVER include scores, grades, remarks, question or message text, amounts or fee breakdowns
 */
export function renderNotificationTemplate(
  type: string,
  ctx: TemplateContext
): NotificationTemplate {
  const normalizedType = type.replace(/\./g, '_')
  const baseUrl = (ctx.appUrl || process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')
  const actionUrl = `${baseUrl}/n/${ctx.notificationId}`
  const manageUrl = `${baseUrl}/dashboard/notifications/settings`

  let unsubUrl: string | null = null
  if (ctx.category !== 'account' && ctx.category !== 'system') {
    const token = signUnsubscribeToken({
      userId: ctx.recipientId,
      category: ctx.category,
      schoolId: ctx.schoolId,
    })
    unsubUrl = `${baseUrl}/unsubscribe?token=${token}`
  }

  const child = ctx.studentFirstName ? extractFirstName(ctx.studentFirstName) : null

  let pushTitle = 'Lantern Notification'
  let pushBody = 'You have a new update in your school portal.'
  let emailSubject = 'New notification from your school'
  let emailLead = 'You have a new notice available in your school portal.'
  const actionText = 'View in portal'

  switch (normalizedType) {
    // Attendance
    case 'attendance_marked':
      pushTitle = 'Attendance update'
      pushBody = child ? `${child} was marked today.` : 'Attendance was marked today.'
      emailSubject = child ? `Attendance update for ${child}` : 'Attendance update'
      emailLead = child
        ? `Attendance has been recorded for ${child}. Log in to view details and status.`
        : 'Daily attendance has been recorded for your student. Log in to view status.'
      break

    case 'lms_period_attendance_saved':
      pushTitle = 'Period attendance'
      pushBody = child ? `${child}'s period attendance was saved.` : 'Period attendance was saved.'
      emailSubject = child ? `Period attendance recorded for ${child}` : 'Period attendance recorded'
      emailLead = child
        ? `Attendance for a class period was recorded for ${child}. Check the portal for details.`
        : 'Class period attendance was recorded. Check the portal for details.'
      break

    // Results
    case 'results_published':
      pushTitle = 'Results published'
      pushBody = child ? `${child}'s results are now available.` : 'Academic results are now published.'
      emailSubject = child ? `Academic results published for ${child}` : 'Academic results published'
      emailLead = child
        ? `New academic results have been published for ${child}. Log in to view the verified report card.`
        : 'New academic results have been published. Log in to view the verified report.'
      break

    case 'batch_submitted_for_approval':
      pushTitle = 'Results awaiting approval'
      pushBody = 'A result batch has been submitted for your review.'
      emailSubject = 'Results batch awaiting approval'
      emailLead = 'A teacher has submitted an academic result batch for your review and approval.'
      break

    case 'batch_approved':
      pushTitle = 'Results approved'
      pushBody = 'A submitted result batch has been approved.'
      emailSubject = 'Results batch approved'
      emailLead = 'Your submitted academic result batch has been approved.'
      break

    case 'batch_rejected':
      pushTitle = 'Results rejected'
      pushBody = 'A submitted result batch was rejected.'
      emailSubject = 'Results batch rejected'
      emailLead = 'A submitted academic result batch was rejected. Please review the portal for next steps.'
      break

    case 'batch_returned':
      pushTitle = 'Results returned'
      pushBody = 'A result batch was returned for corrections.'
      emailSubject = 'Results batch returned'
      emailLead = 'A submitted academic result batch has been returned for adjustments.'
      break

    // Fees
    case 'payment_recorded':
    case 'fees_payment_received':
      pushTitle = 'Payment received'
      pushBody = child ? `A payment for ${child} was recorded.` : 'A fee payment was recorded.'
      emailSubject = child ? `Payment recorded for ${child}` : 'Payment recorded'
      emailLead = child
        ? `A school fee payment for ${child} has been recorded. Log in to view your receipt and balance.`
        : 'A fee payment has been recorded to your account. Log in to view your receipt.'
      break

    case 'fee_structure_changed':
    case 'fees_structure_changed':
      pushTitle = 'Fee schedule updated'
      pushBody = 'The school has published an updated fee structure.'
      emailSubject = 'School fee schedule update'
      emailLead = 'An updated fee schedule has been published for your school. Log in to review the details.'
      break

    // Account
    case 'role_assigned':
    case 'role_removed':
    case 'role_permission_granted':
    case 'role_permission_revoked':
      pushTitle = 'Account role updated'
      pushBody = 'Your portal permissions have been updated.'
      emailSubject = 'Your portal permissions were updated'
      emailLead = 'Your portal access permissions have been updated by a school administrator.'
      break

    case 'account_welcome':
      pushTitle = 'Welcome to Lantern'
      pushBody = 'Your portal account is active.'
      emailSubject = `Welcome to ${ctx.schoolName || 'Lantern'}`
      emailLead = `Your portal account for ${ctx.schoolName || 'your school'} is now active. Log in to access your dashboard.`
      break

    // Announcements
    case 'announcement_posted':
      pushTitle = 'School announcement'
      pushBody = 'A new announcement has been published.'
      emailSubject = 'New school announcement'
      emailLead = 'A new announcement has been published. Log in to read the full notice.'
      break

    // System
    case 'system_alert':
    case 'lms_orphan_storage_cleanup_failed':
      pushTitle = 'System notice'
      pushBody = 'A system notice requires your attention.'
      emailSubject = 'Lantern system notice'
      emailLead = 'An administrative system notice has been generated. Log in to check details.'
      break

    // Q&A
    case 'lms_question_asked':
      pushTitle = 'New lesson question'
      pushBody = 'A student posted a question in a lesson.'
      emailSubject = 'New student question posted'
      emailLead = 'A question has been posted in one of your lessons. Log in to view and reply.'
      break

    case 'lms_question_replied':
      pushTitle = 'Question answered'
      pushBody = 'A reply was posted to your question.'
      emailSubject = 'New reply on your lesson question'
      emailLead = 'A teacher or facilitator has posted a reply to your lesson question.'
      break

    case 'lms_thread_status_changed':
      pushTitle = 'Discussion updated'
      pushBody = 'A lesson discussion thread status was changed.'
      emailSubject = 'Lesson discussion status updated'
      emailLead = 'A discussion thread in your lesson has been updated.'
      break

    // LMS Learning
    case 'lms_lesson_status_changed':
    case 'lms_activity_status_changed':
    case 'lms_activity_updated':
    case 'lms_activity_brief_attached':
      pushTitle = 'Learning update'
      pushBody = 'New lesson activity posted.'
      emailSubject = 'Lesson activity update'
      emailLead = 'New learning activities have been posted in your class portal.'
      break

    case 'lms_submission_marked':
      pushTitle = 'Assignment reviewed'
      pushBody = child ? `${child}'s submission was reviewed.` : 'An assignment was reviewed.'
      emailSubject = child ? `Assignment reviewed for ${child}` : 'Assignment reviewed'
      emailLead = child
        ? `A learning activity submission for ${child} has been reviewed. Log in to see status.`
        : 'Your activity submission has been reviewed by your teacher.'
      break

    default:
      // Generic fallback
      pushTitle = ctx.schoolName || 'Lantern'
      pushBody = 'You have a new notice in your school portal.'
      emailSubject = `Notice from ${ctx.schoolName || 'your school'}`
      emailLead = 'A new notification is available in your account. Log in to view details.'
      break
  }

  const emailText = `${emailSubject}\n\n${emailLead}\n\nView details: ${actionUrl}\n\nManage notification preferences: ${manageUrl}${
    unsubUrl ? `\nUnsubscribe: ${unsubUrl}` : ''
  }`

  const emailHtml = renderEmailHtml({
    schoolName: ctx.schoolName,
    title: emailSubject,
    lead: emailLead,
    actionUrl,
    actionText,
    manageUrl,
    unsubUrl,
  })

  return {
    pushTitle,
    pushBody,
    emailSubject,
    emailText,
    emailHtml,
  }
}

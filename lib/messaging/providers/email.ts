import 'server-only'
import { Resend } from 'resend'
import { maskEmail, signUnsubscribeToken } from '../utils'
import type { Category } from '@/lib/notifications/types'

let resendInstance: Resend | null = null

function getResendClient(): Resend | null {
  if (resendInstance) return resendInstance
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  resendInstance = new Resend(apiKey)
  return resendInstance
}

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text: string
  category: Category
  recipientId: string
  schoolId: string
  deliveryId: string
}

export interface EmailSendResult {
  ok: boolean
  providerMessageId?: string
  retryable?: boolean
  error?: string
}

/**
 * Send an email via Resend with List-Unsubscribe headers and error categorization.
 */
export async function sendEmail(options: SendEmailOptions): Promise<EmailSendResult> {
  const { to, subject, html, text, category, recipientId, schoolId } = options
  const isLogMode = process.env.MESSAGING_MODE === 'log'
  const masked = maskEmail(to)

  if (isLogMode) {
    console.log(
      `[MESSAGING:LOG] Email to ${masked} (category: ${category}): "${subject}"`
    )
    return {
      ok: true,
      providerMessageId: `log_email_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    }
  }

  const resend = getResendClient()
  if (!resend) {
    return {
      ok: false,
      retryable: false,
      error: 'RESEND_API_KEY is not configured',
    }
  }

  const from = process.env.EMAIL_FROM || 'Lantern <notifications@example.com>'
  const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')

  const headers: Record<string, string> = {}

  // List-Unsubscribe for non-account and non-system categories
  if (category !== 'account' && category !== 'system') {
    const token = signUnsubscribeToken({
      userId: recipientId,
      category,
      schoolId,
    })
    const unsubUrl = `${appUrl}/unsubscribe?token=${token}`
    headers['List-Unsubscribe'] = `<${unsubUrl}>`
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      text,
      headers,
    })

    if (error) {
      const msg = error.message || 'Resend API returned an error'
      // Determine retryability based on error type/status
      const isRetryable =
        /rate limit|timeout|network|5\d\d|service unavailable|too many requests/i.test(msg)

      console.error(`[Email] Failed to send to ${masked}: ${msg}`)
      return {
        ok: false,
        retryable: isRetryable,
        error: msg,
      }
    }

    return {
      ok: true,
      providerMessageId: data?.id,
    }
  } catch (err: unknown) {
    const errorMsg = (err as Error)?.message || 'Unknown network error'
    const isRetryable =
      /timeout|network|econnrefused|fetch failed|socket|5\d\d|429/i.test(errorMsg)

    console.error(`[Email] Exception sending to ${masked}: ${errorMsg}`)
    return {
      ok: false,
      retryable: isRetryable,
      error: errorMsg,
    }
  }
}

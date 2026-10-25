'use client'

import { useState, useTransition } from 'react'
import {
  updateSchoolNotificationSettings,
  sendTestEmailToCaller,
} from './actions'
import {
  Mail,
  Bell,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  Send,
  Loader2,
  Check,
} from 'lucide-react'

export interface ChannelStats {
  sent: number
  failed: number
  skipped: number
  queued: number
}

export interface AdoptionStats {
  guardians: { subscribed: number; total: number }
  students: { subscribed: number; total: number }
  staff: { subscribed: number; total: number }
}

export interface RecentDeliveryItem {
  id: string
  channel: 'email' | 'push'
  status: string
  skip_reason: string | null
  error: string | null
  created_at: string
  masked_address: string
}

export function AdminNotificationSettingsClient({
  initialSettings,
  todayStats,
  adoption,
  recentDeliveries,
}: {
  initialSettings: { email_enabled: boolean; push_enabled: boolean }
  todayStats: { email: ChannelStats; push: ChannelStats }
  adoption: AdoptionStats
  recentDeliveries: RecentDeliveryItem[]
}) {
  const [emailEnabled, setEmailEnabled] = useState(initialSettings.email_enabled)
  const [pushEnabled, setPushEnabled] = useState(initialSettings.push_enabled)
  const [isSaving, startSaving] = useTransition()
  const [isTestingEmail, startTestingEmail] = useTransition()
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  function handleSaveSettings(newEmail: boolean, newPush: boolean) {
    setEmailEnabled(newEmail)
    setPushEnabled(newPush)
    startSaving(async () => {
      await updateSchoolNotificationSettings({
        email_enabled: newEmail,
        push_enabled: newPush,
      })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    })
  }

  function handleSendTestEmail() {
    setTestResult(null)
    startTestingEmail(async () => {
      const res = await sendTestEmailToCaller()
      if (res.error) {
        setTestResult(`Error: ${res.error}`)
      } else {
        setTestResult(`Test email dispatched successfully to ${res.email}`)
      }
    })
  }

  return (
    <div className="space-y-8">
      {/* 1. School-Wide Channels Toggle & Test */}
      <div className="bg-surface border border-border rounded-xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              School Notification Channels
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Enable or disable outbound notification channels for everyone in this school.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {saveSuccess && (
              <span className="text-xs font-medium text-success-text bg-success-bg px-2.5 py-1 rounded-md flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Saved
              </span>
            )}
            <button
              onClick={handleSendTestEmail}
              disabled={isTestingEmail || !emailEnabled}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-text-primary bg-surface-muted hover:bg-surface-muted/80 border border-border px-3.5 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {isTestingEmail ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Send test email to me
            </button>
          </div>
        </div>

        {testResult && (
          <div className="text-xs bg-surface-muted border border-border p-3 rounded-lg flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary shrink-0" />
            <span className="text-text-primary">{testResult}</span>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Email Channel Toggle */}
          <div className="border border-border rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  emailEnabled ? 'bg-primary/10 text-primary' : 'bg-surface-muted text-text-muted'
                }`}
              >
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">Email Delivery</p>
                <p className="text-xs text-text-secondary">
                  {emailEnabled ? 'Outbound transactional email active' : 'All outbound email suspended'}
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={emailEnabled}
                disabled={isSaving}
                onChange={(e) => handleSaveSettings(e.target.checked, pushEnabled)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          {/* Push Channel Toggle */}
          <div className="border border-border rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  pushEnabled ? 'bg-primary/10 text-primary' : 'bg-surface-muted text-text-muted'
                }`}
              >
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">Web Push Delivery</p>
                <p className="text-xs text-text-secondary">
                  {pushEnabled ? 'Browser & mobile web push active' : 'Web push alerts suspended'}
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={pushEnabled}
                disabled={isSaving}
                onChange={(e) => handleSaveSettings(emailEnabled, e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>
      </div>

      {/* 2. Today's Delivery Volume & Health */}
      <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Today&apos;s Deliveries</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Deliveries queued, sent, skipped, or failed today (UTC).
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Email Stats */}
          <div className="rounded-xl border border-border p-4 bg-surface-muted/30 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
              <Mail className="w-4 h-4 text-primary" />
              <span>Email Channel</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-surface p-2.5 rounded-lg border border-border">
                <p className="text-lg font-bold text-success-text">{todayStats.email.sent}</p>
                <p className="text-[11px] text-text-secondary">Sent</p>
              </div>
              <div className="bg-surface p-2.5 rounded-lg border border-border">
                <p className="text-lg font-bold text-text-muted">{todayStats.email.skipped}</p>
                <p className="text-[11px] text-text-secondary">Skipped</p>
              </div>
              <div className="bg-surface p-2.5 rounded-lg border border-border">
                <p className="text-lg font-bold text-danger-text">{todayStats.email.failed}</p>
                <p className="text-[11px] text-text-secondary">Failed</p>
              </div>
            </div>
          </div>

          {/* Push Stats */}
          <div className="rounded-xl border border-border p-4 bg-surface-muted/30 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
              <Bell className="w-4 h-4 text-primary" />
              <span>Push Channel</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-surface p-2.5 rounded-lg border border-border">
                <p className="text-lg font-bold text-success-text">{todayStats.push.sent}</p>
                <p className="text-[11px] text-text-secondary">Sent</p>
              </div>
              <div className="bg-surface p-2.5 rounded-lg border border-border">
                <p className="text-lg font-bold text-text-muted">{todayStats.push.skipped}</p>
                <p className="text-[11px] text-text-secondary">Skipped</p>
              </div>
              <div className="bg-surface p-2.5 rounded-lg border border-border">
                <p className="text-lg font-bold text-danger-text">{todayStats.push.failed}</p>
                <p className="text-[11px] text-text-secondary">Failed</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Push Adoption by Kind */}
      <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Push Notification Adoption</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Portal users who have registered at least one browser or phone device (counts only).
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="border border-border rounded-xl p-4 bg-surface space-y-1">
            <p className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Parents &amp; Guardians
            </p>
            <p className="text-2xl font-bold text-text-primary">
              {adoption.guardians.subscribed}{' '}
              <span className="text-xs font-normal text-text-muted">
                / {adoption.guardians.total} (
                {adoption.guardians.total > 0
                  ? Math.round((adoption.guardians.subscribed / adoption.guardians.total) * 100)
                  : 0}
                %)
              </span>
            </p>
          </div>

          <div className="border border-border rounded-xl p-4 bg-surface space-y-1">
            <p className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Students
            </p>
            <p className="text-2xl font-bold text-text-primary">
              {adoption.students.subscribed}{' '}
              <span className="text-xs font-normal text-text-muted">
                / {adoption.students.total} (
                {adoption.students.total > 0
                  ? Math.round((adoption.students.subscribed / adoption.students.total) * 100)
                  : 0}
                %)
              </span>
            </p>
          </div>

          <div className="border border-border rounded-xl p-4 bg-surface space-y-1">
            <p className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Staff Members
            </p>
            <p className="text-2xl font-bold text-text-primary">
              {adoption.staff.subscribed}{' '}
              <span className="text-xs font-normal text-text-muted">
                / {adoption.staff.total} (
                {adoption.staff.total > 0
                  ? Math.round((adoption.staff.subscribed / adoption.staff.total) * 100)
                  : 0}
                %)
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* 4. Last 20 Failed / Skipped Deliveries */}
      <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary">
            Recent Delivery Exceptions
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Last 20 skipped or failed delivery attempts and reasons.
          </p>
        </div>

        {recentDeliveries.length === 0 ? (
          <div className="text-center py-8 text-xs text-text-muted border border-dashed border-border rounded-xl">
            No failed or skipped deliveries recorded.
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-muted border-b border-border text-text-secondary font-medium">
                <tr>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Channel</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Reason / Details</th>
                  <th className="py-2.5 px-3">Recipient</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentDeliveries.map((d) => (
                  <tr key={d.id} className="hover:bg-surface-muted/30">
                    <td className="py-2.5 px-3 text-text-secondary whitespace-nowrap">
                      {new Date(d.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="capitalize font-medium text-text-primary">
                        {d.channel}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {d.status === 'failed' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-danger-text bg-danger-bg px-2 py-0.5 rounded-full font-medium">
                          <XCircle className="w-3 h-3" /> Failed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-text-muted bg-surface-muted px-2 py-0.5 rounded-full font-medium">
                          <AlertCircle className="w-3 h-3" /> Skipped
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-text-secondary max-w-xs truncate">
                      {d.skip_reason
                        ? `Reason: ${d.skip_reason.replace('_', ' ')}`
                        : d.error || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-text-muted">
                      {d.masked_address}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

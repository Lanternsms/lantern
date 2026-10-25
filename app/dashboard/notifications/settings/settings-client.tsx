'use client'

import { useState, useTransition } from 'react'
import { PwaInstallPrompt } from '@/components/pwa-install-prompt'
import { PushSettingsCard } from '@/components/push-settings-card'
import { savePreferences, type UserSubscriptionInfo } from '../actions'
import type { Category } from '@/lib/notifications/types'
import { Check, Lock, ShieldCheck } from 'lucide-react'

export interface CategoryPrefState {
  category: Category
  label: string
  description: string
  in_app: boolean
  in_app_locked?: boolean
  push: boolean | null // null = Default
  email: boolean | null // null = Default
  email_locked?: boolean
  push_default_label?: string
  email_default_label?: string
}

export function NotificationSettingsClient({
  categories,
  subscriptions,
}: {
  categories: CategoryPrefState[]
  subscriptions: UserSubscriptionInfo[]
}) {
  const [prefs, setPrefs] = useState<CategoryPrefState[]>(categories)
  const [isPending, startTransition] = useTransition()
  const [savedSuccess, setSavedSuccess] = useState(false)

  function handlePushChange(category: Category, value: string) {
    const pushVal = value === 'default' ? null : value === 'on'
    setPrefs((prev) =>
      prev.map((p) => (p.category === category ? { ...p, push: pushVal } : p))
    )
    setSavedSuccess(false)
  }

  function handleEmailChange(category: Category, value: string) {
    const emailVal = value === 'default' ? null : value === 'on'
    setPrefs((prev) =>
      prev.map((p) => (p.category === category ? { ...p, email: emailVal } : p))
    )
    setSavedSuccess(false)
  }

  function handleInAppToggle(category: Category) {
    setPrefs((prev) =>
      prev.map((p) =>
        p.category === category && !p.in_app_locked
          ? { ...p, in_app: !p.in_app }
          : p
      )
    )
    setSavedSuccess(false)
  }

  function handleSave() {
    startTransition(async () => {
      const updates = prefs.map((p) => ({
        category: p.category,
        email: p.email,
        push: p.push,
        in_app: p.in_app,
      }))
      await savePreferences(updates)
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 3000)
    })
  }

  return (
    <div className="space-y-8">
      {/* Cards at Top */}
      <div className="space-y-5">
        <PwaInstallPrompt variant="card" forceShow />
        <PushSettingsCard existingSubscriptions={subscriptions} />
      </div>

      {/* Category Notification Preferences Matrix */}
      <div className="bg-surface border border-border rounded-xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              Notification preferences
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Customize how and where you want to receive alerts for each category.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {savedSuccess && (
              <span className="text-xs font-medium text-success-text bg-success-bg px-2.5 py-1 rounded-md flex items-center gap-1 animate-fade-in">
                <Check className="w-3.5 h-3.5" /> Saved
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={isPending}
              className="text-xs font-semibold text-white bg-primary hover:bg-primary-hover px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {isPending ? 'Saving…' : 'Save preferences'}
            </button>
          </div>
        </div>

        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-muted border-b border-border text-text-secondary uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4 min-w-[200px]">Category</th>
                  <th className="py-3 px-4 text-center w-28">In-app</th>
                  <th className="py-3 px-4 text-center w-36">Push alerts</th>
                  <th className="py-3 px-4 text-center w-36">Email alerts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {prefs.map((row) => (
                  <tr key={row.category} className="hover:bg-surface-muted/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-text-primary capitalize">{row.label}</p>
                      <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">
                        {row.description}
                      </p>
                    </td>

                    {/* In-app */}
                    <td className="py-3.5 px-4 text-center">
                      {row.in_app_locked ? (
                        <div className="inline-flex items-center justify-center gap-1 text-[11px] text-text-muted bg-surface-muted px-2 py-1 rounded border border-border/50">
                          <Lock className="w-3 h-3" /> Mandatory
                        </div>
                      ) : (
                        <input
                          type="checkbox"
                          checked={row.in_app}
                          onChange={() => handleInAppToggle(row.category)}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                        />
                      )}
                    </td>

                    {/* Push alerts */}
                    <td className="py-3.5 px-4 text-center">
                      <select
                        value={row.push === null ? 'default' : row.push ? 'on' : 'off'}
                        onChange={(e) => handlePushChange(row.category, e.target.value)}
                        className="text-xs rounded-lg border border-border bg-surface px-2.5 py-1.5 text-text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                      >
                        <option value="default">
                          Default ({row.push_default_label || 'On'})
                        </option>
                        <option value="on">On</option>
                        <option value="off">Off</option>
                      </select>
                    </td>

                    {/* Email alerts */}
                    <td className="py-3.5 px-4 text-center">
                      {row.email_locked ? (
                        <div className="inline-flex items-center justify-center gap-1 text-[11px] text-text-muted bg-surface-muted px-2.5 py-1.5 rounded-lg border border-border/50">
                          <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Always on
                        </div>
                      ) : (
                        <select
                          value={row.email === null ? 'default' : row.email ? 'on' : 'off'}
                          onChange={(e) => handleEmailChange(row.category, e.target.value)}
                          className="text-xs rounded-lg border border-border bg-surface px-2.5 py-1.5 text-text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                        >
                          <option value="default">
                            Default ({row.email_default_label || 'On'})
                          </option>
                          <option value="on">On</option>
                          <option value="off">Off</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-[11px] text-text-muted">
          * Account security notifications are strictly required and cannot be disabled. When a channel is set to &quot;Default&quot;, system policy applies automatically.
        </p>
      </div>
    </div>
  )
}

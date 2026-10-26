/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getLmsAccess } from '@/lib/lms/access'
import { getAiSettings, updateAiSettings, getAiAuditLogs, flagAiMessage } from './actions'
import { AI_NAME } from '@/lib/ai/brand'
import { isAiConfigured } from '@/lib/ai/provider'
import { AiConnectionTester } from './connection-tester'

export const dynamic = 'force-dynamic'

function calculateCost(tokensIn: number, tokensOut: number): string {
  // Rough estimate for small models (~$0.15 / 1M in, $0.60 / 1M out)
  const costUsd = (tokensIn * 0.15 + tokensOut * 0.6) / 1_000_000
  if (costUsd < 0.0001) return '< $0.0001'
  return `$${costUsd.toFixed(4)}`
}

export default async function LmsAiAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ flagged?: string; lessonId?: string; page?: string; success?: string; error?: string }>
}) {
  const access = await getLmsAccess()
  if (!access.isManager) {
    redirect('/dashboard?error=' + encodeURIComponent('Not found'))
  }

  const { flagged, lessonId, page = '1', success, error } = await searchParams
  const flaggedOnly = flagged === 'true'
  const pageNum = Math.max(1, parseInt(page, 10))
  const limit = 30
  const offset = (pageNum - 1) * limit

  const [settings, auditData] = await Promise.all([
    getAiSettings(),
    getAiAuditLogs({
      flaggedOnly,
      lessonId,
      limit,
      offset,
    }),
  ])

  const configured = isAiConfigured()
  const currentProvider = process.env.AI_PROVIDER || 'gemini'
  const currentModel = process.env.AI_MODEL || (currentProvider === 'anthropic' ? 'claude-haiku-4-5' : 'gemini-3.5-flash-lite')

  async function handleToggleFlag(formData: FormData) {
    'use server'
    const msgId = formData.get('messageId') as string
    const currentFlag = formData.get('currentFlag') === 'true'
    await flagAiMessage(msgId, !currentFlag)
  }

  async function handleSaveSettings(formData: FormData) {
    'use server'
    const res = await updateAiSettings(formData)
    if (res?.error) {
      redirect('/dashboard/lms/ai?error=' + encodeURIComponent(res.error))
    } else {
      redirect('/dashboard/lms/ai?success=' + encodeURIComponent('AI settings saved successfully.'))
    }
  }

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto space-y-8">
      {/* ── Breadcrumb & Title ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-text-secondary mb-1">
            <Link href="/dashboard/lms" className="hover:text-text-primary transition-colors">
              LMS
            </Link>
            <span>/</span>
            <span className="text-text-primary font-medium">{AI_NAME} AI Tutor</span>
          </div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <span>✨ {AI_NAME} Settings & Audit Log</span>
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Configure school-wide AI limits, voice preferences, and audit student & classroom inquiries.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              settings.enabled && configured
                ? 'bg-success-bg text-success-text'
                : 'bg-surface-muted text-text-secondary'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                settings.enabled && configured ? 'bg-success' : 'bg-text-secondary'
              }`}
            />
            {settings.enabled && configured ? 'AI Tutor Active' : 'AI Tutor Inactive'}
          </span>
        </div>
      </div>

      {success && (
        <div className="rounded-xl border border-success/30 bg-success-bg p-4 text-xs text-success-text font-medium">
          {success}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/30 p-4 text-xs text-red-700 dark:text-red-300 font-medium">
          {error}
        </div>
      )}

      {/* ── System Status Banner ── */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div>
          <span className="text-text-secondary block">Provider & Model</span>
          <span className="font-semibold text-text-primary uppercase">
            {currentProvider} ({currentModel})
          </span>
        </div>
        <div>
          <span className="text-text-secondary block">Environment API Key</span>
          <span className={`font-semibold ${configured ? 'text-success-text' : 'text-danger-text'}`}>
            {configured ? 'Configured & Ready' : 'Missing API Key in .env'}
          </span>
        </div>
        <div>
          <span className="text-text-secondary block">Privacy / Training Policy</span>
          <span className="text-text-primary font-medium">
            Commercial API tier: Zero model training on prompts or lesson notes
          </span>
        </div>
      </div>

      {/* ── Test Connection ── */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Test AI Connection</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Sends a tiny probe to the configured provider and model. The API key is never shown.
          </p>
        </div>
        <AiConnectionTester />
      </div>

      {/* ── Settings Form ── */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-5">
        <h2 className="text-base font-semibold text-text-primary">School AI Configuration</h2>

        <form action={handleSaveSettings} className="space-y-6">
          <div className="space-y-4">
            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-border bg-background/50 hover:bg-background cursor-pointer transition-colors">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={settings.enabled}
                className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <div>
                <span className="text-sm font-semibold text-text-primary block">
                  Enable {AI_NAME} for School
                </span>
                <span className="text-xs text-text-secondary">
                  When enabled, teachers and students can interact with the tutor on lessons that have notes.
                </span>
              </div>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-border bg-background/50 hover:bg-background cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  name="voice_enabled"
                  defaultChecked={settings.voice_enabled}
                  className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <div>
                  <span className="text-sm font-semibold text-text-primary block">Voice Input</span>
                  <span className="text-xs text-text-secondary">
                    Allows students & teachers to speak questions in Nigerian English.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-border bg-background/50 hover:bg-background cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  name="read_aloud_enabled"
                  defaultChecked={settings.read_aloud_enabled}
                  className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <div>
                  <span className="text-sm font-semibold text-text-primary block">Read Aloud</span>
                  <span className="text-xs text-text-secondary">
                    Allows reading assistant answers out loud via text-to-speech.
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-4">
              Rate Limits & Safety Budget
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Daily Limit per Student
                </label>
                <input
                  type="number"
                  name="daily_limit_per_student"
                  min={1}
                  max={500}
                  defaultValue={settings.daily_limit_per_student}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="text-[10px] text-text-secondary mt-1 block">Default: 20 questions/day</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Daily Limit per Class / Lesson
                </label>
                <input
                  type="number"
                  name="daily_limit_per_class"
                  min={1}
                  max={2000}
                  defaultValue={settings.daily_limit_per_class}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="text-[10px] text-text-secondary mt-1 block">Default: 150 questions/day</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Monthly Limit per School
                </label>
                <input
                  type="number"
                  name="monthly_limit_school"
                  min={10}
                  max={100000}
                  defaultValue={settings.monthly_limit_school}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="text-[10px] text-text-secondary mt-1 block">Default: 3,000 questions/month</span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-primary text-white font-medium text-xs hover:bg-primary-hover shadow-sm transition-colors"
            >
              Save AI Settings
            </button>
          </div>
        </form>
      </div>

      {/* ── Audit Logs ── */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Inquiry Audit Log</h2>
            <p className="text-xs text-text-secondary">
              Review questions asked by students and teachers, groundedness badges, and token usage.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={flaggedOnly ? '/dashboard/lms/ai' : '/dashboard/lms/ai?flagged=true'}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                flaggedOnly
                  ? 'border-amber-400 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold'
                  : 'border-border text-text-secondary hover:text-text-primary'
              }`}
            >
              {flaggedOnly ? 'Showing Flagged Only ✕' : '🚩 View Flagged Only'}
            </Link>
          </div>
        </div>

        {auditData.logs.length === 0 ? (
          <div className="py-12 text-center text-xs text-text-secondary border border-dashed border-border rounded-xl">
            No inquiry records found.
          </div>
        ) : (
          <div className="overflow-x-auto border border-border rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-muted border-b border-border text-[11px] uppercase tracking-wider text-text-secondary">
                <tr>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Asker & Mode</th>
                  <th className="py-3 px-4">Lesson</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Content Preview</th>
                  <th className="py-3 px-4">Grounded</th>
                  <th className="py-3 px-4">Tokens / Cost</th>
                  <th className="py-3 px-4 text-right">Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {auditData.logs.map((log: any) => {
                  const isUser = log.role === 'user'
                  return (
                    <tr key={log.id} className="hover:bg-background/40 transition-colors">
                      <td className="py-3 px-4 text-text-secondary whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-text-primary block">
                          {log.asker ? `${log.asker.first_name} ${log.asker.last_name}` : 'Unknown'}
                        </span>
                        <span className="text-[10px] text-text-secondary uppercase">
                          {log.mode || 'student'}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-[150px] truncate">
                        <Link
                          href={`/dashboard/lms/${log.lesson_id}`}
                          className="hover:underline text-primary"
                        >
                          {log.lesson?.title || 'Lesson'}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                            isUser
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                          }`}
                        >
                          {log.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-text-primary" title={log.content}>
                        {log.content}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {!isUser && log.grounded !== null && (
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              log.grounded
                                ? 'bg-success-bg text-success-text'
                                : 'bg-red-500/10 text-red-600 dark:text-red-400'
                            }`}
                          >
                            {log.grounded ? '✓ Grounded' : '⚠ Ungrounded'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-text-secondary text-[11px]">
                        {!isUser && (
                          <>
                            <span>{log.tokens_in + log.tokens_out} tok</span>
                            <span className="block text-[10px] text-text-secondary/70">
                              {calculateCost(log.tokens_in || 0, log.tokens_out || 0)}
                            </span>
                          </>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <form action={handleToggleFlag}>
                          <input type="hidden" name="messageId" value={log.id} />
                          <input type="hidden" name="currentFlag" value={String(Boolean(log.flagged))} />
                          <button
                            type="submit"
                            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                              log.flagged
                                ? 'bg-red-500/10 text-red-600 font-bold hover:bg-red-500/20'
                                : 'text-text-secondary hover:text-text-primary'
                            }`}
                            title={log.flagged ? 'Click to unflag' : 'Click to flag for review'}
                          >
                            {log.flagged ? '🚩 Flagged' : '⚐ Flag'}
                          </button>
                        </form>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

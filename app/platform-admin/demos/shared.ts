export const DEMO_STATUSES = ['new', 'contacted', 'scheduled', 'demo_done', 'won', 'lost'] as const
export type DemoStatus = (typeof DEMO_STATUSES)[number]

export const STATUS_LABEL: Record<DemoStatus, string> = {
  new: 'New', contacted: 'Contacted', scheduled: 'Demo booked', demo_done: 'Demo done', won: 'Won', lost: 'Lost',
}
export const STATUS_TONE: Record<DemoStatus, string> = {
  new: 'bg-danger-bg text-danger-text',
  contacted: 'bg-warning-bg text-warning-text',
  scheduled: 'bg-school-soft text-school-ink',
  demo_done: 'bg-raised text-text-primary',
  won: 'bg-success-bg text-success-text',
  lost: 'bg-raised text-text-secondary',
}
/** What to do next for each stage, so the list reads as a to-do list. */
export const NEXT_STEP: Record<DemoStatus, string> = {
  new: 'Call them today',
  contacted: 'Book the demo',
  scheduled: 'Run the demo',
  demo_done: 'Follow up and close',
  won: 'Onboard the school',
  lost: '',
}

export type DemoRow = {
  id: string; created_at: string; name: string; school: string; role: string; phone: string; email: string | null
  students: string | null; preferred_time: string | null; notes: string | null; status: DemoStatus
  demo_at: string | null; admin_notes: string | null; lost_reason: string | null; onboarded_school_id: string | null
}

const FAQS = [
  {
    q: "How do I reset a student or staff member's password?",
    a: 'Go to the relevant Staff or Students list, open their profile, and use "Send password reset." They\'ll receive an email link to set a new password.',
  },
  {
    q: "How do I change my school's branding or logo?",
    a: 'Go to Settings → Branding & Theme. You can upload a logo, pick your colors, and preview changes before saving.',
  },
  {
    q: "Why can't I see a particular page or action?",
    a: "Access is controlled by roles and permissions. If you believe you should have access to something, contact your school's admin.",
  },
  {
    q: 'How do I publish results so parents can see them?',
    a: 'From the Results module, enter scores for a class and term, then use "Publish" on that result batch. Parents and students are notified once published.',
  },
  {
    q: 'What happens if I lose my internet connection while working?',
    a: "You'll see a banner letting you know you're offline. Unsaved changes won't be saved until your connection returns — avoid closing the tab until you're back online.",
  },
]

export default function HelpPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Help & Support</h1>
        <p className="text-sm text-text-secondary mt-1">Answers to common questions, and how to reach us if you&apos;re stuck.</p>
      </div>

      <div className="border border-border rounded-xl divide-y divide-border">
        {FAQS.map((item) => (
          <details key={item.q} className="px-4 py-3 group">
            <summary className="cursor-pointer list-none font-medium text-sm text-text-primary flex items-center justify-between">
              {item.q}
              <span className="text-text-secondary group-open:rotate-180 transition-transform">⌄</span>
            </summary>
            <p className="text-sm text-text-secondary mt-2">{item.a}</p>
          </details>
        ))}
      </div>

      <div className="border border-border rounded-xl p-5 space-y-2">
        <h2 className="text-sm font-semibold text-text-primary">Still need help?</h2>
        <p className="text-sm text-text-secondary">
          Reach out to your school&apos;s admin for account-specific issues, or contact Lantern support directly for anything else.
        </p>
        <a href="" className="inline-block text-sm font-medium text-primary hover:underline">
          [EMAIL_ADDRESS]
        </a>
      </div>

      <div className="flex items-center gap-4 text-xs text-text-secondary">
        <a href="/terms" target="_blank" className="hover:text-text-primary hover:underline">Terms of Service</a>
        <span>·</span>
        <a href="/privacy" target="_blank" className="hover:text-text-primary hover:underline">Privacy Policy</a>
      </div>
    </div>
  )
}
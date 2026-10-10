export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 space-y-8 text-text-primary">
      <div>
        <h1 className="text-2xl font-semibold">Terms of Service</h1>
        <p className="text-sm text-text-secondary mt-1">Last updated: [DATE]</p>
      </div>

      <section className="space-y-2">
        <p className="text-sm text-text-secondary">
          These Terms of Service ("Terms") govern access to and use of Lantern (the "Service"), operated by
          [Your Company Legal Name] ("Lantern," "we," "us"). By creating an account or using the Service, you agree
          to these Terms on behalf of yourself and, if applicable, the school or organization you represent.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">1. Who this applies to</h2>
        <p className="text-sm text-text-secondary">
          The Service is used by schools ("Schools") and the staff, students, and parents/guardians they invite
          ("Users"). A School's administrator accepts these Terms on behalf of their institution when onboarding.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">2. Accounts</h2>
        <p className="text-sm text-text-secondary">
          You are responsible for maintaining the confidentiality of your login credentials and for all activity
          under your account. Notify us immediately at [SUPPORT EMAIL] if you suspect unauthorized access.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">3. School data and ownership</h2>
        <p className="text-sm text-text-secondary">
          Each School retains ownership of the student, staff, and academic records it enters into the Service.
          We act as a data processor on the School's behalf for that data, and will only use it to provide and
          improve the Service, not for unrelated purposes.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">4. Acceptable use</h2>
        <p className="text-sm text-text-secondary">
          You agree not to misuse the Service — including attempting to access another School's data, disrupting
          the Service, or uploading unlawful or harmful content.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">5. Subscription and billing</h2>
        <p className="text-sm text-text-secondary">
          Paid plans are billed according to the plan and cycle agreed with your School at onboarding or renewal.
          Non-payment may result in restricted access after notice, as described in your billing status.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">6. Termination</h2>
        <p className="text-sm text-text-secondary">
          Either party may terminate access as agreed in the School's subscription terms. On termination, Schools
          may request an export of their data within [X] days before it is deleted from our systems.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">7. Disclaimers and limitation of liability</h2>
        <p className="text-sm text-text-secondary">
          The Service is provided "as is." To the extent permitted by law, [Your Company Legal Name] is not liable
          for indirect or consequential damages arising from use of the Service.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">8. Governing law</h2>
        <p className="text-sm text-text-secondary">
          These Terms are governed by the laws of [Jurisdiction, e.g. the Federal Republic of Nigeria].
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">9. Contact</h2>
        <p className="text-sm text-text-secondary">
          Questions about these Terms can be sent to [SUPPORT EMAIL].
        </p>
      </section>
    </div>
  )
}
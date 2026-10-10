export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 space-y-8 text-text-primary">
      <div>
        <h1 className="text-2xl font-semibold">Privacy Policy</h1>
        <p className="text-sm text-text-secondary mt-1">Last updated: [DATE]</p>
      </div>

      <section className="space-y-2">
        <p className="text-sm text-text-secondary">
          This Privacy Policy explains how [Your Company Legal Name] ("Lantern," "we," "us") collects, uses, and
          protects personal data through the Lantern school management platform (the "Service"), in line with the
          Nigeria Data Protection Act 2023 ("NDPA") and applicable data protection law.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">1. What we collect</h2>
        <p className="text-sm text-text-secondary">
          Account data (name, email, role); student academic records (attendance, results, fees) entered by your
          School; and technical data (device, browser, log data) needed to operate the Service securely.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">2. Children's data</h2>
        <p className="text-sm text-text-secondary">
          Student records may include data belonging to minors. This data is entered and controlled by the School,
          which acts as data controller; Lantern processes it solely on the School's instructions to provide the
          Service, and does not use it for advertising or sell it to third parties.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">3. How we use data</h2>
        <p className="text-sm text-text-secondary">
          To provide the Service (dashboards, results, attendance, fees, notifications), to maintain security and
          an audit trail of account activity, and to communicate service-related updates.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">4. Who we share it with</h2>
        <p className="text-sm text-text-secondary">
          We do not sell personal data. Limited data is shared with infrastructure providers (e.g. hosting,
          database, email delivery) strictly to operate the Service, under confidentiality obligations.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">5. Data retention</h2>
        <p className="text-sm text-text-secondary">
          We retain School data for as long as the School's subscription is active, and for [X] days afterward to
          allow data export, unless a longer period is required by law.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">6. Security</h2>
        <p className="text-sm text-text-secondary">
          We use industry-standard safeguards — encrypted connections, access controls scoped per school, and an
          internal audit log of administrative actions — to protect data against unauthorized access.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">7. Your rights</h2>
        <p className="text-sm text-text-secondary">
          Subject to applicable law, you may request access to, correction of, or deletion of your personal data
          by contacting your School's administrator, or us directly at [SUPPORT EMAIL].
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">8. Changes to this policy</h2>
        <p className="text-sm text-text-secondary">
          We may update this policy from time to time. Material changes will be communicated to School
          administrators.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">9. Contact</h2>
        <p className="text-sm text-text-secondary">
          Questions or data protection requests can be sent to [SUPPORT EMAIL] / [DPO CONTACT, if applicable].
        </p>
      </section>
    </div>
  )
}
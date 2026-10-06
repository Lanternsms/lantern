import Link from 'next/link'
import {
  CalendarRange, Layers, BookMarked, Building2, GraduationCap,
  ClipboardList, SlidersHorizontal, CalendarCheck, ListPlus, GitBranch,
} from 'lucide-react'

export default function AcademicsPage() {
  const sections = [
    { href: '/dashboard/academics/sessions', icon: CalendarRange, title: 'Sessions & Terms', description: 'Manage academic sessions and terms, and set the current one.' },
    { href: '/dashboard/academics/classes', icon: Layers, title: 'Classes & Arms', description: 'Manage your school\'s classes and their arms.' },
    { href: '/dashboard/academics/subjects', icon: BookMarked, title: 'Subjects', description: 'Manage subjects and assign them to classes.' },
    { href: '/dashboard/academics/departments', icon: Building2, title: 'Departments', description: 'Manage departments used to organize classes and staff.' },
    { href: '/dashboard/academics/grading', icon: GraduationCap, title: 'Grading Scales', description: 'Define how scores map to grades, and set your default scale.' },
    { href: '/dashboard/academics/assessments', icon: ClipboardList, title: 'Assessment Types', description: 'Define CA/exam types and their weight toward the final score.' },
    { href: '/dashboard/academics/results-config', icon: SlidersHorizontal, title: 'Result Rules', description: 'Control ranking behavior and who can see it.' },
    { href: '/dashboard/academics/workflow', icon: GitBranch, title: 'Approval Workflow', description: 'Define who reviews and approves results before they are published.' },
    { href: '/dashboard/academics/attendance-statuses', icon: CalendarCheck, title: 'Attendance Categories', description: 'Define attendance status options beyond Present/Absent.' },
    { href: '/dashboard/academics/custom-fields', icon: ListPlus, title: 'Custom Fields', description: 'Add extra fields to student, staff, or guardian records.' },
  ]

  return (
    <div className="px-8 py-8">
      <h1 className="text-xl font-semibold text-text-primary mb-1">Academics</h1>
      <p className="text-sm text-text-secondary mb-6">Configure your school&apos;s academic structure.</p>

      <div className="grid grid-cols-3 gap-4">
        {sections.map((s) => (
          <Link
            key={s.title}
            href={s.href}
            className="bg-surface border border-border rounded-xl p-5 hover:border-primary/40 transition-colors"
          >
            <s.icon size={20} className="text-primary mb-3" />
            <h3 className="text-sm font-medium text-text-primary mb-1">{s.title}</h3>
            <p className="text-xs text-text-secondary">{s.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
import {
  Building03Icon, Calendar02Icon, CalendarCheckIn01Icon, ClipboardIcon, GitBranchIcon, Layers01Icon,
  Mortarboard01Icon, SlidersHorizontalIcon, TaskAdd01Icon, Bookmark01Icon,
} from '@hugeicons/core-free-icons'
import { HubGrid, PageHeader, PageShell } from '@/components/ui/page'

export default function AcademicsPage() {
  return (
    <PageShell>
      <PageHeader title="Classes and subjects" subtitle="How your school’s year, classes and results are set up." />
      <HubGrid
        items={[
          { href: '/dashboard/academics/sessions', icon: Calendar02Icon, title: 'Sessions and terms', description: 'Your academic sessions and terms, and which one is current.' },
          { href: '/dashboard/academics/classes', icon: Layers01Icon, title: 'Classes and arms', description: 'JSS 1 to SS 3 and their arms, with form teachers.' },
          { href: '/dashboard/academics/subjects', icon: Bookmark01Icon, title: 'Subjects', description: 'Subjects, and which classes take them.' },
          { href: '/dashboard/academics/departments', icon: Building03Icon, title: 'Departments', description: 'Groups of subjects and the staff who teach them.' },
          { href: '/dashboard/academics/grading', icon: Mortarboard01Icon, title: 'Grading scale', description: 'How totals become grades, A1 to F9.' },
          { href: '/dashboard/academics/assessments', icon: ClipboardIcon, title: 'Assessments', description: 'CA and exam types and how much each one counts.' },
          { href: '/dashboard/academics/results-config', icon: SlidersHorizontalIcon, title: 'Result rules', description: 'Positions in class and who can see them.' },
          { href: '/dashboard/academics/workflow', icon: GitBranchIcon, title: 'Approval steps', description: 'Who checks and approves results before guardians see them.' },
          { href: '/dashboard/academics/attendance-statuses', icon: CalendarCheckIn01Icon, title: 'Attendance statuses', description: 'Status options beyond present and absent.' },
          { href: '/dashboard/academics/custom-fields', icon: TaskAdd01Icon, title: 'Custom fields', description: 'Extra details to keep on students, staff or guardians.' },
        ]}
      />
    </PageShell>
  )
}

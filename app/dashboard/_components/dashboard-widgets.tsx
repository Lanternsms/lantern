import type { NavGate } from '@/lib/permissions'
import { FeesWidget } from './widgets/fees-widget'
import { AttendanceWidget } from './widgets/attendance-widget'
import { ResultsWidget } from './widgets/results-widget'
import { StudentsWidget } from './widgets/students-widget'
import { StaffWidget } from './widgets/staff-widget'
import { UsersWidget } from './widgets/users-widget'
import { AcademicStructureWidget } from './widgets/academic-structure-widget'
import { TimetableWidget } from './widgets/timetable-widget'
import { RolesWidget } from './widgets/roles-widget'
import { TeacherWidget } from './widgets/teacher-widget'
import { FormTeacherWidget } from './widgets/form-teacher-widget'
import { StudentWidget } from './widgets/student-widget'
import { ApprovalsWidget } from './widgets/approvals-widget'

export type DashboardWidget = {
  key: string
  gate: NavGate
  span?: 1 | 2
  Component: () => Promise<React.JSX.Element | null>
}

export const DASHBOARD_WIDGETS: DashboardWidget[] = [
  { key: 'teacher', gate: { scope: 'teacher' }, span: 2, Component: TeacherWidget },
  { key: 'formTeacher', gate: { scope: 'formTeacher' }, span: 1, Component: FormTeacherWidget },
  { key: 'student', gate: { scope: 'student' }, span: 2, Component: StudentWidget },
  { key: 'approvals', gate: { scope: 'approver' }, span: 1, Component: ApprovalsWidget },
  { key: 'fees', gate: { permission: 'fees.manage' }, span: 1, Component: FeesWidget },
  { key: 'attendance', gate: { permission: ['attendance.manage', 'attendance.view_all'] }, span: 1, Component: AttendanceWidget },
  { key: 'results', gate: { permission: 'results.view_all' }, span: 1, Component: ResultsWidget },
  { key: 'students', gate: { permission: 'students.view_all' }, span: 1, Component: StudentsWidget },
  { key: 'staff', gate: { permission: 'staff.view_all' }, span: 1, Component: StaffWidget },
  { key: 'users', gate: { permission: ['users.invite', 'users.edit', 'users.view_all'] }, span: 1, Component: UsersWidget },
  { key: 'academic_structure', gate: { permission: 'academic_structure.manage' }, span: 1, Component: AcademicStructureWidget },
  { key: 'timetable', gate: { permission: 'timetable.manage' }, span: 1, Component: TimetableWidget },
  { key: 'roles', gate: { permission: 'roles.manage' }, span: 1, Component: RolesWidget },
]
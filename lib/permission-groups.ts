export const PERMISSION_GROUPS: { label: string; prefixes: string[] }[] = [
  { label: 'Platform & School Administration', prefixes: ['school.', 'settings.', 'roles.', 'billing.'] },
  { label: 'Users & Staff', prefixes: ['users.', 'staff.'] },
  { label: 'Academic Structure & Grading', prefixes: ['academic_structure.', 'grading.', 'workflow.'] },
  { label: 'Students', prefixes: ['students.'] },
  { label: 'Results', prefixes: ['results.'] },
  { label: 'Attendance', prefixes: ['attendance.'] },
  { label: 'Timetable', prefixes: ['timetable.'] },
  { label: 'Announcements', prefixes: ['announcements.'] },
  { label: 'Documents & Fees', prefixes: ['documents.', 'fees.'] },
  { label: 'Notifications & Audit', prefixes: ['notifications.', 'audit.'] },
  { label: 'Records', prefixes: ['records.'] },
]

export function groupPermissions<T extends { code: string }>(permissions: T[]) {
  return PERMISSION_GROUPS.map((group) => ({
    label: group.label,
    permissions: permissions.filter((p) => group.prefixes.some((prefix) => p.code.startsWith(prefix))),
  })).filter((g) => g.permissions.length > 0)
}
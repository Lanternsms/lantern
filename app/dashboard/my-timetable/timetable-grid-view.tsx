const DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
]

export type TimetableRow = {
  day_of_week: number
  period_id: string
  subject_name: string
  teacher_name?: string | null
  class_name?: string | null
  arm_name?: string | null
}

export default function TimetableGridView({
  periods,
  rows,
  mode,
}: {
  periods: { id: string; name: string; start_time: string; end_time: string; is_break: boolean }[]
  rows: TimetableRow[]
  mode: 'teacher' | 'student'
}) {
  function cellFor(day: number, periodId: string) {
    return rows.find((r) => r.day_of_week === day && r.period_id === periodId)
  }

  if (periods.length === 0) {
    return <p className="text-sm text-text-secondary">No timetable has been set up yet.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="text-left text-xs text-text-secondary p-2 border border-border">Period</th>
            {DAYS.map((d) => (
              <th key={d.value} className="text-left text-xs text-text-secondary p-2 border border-border">
                {d.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((p) =>
            p.is_break ? (
              <tr key={p.id} className="bg-background">
                <td colSpan={DAYS.length + 1} className="text-center text-xs text-text-secondary p-2 border border-border">
                  {p.name} ({p.start_time}–{p.end_time})
                </td>
              </tr>
            ) : (
              <tr key={p.id}>
                <td className="p-2 border border-border text-xs text-text-secondary">
                  {p.name}
                  <div className="text-[10px]">{p.start_time}–{p.end_time}</div>
                </td>
                {DAYS.map((d) => {
                  const cell = cellFor(d.value, p.id)
                  return (
                    <td key={d.value} className="p-2 border border-border align-top">
                      {cell ? (
                        <div>
                          <div className="text-xs font-medium text-text-primary">{cell.subject_name}</div>
                          {mode === 'teacher' && cell.class_name && (
                            <div className="text-[10px] text-text-secondary">
                              {cell.class_name} {cell.arm_name}
                            </div>
                          )}
                          {mode === 'student' && cell.teacher_name && (
                            <div className="text-[10px] text-text-secondary">{cell.teacher_name}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-text-secondary">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  )
}
import MarkingGrid from '@/app/dashboard/attendance/marking-grid'
import { DashboardShell } from '@/components/dashboard-shell'
export default function P() {
  const nav = [['Today','/dashboard'],['Registers','/dashboard/attendance'],['Gradebook','/dashboard/gradebook'],['My timetable','/dashboard/my-timetable'],['Announcements','/dashboard/announcements']].map(([label,href])=>({label,href}))
  const names=['Abdullahi Sani','Blessing Udo','Chinedu Okeke','Damilola Ajayi','Esther Danjuma','Femi Lawal','Grace Nwosu','Hauwa Bello']
  return <DashboardShell firstName="Tunde" lastName="Bello" schoolName="Greenfield College" logoUrl={null} navItems={nav}>
    <div className="px-4 pt-5"><MarkingGrid classId="c" date="2026-11-02" statuses={[{id:'p',label:'Present'},{id:'l',label:'Late'},{id:'a',label:'Absent'}]}
      students={names.map((n,i)=>({id:String(i),first_name:n.split(' ')[0],last_name:n.split(' ')[1],admission_no:'GFC/24/0'+(10+i),arm_id:null}))}
      existingMarks={[]} teachableSubjects={[]} /></div>
  </DashboardShell>
}

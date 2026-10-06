import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AnnouncementForm from '../../announcement-form'
import { updateAnnouncement } from '../../actions'

export const dynamic = 'force-dynamic'

export default async function EditAnnouncementPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: announcement } = await supabase
    .from('announcements')
    .select('id, title, body, audience')
    .eq('id', id)
    .single()

  if (!announcement) notFound()

  async function handleSubmit(formData: FormData) {
    'use server'
    return updateAnnouncement(id, formData)
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold text-text-primary">Edit Announcement</h1>
      <AnnouncementForm
        initial={{ title: announcement.title, body: announcement.body, audience: announcement.audience }}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
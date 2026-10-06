'use client'

import AnnouncementForm from '../announcement-form'
import { createAnnouncement } from '../actions'

export default function NewAnnouncementPage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold text-text-primary">New Announcement</h1>
      <AnnouncementForm onSubmit={createAnnouncement} />
    </div>
  )
}
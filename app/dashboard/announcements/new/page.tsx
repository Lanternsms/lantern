'use client'

import AnnouncementForm from '../announcement-form'
import { createAnnouncement } from '../actions'

export default function NewAnnouncementPage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="font-display text-[28px] font-semibold leading-tight text-text-primary sm:text-[32px]">New Announcement</h1>
      <AnnouncementForm onSubmit={createAnnouncement} />
    </div>
  )
}
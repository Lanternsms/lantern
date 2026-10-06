import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import DownloadButton from './download-button'
import ViewButton from './view-button'
import DeleteButton from './delete-button'

export const dynamic = 'force-dynamic'

type DocumentItem = {
  id: string
  title: string
  description: string | null
  file_type: string
  file_size: number
  audience: string[]
  class_id: string | null
  arm_id: string | null
  created_by: string
  created_at: string
  author: { first_name: string; last_name: string } | null
  classes: { name: string } | null
  arms: { name: string } | null
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: documents } = await supabase
    .from('documents')
    .select(
      'id, title, description, file_type, file_size, audience, class_id, arm_id, created_by, created_at, author:profiles(first_name, last_name), classes(name), arms(name)'
    )
    .order('created_at', { ascending: false })

  const { data: canUpload } = await supabase.rpc('has_permission', { perm_code: 'documents.manage' })
  const { data: canManageAll } = await supabase.rpc('has_permission', { perm_code: 'documents.manage_all' })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary">Documents & Downloads</h1>
        {canUpload && (
          <Link href="/dashboard/documents/new" className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium">
            Upload Document
          </Link>
        )}
      </div>

      {(!documents || documents.length === 0) && (
        <p className="text-sm text-text-secondary">No documents have been shared yet.</p>
      )}

      <div className="space-y-3">
        {((documents as unknown as DocumentItem[]) ?? []).map((d: DocumentItem) => {
          const canManage = d.created_by === user.id || canManageAll
          return (
            <div key={d.id} className="bg-surface border border-border rounded-xl p-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">{d.title}</h2>
                {d.description && <p className="text-sm text-text-secondary mt-1">{d.description}</p>}
                <p className="text-xs text-text-secondary mt-1">
                  {d.author?.first_name} {d.author?.last_name} · {new Date(d.created_at).toLocaleDateString()} ·{' '}
                  {formatSize(d.file_size)} 
                  {d.classes?.name && ` · ${d.classes.name}${d.arms?.name ? ' ' + d.arms.name : ''}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <ViewButton documentId={d.id} />
                <DownloadButton documentId={d.id} />
                {canManage && <DeleteButton id={d.id} />}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
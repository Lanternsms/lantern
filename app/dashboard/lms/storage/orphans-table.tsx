'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteOrphans } from './actions'
import { formatFileSize } from '../video-inspect'

export type OrphanObject = {
  bucket_id: string
  name: string
  bytes: number
  created_at: string
}

interface OrphansTableProps {
  orphans: OrphanObject[]
}

export function OrphansTable({ orphans }: OrphansTableProps) {
  const router = useRouter()
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [dialogMode, setDialogMode] = useState<'selected' | 'all' | null>(null)
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const toggleSelect = (name: string) => {
    setSelectedNames((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedNames.size === orphans.length) {
      setSelectedNames(new Set())
    } else {
      setSelectedNames(new Set(orphans.map((o) => o.name)))
    }
  }

  const handleDeleteConfirmed = () => {
    const toDelete =
      dialogMode === 'all'
        ? orphans.map((o) => o.name)
        : Array.from(selectedNames)

    setDialogMode(null)
    setResultMessage(null)

    startTransition(async () => {
      const res = await deleteOrphans(toDelete)
      if (res.ok) {
        setResultMessage({
          type: 'success',
          text: `Successfully deleted ${res.deletedCount} orphaned file(s).`,
        })
        setSelectedNames(new Set())
        router.refresh()
      } else {
        setResultMessage({
          type: 'error',
          text: res.error || `Deleted ${res.deletedCount} file(s), failed to delete ${res.failedCount}.`,
        })
        router.refresh()
      }
    })
  }

  const shortenName = (path: string) => {
    const parts = path.split('/')
    return parts.length > 1 ? parts[parts.length - 1] : path
  }

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-text-secondary">
          {orphans.length > 0 ? (
            <span>
              <strong className="text-text-primary">{selectedNames.size}</strong> of{' '}
              <strong className="text-text-primary">{orphans.length}</strong> selected
            </span>
          ) : (
            <span>No orphaned files found</span>
          )}
        </div>

        {orphans.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={selectedNames.size === 0 || isPending}
              onClick={() => setDialogMode('selected')}
              className="text-xs px-3.5 py-2 rounded-lg border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Delete selected ({selectedNames.size})
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setDialogMode('all')}
              className="text-xs px-3.5 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium transition-colors disabled:opacity-40"
            >
              Delete all ({orphans.length})
            </button>
          </div>
        )}
      </div>

      {resultMessage && (
        <div
          className={`p-3 rounded-lg text-xs font-medium border ${
            resultMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {resultMessage.text}
        </div>
      )}

      {/* Table */}
      <div className="border border-border rounded-xl overflow-hidden bg-surface">
        {orphans.length === 0 ? (
          <div className="py-12 px-4 text-center space-y-1">
            <p className="text-sm font-medium text-text-primary">No orphaned files</p>
            <p className="text-xs text-text-muted">
              All storage objects in your school are linked to active lessons or assignments.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface-muted/50 border-b border-border text-text-secondary">
                <tr>
                  <th className="w-10 px-4 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={selectedNames.size === orphans.length && orphans.length > 0}
                      onChange={toggleSelectAll}
                      disabled={isPending}
                      className="rounded border-border text-primary focus:ring-primary/20"
                    />
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium">Bucket</th>
                  <th className="text-left px-4 py-2.5 font-medium">File name</th>
                  <th className="text-left px-4 py-2.5 font-medium">Size</th>
                  <th className="text-left px-4 py-2.5 font-medium">Created date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orphans.map((item) => {
                  const isSelected = selectedNames.has(item.name)
                  const short = shortenName(item.name)
                  return (
                    <tr
                      key={`${item.bucket_id}/${item.name}`}
                      className={`hover:bg-surface-muted/20 transition-colors ${
                        isSelected ? 'bg-primary/5' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(item.name)}
                          disabled={isPending}
                          className="rounded border-border text-primary focus:ring-primary/20"
                        />
                      </td>
                      <td className="px-4 py-2.5 font-mono text-text-secondary whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-surface-muted border border-border">
                          {item.bucket_id}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-text-primary whitespace-nowrap" title={item.name}>
                        {short}
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary whitespace-nowrap">
                        {formatFileSize(item.bytes)}
                      </td>
                      <td className="px-4 py-2.5 text-text-muted whitespace-nowrap">
                        {new Date(item.created_at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Dialog Modal */}
      {dialogMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">
                  {dialogMode === 'all'
                    ? `Delete all ${orphans.length} orphaned files?`
                    : `Delete ${selectedNames.size} selected file(s)?`}
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  This action is permanent and cannot be undone.
                </p>
              </div>
            </div>

            <p className="text-xs text-text-muted">
              These files are no longer attached to any active lesson or assignment in your school. Deleting them will free up storage immediately.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setDialogMode(null)}
                disabled={isPending}
                className="text-xs px-4 py-2 rounded-lg border border-border text-text-secondary hover:bg-surface-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirmed}
                disabled={isPending}
                className="text-xs px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 font-semibold transition-colors disabled:opacity-50"
              >
                {isPending ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

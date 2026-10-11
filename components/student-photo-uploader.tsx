'use client'

import { useState, useRef, ChangeEvent, DragEvent } from 'react'
import { Camera, UploadCloud, X, RefreshCw } from 'lucide-react'

const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function StudentPhotoUploader({
  initialPhotoUrl,
}: {
  initialPhotoUrl?: string | null
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialPhotoUrl ?? null)
  const [isRemoved, setIsRemoved] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    setError(null)

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Please upload a JPG, PNG, or WebP image.')
      return
    }

    if (file.size > MAX_SIZE_BYTES) {
      setError('Photo size must be under 5MB.')
      return
    }

    setFileName(file.name)
    setIsRemoved(false)
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      handleFile(file)
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      if (fileInputRef.current) {
        const dataTransfer = new DataTransfer()
        dataTransfer.items.add(file)
        fileInputRef.current.files = dataTransfer.files
      }
      handleFile(file)
    }
  }

  function handleRemove() {
    setIsRemoved(true)
    setPreviewUrl(null)
    setFileName(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function handleChooseClick() {
    fileInputRef.current?.click()
  }

  const showPreview = previewUrl && !isRemoved

  return (
    <div className="mb-5">
      <label className="block text-sm text-text-secondary mb-2">Student Photo</label>

      <input
        ref={fileInputRef}
        type="file"
        id="student-photo-input"
        name="photo"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleInputChange}
      />

      {isRemoved && (
        <input type="hidden" name="remove_photo" value="true" />
      )}

      {showPreview ? (
        <div className="border border-border rounded-xl p-4 bg-surface flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 rounded-full overflow-hidden border border-border shadow-xs bg-surface-muted shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Student preview"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">
                {fileName ?? 'Current photo'}
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                {fileName ? 'Ready to upload on save' : 'Stored profile photo'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleChooseClick}
              className="inline-flex items-center gap-1.5 text-xs text-text-primary border border-border rounded-lg px-3 py-1.5 hover:bg-surface-muted transition-colors"
            >
              <RefreshCw size={14} />
              Change
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="inline-flex items-center gap-1.5 text-xs text-danger-text border border-red-200 bg-danger-bg/40 rounded-lg px-3 py-1.5 hover:bg-danger-bg transition-colors"
            >
              <X size={14} />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleChooseClick}
          className={`border-2 border-dashed rounded-xl py-7 px-4 flex flex-col items-center gap-2 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-surface-muted/30'
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-surface-muted flex items-center justify-center text-text-muted">
            <Camera size={20} />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">Upload a clear profile photo</p>
            <p className="text-xs text-text-muted mt-0.5">
              Click to browse or drag and drop · JPG, PNG, WebP up to 5MB
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleChooseClick()
            }}
            className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-lg px-3.5 py-1.5 transition-colors"
          >
            <UploadCloud size={14} />
            Choose photo
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-danger-text mt-2">{error}</p>
      )}
    </div>
  )
}

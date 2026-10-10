'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type ResultItem = { id: string; title: string; subtitle?: string; href: string }
type SearchResults = { students: ResultItem[]; staff: ResultItem[]; guardians: ResultItem[]; classes: ResultItem[] }

const EMPTY: SearchResults = { students: [], staff: [], guardians: [], classes: [] }
const SECTIONS: { key: keyof SearchResults; label: string }[] = [
  { key: 'students', label: 'Students' },
  { key: 'staff', label: 'Staff' },
  { key: 'guardians', label: 'Guardians' },
  { key: 'classes', label: 'Classes' },
]

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const flatResults = SECTIONS.flatMap((section) =>
    results[section.key].map((item) => ({ ...item, section: section.label }))
  )

  const close = useCallback(() => {
    setIsOpen(false)
    setQuery('')
    setResults(EMPTY)
    setActiveIndex(0)
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsOpen((v) => !v)
      } else if (e.key === 'Escape') {
        close()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [close])

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 0)
  }, [isOpen])

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(EMPTY)
      return
    }
    setLoading(true)
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        const data = await res.json()
        setResults(data)
        setActiveIndex(0)
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(timeout)
  }, [query])

  function go(item: ResultItem) {
    close()
    router.push(item.href)
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = flatResults[activeIndex]
      if (item) go(item)
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 text-sm text-text-secondary border border-border rounded-lg px-3 py-1.5 hover:border-text-secondary transition-colors"
      >
        <span>Search…</span>
        <span className="text-xs border border-border rounded px-1.5 py-0.5">⌘K</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center pt-24 px-4" onClick={close}>
          <div
            className="w-full max-w-lg bg-surface rounded-xl border border-border shadow-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Search students, staff, guardians, classes…"
              className="w-full px-4 py-3 text-sm text-text-primary bg-surface border-b border-border focus:outline-none"
            />

            <div className="max-h-80 overflow-y-auto">
              {loading && <p className="px-4 py-3 text-xs text-text-secondary">Searching…</p>}

              {!loading && query.trim().length >= 2 && flatResults.length === 0 && (
                <p className="px-4 py-3 text-xs text-text-secondary">No results for &quot;{query}&quot;.</p>
              )}

              {!loading &&
                SECTIONS.map((section) => {
                  const items = results[section.key]
                  if (items.length === 0) return null
                  return (
                    <div key={section.key} className="py-1">
                      <p className="px-4 pt-2 pb-1 text-[11px] font-semibold text-text-secondary uppercase tracking-wide">
                        {section.label}
                      </p>
                      {items.map((item) => {
                        const flatIndex = flatResults.findIndex((f) => f.id === item.id && f.href === item.href)
                        const isActive = flatIndex === activeIndex
                        return (
                          <button
                            key={item.href}
                            onClick={() => go(item)}
                            onMouseEnter={() => setActiveIndex(flatIndex)}
                            className={`w-full text-left px-4 py-2 flex items-center justify-between gap-3 ${
                              isActive ? 'bg-surface-muted' : ''
                            }`}
                          >
                            <span className="text-sm text-text-primary">{item.title}</span>
                            {item.subtitle && <span className="text-xs text-text-secondary">{item.subtitle}</span>}
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
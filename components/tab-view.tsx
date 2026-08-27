'use client'

import { useState, ReactNode } from 'react'

export function TabView({
  tabs,
}: {
  tabs: { id: string; label: string; content: ReactNode }[]
}) {
  const [active, setActive] = useState(tabs[0]?.id)

  return (
    <div>
      <div className="flex gap-6 border-b border-border mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              active === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.find((t) => t.id === active)?.content}
    </div>
  )
}
'use client'

import { useEffect, useState } from 'react'
import { Download, Share, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function PwaInstallPrompt({
  forceShow = false,
  variant = 'banner',
}: {
  forceShow?: boolean
  variant?: 'banner' | 'card'
}) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(true)
  const [isIOS, setIsIOS] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    // Check if already in standalone / installed mode
    const standaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((window.navigator as unknown as { standalone?: boolean }).standalone)
    setIsStandalone(standaloneMode)

    // Check iOS Safari
    const ua = window.navigator.userAgent.toLowerCase()
    const isAppleDevice = /iphone|ipad|ipod/.test(ua)
    const isSafari = ua.includes('safari') && !ua.includes('crios') && !ua.includes('fxios')
    setIsIOS(isAppleDevice && isSafari)

    // Check local storage dismissal
    if (!forceShow) {
      try {
        const stored = localStorage.getItem('lantern_pwa_dismissed')
        if (stored === 'true') {
          setDismissed(true)
        }
      } catch {
        // Ignore localStorage error
      }
    }

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [forceShow])

  if (!mounted) return null
  if (isStandalone && !forceShow) return null
  if (dismissed && !forceShow) return null
  if (!deferredPrompt && !isIOS && !forceShow) return null

  function handleDismiss() {
    setDismissed(true)
    try {
      localStorage.setItem('lantern_pwa_dismissed', 'true')
    } catch {
      // Ignore localStorage error
    }
  }

  async function handleInstallClick() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
      setIsStandalone(true)
    }
  }

  if (variant === 'card') {
    if (isStandalone) {
      return (
        <div className="bg-surface border border-border rounded-xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success-bg flex items-center justify-center text-success-text">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">App installed</p>
              <p className="text-xs text-text-secondary">Lantern is installed and running in standalone mode on this device.</p>
            </div>
          </div>
          <span className="text-xs font-medium text-success-text bg-success-bg px-2.5 py-1 rounded-full">
            Active
          </span>
        </div>
      )
    }

    return (
      <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">Install Lantern App</p>
              <p className="text-xs text-text-secondary">
                Install Lantern on your device for instant launch, offline support, and faster alerts.
              </p>
            </div>
          </div>
        </div>

        {deferredPrompt && (
          <button
            onClick={handleInstallClick}
            className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-primary hover:bg-primary-hover px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Install Lantern
          </button>
        )}

        {isIOS && !deferredPrompt && (
          <div className="rounded-lg bg-surface-muted border border-border p-3 text-xs text-text-secondary space-y-1.5">
            <p className="font-medium text-text-primary flex items-center gap-1.5">
              <Share className="w-3.5 h-3.5 text-primary" /> Install on iPhone or iPad:
            </p>
            <p>1. Tap the <strong className="text-text-primary">Share</strong> button in Safari toolbar.</p>
            <p>2. Scroll down and tap <strong className="text-text-primary">Add to Home Screen</strong>.</p>
          </div>
        )}
      </div>
    )
  }

  // Banner variant
  return (
    <div className="relative mb-6 rounded-xl border border-border bg-surface p-4 shadow-sm">
      <button
        onClick={handleDismiss}
        aria-label="Dismiss install banner"
        className="absolute top-3 right-3 text-text-muted hover:text-text-primary p-1 rounded-md transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3.5 pr-8">
        <div className="w-10 h-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          <Download className="w-5 h-5" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-text-primary">Install Lantern on your device</p>
          <p className="text-xs text-text-secondary">
            Get instant access from your home screen with quick navigation and real-time alerts.
          </p>

          {deferredPrompt && (
            <div className="pt-1 flex items-center gap-2">
              <button
                onClick={handleInstallClick}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary-hover px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Install Lantern
              </button>
              <button
                onClick={handleDismiss}
                className="text-xs text-text-secondary hover:text-text-primary px-2 py-1.5 transition-colors"
              >
                Not now
              </button>
            </div>
          )}

          {isIOS && !deferredPrompt && (
            <div className="mt-2 rounded-lg bg-surface-muted border border-border p-2.5 text-xs text-text-secondary space-y-1">
              <p className="font-medium text-text-primary flex items-center gap-1.5">
                <Share className="w-3.5 h-3.5 text-primary" /> How to install on iOS:
              </p>
              <p>Tap <strong className="text-text-primary">Share</strong> in Safari, then select <strong className="text-text-primary">Add to Home Screen</strong>.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

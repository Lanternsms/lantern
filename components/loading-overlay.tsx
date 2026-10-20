'use client'

import Image from 'next/image'

export function LoadingOverlay({ message = 'Please wait…' }: { message?: string }) {
  return (
    <div
      role="status"
      aria-label={message}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm"
    >
      <div className="relative flex items-center justify-center">
        {/* Outer spinning ring */}
        <span className="absolute inline-block h-24 w-24 rounded-full border-4 border-transparent border-t-primary border-r-primary animate-[lantern-spin_1s_linear_infinite]" />
        {/* Inner pulsing ring */}
        <span className="absolute inline-block h-16 w-16 rounded-full border-2 border-primary/30 animate-[lantern-pulse_1.5s_ease-in-out_infinite]" />
        {/* Logo */}
        <div className="relative z-10 flex items-center justify-center h-12 w-12">
          <Image
            src="/favicon.png"
            alt="Lantern"
            width={48}
            height={48}
            className="object-contain animate-[lantern-breathe_1.5s_ease-in-out_infinite]"
            priority
          />
        </div>
      </div>
      <p className="mt-6 text-sm font-medium text-text-secondary tracking-wide animate-[lantern-fade_1.5s_ease-in-out_infinite]">
        {message}
      </p>
    </div>
  )
}

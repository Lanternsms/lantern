'use client'

import { useState, forwardRef } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  wrapperClassName?: string
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  {
    className,
    wrapperClassName,
    id = 'password',
    name = 'password',
    placeholder = 'Your password',
    ...props
  },
  ref
) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className={`relative ${wrapperClassName ?? ''}`.trim()}>
      <input
        ref={ref}
        id={id}
        name={name}
        type={isVisible ? 'text' : 'password'}
        placeholder={placeholder}
        className={`h-11 w-full rounded-lg border border-control bg-white px-3 pr-11 text-[15px] text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 ${className ?? ''}`.trim()}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setIsVisible(!isVisible)}
        aria-label={isVisible ? 'Hide password' : 'Show password'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors cursor-pointer flex items-center justify-center p-0.5 focus:outline-none"
      >
        {isVisible ? (
          <Eye size={18} aria-hidden="true" />
        ) : (
          <EyeOff size={18} aria-hidden="true" />
        )}
      </button>
    </div>
  )
})
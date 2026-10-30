import { HugeiconsIcon } from '@hugeicons/react'
import type { IconSvgElement } from '@hugeicons/react'

/** One icon system for the whole app: Hugeicons, 1.8 stroke, decorative unless labelled. */
export function Icon({
  icon,
  size = 18,
  strokeWidth = 1.8,
  className,
  label,
}: {
  icon: IconSvgElement
  size?: number
  strokeWidth?: number
  className?: string
  label?: string
}) {
  return (
    <HugeiconsIcon
      icon={icon}
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    />
  )
}

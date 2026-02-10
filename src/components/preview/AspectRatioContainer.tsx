import type { ReactNode } from 'react'
import type { AspectRatio } from '../../types/common'
import { ASPECT_RATIO_VALUES } from '../../types/common'

interface AspectRatioContainerProps {
  ratio: AspectRatio
  children: ReactNode
  className?: string
}

export function AspectRatioContainer({ ratio, children, className = '' }: AspectRatioContainerProps) {
  const value = ASPECT_RATIO_VALUES[ratio]

  return (
    <div className={`relative w-full flex items-center justify-center ${className}`}>
      <div
        className="relative bg-black rounded-lg overflow-hidden w-full max-w-[300px]"
        style={{ aspectRatio: String(value) }}
      >
        {children}
      </div>
    </div>
  )
}

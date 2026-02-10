import { useEffect, useRef, type ReactNode } from 'react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef(0)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dy = e.changedTouches[0].clientY - startYRef.current
    if (dy > 100) onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        ref={sheetRef}
        className="relative bg-slate-800 rounded-t-2xl max-h-[80vh] flex flex-col animate-slide-up"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle */}
        <div className="flex justify-center py-3">
          <div className="w-10 h-1 rounded-full bg-slate-600" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 text-sm active:text-slate-200"
          >
            Done
          </button>
        </div>
        {/* Content */}
        <div className="px-4 pb-6 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          {children}
        </div>
      </div>
    </div>
  )
}

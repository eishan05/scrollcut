import { useMediaStore } from '../../stores/media-store'

export function ImportProgress() {
  const isImporting = useMediaStore((s) => s.isImporting)
  const progress = useMediaStore((s) => s.importProgress)

  if (!isImporting) return null

  return (
    <div className="px-4 py-2">
      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
        <span>Importing...</span>
        <span>{Math.round(progress * 100)}%</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-300"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  )
}

interface DownloadProgressProps {
  downloaded: number
  total: number
  label: string
}

export function DownloadProgress({ downloaded, total, label }: DownloadProgressProps) {
  const pct = total > 0 ? (downloaded / total) * 100 : 0

  return (
    <div className="py-2">
      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
        <span>{label}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-purple-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
